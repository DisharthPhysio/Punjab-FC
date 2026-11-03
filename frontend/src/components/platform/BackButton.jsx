import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { previousPath, currentIdx } from "@/lib/navHistory";

/** Back arrow, present on every platform page (item 9).
 * Always navigates to a fixed, known destination -- deliberately NOT using
 * browser/router history (navigate(-1)), which was the cause of "back jumps
 * to a random page": history depth varies depending on how the person
 * arrived, redirects/replace navigations shift it further, so two people on
 * the same screen could get two different "back" results. A fixed `to` is
 * predictable every time. Defaults to the landing page if none is given. */
export function BackButton({ to = "/", label }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <button
      type="button"
      // Same rule as the phone's Back key: if the page above us is already the previous history entry just step
      // back to it, otherwise replace this page with it. Either way history never piles up in reverse order.
      onClick={() => (previousPath(currentIdx()) === to ? navigate(-1) : navigate(to, { replace: true }))}
      data-testid="back-button"
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:border-primary/50"
    >
      <ArrowLeft className="h-4 w-4" />
      {label || t("common.back")}
    </button>
  );
}
