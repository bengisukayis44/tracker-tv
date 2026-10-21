"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteComment, editComment } from "@/app/actions/comments";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CommentView } from "@/lib/comments";
import { cn } from "@/lib/utils";
import { CommentForm } from "./comment-form";
import { SpoilerBlur } from "./spoiler-blur";

/** One comment: author, time, text (spoilers hidden unless revealed), like, and edit/delete for the author. */
export function CommentItem({
  comment,
  spoilersRevealed,
  onToggleLike,
}: {
  comment: CommentView;
  /** The viewer has watched it, so spoilers need not be hidden */
  spoilersRevealed: boolean;
  onToggleLike: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, startDelete] = useTransition();
  const router = useRouter();

  const remove = () =>
    startDelete(async () => {
      const result = await deleteComment(comment.id);
      if (!result.ok) return void toast.error(result.error);
      setConfirmDelete(false);
      router.refresh();
      toast.success("Yorumun silindi.");
    });

  const text = <p className="text-foreground/90 break-words whitespace-pre-wrap">{comment.content}</p>;

  return (
    <article aria-label={`@${comment.author.username} yorumu`} className="flex gap-3 py-4">
      <Avatar>
        {comment.author.avatarUrl && <AvatarImage src={comment.author.avatarUrl} alt="" />}
        <AvatarFallback>{comment.author.username.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1 space-y-2">
        <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
          <span className="font-bold">@{comment.author.username}</span>
          {comment.mine && <span className="text-primary text-xs font-semibold">Sen</span>}
          <time dateTime={comment.createdAt} className="text-muted-foreground text-xs">
            {comment.createdLabel}
          </time>
          {comment.edited && <span className="text-muted-foreground text-xs">(düzenlendi)</span>}
          {comment.isSpoiler && (
            <span className="rounded border border-orange-400/30 bg-orange-400/10 px-1.5 text-xs font-semibold text-orange-400">
              Spoiler
            </span>
          )}
        </header>

        {editing ? (
          <CommentForm
            initial={{ content: comment.content, isSpoiler: comment.isSpoiler }}
            submitLabel="Kaydet"
            onCancel={() => setEditing(false)}
            onSubmit={async (draft) => {
              const result = await editComment({ commentId: comment.id, ...draft });
              if (result.ok) {
                setEditing(false);
                router.refresh();
                toast.success("Yorumun güncellendi.");
              }
              return result;
            }}
          />
        ) : comment.isSpoiler ? (
          <SpoilerBlur initiallyRevealed={spoilersRevealed || comment.mine}>{text}</SpoilerBlur>
        ) : (
          text
        )}

        {!editing && (
          <div className="-ml-2 flex flex-wrap items-center gap-1">
            {comment.mine ? (
              <>
                <span className="text-muted-foreground inline-flex items-center gap-1.5 px-2 text-sm">
                  <Heart className="size-4" />
                  <span aria-label={`${comment.likeCount} beğeni`}>{comment.likeCount}</span>
                </span>
                <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                  <Pencil />
                  Düzenle
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                  <Trash2 />
                  Sil
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                aria-pressed={comment.likedByMe}
                aria-label={`Beğen, ${comment.likeCount} beğeni`}
                onClick={onToggleLike}
              >
                <Heart className={cn(comment.likedByMe && "fill-rose-500 text-rose-500")} />
                {comment.likeCount}
              </Button>
            )}
          </div>
        )}
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yorumu sil?</DialogTitle>
            <DialogDescription>Yorumun ve aldığı beğeniler kalıcı olarak silinir.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>
              Vazgeç
            </Button>
            <Button variant="destructive" onClick={remove} disabled={deleting}>
              {deleting && <Loader2 className="animate-spin" />}
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
