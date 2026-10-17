import { Skeleton } from "@/components/ui/skeleton";

export default function SeriesLoading() {
  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-6 rounded-3xl border p-5 sm:p-8 md:flex-row">
        <Skeleton className="aspect-[2/3] w-36 shrink-0 rounded-xl sm:w-48 md:w-56" />
        <div className="flex-1 space-y-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-24 w-full max-w-3xl" />
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
