/** Where the phone's Back key should go.
 *
 * Browsers walk back through history in reverse order of what the person did (sign-in screen, entry
 * screen, ...). People expect Back to mean "the page above this one". Every page below has a fixed
 * parent; NavigationGuard enforces it, and so does the in-app Back button (same rule, one place). */

const RULES = [
  [/^\/athlete$/, () => "/"],
  [/^\/team$/, () => "/"],
  [/^\/privacy$/, () => "/"],
  [/^\/athlete\/(individual|join-team)$/, () => "/athlete"],
  [/^\/team\/(register|admin-auth)$/, () => "/team"],
  [/^\/forgot-password$/, (search) => (new URLSearchParams(search).get("role") === "admin" ? "/team/admin-auth" : "/athlete/individual")],
  [/^\/team\/(roster-setup|gps|calendar|player\/[^/]+)$/, () => "/team/home"],
];

export function parentOf(pathname, search = "") {
  for (const [re, parent] of RULES) if (re.test(pathname)) return parent(search);
  return null; // a "root" page: Back leaves the app
}

/** Sign-in / entry screens: pointless to show to someone who is already logged in. */
const PRE_AUTH = new Set(["/", "/athlete", "/athlete/individual", "/athlete/join-team", "/team", "/team/register", "/team/admin-auth", "/forgot-password"]);
export const isPreAuth = (pathname) => PRE_AUTH.has(pathname);

export const homeFor = (role) => (role === "athlete" ? "/athlete/checkin" : role === "team_athlete" ? "/athlete/team" : role === "admin" ? "/team/home" : "/");

/** Athletes stay logged in, so opening the app (or any sign-in page) goes straight to their check-in. Coaches keep the landing page. */
export function autoRedirect(role, pathname) {
  if (role === "athlete" && ["/", "/athlete", "/athlete/individual"].includes(pathname)) return "/athlete/checkin";
  if (role === "team_athlete" && ["/", "/athlete", "/athlete/join-team"].includes(pathname)) return "/athlete/team";
  return null;
}

// idx (position in this tab's history, kept by react-router in history.state) -> pathname there
const stack = {};
export function recordLocation(idx, pathname) {
  stack[idx] = pathname;
  Object.keys(stack).forEach((k) => { if (Number(k) > idx) delete stack[k]; }); // a new push discards the "forward" entries
}
export const previousPath = (idx) => stack[idx - 1] ?? null;
export const currentIdx = () => window.history.state?.idx ?? 0;
