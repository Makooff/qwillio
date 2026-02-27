import { useEffect, useState } from 'react';
import api from '../services/api';
import { Campaign, PaginatedResponse } from '../types';
import { Mail, Plus, Send, X } from 'lucide-react';

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '',
    subjectLine: '',
    messageTemplate: '',
    targetBusinessTypes: [] as string[],
    targetCities: [] as string[],
    targetStatuses: ['interested', 'qualified'],
    targetMinScore: 50,
  });

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<PaginatedResponse<Campaign>>('/campaigns');
      setCampaigns(data.data);
    } catch (error) {
      console.error('Failed to fetch campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCampaigns(); }, []);

  const createCampaign = async () => {
    try {
      await api.post('/campaigns', form);
      setShowCreate(false);
      fetchCampaigns();
    } catch (error) {
      console.error('Failed to create campaign:', error);
    }
  };

  const launchCampaign = async (id: string) => {
    try {
      await api.post(`/campaigns/${id}/launch`);
      fetchCampaigns();
    } catch (error) {
      console.error('Failed to launch campaign:', error);
    }
  };

  const statusIcons: Record<string, string> = {
    draft: '📝', scheduled: '📅', running: '🔄', completed: '✅', canceled: '❌',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campagnes Email</h1>
          <p className="text-gray-500">{campaigns.length} campagnes</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nouvelle Campagne
        </button>
      </div>

      {/* Campaign List */}
      <div className="grid gap-4">
        {loading ? (
          <div className="card text-center py-12 text-gray-500">Chargement...</div>
        ) : campaigns.length === 0 ? (
          <div className="card text-center py-12 text-gray-500">Aucune campagne. Créez votre première campagne !</div>
        ) : campaigns.map((c) => (
          <div key={c.id} className="card flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary-50 rounded-lg">
                <Mail className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{c.name}</h3>
                <p className="text-sm text-gray-500">
                  {statusIcons[c.status]} {c.status.charAt(0).toUpperCase() + c.status.slice(1)} · {new Date(c.createdAt).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">{c.sentCount}</p>
                <p className="text-xs text-gray-500">Envoyés</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-emerald-600">{c.openedCount}</p>
                <p className="text-xs text-gray-500">Ouverts</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-primary-600">{c.clickedCount}</p>
                <p className="text-xs text-gray-500">Cliqués</p>
              </div>
              {c.status === 'draft' && (
                <button onClick={() => launchCampaign(c.id)} className="btn-success text-sm flex items-center gap-1">
                  <Send className="w-4 h-4" /> Lancer
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold">Nouvelle Campagne</h2>
              <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Relance Restaurants Bruxelles" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sujet</label>
                <input className="input" value={form.subjectLine} onChange={(e) => setForm({ ...form, subjectLine: e.target.value })} placeholder="Offre spéciale pour {{business_name}}" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contenu (HTML)</label>
                <textarea className="input h-32" value={form.messageTemplate} onChange={(e) => setForm({ ...form, messageTemplate: e.target.value })} placeholder="Variables: {{business_name}}, {{contact_name}}, {{city}}" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Score minimum</label>
                <input type="number" className="input" value={form.targetMinScore} onChange={(e) => setForm({ ...form, targetMinScore: parseInt(e.target.value) })} />
              </div>
              <button onClick={createCampaign} className="btn-primary w-full">Créer la campagne</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

