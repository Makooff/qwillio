import { ReactNode } from 'react';

interface Props {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#7B5CF0]/10 flex items-center justify-center text-[#7B5CF0] mb-4">
        {icon}
      </div>
      <p className="text-sm font-medium text-[#F8F8FF] mb-1">{title}</p>
      {description && <p className="text-xs text-[#8B8BA7] max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
