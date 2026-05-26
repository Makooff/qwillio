import { AlertTriangle, CheckCircle } from 'lucide-react';
import { pro } from '../../styles/pro-theme';
import { Card, SectionHead, Pill } from '../pro/ProBlocks';
import type { Anomaly } from '../../hooks/useDashboardData';

type PillColor = 'ok' | 'warn' | 'bad' | 'info' | 'accent' | 'neutral';

function severityColor(s: string): PillColor {
  const v = s.toLowerCase();
  if (v === 'critical' || v === 'high') return 'bad';
  if (v === 'medium') return 'warn';
  return 'info';
}

interface Props {
  anomalies: Anomaly[];
}

export function DashboardAnomalies({ anomalies }: Props) {
  return (
    <Card>
      <div className="p-4">
        <SectionHead title="Anomalies détectées" />
        {anomalies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <CheckCircle size={28} style={{ color: pro.ok }} />
            <p className="text-[13px]" style={{ color: pro.textSec }}>Aucune anomalie</p>
          </div>
        ) : (
          <ul className="space-y-0">
            {anomalies.slice(0, 5).map((a, i) => (
              <li
                key={a.id}
                className="flex items-start gap-3 py-2.5"
                style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
              >
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" style={{ color: pro.warn }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12.5px] font-medium" style={{ color: pro.text }}>{a.metric}</span>
                    <Pill color={severityColor(a.severity)}>{a.severity}</Pill>
                  </div>
                  {a.diagnosis && (
                    <p className="text-[11px] mt-0.5 truncate" style={{ color: pro.textSec }}>{a.diagnosis}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
