import { useCallback, useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_URL || 'https://qwillio.onrender.com';

export interface BotStatus {
  isActive: boolean;
  callsToday: number;
  callsQuota: number;
  eligibleProspects: number;
  lastProspection?: string | null;
  lastCall?: string | null;
}

export interface DashStats {
  prospects: { total: number; newThisMonth: number };
  clients: { totalActive: number };
  revenue: { mrr: number };
  hotLeads: number;
}

export interface ActivityItem {
  id: string;
  type: string;
  message?: string;
  description?: string;
  createdAt?: string;
  timestamp?: string;
}

export interface CallDay {
  date: string;
  calls: number;
}

export interface Anomaly {
  id: string;
  metric: string;
  severity: string;
  diagnosis: string | null;
}

interface DashboardData {
  botStatus: BotStatus | null;
  stats: DashStats | null;
  activity: ActivityItem[];
  callsChart: CallDay[];
  anomalies: Anomaly[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

function getHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export function useDashboardData(intervalMs = 10_000): DashboardData {
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [stats, setStats] = useState<DashStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [callsChart, setCallsChart] = useState<CallDay[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        fetch(`${API}/api/bot/status`, { headers: getHeaders() }),
        fetch(`${API}/api/dashboard/stats`, { headers: getHeaders() }),
        fetch(`${API}/api/bot/activity?limit=8`, { headers: getHeaders() }),
        fetch(`${API}/api/dashboard/calls-chart`, { headers: getHeaders() }),
        fetch(`${API}/api/ai-agents/anomalies`, { headers: getHeaders() }),
      ]);
      const [botRes, statsRes, actRes, chartRes, anomRes] = results;

      if (botRes.status === 'fulfilled' && botRes.value.ok) setBotStatus(await botRes.value.json());
      if (statsRes.status === 'fulfilled' && statsRes.value.ok) setStats(await statsRes.value.json());
      if (actRes.status === 'fulfilled' && actRes.value.ok) {
        const d = await actRes.value.json();
        setActivity(Array.isArray(d) ? d : d.items ?? []);
      }
      if (chartRes.status === 'fulfilled' && chartRes.value.ok) {
        const d = await chartRes.value.json();
        setCallsChart(Array.isArray(d) ? d : d.data ?? []);
      }
      if (anomRes.status === 'fulfilled' && anomRes.value.ok) {
        const d = await anomRes.value.json();
        setAnomalies(Array.isArray(d) ? d : d.anomalies ?? []);
      }
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
    const id = window.setInterval(refetch, intervalMs);
    return () => window.clearInterval(id);
  }, [refetch, intervalMs]);

  return { botStatus, stats, activity, callsChart, anomalies, loading, error, refetch };
}
