import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { TrendingUp, Lock, ArrowLeft, KeyRound, User } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import api, { formatApiError } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TrafficLightBadge } from "@/components/TrafficLightBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const RANGES = [7, 28, 90];
const CODE_KEY = "my_stats_code";
const parseDate = (ds) => new Date(ds + "T00:00:00");
const shortDay = (ds) => parseDate(ds).toLocaleDateString([], { weekday: "short" });
const dayMonth = (ds) => parseDate(ds).toLocaleDateString([], { day: "numeric", month: "short" });
const longDay = (ds) => parseDate(ds).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });

const TooltipBox = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: <span className="font-mono font-bold">{p.value ?? "—"}</span></p>
      ))}
    </div>
  );
};

export default function MyStats() {
  const [code, setCode] = useState(() => localStorage.getItem(CODE_KEY) || "");
  const [codeInput, setCodeInput] = useState("");
  const [roster, setRoster] = useState([]);
  const [name, setName] = useState("");
  const [range, setRange] = useState(7);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (code) api.get("/roster").then((res) => setRoster(res.data)).catch(() => {});
  }, [code]);

  const tryCode = async (candidate) => {
    setError("");
    try {
      await api.get("/roster");
      // The roster is public, so this just confirms the backend is reachable; the real check
      // happens on the first /my-stats request once a name is picked. Store optimistically.
      localStorage.setItem(CODE_KEY, candidate);
      setCode(candidate);
    } catch {
      setError("Couldn't reach the server. Try again.");
    }
  };

  const loadStats = useCallback(async (n, r) => {
    if (!n) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/my-stats", { params: { name: n, code, days: r } });
      setData(res.data);
    } catch (e) {
      const status = e.response?.status;
      if (status === 403) {
        setError("That access code isn't right anymore. Ask your medical team for the current one.");
        localStorage.removeItem(CODE_KEY);
        setCode("");
        setData(null);
      } else {
        toast.error(formatApiError(e.response?.data?.detail));
      }
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => { if (name) loadStats(name, range); }, [name, range, loadStats]);

  const shownRange = data?.range || range;
  const labelOf = shownRange <= 7 ? shortDay : dayMonth;
  const days = (data?.days || []).map((d) => ({ ...d, label: labelOf(d.date) }));
  const weeks = data?.weeks || [];
  const latestWeek = weeks[weeks.length - 1];
  const history = [...days].reverse().filter((d) => d.ill || (d.sorenessAreas && d.sorenessAreas.length > 0)).slice(0, 20);
  const changeText = (pct) => (pct === null || pct === undefined ? "—" : `${pct > 0 ? "▲ " : pct < 0 ? "▼ " : ""}${Math.abs(pct)}%`);

  if (!code) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
        <div className="absolute right-4 top-4"><ThemeToggle /></div>
        <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-8">
          <div className="mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <KeyRound className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tight">My Stats</h1>
          <p className="mt-2 text-sm text-muted-foreground">Enter your team's access code to see your own history.</p>
          <div className="mt-6 space-y-4">
            <Input
              data-testid="my-stats-code-input" type="text" value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)} placeholder="Access code" className="h-12"
              onKeyDown={(e) => e.key === "Enter" && codeInput.trim() && tryCode(codeInput.trim())}
            />
            {error && <p className="text-sm text-rose-500" data-testid="my-stats-code-error">{error}</p>}
            <Button
              data-testid="my-stats-code-submit" className="h-12 w-full text-base font-bold uppercase tracking-wide"
              onClick={() => codeInput.trim() && tryCode(codeInput.trim())} disabled={!codeInput.trim()}
            >
              Continue
            </Button>
          </div>
          <Link to="/" className="mt-6 flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> Back to check-in
          </Link>
        </div>
      </div>
    );
  }

  if (!name) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
        <div className="absolute right-4 top-4"><ThemeToggle /></div>
        <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-8">
          <div className="mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <User className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tight">Who are you?</h1>
          <p className="mt-2 text-sm text-muted-foreground">Pick your name to see your own stats.</p>
          <div className="mt-6">
            <Select value={name} onValueChange={setName}>
              <SelectTrigger data-testid="my-stats-name-dropdown" className="h-12"><SelectValue placeholder="Select your name" /></SelectTrigger>
              <SelectContent>
                {roster.map((a) => <SelectItem key={a.id} value={a.name} data-testid={`my-stats-name-${a.name}`}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <button
            className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
            onClick={() => { localStorage.removeItem(CODE_KEY); setCode(""); }} data-testid="my-stats-change-code"
          >
            <Lock className="h-3.5 w-3.5" /> Use a different access code
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <button onClick={() => setName("")} className="flex items-center gap-1.5 text-sm font-semibold hover:text-primary" data-testid="my-stats-switch-name">
            <ArrowLeft className="h-4 w-4" /> {name}
          </button>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black uppercase tracking-tight"><TrendingUp className="h-6 w-6 text-primary" /> My Stats</h1>
          <p className="text-sm text-muted-foreground">Your own load and recovery history. Nobody else's data is shown here.</p>
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Time range">
          {RANGES.map((r) => (
            <Button key={r} size="sm" variant={range === r ? "default" : "outline"} className="h-8" aria-pressed={range === r}
              onClick={() => setRange(r)} data-testid={`my-stats-range-${r}`}>
              {r} days
            </Button>
          ))}
        </div>

        {loading && !data ? (
          <div className="grid h-48 place-items-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : error ? (
          <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400" data-testid="my-stats-error">{error}</p>
        ) : data && (
          <div className={`space-y-6 transition-opacity ${loading ? "opacity-60" : ""}`} data-testid="my-stats-content">
            {latestWeek && (
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-border bg-card p-3 text-center">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Monotony</p>
                  <div className="mt-1 flex h-8 items-center justify-center">
                    {latestWeek.monotonyRisk
                      ? <TrafficLightBadge status={latestWeek.monotonyRisk} label={latestWeek.monotony} testId="my-stats-monotony" />
                      : <span className="font-mono text-xl font-bold text-muted-foreground" data-testid="my-stats-monotony">—</span>}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-3 text-center">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Strain</p>
                  <p className="font-mono text-2xl font-bold" data-testid="my-stats-strain">{latestWeek.strain ?? "—"}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3 text-center">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">vs last week</p>
                  <p className="font-mono text-2xl font-bold" data-testid="my-stats-week-change">{changeText(latestWeek.changePct)}</p>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Daily Training Load</p>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={days} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="myLoadFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="currentColor" className="text-muted-foreground" interval="preserveStartEnd" minTickGap={18} />
                  <YAxis tick={{ fontSize: 12 }} stroke="currentColor" className="text-muted-foreground" />
                  <Tooltip content={<TooltipBox />} />
                  <Area type="monotone" dataKey="load" name="Load" stroke="#10B981" strokeWidth={2.5} fill="url(#myLoadFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sleep · Hydration · Motivation (1-5)</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={days} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="currentColor" className="text-muted-foreground" interval="preserveStartEnd" minTickGap={18} />
                  <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 12 }} stroke="currentColor" className="text-muted-foreground" />
                  <Tooltip content={<TooltipBox />} />
                  <Line type="monotone" dataKey="sleep" name="Sleep" stroke="#3B82F6" strokeWidth={2} dot={shownRange <= 28 ? { r: 3 } : false} connectNulls />
                  <Line type="monotone" dataKey="hydration" name="Hydration" stroke="#06B6D4" strokeWidth={2} dot={shownRange <= 28 ? { r: 3 } : false} connectNulls />
                  <Line type="monotone" dataKey="motivation" name="Motivation" stroke="#F59E0B" strokeWidth={2} dot={shownRange <= 28 ? { r: 3 } : false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div data-testid="my-stats-history">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Illness &amp; soreness history</p>
              {history.length === 0 ? (
                <p className="rounded-xl bg-secondary/40 px-4 py-4 text-center text-sm text-muted-foreground" data-testid="my-stats-history-empty">
                  Nothing to show for this period.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {history.map((d) => (
                    <li key={d.date} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border px-3 py-2 text-sm" data-testid={`my-stats-history-${d.date}`}>
                      <span className="w-24 shrink-0 font-semibold">{longDay(d.date)}</span>
                      {d.ill && <TrafficLightBadge status="red" label={`Unwell${d.illnessSeverity ? ` (${d.illnessSeverity})` : ""}${d.symptoms?.length ? `: ${d.symptoms.join(", ")}` : ""}`} />}
                      {d.sorenessAreas.length > 0 && (
                        <TrafficLightBadge
                          status={(d.soreness || 0) >= 4 ? "red" : (d.soreness || 0) === 3 ? "amber" : "green"}
                          label={`Soreness ${d.soreness ?? 0}/5: ${d.sorenessAreas.join(", ")}${d.sorenessSide ? ` · ${d.sorenessSide}` : ""}`}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
