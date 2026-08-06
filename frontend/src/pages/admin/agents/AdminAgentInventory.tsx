import { Package } from '../../../components/icons';
import { AgentDetailShell } from '../../../components/admin/AgentDetailShell';

export default function AdminAgentInventory() {
  return (
    <AgentDetailShell
      agentType="inventory"
      displayName="Inventory AI"
      icon={Package}
      description="Suivi de stock, alertes seuil bas, demandes de réapprovisionnement automatiques."
      runForm="none"
    />
  );
}
