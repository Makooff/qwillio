import { useEffect, useState } from 'react';
import { Shield, AlertTriangle, Ban, Eye, UserX, Globe } from 'lucide-react';
import api from '../services/api';

interface AbuseStats {
  totalBlocked: number;
  deletedAccounts: number;
  vpnAttempts: number;
  topReasons: { blockReason: string | null; _count: number }[];
}

interface FlaggedAttempt {
  id: string;
  emailHash: string;
  phoneHash: string | null;
  ipCountry: string | null;
  vpnDetected: boolean;
  suspiciousSignals: number;
  blocked: boolean;
  blockReason: string | null;
  createdAt: string;
}

export default function AdminAbuse() {
  const [stats, setStats] = useState<AbuseStats | null>(null);
  const [flagged, setFlagged] = useState<FlaggedAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [statsRes, flaggedRes] = await Promise.all([
        api.get('/trial/admin/stats'),
        api.get('/trial/admin/flagged'),
      ]);
      setStats(statsRes.data);
      setFlagged(flaggedRes.data.items || []);
    } catch (error) {
      console.error('Failed to load abuse data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="text-indigo-500" size={28} />
        <h1 className="text-2xl font-bold text-gray-900">Abuse Prevention Dashboard</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 text-red-500 mb-2">
            <Ban size={18} />
            <span className="text-sm font-medium">Blocked This Month</span>
          </div>
          <p className="text-3xl font-bold">{stats?.totalBlocked || 0}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 text-orange-500 mb-2">
            <UserX size={18} />
            <span className="text-sm font-medium">Deleted Accounts</span>
          </div>
          <p className="text-3xl font-bold">{stats?.deletedAccounts || 0}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 text-yellow-500 mb-2">
            <Globe size={18} />
            <span className="text-sm font-medium">VPN Attempts</span>
          </div>
          <p className="text-3xl font-bold">{stats?.vpnAttempts || 0}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 text-indigo-500 mb-2">
            <AlertTriangle size={18} />
            <span className="text-sm font-medium">Top Block Reason</span>
          </div>
          <p className="text-sm font-semibold mt-1">
            {stats?.topReasons?.[0]?.blockReason || 'None'}
          </p>
        </div>
      </div>

      {/* Flagged Attempts Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Flagged Signup Attempts</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Email Hash</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Country</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">VPN</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Signals</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Reason</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {flagged.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    No flagged attempts yet
                  </td>
                </tr>
              ) : (
                flagged.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {item.emailHash?.substring(0, 12)}...
                    </td>
                    <td className="px-4 py-3">{item.ipCountry || '—'}</td>
                    <td className="px-4 py-3">
                      {item.vpnDetected ? (
                        <span className="text-red-500 font-medium">Yes</span>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          item.suspiciousSignals >= 3
                            ? 'bg-red-100 text-red-700'
                            : item.suspiciousSignals >= 2
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {item.suspiciousSignals}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {item.blocked ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          Blocked
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                          Flagged
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate">
                      {item.blockReason || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-indigo-500 hover:text-indigo-700 text-xs font-medium">
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
