import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/** Back arrow, present on every platform page (item 9).
 * Always navigates to a fixed, known destination -- deliberately NOT using
 * browser/router history (navigate(-1)), which was the cause of "back jumps
 * to a random page": history depth varies depending on how the person
 * arrived, redirects/replace navigations shift it further, so two people on
 * the same screen could get two different "back" results. A fixed `to` is
 * predictable every time. Defaults to the landing page if none is given. */
export function BackButton({ to = "/", label = "Back" }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      data-testid="back-button"
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:border-primary/50"
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </button>
  );
}
