import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Satellite, Plus, Trash2 } from "lucide-react";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import apiV2, { formatApiError } from "@/lib/apiV2";
import { localDateStr, formatDay } from "@/lib/dates";
import { AuthShell } from "@/components/platform/AuthShell";
import { ExportButtons } from "@/components/platform/ExportButtons";
import { GpsImportPanel } from "@/components/platform/GpsImportPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const emptyForm = () => ({ date: localDateStr(), distance_m: "", hsr_distance_m: "", sprints: "", max_speed_kmh: "", notes: "" });

export default function GpsData() {
  const { t, i18n } = useTranslation();
  const [players, setPlayers] = useState([]);
  const [playerId, setPlayerId] = useState("");
  const [sessions, setSessions] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadRoster = useCallback(async () => {
    try {
      const res = await apiV2.get("/team/roster");
      setPlayers(res.data.players);
      setPlayerId((current) => (res.data.players.some((p) => p.id === current) ? current : res.data.players[0]?.id || ""));
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    }
  }, []);

  useEffect(() => { loadRoster(); }, [loadRoster]);

  const loadPlayerData = useCallback(async () => {
    if (!playerId) return;
    setSessions(null);
    setAnalysis(null);
    try {
      const [sRes, aRes] = await Promise.all([
        apiV2.get("/team/gps", { params: { player_id: playerId } }),
        apiV2.get("/team/gps/analysis", { params: { player_id: playerId } }),
      ]);
      setSessions(sRes.data.sessions);
      setAnalysis(aRes.data);
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    }
  }, [playerId]);

  useEffect(() => { loadPlayerData(); }, [loadPlayerData]);

  const afterImport = async () => {
    await loadRoster();
    await loadPlayerData();
  };

  const addSession = async (e) => {
    e.preventDefault();
    if (!form.distance_m) return toast.error(t("gps.needDistance"));
    setSaving(true);
    try {
      await apiV2.post("/team/gps", {
        player_id: playerId, date: form.date,
        distance_m: Number(form.distance_m),
        hsr_distance_m: form.hsr_distance_m ? Number(form.hsr_distance_m) : null,
        sprints: form.sprints ? Number(form.sprints) : null,
        max_speed_kmh: form.max_speed_kmh ? Number(form.max_speed_kmh) : null,
        notes: form.notes,
      });
      setForm(emptyForm());
      toast.success(t("gps.sessionAdded"));
      await loadPlayerData();
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const removeSession = async (id) => {
    try {
      await apiV2.delete(`/team/gps/${id}`);
      await loadPlayerData();
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    }
  };

  const playerName = players.find((p) => p.id === playerId)?.name;
  const chartData = (analysis?.sessions || []).map((s) => ({
    label: formatDay(s.date, i18n.language),
    distance: s.distance_m, internal: s.internal_load,
  }));

  return (
    <AuthShell icon={Satellite} title={t("gps.title")} subtitle={t("gps.subtitle")} backTo="/team/home" maxWidth="max-w-2xl">
      <div className="space-y-6">
        <GpsImportPanel players={players} onImported={afterImport} />

        <div className="h-px bg-border" />

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("gps.player")}</p>
          <Select value={playerId} onValueChange={setPlayerId}>
            <SelectTrigger data-testid="gps-player-select"><SelectValue placeholder={t("gps.selectPlayer")} /></SelectTrigger>
            <SelectContent>
              {players.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {players.length === 0 && <p className="mt-2 text-xs text-muted-foreground">{t("gps.noPlayers")}</p>}
        </div>

        {playerId && (
          <>
            <form onSubmit={addSession} className="rounded-2xl border border-border bg-card p-4">
              <p className="mb-3 text-sm font-bold">{t("gps.addManually")}</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">{t("gps.date")}</p>
                  <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} data-testid="gps-date-input" />
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">{t("gps.distanceM")}</p>
                  <Input type="number" min={0} value={form.distance_m} onChange={(e) => setForm((f) => ({ ...f, distance_m: e.target.value }))} placeholder={t("gps.distancePlaceholder")} data-testid="gps-distance-input" />
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">{t("gps.hsrM")}</p>
                  <Input type="number" min={0} value={form.hsr_distance_m} onChange={(e) => setForm((f) => ({ ...f, hsr_distance_m: e.target.value }))} placeholder="optional" data-testid="gps-hsr-input" />
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">{t("gps.sprints")}</p>
                  <Input type="number" min={0} value={form.sprints} onChange={(e) => setForm((f) => ({ ...f, sprints: e.target.value }))} placeholder="optional" data-testid="gps-sprints-input" />
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">{t("gps.maxSpeed")}</p>
                  <Input type="number" min={0} step={0.1} value={form.max_speed_kmh} onChange={(e) => setForm((f) => ({ ...f, max_speed_kmh: e.target.value }))} placeholder="optional" data-testid="gps-maxspeed-input" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <p className="mb-1 text-xs text-muted-foreground">{t("gps.notes")}</p>
                  <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="optional" data-testid="gps-notes-input" />
                </div>
              </div>
              <Button type="submit" size="sm" className="mt-3 gap-1.5" disabled={saving} data-testid="gps-add-submit">
                <Plus className="h-3.5 w-3.5" /> {t("gps.addSession")}
              </Button>
            </form>

            {analysis && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="mb-1 text-sm font-bold">{t("gps.analysisTitle")}</p>
                <p className="mb-4 text-xs text-muted-foreground">
                  {analysis.matchedSamples >= 3 ? t("gps.matchedDays", { count: analysis.matchedSamples }) : t("gps.needMoreDays")}
                </p>

                {chartData.length > 0 && (
                  <div className="mb-4 h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(chartData.length / 8))} />
                        <YAxis yAxisId="dist" tick={{ fontSize: 10 }} />
                        <YAxis yAxisId="load" orientation="right" tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                        <Bar yAxisId="dist" dataKey="distance" fill="hsl(160 84% 39%)" radius={[3, 3, 0, 0]} name={t("gps.distanceM")} />
                        <Line yAxisId="load" type="monotone" dataKey="internal" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls name={t("gps.internalLoad")} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {analysis.correlations?.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-muted-foreground">
                          <th className="pb-2 pr-2 font-semibold">{t("gps.colMetric")}</th>
                          <th className="pb-2 pr-2 font-semibold">{t("gps.colSameDay")}</th>
                          <th className="pb-2 font-semibold">{t("gps.colNextDay")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysis.correlations.map((c) => (
                          <tr key={c.metric} className="border-t border-border">
                            <td className="py-2 pr-2 font-medium">{t(`gps.metrics.${c.metric}`, { defaultValue: c.label })}</td>
                            <td className="py-2 pr-2 font-mono">{c.vsInternalLoad != null ? `${c.vsInternalLoad} (n=${c.vsInternalLoadN})` : "—"}</td>
                            <td className="py-2 font-mono">{c.vsNextDayReadiness != null ? `${c.vsNextDayReadiness} (n=${c.vsNextDayReadinessN})` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  {t("gps.footnote")}
                </p>
              </div>
            )}

            <div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{t("gps.logged")}</h3>
                {sessions?.length > 0 && (
                  <ExportButtons pdfUrl={`/team/gps/export/pdf?player_id=${playerId}`} filename={`${playerName || "player"}-gps`} canShare={false} />
                )}
              </div>
              <div className="space-y-2">
                {sessions === null && <p className="py-4 text-center text-sm text-muted-foreground">{t("common.loading")}</p>}
                {sessions?.length === 0 && <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">{t("gps.noSessions", { name: playerName })}</p>}
                {sessions?.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-2.5">
                    <div className="text-sm">
                      <span className="font-semibold">{formatDay(s.date, i18n.language)}</span>
                      <span className="ml-2 text-muted-foreground">{s.distance_m}m{s.hsr_distance_m ? ` · ${t("gps.hsrShort")} ${s.hsr_distance_m}m` : ""}{s.sprints ? ` · ${t("gps.sprintsCount", { count: s.sprints })}` : ""}{s.source === "import" ? ` · ${t("gps.imported")}` : ""}</span>
                    </div>
                    <button onClick={() => removeSession(s.id)} className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive" aria-label={t("gps.deleteSession")}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </AuthShell>
  );
}
