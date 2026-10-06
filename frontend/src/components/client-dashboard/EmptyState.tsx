import { LucideIcon, Inbox } from '../icons';
import { t } from '../../styles/admin-theme';
import { ds } from '../../styles/design-system';
import Button from '../ui/Button';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ icon: Icon = Inbox, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: t.elevated, color: t.textSec }}
      >
        <Icon size={24} />
      </div>
      <h3 className="text-base font-semibold mb-1" style={{ color: t.text }}>{title}</h3>
      {description && (
        <p className="text-sm max-w-sm" style={{ color: t.textSec }}>{description}</p>
      )}
      {action && (
        <div className="mt-4">
          <Button variant="primary" size="md" onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}
