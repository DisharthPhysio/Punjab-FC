import { MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { reminderMessage, whatsappLink } from "@/lib/whatsapp";

export function RemindersDialog({ open, onOpenChange, pending, reminded, onReminded, onAddNumbers }) {
  const link = window.location.origin;
  const missing = pending.filter((a) => !a.phone);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="reminders-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" /> WhatsApp reminders
          </DialogTitle>
          <DialogDescription data-testid="reminders-summary">
            {pending.length === 0
              ? "Everyone has checked in today. 🎉"
              : `${pending.length} ${pending.length === 1 ? "player hasn't" : "players haven't"} checked in yet. Tap a button: WhatsApp opens with the message ready, then press Send.`}
          </DialogDescription>
        </DialogHeader>

        {pending.length > 0 && (
          <>
            <p className="rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground" data-testid="reminder-message-preview">
              Message: “{reminderMessage("[name]", link)}”
            </p>
            <ul className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {pending.map((a) => {
                const done = reminded.includes(a.id);
                return (
                  <li key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2" data-testid={`reminder-row-${a.id}`}>
                    <span className="font-semibold">{a.name}</span>
                    {a.phone ? (
                      <Button asChild size="sm" variant={done ? "outline" : "default"} className="gap-1.5">
                        <a
                          href={whatsappLink(a.phone, reminderMessage(a.name, link))}
                          target="_blank" rel="noopener noreferrer"
                          onClick={() => onReminded(a.id)}
                          data-testid={`send-reminder-${a.id}`}
                        >
                          <MessageCircle className="h-4 w-4" /> {done ? "Reminded ✓ · send again" : "Send on WhatsApp"}
                        </a>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground" data-testid={`no-number-${a.id}`}>No number saved</span>
                    )}
                  </li>
                );
              })}
            </ul>
            {missing.length > 0 && (
              <Button variant="outline" size="sm" className="gap-1.5 self-start" onClick={onAddNumbers} data-testid="reminders-add-numbers-button">
                <Phone className="h-4 w-4" /> Add phone numbers ({missing.length} missing)
              </Button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
