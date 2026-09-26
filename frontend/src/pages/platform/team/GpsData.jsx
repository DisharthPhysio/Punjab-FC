import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Satellite, Plus, Trash2 } from "lucide-react";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import apiV2, { formatApiError } from "@/lib/apiV2";
import { AuthShell } from "@/components/platform/AuthShell";
import { ExportButtons } from "@/components/platform/ExportButtons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const emptyForm = { date: new Date().toISOString().slice(0, 10), distance_m: "", hsr_distance_m: "", sprints: "", max_speed_kmh: "", notes: "" };

export default function GpsData() {
  const [players, setPlayers] = useState([]);
  const [playerId, setPlayerId] = useState("");
  const [sessions, setSessions] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiV2.get("/team/roster").then((res) => {
      const joined = res.data.players.filter((p) => p.joined);
      setPlayers(joined);
      if (joined.length > 0) setPlayerId(joined[0].id);
    }).catch((err) => toast.error(formatApiError(err?.response?.data?.detail)));
  }, []);

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

  const addSession = async (e) => {
    e.preventDefault();
    if (!form.distance_m) return toast.error("Enter at least the total distance");
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
      setForm(emptyForm);
      toast.success("GPS session added");
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
    label: new Date(s.date + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" }),
    distance: s.distance_m, internal: s.internal_load,
  }));

  return (
    <AuthShell icon={Satellite} title="GPS data" subtitle="Optional — external load from your tracking system, vs. internal (session-RPE) load" backTo="/team/home" maxWidth="max-w-2xl">
      <div className="space-y-6">
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Player</p>
          <Select value={playerId} onValueChange={setPlayerId}>
            <SelectTrigger data-testid="gps-player-select"><SelectValue placeholder="Select a player" /></SelectTrigger>
            <SelectContent>
              {players.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {players.length === 0 && <p className="mt-2 text-xs text-muted-foreground">No joined players yet.</p>}
        </div>

        {playerId && (
          <>
            <form onSubmit={addSession} className="rounded-2xl border border-border bg-card p-4">
              <p className="mb-3 text-sm font-bold">Add a session</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Date</p>
                  <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} data-testid="gps-date-input" />
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Distance (m)</p>
                  <Input type="number" min={0} value={form.distance_m} onChange={(e) => setForm((f) => ({ ...f, distance_m: e.target.value }))} placeholder="e.g. 8200" data-testid="gps-distance-input" />
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">HSR distance (m)</p>
                  <Input type="number" min={0} value={form.hsr_distance_m} onChange={(e) => setForm((f) => ({ ...f, hsr_distance_m: e.target.value }))} placeholder="optional" data-testid="gps-hsr-input" />
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Sprints</p>
                  <Input type="number" min={0} value={form.sprints} onChange={(e) => setForm((f) => ({ ...f, sprints: e.target.value }))} placeholder="optional" data-testid="gps-sprints-input" />
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Max speed (km/h)</p>
                  <Input type="number" min={0} step={0.1} value={form.max_speed_kmh} onChange={(e) => setForm((f) => ({ ...f, max_speed_kmh: e.target.value }))} placeholder="optional" data-testid="gps-maxspeed-input" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <p className="mb-1 text-xs text-muted-foreground">Notes</p>
                  <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="optional" data-testid="gps-notes-input" />
                </div>
              </div>
              <Button type="submit" size="sm" className="mt-3 gap-1.5" disabled={saving} data-testid="gps-add-submit">
                <Plus className="h-3.5 w-3.5" /> Add session
              </Button>
            </form>

            {analysis && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold">External vs. internal load</p>
                    <p className="text-xs text-muted-foreground">
                      {analysis.matchedSamples >= 3 ? `${analysis.matchedSamples} matched days` : "Need a few more matched days for a correlation"}
                    </p>
                  </div>
                  {analysis.correlation != null && (
                    <p className="font-mono text-2xl font-extrabold">{analysis.correlation}</p>
                  )}
                </div>
                {chartData.length > 0 && (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(chartData.length / 8))} />
                        <YAxis yAxisId="dist" tick={{ fontSize: 10 }} />
                        <YAxis yAxisId="load" orientation="right" tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                        <Bar yAxisId="dist" dataKey="distance" fill="hsl(160 84% 39%)" radius={[3, 3, 0, 0]} name="Distance (m)" />
                        <Line yAxisId="load" type="monotone" dataKey="internal" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls name="Internal load" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  Distance tends to track session-RPE reasonably well; sprints and high-speed running often don't —
                  that's a different (and useful) signal, not a data problem.
                </p>
              </div>
            )}

            <div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Logged sessions</h3>
                {sessions?.length > 0 && (
                  <ExportButtons pdfUrl={`/team/gps/export/pdf?player_id=${playerId}`} filename={`${playerName || "player"}-gps`} canShare={false} />
                )}
              </div>
              <div className="space-y-2">
                {sessions === null && <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>}
                {sessions?.length === 0 && <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">No GPS sessions logged for {playerName} yet.</p>}
                {sessions?.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-2.5">
                    <div className="text-sm">
                      <span className="font-semibold">{new Date(s.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                      <span className="ml-2 text-muted-foreground">{s.distance_m}m{s.hsr_distance_m ? ` · HSR ${s.hsr_distance_m}m` : ""}{s.sprints ? ` · ${s.sprints} sprints` : ""}</span>
                    </div>
                    <button onClick={() => removeSession(s.id)} className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive" aria-label="Delete session">
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
