import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-shimmer rounded-md bg-[linear-gradient(90deg,rgb(255_255_255/.04),rgb(255_255_255/.09),rgb(255_255_255/.04))] bg-[length:200%_100%]",
        className,
      )}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="glass space-y-4 rounded-lg p-5" aria-hidden="true">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}
