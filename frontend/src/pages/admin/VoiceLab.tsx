import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../services/api';
import { pro } from '../../styles/pro-theme';
import { PageHeader, Card, SectionHead, GhostBtn, Pill } from '../../components/pro/ProBlocks';
import VapiLiveCall from '../../components/client/VapiLiveCall';
import { RefreshCw, Activity } from '../../components/icons';

/**
 * Le banc d'essai des réceptionnistes.
 *
 * Il répond à une gêne précise: régler une voix demandait de poser une variable
 * sur Render, d'attendre un redéploiement, puis de se souvenir de ce qu'on avait
 * entendu un quart d'heure plus tôt. On ne compare pas deux moteurs comme ça,
 * on compare deux souvenirs.
 *
 * Trois colonnes, et l'ordre est celui du geste: on règle à GAUCHE, on appelle
 * au MILIEU, on lit ce que ça a fait à DROITE. Le moniteur est à droite et pas
 * en dessous parce qu'il se lit PENDANT l'appel, pas après: c'est là qu'on voit
 * l'agent prendre un rendez-vous au mauvais moment.
 *
 * Ce qui n'est pas ici, délibérément: aucun bouton « appliquer à la
 * production ». Un banc d'essai qui écrit dans les réglages d'un client
 * transforme chaque expérience en incident. Ce qu'on retient d'un essai se
 * repose ensuite dans l'écran du client, ou dans une variable d'environnement.
 */

type Provider = '11labs' | 'cartesia';
type Engine = 'auto' | 'classic' | 'realtime';

interface Knob {
  key: string; label: string; min: number; max: number; step: number; help: string;
}
interface LabVoice {
  voiceId: string; name: string; gender: string | null; accent: string | null;
  description: string | null; cloned: boolean; provider?: 'cartesia';
}
interface LabEvent {
  at: string; kind: 'tool' | 'call'; name: string;
  mode: 'real' | 'simulated'; wouldHave: string; args?: Record<string, unknown>;
}
interface Options {
  clients: Array<{ id: string; businessName: string; agentLanguage: string | null }>;
  characters: Array<{ id: string; name: string; gender: string }>;
  voices: { '11labs': LabVoice[]; cartesia: LabVoice[]; errors: Record<string, string | null> };
  defaults: Record<string, number | string>;
  knobs: Knob[];
  models: { tts: string[]; cartesia: string[]; realtime: string[]; llm: string[] };
}

