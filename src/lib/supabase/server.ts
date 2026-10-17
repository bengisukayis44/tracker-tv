import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Supabase client for Server Components, Server Actions and Route Handlers (session read from cookies). */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl(), supabaseKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only; the middleware refreshes the session
        }
      },
    },
  });
}

export function supabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL tanımlı değil. .env.example dosyasına bakın.");
  return url;
}

export function supabaseKey() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY tanımlı değil. .env.example dosyasına bakın.");
  return key;
}
