import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Activity, CheckCircle2, Moon, Droplets, Flame, Thermometer, Dumbbell, ShieldAlert, Lock } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { WellnessRating } from "@/components/WellnessRating";
import { ThemeToggle } from "@/components/ThemeToggle";
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
const HERO = "https://images.unsplash.com/photo-1758922769578-68c5ba000d87?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzd8MHwxfHNlYXJjaHwxfHxydW5uZXIlMjBhdGhsZXRlJTIwcG9ydHJhaXQlMjBmb2N1cyUyMHRyYWNrfGVufDB8fHx8MTc4OTcwOTA2Mnww&ixlib=rb-4.1.0&q=85";

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

export default function CheckIn() {
  const [roster, setRoster] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const [name, setName] = useState("");
  const [sleepQuality, setSleepQuality] = useState(0);
  const [sleepNotes, setSleepNotes] = useState("");
  const [hydration, setHydration] = useState(0);
  const [motivation, setMotivation] = useState(0);

  const [feelingIll, setFeelingIll] = useState(false);
  const [symptoms, setSymptoms] = useState([]);
  const [illnessSeverity, setIllnessSeverity] = useState("");
  const [temperature, setTemperature] = useState("");
  const [illnessNotes, setIllnessNotes] = useState("");

  const [hasSoreness, setHasSoreness] = useState(false);
  const [sorenessAreas, setSorenessAreas] = useState([]);
  const [sorenessSide, setSorenessSide] = useState("");
  const [sorenessSeverity, setSorenessSeverity] = useState(3);
  const [sorenessNotes, setSorenessNotes] = useState("");

  const [sessionType, setSessionType] = useState("");
  const [rpe, setRpe] = useState(0);
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    api.get("/roster").then((res) => setRoster(res.data)).catch(() => {});
  }, []);

  const durationMin = Math.round(Number(duration)) || 0;
  const load = rpe && durationMin ? Number(rpe) * durationMin : 0;
  const loadZone = load > 600 ? { label: "High", cls: "text-rose-500" } : load >= 300 ? { label: "Moderate", cls: "text-amber-500" } : { label: "Low", cls: "text-emerald-500" };

  const toggleIn = (arr, setArr, val) =>
    setArr(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);

  const submit = async () => {
    if (!name) return toast.error("Please select your name");
    if (!sleepQuality || !hydration || !motivation)
      return toast.error("Please rate sleep, hydration and motivation");
    if (!sessionType) return toast.error("Select your previous session type");
    if (!rpe) return toast.error("Select your previous session RPE");
    if (durationMin < 1) return toast.error("Enter your previous session duration (minutes)");

    setSubmitting(true);
    try {
      const payload = {
        name, sleepQuality, sleepNotes, hydration, motivation,
        feelingIll, symptoms: feelingIll ? symptoms : [], illnessSeverity: feelingIll ? illnessSeverity : "",
        temperature: feelingIll ? temperature : "", illnessNotes: feelingIll ? illnessNotes : "",
        sorenessAreas: hasSoreness ? sorenessAreas : [], sorenessSide: hasSoreness ? sorenessSide : "",
        sorenessSeverity: hasSoreness ? sorenessSeverity : 0,
        sorenessNotes: hasSoreness ? sorenessNotes : "",
        logSession: true, sessionType, rpe: Number(rpe), duration: durationMin, notes,
      };
      await api.post("/checkin", payload);
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-md rounded-3xl border border-border bg-card p-8 text-center"
          data-testid="checkin-success"
        >
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-500">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold">Check-in logged, {name.split(" ")[0]}!</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your medical team has your numbers for today. Rest up and train smart. 💪
          </p>
          <Button
            className="mt-6 w-full" data-testid="new-checkin-button"
            onClick={() => window.location.reload()}
          >
            Submit another check-in
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <img src={HERO} alt="athlete" className="absolute inset-0 h-full w-full object-cover opacity-30 dark:opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background" />
        <div className="relative mx-auto max-w-xl px-4 pb-6 pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary">
              <Activity className="h-6 w-6 shrink-0" />
              <span className="text-sm font-bold uppercase leading-tight tracking-widest">Load and Recovery Monitoring</span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link to="/coach" data-testid="coach-login-link">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Lock className="h-3.5 w-3.5" /> Medical Team
                </Button>
              </Link>
            </div>
          </div>
          <h1 className="mt-8 text-4xl font-black uppercase leading-none tracking-tight sm:text-5xl">
            Daily<br /><span className="text-primary">Readiness</span> Report
          </h1>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            Takes under 60 seconds. Honest answers help your medical team manage your load and keep you healthy.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-xl space-y-5 px-4 pb-28">
        {/* Athlete */}
        <Section icon={Activity} title="Who's checking in?" subtitle="Select your name">
          <Select value={name} onValueChange={setName}>
            <SelectTrigger data-testid="athlete-select-dropdown" className="h-12">
              <SelectValue placeholder="Select your name" />
            </SelectTrigger>
            <SelectContent>
              {roster.map((a) => (
                <SelectItem key={a.id} value={a.name} data-testid={`athlete-option-${a.name}`}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Section>

        {/* Sleep */}
        <Section icon={Moon} title="Sleep Quality" subtitle="1 = terrible · 5 = fully rested">
          <WellnessRating value={sleepQuality} onChange={setSleepQuality} testIdPrefix="sleep-rating" />
          <Textarea
            data-testid="sleep-notes-input" value={sleepNotes} onChange={(e) => setSleepNotes(e.target.value)}
            placeholder="Any notes on your sleep? (optional)" className="mt-3 resize-none" rows={2}
          />
        </Section>

        {/* Hydration */}
        <Section icon={Droplets} title="Hydration" subtitle="How well hydrated do you feel?">
          <WellnessRating value={hydration} onChange={setHydration} testIdPrefix="hydration-rating" />
        </Section>

        {/* Motivation */}
        <Section icon={Flame} title="Motivation / Mood" subtitle="How's your drive today?">
          <WellnessRating value={motivation} onChange={setMotivation} testIdPrefix="motivation-rating" />
        </Section>

        {/* Previous session (required) */}
        <Section icon={Dumbbell} title="Training Session" subtitle="Log Previous session load">
          <div className="space-y-4">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Session type <span className="text-rose-500">*</span></p>
              <Select value={sessionType} onValueChange={setSessionType}>
                <SelectTrigger data-testid="session-type-input"><SelectValue placeholder="Select session type" /></SelectTrigger>
                <SelectContent>
                  {SESSION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Session RPE (1 = easy · 10 = max effort) <span className="text-rose-500">*</span></p>
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n} type="button" data-testid={`rpe-score-selector-${n}`}
                    onClick={() => setRpe(n)}
                    className={`h-11 rounded-lg border text-sm font-bold transition-all active:scale-95 ${
                      rpe === n ? "border-primary bg-primary text-primary-foreground scale-105" : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >{n}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Duration (minutes) <span className="text-rose-500">*</span></p>
              <Input
                data-testid="session-duration-input" type="number" inputMode="numeric" min={1} step={1} value={duration}
                onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 75"
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/50 px-4 py-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Training Load</p>
                <p className={`font-mono text-2xl font-bold ${loadZone.cls}`} data-testid="calculated-training-load">{load}</p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${loadZone.cls} border-current`}>{loadZone.label}</span>
            </div>
            <Textarea
              data-testid="session-notes-input" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Session notes (optional)" rows={2} className="resize-none"
            />
          </div>
        </Section>

        {/* Illness */}
        <Section icon={ShieldAlert} title="Feeling unwell?" subtitle="Flag anything your medical team should know">
          <div className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3">
            <span className="text-sm font-medium">I'm feeling ill today</span>
            <Switch data-testid="illness-toggle-switch" checked={feelingIll} onCheckedChange={setFeelingIll} />
          </div>
          <AnimatePresence>
            {feelingIll && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="mt-4 space-y-4 overflow-hidden"
              >
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Symptoms</p>
                  <div className="grid grid-cols-2 gap-2">
                    {SYMPTOMS.map((s) => (
                      <label key={s} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
                        <Checkbox
                          data-testid={`illness-symptom-${s}`}
                          checked={symptoms.includes(s)}
                          onCheckedChange={() => toggleIn(symptoms, setSymptoms, s)}
                        />
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
                      <Input
                        data-testid="illness-temperature-input" value={temperature}
                        onChange={(e) => setTemperature(e.target.value)} placeholder="37.0" className="pl-9"
                      />
                    </div>
                  </div>
                </div>
                <Textarea
                  data-testid="illness-notes-input" value={illnessNotes} onChange={(e) => setIllnessNotes(e.target.value)}
                  placeholder="Anything else? (optional)" rows={2} className="resize-none"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </Section>

        {/* Soreness */}
        <Section icon={Activity} title="Muscle Soreness" subtitle="Any areas feeling tight or sore?">
          <div className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3">
            <span className="text-sm font-medium">I have soreness to report</span>
            <Switch data-testid="soreness-toggle-switch" checked={hasSoreness} onCheckedChange={setHasSoreness} />
          </div>
          <AnimatePresence>
            {hasSoreness && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="mt-4 space-y-4 overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-2">
                  {SORENESS_AREAS.map((a) => {
                    const active = sorenessAreas.includes(a);
                    return (
                      <button
                        key={a} type="button"
                        data-testid={`soreness-area-${a}`}
                        onClick={() => toggleIn(sorenessAreas, setSorenessAreas, a)}
                        className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                          active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
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
                        <button
                          key={side} type="button" aria-pressed={active}
                          data-testid={`soreness-side-${side}`}
                          onClick={() => setSorenessSide(active ? "" : side)}
                          className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                            active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {side}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>Severity</span>
                    <span className="text-foreground">{sorenessSeverity}/5</span>
                  </div>
                  <Slider
                    data-testid="soreness-severity-slider" min={1} max={5} step={1}
                    value={[sorenessSeverity]} onValueChange={(v) => setSorenessSeverity(v[0])}
                  />
                </div>
                <Textarea
                  data-testid="soreness-notes-input" value={sorenessNotes} onChange={(e) => setSorenessNotes(e.target.value)}
                  placeholder="Describe the soreness (optional)" rows={2} className="resize-none"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </Section>
      </div>

      {/* Sticky submit */}
      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/80 p-4 backdrop-blur-md">
        <div className="mx-auto max-w-xl">
          <Button
            data-testid="submit-checkin-button" onClick={submit} disabled={submitting}
            className="h-13 w-full text-base font-bold uppercase tracking-wide"
            style={{ height: 52 }}
          >
            {submitting ? "Submitting..." : "Submit Check-In"}
          </Button>
        </div>
      </div>
    </div>
  );
}
