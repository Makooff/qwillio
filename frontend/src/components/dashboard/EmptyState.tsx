import { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#7B5CF0]/10 flex items-center justify-center mb-4 text-[#7B5CF0]">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-[#F8F8FF] mb-2">{title}</h3>
      <p className="text-sm text-[#8B8BA7] max-w-xs mb-6">{description}</p>
      {action}
    </div>
  );
}
