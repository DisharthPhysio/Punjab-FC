import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  LogOut, Download, Mail, Users, UserCheck, AlertTriangle, Zap, Plus, Trash2,
  RefreshCw, Search, Activity, Clock, TrendingUp, CalendarDays, ClipboardList,
  ChevronLeft, ChevronRight, MessageCircle, Phone, FileText, ShieldCheck,
} from "lucide-react";
import { format, parseISO, addDays } from "date-fns";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AthleteTrendsDialog } from "@/components/AthleteTrendsDialog";
import { ResponsesDialog } from "@/components/ResponsesDialog";
import { RemindersDialog } from "@/components/RemindersDialog";
import { PhoneNumbersDialog } from "@/components/PhoneNumbersDialog";
import { TeamAccessDialog } from "@/components/TeamAccessDialog";
import { TeamPainMap } from "@/components/TeamPainMap";
import { reminderMessage, whatsappLink, loadReminded, saveReminded } from "@/lib/whatsapp";
import { TrafficLightBadge, goodScaleStatus, loadStatus, sorenessStatus } from "@/components/TrafficLightBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const CELL_BG = {
  green: "bg-emerald-500/10",
  amber: "bg-amber-500/10",
  red: "bg-rose-500/10",
  grey: "",
};

const SummaryCard = ({ icon: Icon, label, value, accent, testId }) => (
  <div className="rounded-2xl border border-border bg-card p-5" data-testid={testId}>
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <Icon className={`h-4 w-4 ${accent}`} />
    </div>
    <p className="mt-3 font-mono text-4xl font-bold">{value}</p>
  </div>
);

