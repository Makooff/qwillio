import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../services/api';
import { pro } from '../../styles/pro-theme';
import SlideSheet from '../ui/SlideSheet';
import { Mail, MessageSquare, Send, Loader2 } from '../icons';

/**
 * Écrire à un prospect sans quitter la fiche : un mail ou un SMS, à partir
 * d'un modèle, vers le contact de la fiche ou vers une adresse saisie.
 *
 * L'aperçu vient du SERVEUR, pas d'un rendu recopié ici : ce qui s'affiche est
 * ce qui partira, au caractère près. Un second moteur de rendu côté écran
 * finirait par montrer un message que personne ne reçoit.
 */

export type OutreachChannel = 'email' | 'sms';

export interface OutreachTarget {
  id: string;
  businessName: string;
  email?: string;
  phone?: string;
  city?: string;
}

interface Field { key: string; label: string; placeholder?: string; required?: boolean; long?: boolean }
interface Template {
  id: string; channel: OutreachChannel; label: string; when: string; fields: Field[]; needsVideo?: boolean;
}
interface Sender { prenom: string; nom: string; telephone: string; lienVideo: string }

interface Preview {
  ok: boolean;
  error?: string;
  field?: string;
  rendered?:
    | { channel: 'email'; subject: string; html: string }
    | { channel: 'sms'; body: string; segments: number };
  recipient?: { to: string | null; problem: string | null; consentRequired: boolean; kind?: 'generic' | 'personal' };
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** `null` : envoi libre, vers une adresse ou un numéro saisi. */
  target: OutreachTarget | null;
  channel: OutreachChannel;
  onSent: (info: { prospectId: string | null; channel: OutreachChannel; to: string }) => void;
  onError: (message: string) => void;
}

const SENDER_KEY = 'qwillio.outreach.sender';
const EMPTY_SENDER: Sender = { prenom: '', nom: '', telephone: '', lienVideo: '' };

/** Le stockage du navigateur peut manquer (fenêtre privée) : l'écran doit marcher sans. */
function loadSender(): Sender {
  try {
    const raw = window.localStorage.getItem(SENDER_KEY);
    return raw ? { ...EMPTY_SENDER, ...JSON.parse(raw) } : EMPTY_SENDER;
  } catch {
    return EMPTY_SENDER;
  }
}
function saveSender(sender: Sender) {
  try { window.localStorage.setItem(SENDER_KEY, JSON.stringify(sender)); } catch { /* sans stockage, on redemandera */ }
}

/** Ce que le serveur refuse, dit comme une chose à faire. */
function explain(code: string | null | undefined, field?: string, detail?: string): string {
  switch (code) {
    case 'missing_recipient': return 'Indiquez un destinataire.';
    case 'invalid_email': return "Cette adresse n'est pas valide.";
    case 'invalid_phone': return "Ce numéro n'est pas lisible. Écrivez-le avec l'indicatif, par exemple +32 470 12 34 56.";
    case 'opted_out': return 'Ce contact a demandé à ne plus être sollicité. Rien ne part.';
    case 'bounced': return 'Cette adresse a déjà rejeté un mail. Vérifiez-la avant de réessayer.';
    case 'consent_required': return "Cochez l'accord du destinataire avant d'envoyer.";
    case 'missing_field': return 'Il manque une information dans le message.';
    case 'missing_sender': return field === 'telephone' ? 'Ajoutez votre téléphone dans « Vous ».' : 'Ajoutez votre prénom dans « Vous ».';
    case 'missing_video': return 'Ajoutez le lien de votre vidéo (en https) dans « Vous ».';
    case 'sms_unavailable': return `L'envoi de SMS n'est pas configuré sur le serveur${detail ? ` (${detail})` : ''}.`;
    case 'send_failed': return detail ? `L'envoi a échoué : ${detail}` : "L'envoi a échoué. Rien n'est parti.";
    case 'unknown_prospect': return "Cette fiche n'existe plus.";
    default: return "L'envoi n'a pas pu se faire.";
  }
}

const inputStyle = { background: 'rgba(255,255,255,0.04)', border: `1px solid ${pro.border}`, color: pro.text } as const;
const inputCls = 'w-full h-10 px-3 rounded-xl text-[13.5px] outline-none transition-colors focus:border-white/30';
const labelCls = 'block text-[11.5px] mb-1.5';

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return <label htmlFor={htmlFor} className={labelCls} style={{ color: pro.textSec }}>{children}</label>;
}

