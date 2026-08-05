import { Star } from '../../../components/icons';
import { AgentDetailShell } from '../../../components/admin/AgentDetailShell';

export default function AdminAgentReputation() {
  return (
    <AgentDetailShell
      agentType="reputation"
      displayName="Reputation AI"
      icon={Star}
      description="Monitoring avis Google/Facebook + génération de réponses avec escalade automatique."
    />
  );
}
