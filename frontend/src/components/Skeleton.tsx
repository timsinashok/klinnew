export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-neutral-200 rounded animate-pulse ${className}`} />;
}

export function SkeletonRow({ cols = 6 }: { cols?: number }) {
  return (
    <tr className="border-b last:border-b-0">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-2">
          <Skeleton className="h-5 w-full" />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonGrid({ cols = 6, rows = 4 }: { cols?: number; rows?: number }) {
  return (
    <div className="border rounded bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 border-b">
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="px-3 py-2">
                <Skeleton className="h-3 w-16" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonRow key={i} cols={cols} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
