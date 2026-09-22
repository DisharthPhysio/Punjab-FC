import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/** Back arrow, present on every platform page per spec item 9.
 *  Pass `to` for a fixed destination, otherwise it goes to the previous
 *  page in history (falling back to `fallback` if there's nowhere to go). */
export function BackButton({ to, fallback = "/", label = "Back" }) {
  const navigate = useNavigate();
  const handleClick = () => {
    if (to) return navigate(to);
    if (window.history.length > 2) return navigate(-1);
    navigate(fallback);
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      data-testid="back-button"
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:border-primary/50"
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </button>
  );
}
