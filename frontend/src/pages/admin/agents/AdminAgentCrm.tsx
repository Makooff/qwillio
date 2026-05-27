import { Users } from 'lucide-react';
import { AgentDetailShell } from '../../../components/admin/AgentDetailShell';

export default function AdminAgentCrm() {
  return (
    <AgentDetailShell
      agentType="crm"
      displayName="CRM AI"
      icon={Users}
      description="Pipeline management, sync HubSpot, lost-deal analysis, revenue forecast."
    />
  );
}
