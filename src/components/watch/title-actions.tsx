"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck, Heart } from "lucide-react";
import { toast } from "sonner";
import { toggleFavorite, toggleWatchlist } from "@/app/actions/watch";
import { Button } from "@/components/ui/button";
import { AddToListButton } from "@/components/lists/add-to-list-button";
import { cn } from "@/lib/utils";
import { useLoginRedirect } from "./use-login-redirect";

/** "Favorilere ekle" and "Daha sonra izle" toggles on a title. */
export function TitleActions({
  titleId,
  titleName,
  isFavorite,
  inWatchlist,
  signedIn,
}: {
  titleId: string;
  titleName: string;
  isFavorite: boolean;
  inWatchlist: boolean;
  signedIn: boolean;
}) {
  const [, startTransition] = useTransition();
  const [favorite, setFavorite] = useOptimistic(isFavorite);
  const [later, setLater] = useOptimistic(inWatchlist);
  const goToLogin = useLoginRedirect();
  const router = useRouter();

  const toggle = (kind: "favorite" | "later") => {
    if (!signedIn) return goToLogin();
    startTransition(async () => {
      if (kind === "favorite") {
        setFavorite(!favorite);
        const result = await toggleFavorite(titleId);
        if (result.ok) router.refresh();
        if (!result.ok) toast.error(result.error);
        else toast.success(result.active ? "Favorilere eklendi." : "Favorilerden çıkarıldı.");
      } else {
        setLater(!later);
        const result = await toggleWatchlist(titleId);
        if (result.ok) router.refresh();
        if (!result.ok) toast.error(result.error);
        else toast.success(result.active ? "Daha sonra izle listene eklendi." : "Daha sonra izle listenden çıkarıldı.");
      }
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant={favorite ? "secondary" : "outline"} aria-pressed={favorite} onClick={() => toggle("favorite")}>
        <Heart className={cn(favorite && "fill-rose-500 text-rose-500")} />
        {favorite ? "Favorilerde" : "Favorilere ekle"}
      </Button>
      <Button variant={later ? "secondary" : "outline"} aria-pressed={later} onClick={() => toggle("later")}>
        {later ? <BookmarkCheck className="text-primary" /> : <Bookmark />}
        {later ? "Daha sonra izlenecek" : "Daha sonra izle"}
      </Button>
      <AddToListButton titleId={titleId} titleName={titleName} signedIn={signedIn} />
    </div>
  );
}
