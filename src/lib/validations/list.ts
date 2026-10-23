import { z } from "zod";

export const LIST_NAME_MAX = 60;
export const LIST_DESCRIPTION_MAX = 300;
/** Per user, and titles per list: generous, but keeps a runaway script from filling the database */
export const MAX_LISTS = 50;
export const MAX_LIST_ITEMS = 500;

export const listFieldsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Listeye bir ad ver.")
    .max(LIST_NAME_MAX, `Liste adı en fazla ${LIST_NAME_MAX} karakter olabilir.`),
  description: z
    .string()
    .trim()
    .max(LIST_DESCRIPTION_MAX, `Açıklama en fazla ${LIST_DESCRIPTION_MAX} karakter olabilir.`)
    .transform((s) => s || null),
  isPublic: z.boolean(),
});

export type ListFields = z.input<typeof listFieldsSchema>;
