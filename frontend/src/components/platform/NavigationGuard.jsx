import { useEffect, useRef } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { usePlatformAuth } from "@/context/PlatformAuthContext";
import { parentOf, isPreAuth, homeFor, autoRedirect, recordLocation, currentIdx } from "@/lib/navHistory";

/** Mounted once inside the router. Three jobs:
 *  1. Already-logged-in athletes never see sign-in screens: opening the app goes straight to check-in.
 *  2. Pressing the phone's Back key goes to the page's PARENT (lib/navHistory.js), not backwards through
 *     the sequence of options the person tapped.
 *  3. From a home screen, Back leaves the app instead of dropping a logged-in person on the sign-in page. */
export function NavigationGuard() {
  const location = useLocation();
  const navType = useNavigationType();
  const navigate = useNavigate();
  const { role, user, loading } = usePlatformAuth();
  const last = useRef({ idx: null, path: null, search: "" });
  const authed = !!user && !!role;

  useEffect(() => {
    const idx = currentIdx();
    const prev = last.current;
    const moved = prev.path !== location.pathname || prev.idx !== idx;
    recordLocation(idx, location.pathname);
    last.current = { idx, path: location.pathname, search: location.search };
    const wentBack = moved && navType === "POP" && prev.idx !== null && idx < prev.idx;

    if (!loading && authed && isPreAuth(location.pathname)) {
      if (wentBack) {
        // leave the app: jump to before this tab's first page; if there is nowhere to go, fall back to home
        window.history.go(-(idx + 1));
        setTimeout(() => { if (isPreAuth(window.location.pathname)) navigate(homeFor(role), { replace: true }); }, 250);
        return;
      }
      const target = autoRedirect(role, location.pathname);
      if (target) { navigate(target, { replace: true }); return; }
    }
    if (wentBack && prev.path) {
      const expected = parentOf(prev.path, prev.search);
      if (expected && location.pathname !== expected) navigate(expected, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, loading, authed, role]);

  return null;
}
