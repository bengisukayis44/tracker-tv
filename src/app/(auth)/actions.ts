"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from "@/lib/validations/auth";

export type AuthFormState = {
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
};

// Only allow redirects inside this site
function safeRedirect(path?: string) {
  return path && path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

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

  await prisma.user.create({
    data: { username, email, passwordHash: await bcrypt.hash(password, 12) },
  });

  // signIn redirects by throwing, so it must stay outside try/catch
  await signIn("credentials", { identifier: email, password, redirectTo: "/" });
  return {};
}

export async function loginAction(values: LoginInput, callbackUrl?: string): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse(values);
  if (!parsed.success) return { error: "Lütfen formdaki hataları düzeltin." };

  try {
    await signIn("credentials", { ...parsed.data, redirectTo: safeRedirect(callbackUrl) });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "E-posta/kullanıcı adı veya şifre hatalı." };
    }
    throw error;
  }
  return {};
}

export async function googleSignInAction(callbackUrl?: string) {
  await signIn("google", { redirectTo: safeRedirect(callbackUrl) });
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}
