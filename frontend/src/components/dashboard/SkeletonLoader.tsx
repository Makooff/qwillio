interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-white/[0.07] rounded ${className}`} />
  );
}

export function MetricCardSkeleton() {
  return (
    <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5 animate-pulse">
      <div className="flex justify-between mb-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      <Skeleton className="h-8 w-28 mb-2" />
      <Skeleton className="h-8 w-20" />
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-white/[0.04]">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-4 px-4">
          <Skeleton className={`h-4 ${i === 0 ? 'w-36' : i === 1 ? 'w-20' : 'w-16'}`} />
        </td>
      ))}
    </tr>
  );
}

export function ChartSkeleton({ height = 'h-64' }: { height?: string }) {
  return (
    <div className={`${height} rounded-xl bg-[#0D0D15] border border-white/[0.04] animate-pulse`} />
  );
}

export default function SkeletonLoader({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} cols={cols} />
      ))}
    </tbody>
  );
}
