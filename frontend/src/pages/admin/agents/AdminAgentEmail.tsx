import { Mail } from 'lucide-react';
import { AgentDetailShell } from '../../../components/admin/AgentDetailShell';

export default function AdminAgentEmail() {
  return (
    <AgentDetailShell
      agentType="email"
      displayName="Email AI"
      icon={Mail}
      description="Classification, auto-reply et follow-up sur la boîte client (Gmail/Outlook)."
      runForm="none"
    />
  );
}
