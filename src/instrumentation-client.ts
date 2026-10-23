/**
 * Runs in the browser before the app starts. Tells the top progress bar (components/navigation-progress.tsx)
 * that a page change has begun; most pages have no loading.tsx because of a Next.js 15.5 bug (see README).
 */
export function onRouterTransitionStart(url: string) {
  window.dispatchEvent(new CustomEvent("tracker:navigation-start", { detail: url }));
}