export default function OutreachSheet({ open, onClose, target, channel: initialChannel, onSent, onError }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [smsMissing, setSmsMissing] = useState<string[]>([]);
  const [channel, setChannel] = useState<OutreachChannel>(initialChannel);
  const [templateId, setTemplateId] = useState('');
  const [to, setTo] = useState('');
  const [vars, setVars] = useState<Record<string, string>>({});
  const [sender, setSender] = useState<Sender>(EMPTY_SENDER);
  const [senderOpen, setSenderOpen] = useState(false);
  const [accord, setAccord] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const requestId = useRef(0);
  /* `onError` est une fonction recréée à chaque rendu du parent : la lire par
     une référence évite qu'un chargement en échec se relance en boucle. */
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Le catalogue ne change pas pendant la session : une lecture suffit.
  const failed = useRef(false);
  useEffect(() => {
    if (!open) { failed.current = false; return; }
    if (templates.length || failed.current) return;
    api.get('/prospects/outreach/templates')
      .then(({ data }) => {
        setTemplates(Array.isArray(data?.templates) ? data.templates : []);
        setSmsMissing(data?.sms?.ok === false ? data.sms.missing ?? [] : []);
      })
      .catch(() => { if (!failed.current) { failed.current = true; onErrorRef.current('Les modèles de message n’ont pas pu être chargés.'); } });
  }, [open, templates.length]);

  // Chaque ouverture repart de la fiche : rien ne reste du prospect précédent.
  useEffect(() => {
    if (!open) return;
    const saved = loadSender();
    setChannel(initialChannel);
    setTo(initialChannel === 'email' ? target?.email ?? '' : target?.phone ?? '');
    setVars(target?.city ? { commune: target.city } : {});
    setAccord(false);
    setPreview(null);
    setSender(saved);
    setSenderOpen(!saved.prenom);
  }, [open, target, initialChannel]);

  const available = useMemo(() => templates.filter(t => t.channel === channel), [templates, channel]);
  const template = available.find(t => t.id === templateId) ?? available[0];

  useEffect(() => {
    if (available.length && !available.some(t => t.id === templateId)) setTemplateId(available[0].id);
  }, [available, templateId]);

  const switchChannel = (next: OutreachChannel) => {
    if (next === channel) return;
    setChannel(next);
    setTo(next === 'email' ? target?.email ?? '' : target?.phone ?? '');
    setAccord(false);
    setPreview(null);
  };

  const payload = useMemo(() => ({
    channel,
    templateId: template?.id ?? '',
    prospectId: target?.id ?? null,
    to: to.trim() || null,
    vars,
    sender,
  }), [channel, template?.id, target?.id, to, vars, sender]);

  // L'aperçu suit la frappe, avec un court délai pour ne pas interroger à chaque lettre.
  useEffect(() => {
    if (!open || !template) return;
    const id = ++requestId.current;
    setPreviewing(true);
    const timer = window.setTimeout(() => {
      api.post('/prospects/outreach/preview', payload)
        .then(({ data }) => { if (id === requestId.current) setPreview(data); })
        .catch(() => { if (id === requestId.current) setPreview({ ok: false, error: 'preview_failed' }); })
        .finally(() => { if (id === requestId.current) setPreviewing(false); });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [open, template, payload]);

  const updateSender = (patch: Partial<Sender>) => {
    setSender(prev => {
      const next = { ...prev, ...patch };
      saveSender(next);
      return next;
    });
  };

  const recipient = preview?.ok ? preview.recipient : undefined;
  const consentRequired = channel === 'sms' || recipient?.consentRequired === true;
  const blocking = preview && !preview.ok
    ? explain(preview.error, preview.field)
    : recipient?.problem ? explain(recipient.problem) : null;
  const canSend = !!preview?.ok && !recipient?.problem && (!consentRequired || accord) && !sending && !previewing;

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      const { data } = await api.post('/prospects/outreach/send', { ...payload, accord });
      onSent({ prospectId: target?.id ?? null, channel, to: data?.to ?? to });
      onClose();
    } catch (e: any) {
      const body = e?.response?.data;
      onErrorRef.current(explain(body?.error, body?.field, body?.detail));
    } finally {
      setSending(false);
    }
  };

  const rendered = preview?.ok ? preview.rendered : undefined;

  return (
    <SlideSheet
      open={open}
      onClose={onClose}
      title={target?.businessName || 'Envoi libre'}
      subtitle={target ? 'Écrire à ce prospect' : 'Vers une adresse ou un numéro de votre choix'}
      width="w-[560px]"
      footer={
        <button
          type="button"
          onClick={send}
          disabled={!canSend}
          className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl text-[13px] font-medium w-full transition-[transform,opacity] duration-150 ease-out active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100"
          style={{ background: pro.accent, color: '#fff' }}
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {sending ? 'Envoi…' : channel === 'email' ? 'Envoyer le mail' : 'Envoyer le SMS'}
        </button>
      }
    >
      <div className="space-y-6">
        {/* Canal */}
        <div role="tablist" aria-label="Canal" className="inline-flex p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${pro.border}` }}>
          {([['email', 'Mail', Mail], ['sms', 'SMS', MessageSquare]] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={channel === key}
              onClick={() => switchChannel(key)}
              className="inline-flex items-center gap-2 h-8 px-4 rounded-lg text-[12.5px] font-medium transition-colors"
              style={{
                background: channel === key ? 'rgba(255,255,255,0.09)' : 'transparent',
                color: channel === key ? pro.text : pro.textSec,
              }}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {channel === 'sms' && smsMissing.length > 0 && (
          <p className="text-[12.5px] leading-relaxed" style={{ color: pro.warn }}>
            L'envoi de SMS n'est pas configuré sur le serveur ({smsMissing.join(', ')}). Vous pouvez préparer le message, il ne partira pas.
          </p>
        )}

        {/* Destinataire */}
        <div>
          <Label htmlFor="outreach-to">{channel === 'email' ? 'Adresse du destinataire' : 'Numéro du destinataire'}</Label>
          <input
            id="outreach-to"
            type={channel === 'email' ? 'email' : 'tel'}
            inputMode={channel === 'email' ? 'email' : 'tel'}
            autoComplete="off"
            value={to}
            onChange={e => { setTo(e.target.value); setAccord(false); }}
            placeholder={channel === 'email' ? 'info@entreprise.be' : '+32 470 12 34 56'}
            className={inputCls}
            style={inputStyle}
          />
          <p className="text-[11.5px] mt-1.5 leading-relaxed" style={{ color: pro.textTer }}>
            {channel === 'sms'
              ? 'Un SMS ne part que vers quelqu’un qui a accepté de le recevoir.'
              : recipient?.kind === 'generic'
                ? 'Adresse générale d’une entreprise.'
                : recipient?.kind === 'personal'
                  ? 'Adresse nominative : elle demande l’accord de la personne.'
                  : 'Celle de la fiche, ou la vôtre pour un essai.'}
          </p>
        </div>

        {/* Modèle */}
        <div>
          <p className={labelCls} style={{ color: pro.textSec }}>Modèle</p>
          <div className="flex flex-wrap gap-1.5">
            {available.map(t => {
              const selected = t.id === template?.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setTemplateId(t.id)}
                  className="h-8 px-3 rounded-lg text-[12.5px] transition-colors"
                  style={{
                    background: selected ? pro.accentDim : 'rgba(255,255,255,0.04)',
                    color: selected ? pro.accentHi : pro.textSec,
                    border: `1px solid ${selected ? pro.accentBrd : pro.border}`,
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          {template && <p className="text-[11.5px] mt-2" style={{ color: pro.textTer }}>{template.when}</p>}
        </div>

        {/* Ce qui varie d'un envoi à l'autre */}
        {template && template.fields.length > 0 && (
          <div className="space-y-3">
            {template.fields.map(f => (
              <div key={f.key}>
                <Label htmlFor={`outreach-${f.key}`}>{f.label}</Label>
                {f.long ? (
                  <textarea
                    id={`outreach-${f.key}`}
                    value={vars[f.key] ?? ''}
                    onChange={e => setVars(v => ({ ...v, [f.key]: e.target.value }))}
                    rows={channel === 'sms' ? 3 : 7}
                    className="w-full px-3 py-2.5 rounded-xl text-[13.5px] leading-relaxed outline-none transition-colors focus:border-white/30 resize-y"
                    style={inputStyle}
                  />
                ) : (
                  <input
                    id={`outreach-${f.key}`}
                    value={vars[f.key] ?? ''}
                    onChange={e => setVars(v => ({ ...v, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className={inputCls}
                    style={inputStyle}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* L'expéditeur : saisi une fois, retenu sur ce navigateur */}
        <div className="rounded-xl" style={{ border: `1px solid ${pro.border}` }}>
          <button
            type="button"
            aria-expanded={senderOpen}
            onClick={() => setSenderOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 h-11 text-left"
          >
            <span className="text-[12.5px] font-medium" style={{ color: pro.text }}>Vous</span>
            <span className="text-[11.5px] truncate ml-3" style={{ color: pro.textTer }}>
              {sender.prenom ? [sender.prenom, sender.nom].filter(Boolean).join(' ') : 'À compléter'} · {senderOpen ? 'Replier' : 'Modifier'}
            </span>
          </button>
          {senderOpen && (
            <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="outreach-prenom">Prénom</Label>
                <input id="outreach-prenom" value={sender.prenom} onChange={e => updateSender({ prenom: e.target.value })} className={inputCls} style={inputStyle} autoComplete="given-name" />
              </div>
              <div>
                <Label htmlFor="outreach-nom">Nom</Label>
                <input id="outreach-nom" value={sender.nom} onChange={e => updateSender({ nom: e.target.value })} className={inputCls} style={inputStyle} autoComplete="family-name" />
              </div>
              <div>
                <Label htmlFor="outreach-tel">Votre téléphone</Label>
                <input id="outreach-tel" type="tel" value={sender.telephone} onChange={e => updateSender({ telephone: e.target.value })} placeholder="+32 470 12 34 56" className={inputCls} style={inputStyle} autoComplete="tel" />
              </div>
              <div>
                <Label htmlFor="outreach-video">Lien de votre vidéo</Label>
                <input id="outreach-video" type="url" value={sender.lienVideo} onChange={e => updateSender({ lienVideo: e.target.value })} placeholder="https://…" className={inputCls} style={inputStyle} autoComplete="off" />
              </div>
            </div>
          )}
        </div>

        {/* Aperçu */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: pro.textTer }}>Aperçu</p>
            {rendered?.channel === 'sms' && (
              <p className="text-[11.5px] tabular-nums" style={{ color: rendered.segments > 1 ? pro.warn : pro.textTer }}>
                {rendered.body.length} caractères · {rendered.segments} SMS
              </p>
            )}
          </div>

          {blocking ? (
            <p className="text-[13px] leading-relaxed rounded-xl px-4 py-3" style={{ color: pro.textSec, border: `1px dashed ${pro.border}` }}>
              {blocking}
            </p>
          ) : rendered?.channel === 'email' ? (
            <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${pro.border}` }}>
              <p className="px-4 py-2.5 text-[12.5px] truncate" style={{ color: pro.textSec, borderBottom: `1px solid ${pro.border}` }}>
                <span style={{ color: pro.textTer }}>Objet · </span>{rendered.subject}
              </p>
              <iframe
                title="Aperçu du mail"
                sandbox=""
                srcDoc={rendered.html}
                className="w-full block bg-white"
                style={{ height: 460, border: 0 }}
              />
            </div>
          ) : rendered?.channel === 'sms' ? (
            <div className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-3 text-[13.5px] leading-relaxed whitespace-pre-wrap"
                 style={{ background: 'rgba(255,255,255,0.07)', color: pro.text }}>
                {rendered.body}
              </p>
            </div>
          ) : (
            <div className="py-10 grid place-items-center">
              <Loader2 size={16} className="animate-spin" style={{ color: pro.textTer }} />
            </div>
          )}
        </div>

        {/* L'accord : la seule chose que le code ne peut pas vérifier */}
        {consentRequired && !blocking && (
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={accord}
              onChange={e => setAccord(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded flex-shrink-0"
              style={{ accentColor: pro.accent }}
            />
            <span className="text-[12.5px] leading-relaxed" style={{ color: pro.textSec }}>
              {channel === 'sms'
                ? 'Cette personne a accepté de recevoir ce SMS, par exemple au téléphone.'
                : 'Cette personne a accepté de recevoir ce mail, par exemple en me disant « envoyez-moi un mail ».'}
            </span>
          </label>
        )}
      </div>
    </SlideSheet>
  );
}
