import { LifeBuoy } from 'lucide-react';
import { AgentDetailShell } from '../../../components/admin/AgentDetailShell';

export default function AdminAgentSupport() {
  return (
    <AgentDetailShell
      agentType="support"
      displayName="Support AI"
      icon={LifeBuoy}
      description="Triage tickets email/chat, draft réponses, escalade par mots-clés."
    />
  );
}
