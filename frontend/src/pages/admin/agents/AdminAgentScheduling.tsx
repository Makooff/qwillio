import { CalendarClock } from 'lucide-react';
import { AgentDetailShell } from '../../../components/admin/AgentDetailShell';

export default function AdminAgentScheduling() {
  return (
    <AgentDetailShell
      agentType="scheduling"
      displayName="Scheduling AI"
      icon={CalendarClock}
      description="Optimisation des rendez-vous, anti no-show, recommandation de créneaux."
    />
  );
}
