import { Skeleton } from "@/components/ui/skeleton";

export default function EpisodeLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Skeleton className="h-4 w-64" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-5 w-80" />
      </div>
      <Skeleton className="aspect-video rounded-2xl" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
