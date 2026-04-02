import { cn } from "@/lib/utils";

/**
 * @file Skeleton loading component for modern UI feedback during data fetching
 * Provides animated pulse placeholders that mimic content structure
 */

export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-zinc-200", className)}
      {...props}
    />
  );
}

/**
 * Card skeleton for dashboard cards and content blocks
 */
export function CardSkeleton({ className }) {
  return (
    <div className={cn("rounded-lg border border-zinc-200 bg-white p-6", className)}>
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-[200px]" />
          <Skeleton className="h-3 w-[150px]" />
        </div>
      </div>
    </div>
  );
}

/**
 * Table row skeleton for data tables
 */
export function TableRowSkeleton({ columns = 5 }) {
  return (
    <tr className="border-b border-zinc-100">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className={cn("h-4", i === 0 ? "w-8" : "w-full")} />
        </td>
      ))}
    </tr>
  );
}

/**
 * Full table skeleton with multiple rows
 */
export function TableSkeleton({ rows = 5, columns = 5 }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
      <div className="bg-zinc-50 px-4 py-3 border-b border-zinc-200">
        <Skeleton className="h-4 w-48" />
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50/50">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-4 py-3 text-left">
                <Skeleton className="h-3 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Form skeleton for forms with inputs
 */
export function FormSkeleton({ fields = 4 }) {
  return (
    <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6">
      <Skeleton className="h-6 w-48 mb-6" />
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <div className="pt-4">
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}

/**
 * Page header skeleton
 */
export function PageHeaderSkeleton() {
  return (
    <div className="mb-6 space-y-2">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
    </div>
  );
}

/**
 * Stats cards skeleton for dashboard
 */
export function StatsCardsSkeleton({ count = 4 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Full page loading state with multiple skeleton sections
 */
export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <StatsCardsSkeleton />
      <TableSkeleton rows={5} columns={5} />
    </div>
  );
}
