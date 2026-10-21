import { z } from "zod";
import { EMOTION_VALUES } from "@/lib/emotions";

export const NOTE_MAX_LENGTH = 1000;

/** "İzledim" form fields, shared by episodes and movies: all optional. */
const watchFields = {
  rating: z
    .number()
    .int()
    .min(1, "Puan 1 ile 10 arasında olmalı.")
    .max(10, "Puan 1 ile 10 arasında olmalı.")
    .nullable(),
  emotions: z
    .array(z.enum(EMOTION_VALUES))
    .max(EMOTION_VALUES.length)
    .transform((list) => [...new Set(list)]),
  note: z
    .string()
    .max(NOTE_MAX_LENGTH, `Not en fazla ${NOTE_MAX_LENGTH} karakter olabilir.`)
    .transform((s) => s.trim() || null)
    .nullable(),
};

export const watchEpisodeSchema = z.object({ episodeId: z.string().min(1), ...watchFields });
export const watchMovieSchema = z.object({ titleId: z.string().min(1), ...watchFields });

export type WatchEpisodeInput = z.input<typeof watchEpisodeSchema>;
export type WatchMovieInput = z.input<typeof watchMovieSchema>;

export const idSchema = z.string().min(1);
export const idListSchema = z.array(z.string().min(1)).min(1).max(2000);
