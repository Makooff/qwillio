interface Props { className?: string; }

export function Skeleton({ className = '' }: Props) {
  return <div className={`animate-pulse bg-white/[0.06] rounded-lg ${className}`} />;
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-8 rounded-xl" />
      </div>
      <Skeleton className="h-8 w-28 mb-1" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-white/[0.04]">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          <Skeleton className={`h-3.5 ${i === 0 ? 'w-36' : i === cols - 1 ? 'w-16' : 'w-24'}`} />
        </td>
      ))}
    </tr>
  );
}

export function ChartSkeleton({ height = 'h-52' }: { height?: string }) {
  return (
    <div className={`${height} rounded-xl bg-white/[0.03] animate-pulse flex items-end gap-1.5 px-3 pb-3`}>
      {[40, 65, 50, 80, 55, 90, 70, 85, 60, 75, 95, 65].map((h, i) => (
        <div key={i} className="flex-1 bg-white/[0.06] rounded-t" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}
