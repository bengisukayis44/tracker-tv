"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { addComment, toggleCommentLike } from "@/app/actions/comments";
import { Button } from "@/components/ui/button";
import { useLoginRedirect } from "@/components/watch/use-login-redirect";
import { COMMENT_SORTS, sortComments, type CommentSort, type CommentView } from "@/lib/comments";
import type { CommentTarget } from "@/lib/validations/comment";
import { cn } from "@/lib/utils";
import { CommentForm } from "./comment-form";
import { CommentItem } from "./comment-item";

/**
 * Comments of an episode or movie (PROJE_PLANI.md §4.6): write, sort (newest / most liked), like,
 * and edit or delete your own. Sorting happens in the browser, so it needs no navigation.
 */
export function CommentSection({
  target,
  comments,
  signedIn,
  spoilersRevealed,
}: {
  target: CommentTarget;
  comments: CommentView[];
  signedIn: boolean;
  /** The viewer has watched it: spoilers are shown openly */
  spoilersRevealed: boolean;
}) {
  const [sort, setSort] = useState<CommentSort>("newest");
  // Likes given here apply at once, so "En beğenilen" does not wait for the page to refresh
  const [likes, setLikes] = useState<Record<string, Pick<CommentView, "likedByMe" | "likeCount">>>({});
  const router = useRouter();
  const pathname = usePathname();
  const goToLogin = useLoginRedirect();
  // Likes given here, on comments and replies alike
  const withLikes = (c: CommentView): CommentView => ({ ...c, ...likes[c.id], replies: c.replies.map(withLikes) });
  const sorted = sortComments(comments.map(withLikes), sort);
  const total = comments.reduce((sum, c) => sum + 1 + c.replies.length, 0);

  const toggleLike = async (comment: CommentView) => {
    if (!signedIn) return goToLogin();
    // `comment` is the state before this click
    const set = (likedByMe: boolean) =>
      setLikes((prev) => ({
        ...prev,
        [comment.id]: {
          likedByMe,
          likeCount: comment.likeCount + (likedByMe === comment.likedByMe ? 0 : likedByMe ? 1 : -1),
        },
      }));
    set(!comment.likedByMe);
    const result = await toggleCommentLike(comment.id);
    if (result.ok) set(result.liked);
    else {
      set(comment.likedByMe);
      toast.error(result.error);
    }
  };

  return (
    <section aria-labelledby="comments-heading" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="comments-heading" className="inline-flex items-center gap-2 text-lg font-bold">
          <MessageSquare className="size-5" />
          Yorumlar
          <span className="text-muted-foreground font-semibold">({total})</span>
        </h2>
        {comments.length > 1 && (
          <div role="group" aria-label="Yorum sıralaması" className="bg-muted inline-flex rounded-lg p-1">
            {COMMENT_SORTS.map((s) => (
              <button
                key={s.value}
                type="button"
                aria-pressed={sort === s.value}
                onClick={() => setSort(s.value)}
                className={cn(
                  "rounded-md px-3 py-1 text-sm font-semibold transition-colors",
                  sort === s.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-card rounded-2xl border p-4">
        {signedIn ? (
          <CommentForm
            submitLabel="Gönder"
            onSubmit={async (draft) => {
              const result = await addComment({ target, ...draft });
              if (result.ok) {
                setSort("newest");
                router.refresh();
                toast.success("Yorumun paylaşıldı.");
              }
              return result;
            }}
          />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-muted-foreground">Yorum yazmak ve beğenmek için giriş yap.</p>
            <Button asChild size="sm">
              <Link href={`/login?callbackUrl=${encodeURIComponent(pathname)}`}>Giriş yap</Link>
            </Button>
          </div>
        )}
      </div>

      {comments.length === 0 ? (
        <p className="text-muted-foreground text-sm">Henüz yorum yok. İlk yorumu sen yaz!</p>
      ) : (
        <div className="divide-y">
          {sorted.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              spoilersRevealed={spoilersRevealed}
              onToggleLike={toggleLike}
              reply={{ target, signedIn }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
