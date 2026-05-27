import { Megaphone } from 'lucide-react';
import { AgentDetailShell } from '../../../components/admin/AgentDetailShell';

export default function AdminAgentMarketing() {
  return (
    <AgentDetailShell
      agentType="marketing"
      displayName="Marketing AI"
      icon={Megaphone}
      description="Posts réseaux sociaux, emails campagne, ad copy adaptés à la niche du client."
    />
  );
}
