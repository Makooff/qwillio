import { Calculator } from 'lucide-react';
import { AgentDetailShell } from '../../../components/admin/AgentDetailShell';

export default function AdminAgentAccounting() {
  return (
    <AgentDetailShell
      agentType="accounting"
      displayName="Accounting AI"
      icon={Calculator}
      description="Classification des dépenses, génération de rapports financiers mensuels."
      runForm="none"
    />
  );
}
