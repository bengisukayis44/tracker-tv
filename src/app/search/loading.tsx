import { Skeleton } from "@/components/ui/skeleton";

export default function SearchLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-5 w-72" />
      </div>
      <Skeleton className="h-10 max-w-2xl" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="aspect-[2/3] rounded-xl" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