export default function CoachDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [roster, setRoster] = useState([]);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [newAthlete, setNewAthlete] = useState("");
  const [busy, setBusy] = useState(false);
  const [trendsFor, setTrendsFor] = useState(null);
  const [responsesOpen, setResponsesOpen] = useState(false);
  const [dailyEmail, setDailyEmail] = useState({ enabled: false, hour: 20, recipients: [] });
  const [weeklyDigest, setWeeklyDigest] = useState({ enabled: false, hour: 8, recipients: [] });
  const [teamOpen, setTeamOpen] = useState(false);

  // Calendar: "" means today, otherwise a past day as YYYY-MM-DD
  const [dateStr, setDateStr] = useState("");
  const [calOpen, setCalOpen] = useState(false);
  const [dashLoading, setDashLoading] = useState(false);
  const [checkinDates, setCheckinDates] = useState([]);
  const reqId = useRef(0);

  // WhatsApp reminders (one tap per player; the Medical Team presses Send in WhatsApp)
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [phonesOpen, setPhonesOpen] = useState(false);
  const [reminded, setReminded] = useState([]);
  const [mapTick, setMapTick] = useState(0); // bumped to make the Team Pain Map reload

  const loadCheckinDates = () =>
    api.get("/checkins/dates")
      .then((res) => setCheckinDates((res.data.dates || []).map((d) => parseISO(d))))
      .catch(() => {});

  const loadData = useCallback(async () => {
    const id = ++reqId.current;
    setDashLoading(true);
    try {
      const [dash, ros, settings, weekly] = await Promise.all([
        api.get("/dashboard", { params: dateStr ? { date: dateStr } : {} }), api.get("/roster"),
        api.get("/settings/daily-email"), api.get("/settings/weekly-digest"),
      ]);
      if (id !== reqId.current) return; // a newer request replaced this one
      setData(dash.data);
      setRoster(ros.data);
      setDailyEmail(settings.data);
      setWeeklyDigest(weekly.data);
      loadCheckinDates();
    } catch (e) {
      if (id === reqId.current) toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      if (id === reqId.current) setDashLoading(false);
    }
  }, [dateStr]);

  useEffect(() => { loadData(); }, [loadData]);

  const todayStr = data?.today || data?.date || format(new Date(), "yyyy-MM-dd");
  const isToday = !dateStr;
  const selectedDate = parseISO(dateStr || todayStr);
  const maxDate = parseISO(todayStr);
  const dateLabel = isToday
    ? `Today · ${format(selectedDate, "d MMM yyyy")}`
    : format(selectedDate, "EEE, d MMM yyyy");

  const goToDate = (s) => setDateStr(s === todayStr ? "" : s);
  const pickDate = (d) => {
    if (!d) return;
    goToDate(format(d, "yyyy-MM-dd"));
    setCalOpen(false);
  };
  const shiftDay = (n) => {
    const next = format(addDays(parseISO(dateStr || todayStr), n), "yyyy-MM-dd");
    if (next > todayStr) return;
    goToDate(next);
  };

  // Reminders only make sense for today. "Reminded" ticks are remembered in this browser for the day.
  const pendingList = (data?.athletes || []).filter((a) => !a.checkedIn);
  const siteLink = window.location.origin;
  useEffect(() => {
    if (data?.today) setReminded(loadReminded(data.today));
  }, [data?.today]);
  const refreshAll = () => { loadData(); setMapTick((t) => t + 1); };

  // 7-day load (+ change vs the week before), Foster monotony and strain, as of the selected day
  const weekCells = (a) => (
    <>
      <td className="px-4 py-3 text-center font-mono font-bold" data-testid={`week-load-${a.id}`}>
        {a.weekLoad ? a.weekLoad : <span className="font-normal text-muted-foreground">{dash}</span>}
        {a.weekLoad && a.weekChangePct !== null && a.weekChangePct !== undefined ? (
          <span className="ml-1 text-[10px] font-normal text-muted-foreground" data-testid={`week-change-${a.id}`}>
            {a.weekChangePct > 0 ? "▲" : a.weekChangePct < 0 ? "▼" : ""}{Math.abs(a.weekChangePct)}%
          </span>
        ) : null}
      </td>
      <td className="px-4 py-3 text-center">
        {a.monotonyRisk
          ? <TrafficLightBadge status={a.monotonyRisk} label={a.monotony} testId={`monotony-badge-${a.id}`} />
          : <span className="text-muted-foreground">{dash}</span>}
      </td>
      <td className="px-4 py-3 text-center font-mono text-muted-foreground" data-testid={`strain-${a.id}`}>{a.strain ?? dash}</td>
    </>
  );

  const markReminded = (id) => {
    const next = reminded.includes(id) ? reminded : [...reminded, id];
    setReminded(next);
    saveReminded(todayStr, next);
  };

  const doLogout = () => { logout(); navigate("/coach", { replace: true }); };

  const toggleDailyEmail = async (enabled) => {
    setDailyEmail((s) => ({ ...s, enabled }));
    try {
      await api.post("/settings/daily-email", { enabled, hour: dailyEmail.hour });
      toast.success(enabled ? "Automated daily email turned ON" : "Automated daily email turned OFF");
    } catch (e) {
      setDailyEmail((s) => ({ ...s, enabled: !enabled }));
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const toggleWeeklyDigest = async (enabled) => {
    setWeeklyDigest((s) => ({ ...s, enabled }));
    try {
      await api.post("/settings/weekly-digest", { enabled, hour: weeklyDigest.hour });
      toast.success(enabled ? "Weekly digest turned ON" : "Weekly digest turned OFF");
    } catch (e) {
      setWeeklyDigest((s) => ({ ...s, enabled: !enabled }));
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const sendWeeklyNow = async () => {
    setBusy(true);
    try {
      const res = await api.post("/reports/weekly-now");
      toast.success(`Weekly digest emailed to ${res.data.sent_to}`);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  const athleteRisk = (a) => {
    if (!a.checkedIn) return "pending";
    if (a.feelingIll || (a.sorenessSeverity || 0) >= 4 || (a.load || 0) > 600) return "red";
    if (goodScaleStatus(a.sleep) === "amber" || goodScaleStatus(a.hydration) === "amber" ||
        goodScaleStatus(a.motivation) === "amber" || loadStatus(a.load) === "amber") return "amber";
    return "green";
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.athletes.filter((a) => {
      if (query && !a.name.toLowerCase().includes(query.toLowerCase())) return false;
      if (filter === "all") return true;
      if (filter === "pending") return !a.checkedIn;
      if (filter === "spike") return a.acwrRisk === "red";
      return athleteRisk(a) === filter;
    });
  }, [data, filter, query]);

  const addAthlete = async () => {
    const name = newAthlete.trim();
    if (!name) return;
    try {
      await api.post("/roster", { name });
      setNewAthlete("");
      toast.success(`${name} added to roster`);
      loadData();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const removeAthlete = async (id, name) => {
    try {
      await api.delete(`/roster/${id}`);
      toast.success(`${name} removed`);
      loadData();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const exportPdf = async () => {
    setBusy(true);
    try {
      const res = await api.get("/export/pdf", { responseType: "blob", params: dateStr ? { date: dateStr } : {} });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `Load and Recovery Monitoring Report - ${dateStr || data?.today || data?.date || "today"}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success("PDF report downloaded");
    } catch (e) {
      toast.error("PDF export failed");
    } finally {
      setBusy(false);
    }
  };

  const exportExcel = async () => {
    setBusy(true);
    try {
      const res = await api.get("/export/excel", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `Load and Recovery Monitoring Report - ${data?.today || data?.date || "today"}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success("Excel report downloaded");
    } catch (e) {
      toast.error("Export failed");
    } finally {
      setBusy(false);
    }
  };

  const sendReport = async () => {
    setBusy(true);
    try {
      const res = await api.post("/reports/send-now");
      toast.success(`Report emailed to ${res.data.sent_to}`);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  const dash = "—";

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold uppercase leading-none tracking-wide">Command Center</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={doLogout} data-testid="logout-button" className="gap-1.5">
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight sm:text-4xl">{isToday ? "Today's Squad Status" : "Squad Status"}</h1>
            <p className="text-sm text-muted-foreground">
              {data?.date}{!isToday && <span> · viewing a previous day</span>}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5" data-testid="date-navigator">
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => shiftDay(-1)}
                aria-label="Previous day" data-testid="date-prev-button">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Popover open={calOpen} onOpenChange={setCalOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5" data-testid="date-picker-button">
                    <CalendarDays className="h-4 w-4" /> {dateLabel}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0" data-testid="calendar-popover">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    defaultMonth={selectedDate}
                    onSelect={pickDate}
                    disabled={{ after: maxDate }}
                    modifiers={{ hasData: checkinDates }}
                    modifiersClassNames={{
                      hasData: "relative after:absolute after:bottom-0.5 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-primary aria-selected:after:bg-primary-foreground",
                    }}
                    initialFocus
                  />
                  <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                    Dots mark days that have responses.
                  </p>
                </PopoverContent>
              </Popover>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => shiftDay(1)} disabled={isToday}
                aria-label="Next day" data-testid="date-next-button">
                <ChevronRight className="h-4 w-4" />
              </Button>
              {!isToday && (
                <Button variant="ghost" size="sm" className="h-9" onClick={() => setDateStr("")} data-testid="date-today-button">
                  Back to today
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={refreshAll} className="gap-1.5" data-testid="refresh-button">
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => setResponsesOpen(true)} className="gap-1.5" data-testid="manage-responses-button">
              <ClipboardList className="h-4 w-4" /> Responses
            </Button>
            {isToday && (
              <Button variant="outline" size="sm" onClick={() => setRemindersOpen(true)} className="gap-1.5" data-testid="remind-pending-button">
                <MessageCircle className="h-4 w-4" /> Remind{pendingList.length ? ` (${pendingList.length})` : ""}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={exportExcel} disabled={busy} className="gap-1.5" data-testid="export-excel-button">
              <Download className="h-4 w-4" /> Export Excel
            </Button>
            <Button variant="outline" size="sm" onClick={exportPdf} disabled={busy} className="gap-1.5" data-testid="export-pdf-button">
              <FileText className="h-4 w-4" /> Export PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTeamOpen(true)} className="gap-1.5" data-testid="team-access-button">
              <ShieldCheck className="h-4 w-4" /> Team Access
            </Button>
            <Button size="sm" onClick={sendReport} disabled={busy} className="gap-1.5" data-testid="send-report-button">
              <Mail className="h-4 w-4" /> Email Report
            </Button>
          </div>
        </div>

        {/* Summary */}
        {data && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            <SummaryCard icon={Users} label="Squad Size" value={data.summary.total} accent="text-blue-500" testId="summary-total" />
            <SummaryCard icon={UserCheck} label="Checked In" value={`${data.summary.checkedIn}/${data.summary.total}`} accent="text-emerald-500" testId="summary-checkedin" />
            <SummaryCard icon={AlertTriangle} label="Follow-Ups" value={data.summary.followUps} accent="text-rose-500" testId="summary-followups" />
            <SummaryCard icon={Zap} label="High Load" value={data.summary.highLoad} accent="text-amber-500" testId="summary-highload" />
            <SummaryCard icon={TrendingUp} label="Load Spikes" value={data.summary.loadSpikes ?? 0} accent="text-rose-500" testId="summary-loadspikes" />
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList>
              <TabsTrigger value="all" data-testid="filter-status-all">All</TabsTrigger>
              <TabsTrigger value="red" data-testid="filter-status-red">Red Alert</TabsTrigger>
              <TabsTrigger value="amber" data-testid="filter-status-amber">Watch</TabsTrigger>
              <TabsTrigger value="spike" data-testid="filter-status-spike">Load Spike</TabsTrigger>
              <TabsTrigger value="pending" data-testid="filter-status-pending">Pending</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input data-testid="athlete-search-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search athletes..." className="pl-9" />
          </div>
        </div>

        {/* Squad table */}
        <div className={`overflow-x-auto rounded-2xl border border-border bg-card transition-opacity ${dashLoading ? "opacity-60" : ""}`}>
          <table className="w-full min-w-[1060px] text-sm" data-testid="squad-status-table">
            <thead>
              <tr className="border-b border-border bg-secondary/50 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="sticky left-0 bg-secondary/50 px-4 py-3">Athlete</th>
                <th className="px-4 py-3 text-center">Sleep</th>
                <th className="px-4 py-3 text-center">Hydration</th>
                <th className="px-4 py-3 text-center">Motivation</th>
                <th className="px-4 py-3">Illness</th>
                <th className="px-4 py-3">Soreness</th>
                <th className="px-4 py-3 text-center">Load</th>
                <th className="px-4 py-3 text-center">ACWR</th>
                <th className="px-4 py-3 text-center" title="Training load of the last 7 days (RPE x minutes), with the change vs the 7 days before">7-Day Load</th>
                <th className="px-4 py-3 text-center" title="Average daily load / its day-to-day variation over 7 days. 2.0 or more = high, 1.5-2.0 = watch">Monotony</th>
                <th className="px-4 py-3 text-center" title="7-day load x monotony">Strain</th>
                <th className="px-4 py-3 text-center">Time</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => {
                if (!a.checkedIn) {
                  return (
                    <tr key={a.id} className="border-b border-border last:border-0 bg-slate-500/5" data-testid={`athlete-status-row-${a.id}`}>
                      <td className="sticky left-0 bg-card px-4 py-3">
                      <button onClick={() => setTrendsFor(a.name)} className="font-semibold hover:text-primary" data-testid={`athlete-name-${a.name}`}>{a.name}</button>
                    </td>
                      <td colSpan={5} className="px-4 py-3 text-center text-muted-foreground">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <TrafficLightBadge status="grey" label="Not checked in" />
                          {isToday && (a.phone ? (
                            <Button asChild size="sm" variant={reminded.includes(a.id) ? "outline" : "default"} className="h-7 gap-1 px-2 text-xs">
                              <a
                                href={whatsappLink(a.phone, reminderMessage(a.name, siteLink))}
                                target="_blank" rel="noopener noreferrer"
                                onClick={() => markReminded(a.id)}
                                data-testid={`remind-athlete-${a.id}`}
                              >
                                <MessageCircle className="h-3.5 w-3.5" /> {reminded.includes(a.id) ? "Reminded ✓" : "Remind"}
                              </a>
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => setPhonesOpen(true)} data-testid={`add-phone-${a.id}`}>
                              <Phone className="h-3.5 w-3.5" /> Add number
                            </Button>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-muted-foreground">{a.load ?? dash}</td>
                      <td className="px-4 py-3 text-center">
                        {a.acwrRisk ? <TrafficLightBadge status={a.acwrRisk} label={a.acwr} testId={`acwr-badge-${a.id}`} /> : <span className="text-muted-foreground">{dash}</span>}
                      </td>
                      {weekCells(a)}
                      <td className="px-4 py-3 text-center text-muted-foreground">{dash}</td>
                    </tr>
                  );
                }
                const time = a.checkedInAt ? new Date(a.checkedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : dash;
                return (
                  <motion.tr
                    key={a.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                    className="border-b border-border last:border-0 hover:bg-secondary/30"
                    data-testid={`athlete-status-row-${a.id}`}
                  >
                    <td className="sticky left-0 bg-card px-4 py-3">
                      <button onClick={() => setTrendsFor(a.name)} className="font-semibold hover:text-primary" data-testid={`athlete-name-${a.name}`}>{a.name}</button>
                    </td>
                    <td className={`px-4 py-3 text-center font-mono font-bold ${CELL_BG[goodScaleStatus(a.sleep)]}`}>{a.sleep}</td>
                    <td className={`px-4 py-3 text-center font-mono font-bold ${CELL_BG[goodScaleStatus(a.hydration)]}`}>{a.hydration}</td>
                    <td className={`px-4 py-3 text-center font-mono font-bold ${CELL_BG[goodScaleStatus(a.motivation)]}`}>{a.motivation}</td>
                    <td className={`px-4 py-3 ${CELL_BG[a.feelingIll ? "red" : "green"]}`}>
                      {a.feelingIll ? (
                        <TrafficLightBadge status="red" label={a.illnessSeverity || "Ill"} />
                      ) : (
                        <TrafficLightBadge status="green" label="Healthy" />
                      )}
                    </td>
                    <td className={`px-4 py-3 ${CELL_BG[sorenessStatus(a.sorenessAreas, a.sorenessSeverity)]}`}>
                      {a.sorenessAreas && a.sorenessAreas.length > 0 ? (
                        <span className="text-xs">{a.sorenessAreas.join(", ")}{a.sorenessSide ? ` · ${a.sorenessSide}` : ""} <span className="text-muted-foreground">({a.sorenessSeverity}/5)</span></span>
                      ) : (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-center font-mono font-bold ${CELL_BG[a.load ? loadStatus(a.load) : "grey"]}`}>{a.load ?? dash}</td>
                    <td className="px-4 py-3 text-center">
                      {a.acwrRisk ? <TrafficLightBadge status={a.acwrRisk} label={a.acwr} testId={`acwr-badge-${a.id}`} /> : <span className="text-muted-foreground">{dash}</span>}
                    </td>
                    {weekCells(a)}
                    <td className="px-4 py-3 text-center font-mono text-xs text-muted-foreground">{time}</td>
                  </motion.tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">No athletes match this view.</td></tr>
              )}
            </tbody>
          </table>
          <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground" data-testid="weekly-metrics-legend">
            7-Day Load, Monotony and Strain cover the 7 days up to the selected date (days without a session count as 0).
            Monotony = average daily load ÷ its day-to-day variation: 2.0 or more is high, 1.5–2.0 is worth watching.
            Strain = 7-day load × monotony. These are rule-of-thumb markers, not a diagnosis.
          </p>
        </div>

        <TeamPainMap date={dateStr} isToday={isToday} refreshKey={mapTick} />

        {/* Automated emails */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5" data-testid="daily-email-card">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Automated Daily Email</h3>
                  <p className="text-xs text-muted-foreground">
                    Emails the color-coded squad Excel report to {dailyEmail.recipients.length
                      ? `${dailyEmail.recipients.length} Medical Team ${dailyEmail.recipients.length === 1 ? "account" : "accounts"}`
                      : "your inbox"} every evening at ~8 PM.
                  </p>
                </div>
              </div>
              <Switch data-testid="daily-email-toggle" checked={dailyEmail.enabled} onCheckedChange={toggleDailyEmail} />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5" data-testid="weekly-digest-card">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Weekly Digest</h3>
                  <p className="text-xs text-muted-foreground">
                    A Monday-morning summary of the squad's past 7 days (avg readiness, load &amp; ACWR spikes).
                  </p>
                </div>
              </div>
              <Switch data-testid="weekly-digest-toggle" checked={weeklyDigest.enabled} onCheckedChange={toggleWeeklyDigest} />
            </div>
            <Button variant="outline" size="sm" onClick={sendWeeklyNow} disabled={busy} className="mt-4 gap-1.5" data-testid="send-weekly-now-button">
              <Mail className="h-4 w-4" /> Send this week's digest now
            </Button>
          </div>
        </div>

        {/* Roster management */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold">Roster Management</h3>
              <p className="text-xs text-muted-foreground">Add or remove athletes from your squad.</p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPhonesOpen(true)} data-testid="phone-numbers-button">
              <Phone className="h-4 w-4" /> Phone numbers
            </Button>
          </div>
          <div className="mt-4 flex gap-2">
            <Input
              data-testid="add-athlete-input" value={newAthlete} onChange={(e) => setNewAthlete(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addAthlete()} placeholder="New athlete name" className="max-w-xs"
            />
            <Button onClick={addAthlete} className="gap-1.5" data-testid="add-athlete-button">
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {roster.map((a) => (
              <span key={a.id} className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1.5 text-sm" data-testid={`roster-chip-${a.name}`}>
                {a.name}
                <button
                  onClick={() => removeAthlete(a.id, a.name)}
                  data-testid={`remove-athlete-button-${a.id}`}
                  className="text-muted-foreground transition-colors hover:text-rose-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      </main>

      <AthleteTrendsDialog
        name={trendsFor}
        endDate={dateStr}
        open={!!trendsFor}
        onOpenChange={(o) => !o && setTrendsFor(null)}
      />
      <RemindersDialog
        open={remindersOpen}
        onOpenChange={setRemindersOpen}
        pending={pendingList}
        reminded={reminded}
        onReminded={markReminded}
        onAddNumbers={() => { setRemindersOpen(false); setPhonesOpen(true); }}
      />
      <PhoneNumbersDialog open={phonesOpen} onOpenChange={setPhonesOpen} onChanged={loadData} />
      <TeamAccessDialog open={teamOpen} onOpenChange={setTeamOpen} />

      <ResponsesDialog
        date={dateStr}
        open={responsesOpen}
        onOpenChange={setResponsesOpen}
        onChanged={loadData}
      />
    </div>
  );
}
