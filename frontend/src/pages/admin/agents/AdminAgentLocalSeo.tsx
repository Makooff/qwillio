import { MapPin } from 'lucide-react';
import { AgentDetailShell } from '../../../components/admin/AgentDetailShell';

export default function AdminAgentLocalSeo() {
  return (
    <AgentDetailShell
      agentType="local_seo"
      displayName="Local SEO AI"
      icon={MapPin}
      description="Posts Google Business, mots-clés locaux, audit listing, ranking tracking."
    />
  );
}
