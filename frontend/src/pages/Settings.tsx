import { useEffect, useState } from 'react';
import api from '../services/api';
import { BotStatus } from '../types';
import { Settings as SettingsIcon, Zap, Phone, Mail, CreditCard, Bot, Play, Square } from 'lucide-react';

export default function Settings() {
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggerLoading, setTriggerLoading] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchBotStatus();
    const interval = setInterval(fetchBotStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchBotStatus = async () => {
    try {
      const { data } = await api.get('/bot/status');
      setBotStatus(data);
    } catch (error) {
      console.error('Failed to fetch bot status:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleBot = async () => {
    try {
      if (botStatus?.isActive) {
        await api.post('/bot/stop');
        setMessage('Bot arrêté');
      } else {
        await api.post('/bot/start');
        setMessage('Bot démarré ! Tous les crons sont actifs.');
      }
      await fetchBotStatus();
    } catch (error) {
      setMessage('Erreur lors du basculement du bot');
    }
  };

  const triggerAction = async (action: string) => {
    setTriggerLoading(action);
    setMessage('');
    try {
      const { data } = await api.post(`/bot/trigger/${action}`);
      setMessage(data.message);
      await fetchBotStatus();
    } catch (error: any) {
      setMessage(error.response?.data?.error || 'Erreur');
    } finally {
      setTriggerLoading('');
    }
  };

  if (loading) return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div></div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
        <p className="text-gray-500">Configuration du bot et du système automatique</p>
      </div>

      {message && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg">{message}</div>
      )}

      {/* Bot Control */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-6 flex items-center gap-2"><Bot className="w-5 h-5" /> Contrôle du Bot</h2>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl mb-6">
          <div className="flex items-center gap-4">
            <div className={`w-4 h-4 rounded-full ${botStatus?.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
            <div>
              <p className="font-semibold text-lg">{botStatus?.isActive ? 'Bot Actif' : 'Bot Inactif'}</p>
              <p className="text-sm text-gray-500">
                {botStatus?.callsToday || 0} appels aujourd'hui / {botStatus?.callsQuotaDaily || 50} quota
              </p>
            </div>
          </div>
          <button onClick={toggleBot} className={botStatus?.isActive ? 'btn-danger flex items-center gap-2' : 'btn-success flex items-center gap-2'}>
            {botStatus?.isActive ? <><Square className="w-4 h-4" /> Arrêter</> : <><Play className="w-4 h-4" /> Démarrer</>}
          </button>
        </div>

        {/* Cron Status */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {botStatus?.crons && Object.entries(botStatus.crons).map(([name, status]) => (
            <div key={name} className={`p-3 rounded-lg text-center ${status === 'active' ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 border border-gray-200'}`}>
              <div className={`w-2 h-2 rounded-full mx-auto mb-2 ${status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              <p className="text-xs font-medium capitalize">{name}</p>
              <p className="text-xs text-gray-500">{status}</p>
            </div>
          ))}
        </div>

        {/* Last Activity */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-gray-500">Dernière prospection</p>
            <p className="font-medium">{botStatus?.lastProspection ? new Date(botStatus.lastProspection).toLocaleString('fr-FR') : 'Jamais'}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-gray-500">Dernier appel</p>
            <p className="font-medium">{botStatus?.lastCall ? new Date(botStatus.lastCall).toLocaleString('fr-FR') : 'Jamais'}</p>
          </div>
        </div>
      </div>

      {/* Manual Triggers */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-6 flex items-center gap-2"><Zap className="w-5 h-5" /> Actions Manuelles (Test)</h2>
        <p className="text-sm text-gray-500 mb-4">Déclenchez manuellement les actions du bot pour tester le fonctionnement.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => triggerAction('prospection')}
            disabled={triggerLoading === 'prospection'}
            className="p-4 border-2 border-dashed border-gray-200 rounded-xl hover:border-primary-300 hover:bg-primary-50 transition-all text-left"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🔍</span>
              <span className="font-semibold">{triggerLoading === 'prospection' ? 'En cours...' : 'Prospection'}</span>
            </div>
            <p className="text-xs text-gray-500">Rechercher des nouveaux prospects sur Google Places</p>
          </button>

          <button
            onClick={() => triggerAction('call')}
            disabled={triggerLoading === 'call'}
            className="p-4 border-2 border-dashed border-gray-200 rounded-xl hover:border-primary-300 hover:bg-primary-50 transition-all text-left"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">📞</span>
              <span className="font-semibold">{triggerLoading === 'call' ? 'En cours...' : 'Appeler'}</span>
            </div>
            <p className="text-xs text-gray-500">Appeler le prochain prospect avec Ashley (VAPI)</p>
          </button>

          <button
            onClick={() => triggerAction('reminders')}
            disabled={triggerLoading === 'reminders'}
            className="p-4 border-2 border-dashed border-gray-200 rounded-xl hover:border-primary-300 hover:bg-primary-50 transition-all text-left"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">📧</span>
              <span className="font-semibold">{triggerLoading === 'reminders' ? 'En cours...' : 'Relances'}</span>
            </div>
            <p className="text-xs text-gray-500">Envoyer les relances email en attente</p>
          </button>
        </div>
      </div>

      {/* Automation Info */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Boucle Automatique</h2>
        <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2 font-mono">
          <p><strong>Prospection:</strong> Tous les jours à 9h (lun-ven)</p>
          <p><strong>Appels:</strong> Toutes les 20 min, 9h-19h (lun-ven)</p>
          <p><strong>Relances:</strong> Toutes les heures</p>
          <p><strong>Analytics:</strong> Tous les jours à 23h55</p>
          <p><strong>Reset quotidien:</strong> Tous les jours à 00h01</p>
        </div>
      </div>
    </div>
  );
}

