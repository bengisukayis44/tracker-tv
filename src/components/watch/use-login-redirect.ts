"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";

/** Sends a signed-out visitor to the login page and back here afterwards. */
export function useLoginRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  return useCallback(() => router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`), [router, pathname]);
}
