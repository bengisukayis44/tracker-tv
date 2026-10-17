import { z } from "zod";

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Kullanıcı adı en az 3 karakter olmalı.")
    .max(20, "Kullanıcı adı en fazla 20 karakter olabilir.")
    .regex(/^[a-z0-9_]+$/, "Sadece küçük harf, rakam ve alt çizgi kullanılabilir."),
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta adresi girin."),
  password: z.string().min(8, "Şifre en az 8 karakter olmalı.").max(72, "Şifre en fazla 72 karakter olabilir."),
});

export const loginSchema = z.object({
  // E-posta ya da kullanıcı adı
  identifier: z.string().trim().min(1, "E-posta veya kullanıcı adı girin."),
  password: z.string().min(1, "Şifrenizi girin."),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
