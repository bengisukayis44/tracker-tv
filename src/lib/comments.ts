/** A comment as the comment list shows it (serializable, safe to send to the browser). */
export type CommentView = {
  id: string;
  content: string;
  isSpoiler: boolean;
  /** ISO time, for sorting */
  createdAt: string;
  /** Pre-formatted on the server so server and browser render the same text */
  createdLabel: string;
  edited: boolean;
  author: { username: string; avatarUrl: string | null };
  likeCount: number;
  likedByMe: boolean;
  mine: boolean;
  /** Answers to this comment, oldest first (replies have none themselves) */
  replies: CommentView[];
};

export const COMMENT_SORTS = [
  { value: "newest", label: "En yeni" },
  { value: "top", label: "En beğenilen" },
] as const;
export type CommentSort = (typeof COMMENT_SORTS)[number]["value"];

/** "En yeni": newest first. "En beğenilen": most likes first, newest first among equals. */
export function sortComments<T extends Pick<CommentView, "createdAt" | "likeCount">>(
  comments: T[],
  sort: CommentSort,
): T[] {
  const newest = (a: T, b: T) => b.createdAt.localeCompare(a.createdAt);
  return [...comments].sort(sort === "top" ? (a, b) => b.likeCount - a.likeCount || newest(a, b) : newest);
}

/** An edit counts once the comment changed noticeably after it was posted (likes do not touch it). */
export function isEdited(createdAt: Date, updatedAt: Date) {
  return updatedAt.getTime() - createdAt.getTime() > 1000;
}

const timeFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
});

/** "21 Ekim 2026 15:32" (Turkish time) */
export function formatCommentTime(date: Date) {
  return timeFormatter.format(date);
}

/**
 * Puts replies under the comment they answer: top-level comments newest first, replies in the order they
 * were written. Replies to comments that are not in the list are dropped.
 */
export function nestReplies(comments: (CommentView & { parentId: string | null })[]): CommentView[] {
  const top = comments.filter((c) => c.parentId === null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const byId = new Map(top.map((c) => [c.id, c]));
  const replies = comments.filter((c) => c.parentId !== null).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const reply of replies) byId.get(reply.parentId!)?.replies.push(reply);
  return top;
}
