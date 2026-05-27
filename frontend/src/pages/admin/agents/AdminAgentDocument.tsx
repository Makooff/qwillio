import { FileText } from 'lucide-react';
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
