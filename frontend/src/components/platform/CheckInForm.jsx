import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Activity, Moon, Droplets, Flame, Thermometer, Dumbbell, ShieldAlert } from "lucide-react";
import { WellnessRating } from "@/components/WellnessRating";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SYMPTOMS = ["Sore throat", "Cough", "Fever", "Runny nose", "Headache", "Fatigue", "Stomach ache", "Constipation", "Diarrhea", "Body ache"];
const SORENESS_AREAS = ["Lower Back", "Hamstrings", "Quadriceps", "Calves", "Shoulders", "Gluteus", "Groin", "Upper Back / Neck"];
const SORENESS_SIDES = ["Right", "Left", "Both"];
const SESSION_TYPES = ["Field / Pitch", "Gym / Strength", "Conditioning", "Match / Game", "Recovery", "Skills"];

const Section = ({ icon: Icon, title, subtitle, children }) => (
  <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
    <div className="mb-4 flex items-start gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h3 className="text-lg font-bold leading-tight">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
    {children}
  </div>
);

/** onSubmit receives the payload minus `context`/`team_id` — caller adds those. */
/** onSubmit receives the payload minus `context`/`team_id` — caller adds those.
 *  Pass `initial` (an existing check-in) to pre-fill the form for editing. */
export function CheckInForm({ onSubmit, initial = null, submitLabel = "Submit check-in" }) {
  const [submitting, setSubmitting] = useState(false);

  const [sleepHours, setSleepHours] = useState(initial?.sleepHours ?? "");
  const [sleepQuality, setSleepQuality] = useState(initial?.sleepQuality ?? 0);
  const [sleepNotes, setSleepNotes] = useState(initial?.sleepNotes ?? "");
  const [hydration, setHydration] = useState(initial?.hydration ?? 0);
  const [motivation, setMotivation] = useState(initial?.motivation ?? 0);

  const [feelingIll, setFeelingIll] = useState(initial?.feelingIll ?? false);
  const [symptoms, setSymptoms] = useState(initial?.symptoms ?? []);
  const [illnessSeverity, setIllnessSeverity] = useState(initial?.illnessSeverity ?? "");
  const [temperature, setTemperature] = useState(initial?.temperature ?? "");
  const [illnessNotes, setIllnessNotes] = useState(initial?.illnessNotes ?? "");

  const [hasSoreness, setHasSoreness] = useState((initial?.sorenessSeverity ?? 0) > 0);
  const [sorenessAreas, setSorenessAreas] = useState(initial?.sorenessAreas ?? []);
  const [sorenessSide, setSorenessSide] = useState(initial?.sorenessSide ?? "");
  const [sorenessSeverity, setSorenessSeverity] = useState(initial?.sorenessSeverity ?? 3);
  const [sorenessNotes, setSorenessNotes] = useState(initial?.sorenessNotes ?? "");

  const [sessionType, setSessionType] = useState(initial?.sessionType ?? "");
  const [rpe, setRpe] = useState(initial?.rpe ?? 0);
  const [duration, setDuration] = useState(initial?.duration ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const durationMin = Math.round(Number(duration)) || 0;
  const load = rpe && durationMin ? Number(rpe) * durationMin : 0;
  const loadZone = load > 600 ? { label: "High", cls: "text-rose-500" } : load >= 300 ? { label: "Moderate", cls: "text-amber-500" } : { label: "Low", cls: "text-emerald-500" };

  const toggleIn = (arr, setArr, val) => setArr(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);

  const submit = async () => {
    if (!sleepQuality || !hydration || !motivation) return toast.error("Please rate sleep, hydration and motivation");
    if (!sessionType) return toast.error("Select today's session type");
    if (!rpe) return toast.error("Select today's session RPE");
    if (durationMin < 1) return toast.error("Enter today's session duration (minutes)");
    setSubmitting(true);
    try {
      await onSubmit({
        sleepHours: sleepHours === "" ? null : Number(sleepHours),
        sleepQuality, sleepNotes, hydration, motivation,
        feelingIll, symptoms: feelingIll ? symptoms : [], illnessSeverity: feelingIll ? illnessSeverity : "",
        temperature: feelingIll ? temperature : "", illnessNotes: feelingIll ? illnessNotes : "",
        sorenessAreas: hasSoreness ? sorenessAreas : [], sorenessSide: hasSoreness ? sorenessSide : "",
        sorenessSeverity: hasSoreness ? sorenessSeverity : 0, sorenessNotes: hasSoreness ? sorenessNotes : "",
        sessionType, rpe: Number(rpe), duration: durationMin, notes,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <Section icon={Moon} title="Sleep" subtitle="Hours slept and how rested you feel">
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hours of sleep</p>
          <Input
            type="number" inputMode="decimal" min={0} max={16} step={0.5} value={sleepHours}
            onChange={(e) => setSleepHours(e.target.value)} placeholder="e.g. 7.5" data-testid="sleep-hours-input"
            className="max-w-[140px]"
          />
        </div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sleep quality · 1 = terrible · 5 = fully rested</p>
        <WellnessRating value={sleepQuality} onChange={setSleepQuality} testIdPrefix="sleep-rating" />
        <Textarea value={sleepNotes} onChange={(e) => setSleepNotes(e.target.value)} placeholder="Any notes on your sleep? (optional)" className="mt-3 resize-none" rows={2} data-testid="sleep-notes-input" />
      </Section>

      <Section icon={Droplets} title="Hydration" subtitle="How well hydrated do you feel?">
        <WellnessRating value={hydration} onChange={setHydration} testIdPrefix="hydration-rating" />
      </Section>

      <Section icon={Flame} title="Motivation / Mood" subtitle="How's your drive today?">
        <WellnessRating value={motivation} onChange={setMotivation} testIdPrefix="motivation-rating" />
      </Section>

      <Section icon={Dumbbell} title="Training session" subtitle="Required — log today's session">
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Session type</p>
            <Select value={sessionType} onValueChange={setSessionType}>
              <SelectTrigger data-testid="session-type-input"><SelectValue placeholder="Select session type" /></SelectTrigger>
              <SelectContent>{SESSION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Session RPE (1 = easy · 10 = max effort)</p>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button key={n} type="button" data-testid={`rpe-score-selector-${n}`} onClick={() => setRpe(n)}
                  className={`h-11 rounded-lg border text-sm font-bold transition-all active:scale-95 ${rpe === n ? "border-primary bg-primary text-primary-foreground scale-105" : "border-border bg-secondary text-muted-foreground hover:text-foreground"}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Duration (minutes)</p>
            <Input type="number" inputMode="numeric" min={1} step={1} value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 75" data-testid="session-duration-input" />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/50 px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Training load</p>
                  <p className={`font-mono text-2xl font-bold ${loadZone.cls}`}>{load}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${loadZone.cls} border-current`}>{loadZone.label}</span>
              </div>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Session notes (optional)" rows={2} className="resize-none" data-testid="session-notes-input" />
            </div>
      </Section>

      <Section icon={ShieldAlert} title="Feeling unwell?" subtitle="Flag anything your medical team should know">
        <div className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3">
          <span className="text-sm font-medium">I'm feeling ill today</span>
          <Switch checked={feelingIll} onCheckedChange={setFeelingIll} data-testid="illness-toggle-switch" />
        </div>
        <AnimatePresence>
          {feelingIll && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-4 space-y-4 overflow-hidden">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Symptoms</p>
                <div className="grid grid-cols-2 gap-2">
                  {SYMPTOMS.map((s) => (
                    <label key={s} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
                      <Checkbox checked={symptoms.includes(s)} onCheckedChange={() => toggleIn(symptoms, setSymptoms, s)} data-testid={`illness-symptom-${s}`} />
                      {s}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Severity</p>
                  <Select value={illnessSeverity} onValueChange={setIllnessSeverity}>
                    <SelectTrigger data-testid="illness-severity-select"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mild">Mild</SelectItem>
                      <SelectItem value="Moderate">Moderate</SelectItem>
                      <SelectItem value="Severe">Severe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Temp (°C)</p>
                  <div className="relative">
                    <Thermometer className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={temperature} onChange={(e) => setTemperature(e.target.value)} placeholder="37.0" className="pl-9" data-testid="illness-temperature-input" />
                  </div>
                </div>
              </div>
              <Textarea value={illnessNotes} onChange={(e) => setIllnessNotes(e.target.value)} placeholder="Anything else? (optional)" rows={2} className="resize-none" data-testid="illness-notes-input" />
            </motion.div>
          )}
        </AnimatePresence>
      </Section>

      <Section icon={Activity} title="Muscle soreness" subtitle="Any areas feeling tight or sore?">
        <div className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3">
          <span className="text-sm font-medium">I have soreness to report</span>
          <Switch checked={hasSoreness} onCheckedChange={setHasSoreness} data-testid="soreness-toggle-switch" />
        </div>
        <AnimatePresence>
          {hasSoreness && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-4 space-y-4 overflow-hidden">
              <div className="grid grid-cols-2 gap-2">
                {SORENESS_AREAS.map((a) => {
                  const active = sorenessAreas.includes(a);
                  return (
                    <button key={a} type="button" data-testid={`soreness-area-${a}`} onClick={() => toggleIn(sorenessAreas, setSorenessAreas, a)}
                      className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}>
                      {a}
                    </button>
                  );
                })}
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Side</p>
                <div className="grid grid-cols-3 gap-2">
                  {SORENESS_SIDES.map((side) => {
                    const active = sorenessSide === side;
                    return (
                      <button key={side} type="button" aria-pressed={active} data-testid={`soreness-side-${side}`} onClick={() => setSorenessSide(active ? "" : side)}
                        className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}>
                        {side}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Severity</span><span className="text-foreground">{sorenessSeverity}/5</span>
                </div>
                <Slider min={1} max={5} step={1} value={[sorenessSeverity]} onValueChange={(v) => setSorenessSeverity(v[0])} data-testid="soreness-severity-slider" />
              </div>
              <Textarea value={sorenessNotes} onChange={(e) => setSorenessNotes(e.target.value)} placeholder="Describe the soreness (optional)" rows={2} className="resize-none" data-testid="soreness-notes-input" />
            </motion.div>
          )}
        </AnimatePresence>
      </Section>

      <Button className="h-13 w-full text-base font-bold" style={{ height: 52 }} onClick={submit} disabled={submitting} data-testid="submit-checkin-button">
        {submitting ? "Submitting…" : submitLabel}
      </Button>
    </div>
  );
}
