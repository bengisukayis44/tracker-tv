import { z } from "zod";

export const COMMENT_MAX_LENGTH = 2000;

/** Where a comment belongs: an episode or a movie. */
export const commentTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("episode"), episodeId: z.string().min(1) }),
  z.object({ kind: z.literal("movie"), titleId: z.string().min(1) }),
]);

const commentFields = {
  content: z
    .string()
    .trim()
    .min(1, "Yorum boş olamaz.")
    .max(COMMENT_MAX_LENGTH, `Yorum en fazla ${COMMENT_MAX_LENGTH} karakter olabilir.`),
  isSpoiler: z.boolean(),
};

export const newCommentSchema = z.object({
  target: commentTargetSchema,
  /** Set for a reply: the (top-level) comment answered */
  parentId: z.string().min(1).optional(),
  ...commentFields,
});
export const editCommentSchema = z.object({ commentId: z.string().min(1), ...commentFields });

export type CommentTarget = z.infer<typeof commentTargetSchema>;
export type NewCommentInput = z.input<typeof newCommentSchema>;
export type EditCommentInput = z.input<typeof editCommentSchema>;
