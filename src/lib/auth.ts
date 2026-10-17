import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; username: string; email: string; avatarUrl: string | null };

/**
 * The signed-in user's profile, or null. Deduplicated per request.
 * getUser() asks Supabase Auth to confirm the session, so deleted or signed-out users are not trusted
 * from a stale cookie.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  // A missing session is normal for visitors; anything else (e.g. rate limiting) is worth knowing about
  if (error && error.name !== "AuthSessionMissingError")
    console.error("Oturum doğrulanamadı:", error.status, error.message);
  if (!user) return null;

  return prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, username: true, email: true, avatarUrl: true },
  });
});
