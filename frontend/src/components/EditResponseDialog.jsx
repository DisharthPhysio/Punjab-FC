import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { WellnessRating } from "@/components/WellnessRating";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const SESSION_TYPES = ["Field / Pitch", "Gym / Strength", "Conditioning", "Match", "Recovery", "Other"];
const ILL_SEVERITY = ["Mild", "Moderate", "Severe"];

export function EditResponseDialog({ response, open, onOpenChange, onSaved }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (response) {
      setForm({
        sleepQuality: response.sleepQuality || 3,
        hydration: response.hydration || 3,
        motivation: response.motivation || 3,
        feelingIll: !!response.feelingIll,
        illnessSeverity: response.illnessSeverity || "Mild",
        sorenessSeverity: response.sorenessSeverity || 0,
        logSession: response.load != null,
        sessionType: response.sessionType || "Field / Pitch",
        rpe: response.rpe || 5,
        duration: response.duration || 60,
      });
    }
  }, [response]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/checkins/${response.id}`, {
        sleepQuality: form.sleepQuality,
        hydration: form.hydration,
        motivation: form.motivation,
        feelingIll: form.feelingIll,
        illnessSeverity: form.feelingIll ? form.illnessSeverity : null,
        sorenessSeverity: Number(form.sorenessSeverity) || null,
        logSession: form.logSession,
        sessionType: form.sessionType,
        rpe: form.logSession ? Number(form.rpe) : null,
        duration: form.logSession ? Number(form.duration) : null,
      });
      toast.success(`Updated ${response.name}'s response`);
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  if (!form) return null;
  const liveLoad = form.logSession ? (Number(form.rpe) || 0) * (Number(form.duration) || 0) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" data-testid="edit-response-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-black uppercase tracking-tight">
            <Pencil className="h-5 w-5 text-primary" /> Edit — {response?.name}
          </DialogTitle>
          <DialogDescription>Fix any values entered incorrectly. Changes recalculate load & risk instantly.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div>
            <Label className="mb-2 block">Sleep quality</Label>
            <WellnessRating value={form.sleepQuality} onChange={(v) => set("sleepQuality", v)} testIdPrefix="edit-sleep" />
          </div>
          <div>
            <Label className="mb-2 block">Hydration</Label>
            <WellnessRating value={form.hydration} onChange={(v) => set("hydration", v)} testIdPrefix="edit-hydration" />
          </div>
          <div>
            <Label className="mb-2 block">Motivation</Label>
            <WellnessRating value={form.motivation} onChange={(v) => set("motivation", v)} testIdPrefix="edit-motivation" />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <Label htmlFor="edit-ill">Feeling ill?</Label>
            <Switch id="edit-ill" checked={form.feelingIll} onCheckedChange={(v) => set("feelingIll", v)} data-testid="edit-illness-toggle" />
          </div>
          {form.feelingIll && (
            <div>
              <Label className="mb-2 block">Illness severity</Label>
              <div className="flex gap-2">
                {ILL_SEVERITY.map((s) => (
                  <button key={s} onClick={() => set("illnessSeverity", s)}
                    className={`rounded-lg border px-3 py-1.5 text-sm ${form.illnessSeverity === s ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
                    data-testid={`edit-illness-${s}`}>{s}</button>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label className="mb-2 block">Soreness severity (0 = none)</Label>
            <div className="flex gap-2">
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => set("sorenessSeverity", n)}
                  className={`h-11 flex-1 rounded-xl border font-bold transition-all ${Number(form.sorenessSeverity) === n ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary text-muted-foreground"}`}
                  data-testid={`edit-soreness-${n}`}>{n}</button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <Label htmlFor="edit-session">Training session logged?</Label>
            <Switch id="edit-session" checked={form.logSession} onCheckedChange={(v) => set("logSession", v)} data-testid="edit-session-toggle" />
          </div>
          {form.logSession && (
            <div className="space-y-4 rounded-xl border border-border p-3">
              <div>
                <Label className="mb-2 block">Session type</Label>
                <div className="flex flex-wrap gap-2">
                  {SESSION_TYPES.map((t) => (
                    <button key={t} onClick={() => set("sessionType", t)}
                      className={`rounded-lg border px-3 py-1.5 text-xs ${form.sessionType === t ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
                      data-testid={`edit-session-type-${t}`}>{t}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1 block">RPE (1-10)</Label>
                  <Input type="number" min={1} max={10} value={form.rpe} onChange={(e) => set("rpe", e.target.value)} data-testid="edit-rpe-input" />
                </div>
                <div>
                  <Label className="mb-1 block">Duration (min)</Label>
                  <Input type="number" min={1} value={form.duration} onChange={(e) => set("duration", e.target.value)} data-testid="edit-duration-input" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Training load: <span className="font-mono font-bold text-foreground" data-testid="edit-live-load">{liveLoad}</span></p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="edit-cancel-button">Cancel</Button>
          <Button onClick={save} disabled={saving} data-testid="edit-save-button">{saving ? "Saving…" : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
