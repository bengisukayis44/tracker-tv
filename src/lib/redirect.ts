/** Only allow redirects to paths on this site (blocks open redirects such as //evil.com or https://…). */
export function safeRedirect(path: string | undefined | null): string {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return "/";
  return path;
}
