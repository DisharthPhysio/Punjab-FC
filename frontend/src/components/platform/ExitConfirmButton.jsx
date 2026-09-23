import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { usePlatformAuth } from "@/context/PlatformAuthContext";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/** Used at the TOP of an authenticated area (e.g. the athlete/team home screen).
 * Going further back from here means leaving the logged-in area entirely, so
 * it asks first and, on confirm, logs out — the person has to log in again
 * next time, exactly like a deliberate sign-out. */
export function ExitConfirmButton({ label = "Back" }) {
  const navigate = useNavigate();
  const { logout } = usePlatformAuth();
  const [open, setOpen] = useState(false);

  const confirmExit = () => {
    logout();
    setOpen(false);
    navigate("/", { replace: true });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          data-testid="exit-confirm-button"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:border-primary/50"
        >
          <ArrowLeft className="h-4 w-4" />
          {label}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Exit and log out?</AlertDialogTitle>
          <AlertDialogDescription>
            You'll be signed out and need to log in again next time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="exit-confirm-cancel">Stay</AlertDialogCancel>
          <AlertDialogAction onClick={confirmExit} data-testid="exit-confirm-ok">Log out</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
