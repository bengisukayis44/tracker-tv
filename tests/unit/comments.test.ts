import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatCommentTime, isEdited, nestReplies, sortComments, type CommentView } from "@/lib/comments";
import { COMMENT_MAX_LENGTH, editCommentSchema, newCommentSchema } from "@/lib/validations/comment";

// In-memory stand-ins for the database, the session and Next's cache
const { db, auth, notifications } = vi.hoisted(() => ({
  notifications: { notify: vi.fn(), unnotify: vi.fn() },
  db: {
    comment: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() },
    commentLike: { findUnique: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() },
    title: { findFirst: vi.fn() },
    episode: { findUnique: vi.fn() },
  },
  auth: { getCurrentUser: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => auth);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/notifications", () => notifications);

const { addComment, deleteComment, editComment, toggleCommentLike } = await import("@/app/actions/comments");

const ME = { id: "me", username: "ben", email: "ben@example.com", avatarUrl: null };
const movieTarget = { kind: "movie", titleId: "movie1" } as const;

describe("sortComments", () => {
  const list = [
    { id: "old-popular", createdAt: "2026-10-01T10:00:00.000Z", likeCount: 5 },
    { id: "new", createdAt: "2026-10-03T10:00:00.000Z", likeCount: 0 },
    { id: "mid-popular", createdAt: "2026-10-02T10:00:00.000Z", likeCount: 5 },
  ];

  it("newest first", () => {
    expect(sortComments(list, "newest").map((c) => c.id)).toEqual(["new", "mid-popular", "old-popular"]);
  });

  it("most liked first, newest first among equals, without changing the input", () => {
    expect(sortComments(list, "top").map((c) => c.id)).toEqual(["mid-popular", "old-popular", "new"]);
    expect(list[0].id).toBe("old-popular");
  });
});

describe("comment helpers", () => {
  it("counts a comment as edited only when it changed after posting", () => {
    const at = new Date("2026-10-21T12:00:00Z");
    expect(isEdited(at, new Date(at.getTime() + 200))).toBe(false);
    expect(isEdited(at, new Date(at.getTime() + 60_000))).toBe(true);
  });

  it("shows the time in Turkish time", () => {
    expect(formatCommentTime(new Date("2026-10-21T12:05:00Z"))).toBe("21 Ekim 2026 15:05");
  });
});

describe("comment validation", () => {
  it("trims the text and rejects empty or overlong comments", () => {
    const parsed = newCommentSchema.parse({ target: movieTarget, content: "  Harika!  ", isSpoiler: false });
    expect(parsed.content).toBe("Harika!");
    expect(newCommentSchema.safeParse({ target: movieTarget, content: "   ", isSpoiler: false }).success).toBe(false);
    const long = "x".repeat(COMMENT_MAX_LENGTH + 1);
    expect(editCommentSchema.safeParse({ commentId: "c1", content: long, isSpoiler: false }).success).toBe(false);
  });

  it("needs a known target kind with its id", () => {
    expect(
      newCommentSchema.safeParse({ target: { kind: "series", titleId: "x" }, content: "a", isSpoiler: false }).success,
    ).toBe(false);
    expect(newCommentSchema.safeParse({ target: { kind: "episode" }, content: "a", isSpoiler: false }).success).toBe(
      false,
    );
  });
});

describe("comment permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.getCurrentUser.mockResolvedValue(ME);
    db.title.findFirst.mockResolvedValue({ tmdbId: 27205 });
    db.comment.findUnique.mockResolvedValue({ userId: "someone-else", episodeId: null, titleId: "movie1" });
  });

  it("asks visitors to log in and writes nothing", async () => {
    auth.getCurrentUser.mockResolvedValue(null);
    for (const result of [
      await addComment({ target: movieTarget, content: "a", isSpoiler: false }),
      await editComment({ commentId: "c1", content: "a", isSpoiler: false }),
      await deleteComment("c1"),
      await toggleCommentLike("c1"),
    ]) {
      expect(result).toMatchObject({ ok: false, needsLogin: true });
    }
    expect(db.comment.create).not.toHaveBeenCalled();
    expect(db.commentLike.createMany).not.toHaveBeenCalled();
  });

  it("saves a new comment for the signed-in user on an existing movie", async () => {
    expect(await addComment({ target: movieTarget, content: " Güzel ", isSpoiler: true })).toEqual({ ok: true });
    expect(db.comment.create).toHaveBeenCalledWith({
      data: { userId: "me", content: "Güzel", isSpoiler: true, parentId: null, titleId: "movie1" },
      select: { id: true },
    });
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it("saves a reply to a top-level comment on the same movie and tells its author", async () => {
    db.comment.create.mockResolvedValue({ id: "reply1" });
    db.comment.findFirst.mockResolvedValue({ userId: "someone-else" });
    expect(await addComment({ target: movieTarget, parentId: "c1", content: "Katılıyorum", isSpoiler: false })).toEqual(
      {
        ok: true,
      },
    );
    // Only a top-level comment on the same movie can be answered
    expect(db.comment.findFirst).toHaveBeenCalledWith({
      where: { id: "c1", parentId: null, titleId: "movie1" },
      select: { userId: true },
    });
    expect(db.comment.create.mock.calls[0][0].data).toMatchObject({ parentId: "c1", titleId: "movie1" });
    expect(notifications.notify).toHaveBeenCalledWith("someone-else", "me", "REPLY", "reply1");
  });

  it("refuses a reply to a reply or to a comment elsewhere", async () => {
    db.comment.findFirst.mockResolvedValue(null);
    expect(await addComment({ target: movieTarget, parentId: "r1", content: "a", isSpoiler: false })).toMatchObject({
      ok: false,
    });
    expect(db.comment.create).not.toHaveBeenCalled();
  });

  it("refuses comments on a movie that does not exist", async () => {
    db.title.findFirst.mockResolvedValue(null);
    expect(await addComment({ target: movieTarget, content: "a", isSpoiler: false })).toMatchObject({ ok: false });
    expect(db.comment.create).not.toHaveBeenCalled();
  });

  it("lets nobody but the author edit or delete a comment", async () => {
    expect(await editComment({ commentId: "c1", content: "a", isSpoiler: false })).toMatchObject({ ok: false });
    expect(await deleteComment("c1")).toMatchObject({ ok: false });
    expect(db.comment.update).not.toHaveBeenCalled();
    expect(db.comment.delete).not.toHaveBeenCalled();

    db.comment.findUnique.mockResolvedValue({ userId: "me", episodeId: null, titleId: "movie1" });
    expect(await editComment({ commentId: "c1", content: "yeni", isSpoiler: false })).toEqual({ ok: true });
    expect(await deleteComment("c1")).toEqual({ ok: true });
    expect(db.comment.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { content: "yeni", isSpoiler: false },
    });
    expect(db.comment.delete).toHaveBeenCalledWith({ where: { id: "c1" } });
  });

  it("likes and unlikes others' comments but not your own", async () => {
    db.commentLike.findUnique.mockResolvedValue(null);
    expect(await toggleCommentLike("c1")).toEqual({ ok: true, liked: true });
    expect(notifications.notify).toHaveBeenCalledWith("someone-else", "me", "LIKE", "c1");
    db.commentLike.findUnique.mockResolvedValue({ userId: "me", commentId: "c1" });
    expect(await toggleCommentLike("c1")).toEqual({ ok: true, liked: false });
    expect(db.commentLike.deleteMany).toHaveBeenCalledWith({ where: { userId: "me", commentId: "c1" } });
    expect(notifications.unnotify).toHaveBeenCalledWith("someone-else", "me", "LIKE", "c1");

    db.comment.findUnique.mockResolvedValue({ userId: "me", episodeId: null, titleId: "movie1" });
    expect(await toggleCommentLike("c1")).toMatchObject({ ok: false });
    expect(db.commentLike.createMany).toHaveBeenCalledTimes(1);
  });
});

describe("nestReplies", () => {
  const view = (id: string, createdAt: string, parentId: string | null) =>
    ({
      id,
      parentId,
      createdAt,
      replies: [],
      content: id,
      isSpoiler: false,
      createdLabel: "",
      edited: false,
      author: { username: "a", avatarUrl: null },
      likeCount: 0,
      likedByMe: false,
      mine: false,
    }) as CommentView & { parentId: string | null };

  it("puts replies under their comment, comments newest first and replies oldest first", () => {
    const nested = nestReplies([
      view("eski", "2026-10-01T10:00:00Z", null),
      view("cevap-2", "2026-10-03T10:00:00Z", "eski"),
      view("yeni", "2026-10-02T10:00:00Z", null),
      view("cevap-1", "2026-10-02T12:00:00Z", "eski"),
      view("sahipsiz", "2026-10-02T12:00:00Z", "yok"),
    ]);
    expect(nested.map((c) => [c.id, c.replies.map((r) => r.id)])).toEqual([
      ["yeni", []],
      ["eski", ["cevap-1", "cevap-2"]],
    ]);
  });
});
