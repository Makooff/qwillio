import { CreditCard } from 'lucide-react';
import { AgentDetailShell } from '../../../components/admin/AgentDetailShell';

export default function AdminAgentPayments() {
  return (
    <AgentDetailShell
      agentType="payments"
      displayName="Payments AI"
      icon={CreditCard}
      description="Facturation automatique, relances, suivi des paiements clients."
      runForm="none"
    />
  );
}
