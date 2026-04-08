import { LucideIcon, Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ icon: Icon = Inbox, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-4">
        <Icon size={24} className="text-[#8B8BA7]" />
      </div>
      <h3 className="text-base font-semibold text-[#F8F8FF] mb-1">{title}</h3>
      {description && <p className="text-sm text-[#8B8BA7] max-w-sm">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 text-sm font-medium text-white bg-[#7B5CF0] rounded-xl hover:bg-[#6a4ee0] transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
