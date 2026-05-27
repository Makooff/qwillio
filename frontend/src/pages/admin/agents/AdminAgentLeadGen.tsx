import { Crosshair } from 'lucide-react';
import { AgentDetailShell } from '../../../components/admin/AgentDetailShell';

export default function AdminAgentLeadGen() {
  return (
    <AgentDetailShell
      agentType="lead_gen"
      displayName="Lead Gen AI"
      icon={Crosshair}
      description="Découverte de leads ciblés, séquences multi-touch, handoff vers le Receptionist."
    />
  );
}
