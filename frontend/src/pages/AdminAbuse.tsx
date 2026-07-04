import { useEffect, useState } from 'react';
import { Shield, AlertTriangle, Ban, Eye, UserX, Globe } from 'lucide-react';
import api from '../services/api';
import { t, glass, cx } from '../styles/admin-theme';

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
        <div className="animate-spin rounded-full h-8 w-8" style={{ borderBottomWidth: 2, borderBottomStyle: 'solid', borderBottomColor: t.textSec }} />
      </div>
    );
  }

  return (
    <div className={cx.pageWrap}>
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-6 h-6" style={{ color: t.textSec }} />
        <h1 className={cx.h1} style={{ color: t.text }}>Abuse Prevention Dashboard</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <div className="rounded-[14px] p-5" style={glass}>
          <div className="flex items-center gap-2 mb-2" style={{ color: t.danger }}>
            <Ban size={16} />
            <span className="text-[11px] font-medium" style={{ color: t.textSec }}>Blocked This Month</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: t.text }}>{stats?.totalBlocked || 0}</p>
        </div>

        <div className="rounded-[14px] p-5" style={glass}>
          <div className="flex items-center gap-2 mb-2" style={{ color: t.warning }}>
            <UserX size={16} />
            <span className="text-[11px] font-medium" style={{ color: t.textSec }}>Deleted Accounts</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: t.text }}>{stats?.deletedAccounts || 0}</p>
        </div>

        <div className="rounded-[14px] p-5" style={glass}>
          <div className="flex items-center gap-2 mb-2" style={{ color: t.warning }}>
            <Globe size={16} />
            <span className="text-[11px] font-medium" style={{ color: t.textSec }}>VPN Attempts</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: t.text }}>{stats?.vpnAttempts || 0}</p>
        </div>

        <div className="rounded-[14px] p-5" style={glass}>
          <div className="flex items-center gap-2 mb-2" style={{ color: t.textSec }}>
            <AlertTriangle size={16} />
            <span className="text-[11px] font-medium" style={{ color: t.textSec }}>Top Block Reason</span>
          </div>
          <p className="text-[13px] font-semibold mt-1" style={{ color: t.text }}>
            {stats?.topReasons?.[0]?.blockReason || 'None'}
          </p>
        </div>
      </div>

      {/* Flagged Attempts Table */}
      <div className="rounded-[14px] overflow-hidden" style={glass}>
        <div className="px-4 py-3" style={{ borderBottom: `1px solid ${t.border}` }}>
          <h2 className={cx.h2} style={{ color: t.textSec }}>Flagged Signup Attempts</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                <th className={cx.th} style={{ color: t.textTer }}>Date</th>
                <th className={cx.th} style={{ color: t.textTer }}>Email Hash</th>
                <th className={cx.th} style={{ color: t.textTer }}>Country</th>
                <th className={cx.th} style={{ color: t.textTer }}>VPN</th>
                <th className={cx.th} style={{ color: t.textTer }}>Signals</th>
                <th className={cx.th} style={{ color: t.textTer }}>Status</th>
                <th className={cx.th} style={{ color: t.textTer }}>Reason</th>
                <th className={cx.th} style={{ color: t.textTer }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {flagged.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center" style={{ color: t.textMuted }}>
                    No flagged attempts yet
                  </td>
                </tr>
              ) : (
                flagged.map((item) => (
                  <tr key={item.id} className={cx.tr}>
                    <td className={cx.td} style={{ color: t.textSec }}>
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td className={`${cx.td} font-mono text-xs`} style={{ color: t.textSec }}>
                      {item.emailHash?.substring(0, 12)}...
                    </td>
                    <td className={cx.td} style={{ color: t.textSec }}>{item.ipCountry || '\u2014'}</td>
                    <td className={cx.td}>
                      {item.vpnDetected ? (
                        <span className="font-medium" style={{ color: t.danger }}>Yes</span>
                      ) : (
                        <span style={{ color: t.textMuted }}>No</span>
                      )}
                    </td>
                    <td className={cx.td}>
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                        style={
                          item.suspiciousSignals >= 3
                            ? { background: `${t.danger}18`, color: t.danger }
                            : item.suspiciousSignals >= 2
                            ? { background: `${t.warning}18`, color: t.warning }
                            : { background: t.elevated, color: t.textSec }
                        }
                      >
                        {item.suspiciousSignals}
                      </span>
                    </td>
                    <td className={cx.td}>
                      {item.blocked ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ background: `${t.danger}18`, color: t.danger }}>
                          Blocked
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ background: `${t.warning}18`, color: t.warning }}>
                          Flagged
                        </span>
                      )}
                    </td>
                    <td className={cx.td} style={{ color: t.textTer, maxWidth: 200 }}>
                      <span className="text-xs truncate block">{item.blockReason || '\u2014'}</span>
                    </td>
                    <td className={cx.td}>
                      <button className="p-1.5 rounded-[8px] hover:bg-white/[0.08] transition-all" style={{ color: t.textSec }}>
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
