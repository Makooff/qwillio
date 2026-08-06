import { FileText } from '../../../components/icons';
import { AgentDetailShell } from '../../../components/admin/AgentDetailShell';

export default function AdminAgentDocument() {
  return (
    <AgentDetailShell
      agentType="document"
      displayName="Document AI"
      icon={FileText}
      description="Génération devis, contrats, estimates depuis transcript ou items structurés."
    />
  );
}