const label = { color: pro.textSec, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase' as const };

function Field({ title, children, help }: { title: string; children: React.ReactNode; help?: string }) {
  return (
    <div className="mb-4">
      <div style={label} className="mb-1.5 font-semibold">{title}</div>
      {children}
      {help && <p className="mt-1 text-[11px] leading-snug" style={{ color: pro.textTer }}>{help}</p>}
    </div>
  );
}

const selectStyle = {
  background: pro.panelHi,
  border: `1px solid ${pro.border}`,
  color: pro.text,
};

export default function VoiceLab() {
  const [opts, setOpts] = useState<Options | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [clientId, setClientId] = useState('');
  const [characterId, setCharacterId] = useState('');
  const [engine, setEngine] = useState<Engine>('classic');
  const [provider, setProvider] = useState<Provider>('cartesia');
  const [voiceId, setVoiceId] = useState('');
  const [models, setModels] = useState<Record<string, string>>({});
  const [tuning, setTuning] = useState<Record<string, number>>({});

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [resolved, setResolved] = useState<Record<string, string> | null>(null);
  const [events, setEvents] = useState<LabEvent[]>([]);
  const [callError, setCallError] = useState<string | null>(null);
  const seenRef = useRef(0);

  useEffect(() => {
    api.get('/admin/lab/options')
      .then(({ data }) => {
        setOpts(data);
        if (data.clients?.[0]) setClientId(data.clients[0].id);
        const d = data.defaults || {};
        setTuning(Object.fromEntries(
          (data.knobs || []).map((k: Knob) => [k.key, Number(d[k.key] ?? k.min)]),
        ));
        setModels({
          ttsModel: String(d.ttsModel || ''),
          cartesiaModel: String(d.cartesiaModel || ''),
          realtimeModel: String(d.realtimeModel || ''),
          llmModel: String(d.llmModel || ''),
        });
      })
      .catch(e => setErr(e?.response?.data?.error || 'Chargement impossible.'));
  }, []);

  /* Le corps posté au serveur. Mémoïsé sur ses parties: `VapiLiveCall` redemande
     sa configuration quand ce corps change, donc un objet recréé à chaque rendu
     relancerait une requête en boucle. */
  const body = useMemo(() => ({
    clientId,
    characterId: characterId || undefined,
    voiceMode: engine,
    ttsProvider: provider,
    voiceId: voiceId || undefined,
    voiceProvider: provider === 'cartesia' ? 'cartesia' : undefined,
    tuning: { ...tuning, ...models },
  }), [clientId, characterId, engine, provider, voiceId, tuning, models]);

  /* Le moniteur interroge, il n'écoute pas: un flux SSE à travers Render se
     coupe en silence et l'écran resterait vide sans rien dire. Deux secondes
     suffisent à suivre un appel, et l'interrogation s'arrête avec la session. */
  const poll = useCallback(async (id: string) => {
    try {
      const { data } = await api.get(`/admin/lab/session/${id}`);
      if (Array.isArray(data?.events) && data.events.length !== seenRef.current) {
        seenRef.current = data.events.length;
        setEvents(data.events);
      }
    } catch { /* une interrogation ratée ne casse pas l'essai en cours */ }
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    const timer = setInterval(() => void poll(sessionId), 2000);
    return () => clearInterval(timer);
  }, [sessionId, poll]);

  if (err) return <div className="p-6 text-[13px]" style={{ color: pro.bad }}>{err}</div>;
  if (!opts) return <div className="p-6 text-[13px]" style={{ color: pro.textSec }}>Chargement…</div>;

  const voices = opts.voices[provider] || [];
  const voiceError = opts.voices.errors?.[provider];

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        title="Banc d'essai"
        subtitle="Régler, appeler, voir ce que ça aurait fait. Rien n'est enregistré sur le client."
        badge="admin"
      />

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr_360px] gap-4 mt-4">

        {/* ── Les réglages ── */}
        <Card>
          <SectionHead title="Réglages" />
          <div className="p-4 pt-0">
            <Field title="Client de référence" help="Son profil, ses horaires, ses services. Rien n'y sera modifié.">
              <select value={clientId} onChange={e => setClientId(e.target.value)}
                className="w-full h-9 px-3 text-[13px] rounded-lg" style={selectStyle}>
                {opts.clients.map(c => <option key={c.id} value={c.id}>{c.businessName}</option>)}
              </select>
            </Field>

            <Field title="Moteur">
              <div className="flex gap-1.5">
                {(['classic', 'realtime', 'auto'] as const).map(m => (
                  <button key={m} type="button" onClick={() => setEngine(m)}
                    className="flex-1 h-9 text-[12px] rounded-lg transition-colors"
                    style={{
                      background: engine === m ? pro.accentDim : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${engine === m ? pro.accentBrd : pro.border}`,
                      color: engine === m ? pro.text : pro.textSec,
                    }}>
                    {m === 'classic' ? 'Classique' : m === 'realtime' ? 'Direct' : 'Auto'}
                  </button>
                ))}
              </div>
            </Field>

            {engine !== 'realtime' && (
              <>
                <Field title="Synthèse">
                  <div className="flex gap-1.5">
                    {(['cartesia', '11labs'] as const).map(p => (
                      <button key={p} type="button" onClick={() => { setProvider(p); setVoiceId(''); }}
                        className="flex-1 h-9 text-[12px] rounded-lg transition-colors"
                        style={{
                          background: provider === p ? pro.accentDim : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${provider === p ? pro.accentBrd : pro.border}`,
                          color: provider === p ? pro.text : pro.textSec,
                        }}>
                        {p === 'cartesia' ? 'Cartesia' : 'ElevenLabs'}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field title="Voix" help={voiceError ? `Catalogue indisponible : ${voiceError}` : undefined}>
                  <select value={voiceId} onChange={e => setVoiceId(e.target.value)}
                    className="w-full h-9 px-3 text-[13px] rounded-lg" style={selectStyle}>
                    <option value="">Voix du personnage</option>
                    {voices.map(v => (
                      <option key={v.voiceId} value={v.voiceId}>
                        {v.name}{v.cloned ? ' (clone)' : ''}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}

            <Field title="Personnage">
              <select value={characterId} onChange={e => setCharacterId(e.target.value)}
                className="w-full h-9 px-3 text-[13px] rounded-lg" style={selectStyle}>
                <option value="">Celui du client</option>
                {opts.characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>

            {/* Les modèles: liste proposée, champ libre. Un fournisseur qui sort
                un modèle ne doit pas demander un déploiement pour être essayé,
                c'est exactement ce que ce banc existe pour éviter. */}
            {([
              ['llmModel', 'Modèle de langage', opts.models.llm],
              ...(engine === 'realtime'
                ? [['realtimeModel', 'Modèle temps réel', opts.models.realtime] as const]
                : [[provider === 'cartesia' ? 'cartesiaModel' : 'ttsModel', 'Modèle de voix',
                    provider === 'cartesia' ? opts.models.cartesia : opts.models.tts] as const]),
            ] as Array<readonly [string, string, string[]]>).map(([key, title, list]) => (
              <Field key={key} title={title}>
                <input list={`l-${key}`} value={models[key] ?? ''}
                  onChange={e => setModels(m => ({ ...m, [key]: e.target.value }))}
                  className="w-full h-9 px-3 text-[13px] rounded-lg" style={selectStyle} />
                <datalist id={`l-${key}`}>{list.map(v => <option key={v} value={v} />)}</datalist>
              </Field>
            ))}
          </div>
        </Card>

        {/* ── L'appel ── */}
        <div className="flex flex-col gap-4">
          <Card>
            <SectionHead title="Appel d'essai" action={
              <GhostBtn size="sm" onClick={() => { setEvents([]); seenRef.current = 0; }}>
                <RefreshCw size={13} /> Vider le moniteur
              </GhostBtn>
            } />
            <div className="p-4 pt-0">
              <VapiLiveCall
                endpoint="/admin/lab/session"
                body={body}
                isFr
                variant="card"
                onError={setCallError}
                onConfig={(c: any) => {
                  // La session change à chaque appel: c'est ce qui sépare deux
                  // essais dans le moniteur au lieu de les empiler.
                  if (c?.sessionId && c.sessionId !== sessionId) {
                    seenRef.current = 0;
                    setEvents([]);
                    setSessionId(c.sessionId);
                  }
                  if (c?.resolved) setResolved(c.resolved);
                }}
              />
              {callError && (
                <p className="mt-3 text-[12px] leading-snug" style={{ color: pro.bad }}>{callError}</p>
              )}
            </div>
          </Card>

          {/* Ce qui SERT réellement, par opposition à ce qui a été demandé. Le
              réglage et le moteur retenu divergent dès qu'une voix clonée entre
              en jeu, et ne pas le dire fait juger le mauvais moteur. */}
          {resolved && (
            <Card>
              <SectionHead title="Ce qui sert réellement" />
              <div className="p-4 pt-0 grid grid-cols-2 gap-3">
                {Object.entries(resolved).map(([k, v]) => (
                  <div key={k}>
                    <div style={label} className="font-semibold mb-0.5">{k}</div>
                    <div className="text-[12.5px] truncate" style={{ color: pro.text }}>{String(v)}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <SectionHead title="Curseurs" />
            <div className="p-4 pt-0">
              {opts.knobs.map(k => (
                <div key={k.key} className="mb-3.5">
                  <div className="flex items-baseline justify-between mb-1">
                    <span style={label} className="font-semibold">{k.label}</span>
                    <span className="text-[12px] tabular-nums" style={{ color: pro.text }}>
                      {tuning[k.key] ?? k.min}
                    </span>
                  </div>
                  <input type="range" min={k.min} max={k.max} step={k.step}
                    value={tuning[k.key] ?? k.min}
                    onChange={e => setTuning(t => ({ ...t, [k.key]: Number(e.target.value) }))}
                    className="w-full" style={{ accentColor: pro.accent }} />
                  <p className="mt-0.5 text-[11px] leading-snug" style={{ color: pro.textTer }}>{k.help}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ── Le moniteur ── */}
        <Card>
          <SectionHead title="Moniteur" action={<Pill color={sessionId ? 'ok' : 'neutral'}>
            {sessionId ? 'session ouverte' : 'en attente'}
          </Pill>} />
          <div className="p-4 pt-0">
            <p className="text-[11.5px] leading-relaxed mb-3" style={{ color: pro.textTer }}>
              Ce que l'agent fait, et ce que ça aurait déclenché sur un vrai appel.
              Les lectures s'exécutent pour de bon, les écritures et les envois sont décrits sans avoir lieu.
            </p>

            {events.length === 0 && (
              <div className="flex items-center gap-2 text-[12px] py-6 justify-center" style={{ color: pro.textTer }}>
                <Activity size={14} /> Rien pour l'instant.
              </div>
            )}

            <div className="flex flex-col gap-2">
              {events.map((e, i) => (
                <div key={`${e.at}-${i}`} className="rounded-lg p-2.5"
                  style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${pro.border}` }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[12.5px] font-semibold" style={{ color: pro.text }}>{e.name}</span>
                    <Pill color={e.mode === 'simulated' ? 'warn' : 'info'}>
                      {e.mode === 'simulated' ? 'simulé' : 'réel'}
                    </Pill>
                    <span className="ml-auto text-[10.5px] tabular-nums" style={{ color: pro.textTer }}>
                      {new Date(e.at).toLocaleTimeString('fr-FR')}
                    </span>
                  </div>
                  <p className="text-[11.5px] leading-snug" style={{ color: pro.textSec }}>{e.wouldHave}</p>
                  {e.args && Object.keys(e.args).length > 0 && (
                    <pre className="mt-1.5 text-[10.5px] overflow-x-auto" style={{ color: pro.textTer }}>
                      {JSON.stringify(e.args)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
