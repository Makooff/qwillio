import { LineChart } from '../../../components/icons';
import { AgentDetailShell } from '../../../components/admin/AgentDetailShell';

export default function AdminAgentAnalytics() {
  return (
    <AgentDetailShell
      agentType="analytics"
      displayName="Analytics AI"
      icon={LineChart}
      description="Digest hebdomadaire, détection d'anomalies, forecast, recommandations cross-module."
    />
  );
}
