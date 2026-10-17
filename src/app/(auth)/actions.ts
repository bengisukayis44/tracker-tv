"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { safeRedirect } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from "@/lib/validations/auth";

export type AuthFormState = {
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
};

export async function registerAction(values: RegisterInput): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse(values);
  if (!parsed.success) return { error: "Lütfen formdaki hataları düzeltin." };
  const { username, email, password } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
    select: { email: true, username: true },
  });
  if (existing?.email === email) return { fieldErrors: { email: "Bu e-posta adresiyle zaten bir hesap var." } };
  if (existing?.username === username) return { fieldErrors: { username: "Bu kullanıcı adı alınmış." } };

  // The profile row in public."User" is created by a database trigger from this metadata
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username } } });

  if (error) {
    if (error.code === "user_already_exists" || error.code === "email_exists") {
      return { fieldErrors: { email: "Bu e-posta adresiyle zaten bir hesap var." } };
    }
    if (error.code === "weak_password") return { fieldErrors: { password: "Bu şifre çok zayıf." } };
    if (error.code === "over_request_rate_limit" || error.status === 429) {
      return { error: "Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin." };
    }
    console.error("Kayıt başarısız:", error);
    return { error: "Kayıt şu anda yapılamıyor. Biraz sonra tekrar deneyin." };
  }
  // E-posta doğrulaması kapalı olduğu için oturum hemen açılır; açılmadıysa ayar değişmiş demektir
  if (!data.session) return { error: "Hesap oluşturuldu ama oturum açılamadı. Giriş yapmayı deneyin." };

  redirect("/");
}

export async function loginAction(values: LoginInput, callbackUrl?: string): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse(values);
  if (!parsed.success) return { error: "Lütfen formdaki hataları düzeltin." };

  // Supabase signs in by e-mail, so a username is looked up first
  const identifier = parsed.data.identifier.toLowerCase();
  const email = identifier.includes("@")
    ? identifier
    : (await prisma.user.findUnique({ where: { username: identifier }, select: { email: true } }))?.email;

  const invalid = { error: "E-posta/kullanıcı adı veya şifre hatalı." };
  if (!email) return invalid;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
  if (error) {
    if (error.code === "over_request_rate_limit" || error.status === 429) {
      return { error: "Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin." };
    }
    if (error.code !== "invalid_credentials") console.error("Giriş başarısız:", error);
    return invalid;
  }

  redirect(safeRedirect(callbackUrl));
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
