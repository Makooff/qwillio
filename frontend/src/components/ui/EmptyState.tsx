import { ReactNode } from 'react';
import { t } from '../../styles/admin-theme';

interface Props {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: t.elevated, color: t.textSec }}>
        {icon}
      </div>
      <p className="text-sm font-medium mb-1" style={{ color: t.text }}>{title}</p>
      {description && <p className="text-xs max-w-xs" style={{ color: t.textSec }}>{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
