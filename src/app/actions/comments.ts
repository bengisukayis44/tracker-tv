"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  editCommentSchema,
  newCommentSchema,
  type CommentTarget,
  type EditCommentInput,
  type NewCommentInput,
} from "@/lib/validations/comment";
import { idSchema } from "@/lib/validations/watch";
import type { ActionResult } from "./watch";

const LOGIN_REQUIRED = { ok: false, error: "Bunun için giriş yapmalısın.", needsLogin: true } as const;
const COMMENT_NOT_FOUND = { ok: false, error: "Yorum bulunamadı." } as const;

function invalid(error: { issues: { message: string }[] }) {
  return { ok: false, error: error.issues[0]?.message ?? "Geçersiz bilgi." } as const;
}

/** The page a comment target lives on, for revalidation; null when the episode or movie does not exist. */
async function targetPath(target: CommentTarget): Promise<string | null> {
  if (target.kind === "movie") {
    const movie = await prisma.title.findFirst({
      where: { id: target.titleId, type: "MOVIE" },
      select: { tmdbId: true },
    });
    return movie ? `/movie/${movie.tmdbId}` : null;
  }
  const episode = await prisma.episode.findUnique({
    where: { id: target.episodeId },
    select: { episodeNumber: true, season: { select: { seasonNumber: true, title: { select: { tmdbId: true } } } } },
  });
  if (!episode) return null;
  const { seasonNumber, title } = episode.season;
  return `/series/${title.tmdbId}/season/${seasonNumber}/episode/${episode.episodeNumber}`;
}

/** Where an existing comment lives, together with its author. */
async function findComment(commentId: string) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { userId: true, episodeId: true, titleId: true },
  });
  if (!comment) return null;
  const target: CommentTarget = comment.episodeId
    ? { kind: "episode", episodeId: comment.episodeId }
    : { kind: "movie", titleId: comment.titleId! };
  return { userId: comment.userId, target };
}

export async function addComment(input: NewCommentInput): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;

  const parsed = newCommentSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { target, content, isSpoiler } = parsed.data;

  const path = await targetPath(target);
  if (!path) return { ok: false, error: target.kind === "movie" ? "Film bulunamadı." : "Bölüm bulunamadı." };

  await prisma.comment.create({
    data: {
      userId: user.id,
      content,
      isSpoiler,
      ...(target.kind === "episode" ? { episodeId: target.episodeId } : { titleId: target.titleId }),
    },
  });
  revalidatePath(path);
  return { ok: true };
}

/** Only the author can edit a comment. */
export async function editComment(input: EditCommentInput): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;

  const parsed = editCommentSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { commentId, content, isSpoiler } = parsed.data;

  const comment = await findComment(commentId);
  if (!comment) return COMMENT_NOT_FOUND;
  if (comment.userId !== user.id) return { ok: false, error: "Yalnızca kendi yorumunu düzenleyebilirsin." };

  await prisma.comment.update({ where: { id: commentId }, data: { content, isSpoiler } });
  const path = await targetPath(comment.target);
  if (path) revalidatePath(path);
  return { ok: true };
}

/** Only the author can delete a comment; its likes go with it. */
export async function deleteComment(commentId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;
  if (!idSchema.safeParse(commentId).success) return COMMENT_NOT_FOUND;

  const comment = await findComment(commentId);
  if (!comment) return COMMENT_NOT_FOUND;
  if (comment.userId !== user.id) return { ok: false, error: "Yalnızca kendi yorumunu silebilirsin." };

  await prisma.comment.delete({ where: { id: commentId } });
  const path = await targetPath(comment.target);
  if (path) revalidatePath(path);
  return { ok: true };
}

/** Likes or unlikes someone else's comment. */
export async function toggleCommentLike(commentId: string): Promise<ActionResult<{ liked: boolean }>> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;
  if (!idSchema.safeParse(commentId).success) return COMMENT_NOT_FOUND;

  const comment = await findComment(commentId);
  if (!comment) return COMMENT_NOT_FOUND;
  if (comment.userId === user.id) return { ok: false, error: "Kendi yorumunu beğenemezsin." };

  const where = { userId_commentId: { userId: user.id, commentId } };
  const liked = !(await prisma.commentLike.findUnique({ where }));
  if (liked) await prisma.commentLike.createMany({ data: [{ userId: user.id, commentId }], skipDuplicates: true });
  else await prisma.commentLike.deleteMany({ where: { userId: user.id, commentId } });

  const path = await targetPath(comment.target);
  if (path) revalidatePath(path);
  return { ok: true, liked };
}
