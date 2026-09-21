import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Phone } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { displayPhone } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

export function PhoneNumbersDialog({ open, onOpenChange, onChanged }) {
  const [contacts, setContacts] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/roster/contacts");
      setContacts(res.data);
      setDrafts(Object.fromEntries(res.data.map((c) => [c.id, displayPhone(c.phone)])));
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setResult(null);
      load();
    }
  }, [open, load]);

  const save = async (c) => {
    setSavingId(c.id);
    try {
      const res = await api.put(`/roster/${c.id}/phone`, { phone: drafts[c.id] || "" });
      setContacts((prev) => prev.map((x) => (x.id === c.id ? { ...x, phone: res.data.phone } : x)));
      setDrafts((d) => ({ ...d, [c.id]: displayPhone(res.data.phone) }));
      toast.success(res.data.phone ? `Saved number for ${c.name}` : `Removed number for ${c.name}`);
      onChanged?.();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setSavingId(null);
    }
  };

  const runImport = async () => {
    if (!importText.trim()) return;
    setImporting(true);
    try {
      const res = await api.post("/roster/phones/import", { text: importText });
      setResult(res.data);
      await load();
      if (res.data.updated.length) {
        toast.success(`Saved ${res.data.updated.length} ${res.data.updated.length === 1 ? "number" : "numbers"}`);
        onChanged?.();
      } else {
        toast.error("No numbers were saved. Check the lines listed below.");
      }
      if (!res.data.unmatched.length && !res.data.invalid.length) setImportText("");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setImporting(false);
    }
  };

  const withNumber = contacts.filter((c) => c.phone).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" data-testid="phone-numbers-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" /> Player phone numbers
          </DialogTitle>
          <DialogDescription>
            Only the Medical Team can see these; they are used for the WhatsApp reminder buttons. Include the country
            code (for example +91 98765 43210). A 10-digit number is treated as an Indian (+91) number.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-xl border border-border bg-secondary/40 p-3">
          <p className="text-sm font-semibold">Paste many at once</p>
          <p className="text-xs text-muted-foreground">One player per line, like “Aniket, 9876543210”. You can paste straight from Excel (name and number side by side).</p>
          <Textarea
            data-testid="phone-import-textarea" rows={4} value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={"Aniket, 9876543210\nArshdeep, +91 98765 43211"}
            className="resize-none bg-background"
          />
          <Button size="sm" onClick={runImport} disabled={importing || !importText.trim()} data-testid="phone-import-button">
            {importing ? "Importing…" : "Import numbers"}
          </Button>
          {result && (
            <div className="space-y-1 text-xs" data-testid="phone-import-result">
              <p className="font-semibold text-emerald-600 dark:text-emerald-400">Saved: {result.updated.length}</p>
              {result.unmatched.length > 0 && (
                <p className="text-amber-600 dark:text-amber-400" data-testid="phone-import-unmatched">
                  Name not on the roster: {result.unmatched.join(" · ")}
                </p>
              )}
              {result.invalid.length > 0 && (
                <ul className="text-rose-600 dark:text-rose-400" data-testid="phone-import-invalid">
                  {result.invalid.map((x) => <li key={x.line}>“{x.line}” - {x.reason}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground" data-testid="phone-count">
            {withNumber} of {contacts.length} players have a number
          </p>
          {loading && contacts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <ul className="space-y-2">
              {contacts.map((c) => {
                const changed = (drafts[c.id] ?? "") !== displayPhone(c.phone);
                return (
                  <li key={c.id} className="flex items-center gap-2">
                    <span className="w-28 shrink-0 truncate text-sm font-medium sm:w-36">{c.name}</span>
                    <Input
                      type="tel" inputMode="tel" value={drafts[c.id] ?? ""} placeholder="+91 98765 43210"
                      onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && changed && save(c)}
                      data-testid={`phone-input-${c.id}`}
                    />
                    <Button size="sm" variant={changed ? "default" : "outline"} disabled={!changed || savingId === c.id}
                      onClick={() => save(c)} data-testid={`phone-save-${c.id}`}>
                      {savingId === c.id ? "Saving…" : "Save"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
