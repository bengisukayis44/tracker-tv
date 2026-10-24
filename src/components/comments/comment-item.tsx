"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Loader2, MessageSquareReply, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addComment, deleteComment, editComment } from "@/app/actions/comments";
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
import type { CommentTarget } from "@/lib/validations/comment";
import { useLoginRedirect } from "@/components/watch/use-login-redirect";
import { cn } from "@/lib/utils";
import { CommentForm } from "./comment-form";
import { ReportButton } from "./report-button";
import { SpoilerBlur } from "./spoiler-blur";

/**
 * One comment: author, time, text (spoilers hidden unless revealed), like, edit/delete for the author and,
 * on top-level comments, "Cevapla" with the replies underneath.
 */
export function CommentItem({
  comment,
  spoilersRevealed,
  onToggleLike,
  reply,
  signedIn,
}: {
  comment: CommentView;
  /** The viewer has watched it, so spoilers need not be hidden */
  spoilersRevealed: boolean;
  onToggleLike: (comment: CommentView) => void;
  /** Given for top-level comments: where a reply goes. Replies themselves cannot be answered */
  reply?: { target: CommentTarget; signedIn: boolean };
  signedIn: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [replying, setReplying] = useState(false);
  const goToLogin = useLoginRedirect();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, startDelete] = useTransition();
  const router = useRouter();
  const profileHref = `/profile/${comment.author.username}`;

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
    <div>
      <article
        id={`yorum-${comment.id}`}
        aria-label={`@${comment.author.username} yorumu`}
        // Below the sticky header when a notification links here
        className="flex scroll-mt-36 gap-3 py-4"
      >
        <Link href={profileHref} aria-hidden tabIndex={-1} className="shrink-0">
          <Avatar>
            {comment.author.avatarUrl && <AvatarImage src={comment.author.avatarUrl} alt="" />}
            <AvatarFallback>{comment.author.username.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Link>

        <div className="min-w-0 flex-1 space-y-2">
          <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
            <Link href={profileHref} className="hover:text-primary font-bold">
              @{comment.author.username}
            </Link>
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
                  onClick={() => onToggleLike(comment)}
                >
                  <Heart className={cn(comment.likedByMe && "fill-rose-500 text-rose-500")} />
                  {comment.likeCount}
                </Button>
              )}
              {reply && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-expanded={replying}
                  onClick={() => (reply.signedIn ? setReplying(!replying) : goToLogin())}
                >
                  <MessageSquareReply />
                  Cevapla
                </Button>
              )}
              {!comment.mine && (
                <ReportButton commentId={comment.id} username={comment.author.username} signedIn={signedIn} />
              )}
            </div>
          )}
          {reply && replying && (
            <CommentForm
              label="Cevabın"
              placeholder={`@${comment.author.username} kullanıcısına cevap yaz…`}
              submitLabel="Cevapla"
              onCancel={() => setReplying(false)}
              onSubmit={async (draft) => {
                const result = await addComment({ target: reply.target, parentId: comment.id, ...draft });
                if (result.ok) {
                  setReplying(false);
                  router.refresh();
                  toast.success("Cevabın paylaşıldı.");
                }
                return result;
              }}
            />
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
      {comment.replies.length > 0 && (
        <div aria-label={`@${comment.author.username} yorumuna cevaplar`} role="group" className="ml-11 border-l pl-4">
          {comment.replies.map((answer) => (
            <CommentItem
              key={answer.id}
              comment={answer}
              spoilersRevealed={spoilersRevealed}
              onToggleLike={onToggleLike}
              signedIn={signedIn}
            />
          ))}
        </div>
      )}
    </div>
  );
}
