import { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import { pro } from '../../styles/pro-theme';
import { Card, SectionHead } from '../../components/pro/ProBlocks';

type Lead = { id: string; name: string; phone: string; city: string; niche: string };
type RecordState = { compliance: boolean; contacted: boolean; need: boolean; demo: boolean; trial: boolean; paid: boolean; optedOut: boolean; note: string; followUp: string; price: number; experiment: 'A' | 'B' };
const empty = (): RecordState => ({ compliance: false, contacted: false, need: false, demo: false, trial: false, paid: false, optedOut: false, note: '', followUp: '', price: 99, experiment: 'A' });
const KEY = 'qwillio-validation-30j-v1';
const STEPS: { key: keyof RecordState; label: string }[] = [
  { key: 'compliance', label: 'Conformité vérifiée' },
  { key: 'contacted', label: 'Contact effectué' },
  { key: 'need', label: 'Besoin confirmé' },
  { key: 'demo', label: 'Démo réalisée' },
  { key: 'trial', label: 'Essai lancé' },
  { key: 'paid', label: 'Client payant' },
];
const pct = (n: number, d: number) => d ? Math.round(100 * n / d) + ' %' : '—';
const escapeCsv = (v: unknown) => '"' + String(v ?? '').replace(/"/g, '""') + '"';

export default function ValidationWorkbench() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [records, setRecords] = useState<Record<string, RecordState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [onlyDue, setOnlyDue] = useState(false);
  const [manual, setManual] = useState<Lead[]>([]);
  const [draft, setDraft] = useState({ name: '', phone: '', city: '', niche: 'auto' });
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
      setRecords(saved.records || {});
      setManual(saved.manual || []);
    } catch { /* corrupted local state: keep defaults */ }
    api.get('/prospects', { params: { limit: 100 } })
      .then(({ data }) => {
        const raw = Array.isArray(data) ? data : (data.prospects || data.data || data.items || []);
        setLeads((Array.isArray(raw) ? raw : []).map((p: any) => ({
          id: String(p.id), name: String(p.businessName || p.name || p.companyName || 'Entreprise'),
          phone: String(p.phone || p.phoneNumber || ''), city: String(p.city || ''),
          niche: String(p.niche || ''),
        })));
      }).catch(() => setError('Impossible de charger les prospects du CRM. Les contacts ajoutés ici restent disponibles sur cet appareil.'))
      .finally(() => setLoading(false));
  }, []);
  const save = (next: Record<string, RecordState>, nextManual = manual) => {
    setRecords(next);
    try { localStorage.setItem(KEY, JSON.stringify({ records: next, manual: nextManual })); }
    catch { setError('Stockage local indisponible : exporte ton suivi avant de quitter cette page.'); }
  };
  const update = (id: string, patch: Partial<RecordState>) => save({ ...records, [id]: { ...empty(), ...records[id], ...patch } });
  const addLead = () => {
    if (!draft.name.trim() || !draft.phone.trim()) return;
    const next = [{ id: 'manual-' + Date.now(), ...draft }, ...manual];
    setManual(next);
    save(records, next);
    setDraft({ name: '', phone: '', city: '', niche: 'auto' });
  };
  const all = useMemo(() => [...manual, ...leads.filter(l => !manual.some(m => m.phone === l.phone))], [manual, leads]);
  const stats = useMemo(() => {
    const rows = all.map(l => ({ ...empty(), ...records[l.id] }));
    const count = (k: keyof RecordState) => rows.filter(r => r[k] === true).length;
    return { contacted: count('contacted'), need: count('need'), demo: count('demo'), trial: count('trial'), paid: count('paid'), revenue: rows.filter(r => r.paid).reduce((sum, r) => sum + (Number(r.price) || 0), 0) };
  }, [all, records]);
  const visible = all.filter(l => {
    const r = { ...empty(), ...records[l.id] };
    return (!onlyDue || (!!r.followUp && r.followUp <= new Date().toISOString().slice(0, 10) && !r.optedOut))
      && (l.name + ' ' + l.city + ' ' + l.niche + ' ' + l.phone).toLowerCase().includes(filter.toLowerCase());
  });
  const exportCsv = () => {
    const columns = ['Entreprise','Téléphone','Ville','Secteur','Conformité','Contact','Besoin','Démo','Essai','Payant','Opposition','Relance','Variante','Prix mensuel','Notes'];
    const rows = all.map(l => {
      const r = { ...empty(), ...records[l.id] };
      return [l.name,l.phone,l.city,l.niche,r.compliance,r.contacted,r.need,r.demo,r.trial,r.paid,r.optedOut,r.followUp,r.experiment,r.price,r.note];
    });
    const csv = '\uFEFF' + [columns, ...rows].map(row => row.map(escapeCsv).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'qwillio-validation-30j.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const fieldStyle = { background: 'rgba(255,255,255,0.05)', border: '1px solid ' + pro.border, color: pro.text };
  return <section className="space-y-3">
    <SectionHead title="Validation commerciale · 30 jours" />
    <Card>
      <div className="p-4 space-y-4">
        <p className="text-xs" style={{ color: pro.textSec }}>Expérience de marché : 40 contacts qualifiés, 5 démos, 1 à 2 clients payants visés. Ces objectifs ne sont pas des prévisions.</p>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {([['Contactés', stats.contacted], ['Besoin', stats.need], ['Démos', stats.demo], ['Essais', stats.trial], ['Payants', stats.paid], ['MRR', stats.revenue + ' €']] as const).map(([label, value]) =>
            <div key={label} className="rounded-xl p-3" style={fieldStyle}><div className="text-[11px]" style={{ color: pro.textSec }}>{label}</div><div className="text-xl font-semibold" style={{ color: pro.text }}>{value}</div></div>)}
        </div>
        <p className="text-xs" style={{ color: pro.textSec }}>Contact → démo : {pct(stats.demo, stats.contacted)} · Démo → essai : {pct(stats.trial, stats.demo)} · Essai → payant : {pct(stats.paid, stats.trial)}. Le revenu est déclaré manuellement, non synchronisé avec Stripe.</p>
        <div className="rounded-lg p-3 text-xs" style={{ background: 'rgba(255,255,255,0.04)', color: pro.textSec }}>
          {stats.contacted < 40 ? 'Décision : données insuffisantes. Continue le test avant de pivoter.' : stats.paid >= 1 ? 'Signal positif : au moins un client payant déclaré. Vérifie la marge et la rétention avant d’accélérer.' : stats.demo >= 5 ? 'Plusieurs démos sans vente : retravaille la proposition et le prix avant de changer de projet.' : 'Peu de démos : teste une autre niche ou un autre message avant de pivoter.'}
        </div>
        <p className="text-[11px]" style={{ color: pro.textTer }}>Ce suivi est enregistré uniquement dans le navigateur de cet appareil, pas dans la base Qwillio. Exporte régulièrement le CSV ; il ne se synchronise pas entre appareils. Aucun appel n'est lancé par ce module.</p>
        <div className="flex flex-wrap gap-2">
          <input aria-label="Rechercher une entreprise" placeholder="Rechercher entreprise, ville, numéro…" value={filter} onChange={e => setFilter(e.target.value)} className="rounded-lg px-3 py-2 text-xs flex-1 min-w-[190px]" style={fieldStyle}/>
          <label className="flex items-center gap-2 text-xs" style={{ color: pro.textSec }}><input type="checkbox" checked={onlyDue} onChange={e => setOnlyDue(e.target.checked)}/> Relances dues</label>
          <button onClick={exportCsv} className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: pro.accent, color: '#000' }}>Exporter le suivi CSV</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {(['name','phone','city','niche'] as const).map(k => <input key={k} aria-label={k} placeholder={{name:'Entreprise',phone:'Téléphone',city:'Ville',niche:'Secteur'}[k]} value={draft[k]} onChange={e => setDraft(v => ({ ...v, [k]: e.target.value }))} className="rounded-lg px-3 py-2 text-xs" style={fieldStyle}/>)}
          <button onClick={addLead} disabled={!draft.name.trim() || !draft.phone.trim()} className="rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50" style={{ background: pro.accent, color: '#000' }}>+ Ajouter prospect</button>
        </div>
        {error && <p role="alert" className="text-xs" style={{ color: '#fca5a5' }}>{error}</p>}
        {loading && <p className="text-xs" style={{ color: pro.textSec }}>Chargement des prospects…</p>}
        <div className="space-y-2 max-h-[640px] overflow-y-auto">
          {visible.slice(0, 100).map(l => {
            const r = { ...empty(), ...records[l.id] };
            return <div key={l.id} className="rounded-xl p-3 space-y-3" style={{ border: '1px solid ' + pro.border }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><div className="text-sm font-semibold" style={{ color: pro.text }}>{l.name}</div><div className="text-xs" style={{ color: pro.textSec }}>{l.city} · {l.niche} · {l.phone || 'Numéro absent'}</div></div>
                {l.phone && !r.optedOut && r.compliance && <a href={'tel:' + l.phone.replace(/[^+\d]/g, '')} className="rounded-lg px-3 py-2 text-xs" style={{ background: 'rgba(255,255,255,0.08)', color: pro.text }}>Appeler</a>}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {STEPS.map(s => <label key={s.key} className="flex items-center gap-1.5 text-xs" style={{ color: pro.textSec }}><input type="checkbox" checked={Boolean(r[s.key])} onChange={e => update(l.id, { [s.key]: e.target.checked })}/>{s.label}</label>)}
                <label className="flex items-center gap-1.5 text-xs" style={{ color: '#fca5a5' }}><input type="checkbox" checked={r.optedOut} onChange={e => update(l.id, { optedOut: e.target.checked })}/> Ne plus contacter</label>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="text-xs" style={{ color: pro.textSec }}>Relance <input type="date" value={r.followUp} onChange={e => update(l.id, { followUp: e.target.value })} className="rounded-lg px-2 py-1 ml-1" style={fieldStyle}/></label>
                <label className="text-xs" style={{ color: pro.textSec }}>Script <select value={r.experiment} onChange={e => update(l.id, { experiment: e.target.value as 'A'|'B' })} className="rounded-lg px-2 py-1 ml-1" style={fieldStyle}><option value="A">A</option><option value="B">B</option></select></label>
                <label className="text-xs" style={{ color: pro.textSec }}>€/mois <input type="number" min="0" value={r.price} onChange={e => update(l.id, { price: Math.max(0, Number(e.target.value) || 0) })} className="rounded-lg px-2 py-1 ml-1 w-20" style={fieldStyle}/></label>
              </div>
              <textarea aria-label={'Notes ' + l.name} rows={2} placeholder="Objection, besoin, retour démo, prochaine action…" value={r.note} onChange={e => update(l.id, { note: e.target.value })} className="rounded-lg px-3 py-2 text-xs w-full" style={fieldStyle}/>
            </div>;
          })}
          {!loading && visible.length === 0 && <p className="text-xs" style={{ color: pro.textSec }}>Aucun prospect. Ajoute-en un ou charge des prospects dans le CRM.</p>}
        </div>
      </div>
    </Card>
  </section>;
}
