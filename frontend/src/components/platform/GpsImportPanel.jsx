import { useState, useRef } from "react";
import { toast } from "sonner";
import { UploadCloud, FileCheck2, UserPlus, X, CheckCircle2 } from "lucide-react";
import apiV2, { formatApiError } from "@/lib/apiV2";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CREATE = "__create__";
const SKIP = "__skip__";

function decisionFor(row) {
  return row.match ? row.match.player_id : CREATE;
}

/** onImported() is called after a successful commit so the parent can refresh
 * its roster/player list (a file import can add brand-new players). */
export function GpsImportPanel({ players, onImported }) {
  const fileInput = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null); // { session, format, unmapped_columns, rows }
  const [decisions, setDecisions] = useState({}); // rowIndex -> player_id | CREATE | SKIP
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState(null);

  const pickFile = () => fileInput.current?.click();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await apiV2.post("/team/gps/upload", form);
      setPreview(res.data);
      const initial = {};
      res.data.rows.forEach((row, i) => { initial[i] = decisionFor(row); });
      setDecisions(initial);
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail) || "Couldn't read that file");
    } finally {
      setUploading(false);
    }
  };

  const commit = async () => {
    setCommitting(true);
    try {
      const rows = preview.rows
        .map((row, i) => {
          const d = decisions[i];
          if (d === SKIP) return { parsed: row.parsed, action: "skip" };
          if (d === CREATE) return { parsed: row.parsed, action: "create" };
          return { parsed: row.parsed, action: "match", player_id: d };
        });
      const res = await apiV2.post("/team/gps/commit", {
        date: preview.session.date || new Date().toISOString().slice(0, 10),
        session_label: preview.session.name || "",
        rows,
      });
      setResult(res.data);
      toast.success(`Saved ${res.data.savedSessions} session${res.data.savedSessions === 1 ? "" : "s"}`);
      setPreview(null);
      onImported?.();
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    } finally {
      setCommitting(false);
    }
  };

  if (!preview) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-5 text-center">
        <input ref={fileInput} type="file" accept=".pdf,.csv,.xlsx" className="hidden" onChange={handleFile} data-testid="gps-import-file-input" />
        <UploadCloud className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
        <p className="mb-1 text-sm font-bold">Import a team GPS report</p>
        <p className="mb-3 text-xs text-muted-foreground">PDF activity report, or a CSV/Excel export — matched to your roster by name.</p>
        <Button size="sm" onClick={pickFile} disabled={uploading} data-testid="gps-import-pick-file">
          {uploading ? "Reading…" : "Choose file"}
        </Button>
        {result && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {result.savedSessions} session(s) saved{result.createdPlayers.length > 0 ? `, ${result.createdPlayers.length} player(s) added` : ""}.
          </p>
        )}
      </div>
    );
  }

  const unmatchedCount = preview.rows.filter((_, i) => decisions[i] === CREATE).length;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-bold"><FileCheck2 className="h-4 w-4" /> {preview.session.name || "Imported session"}</p>
          <p className="text-xs text-muted-foreground">
            {preview.session.date || "no date found"} · {preview.rows.length} athletes
            {unmatchedCount > 0 && ` · ${unmatchedCount} will be added as new players`}
          </p>
        </div>
        <button onClick={() => setPreview(null)} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground" aria-label="Cancel import">
          <X className="h-4 w-4" />
        </button>
      </div>

      {preview.unmapped_columns?.length > 0 && (
        <p className="mb-3 rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
          Not used (unrecognised columns): {preview.unmapped_columns.join(", ")}
        </p>
      )}

      <div className="space-y-2">
        {preview.rows.map((row, i) => {
          const d = decisions[i];
          const confident = row.match && row.match.score >= 0.95;
          return (
            <div key={i} className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{row.parsed.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.parsed.distance_m != null ? `${row.parsed.distance_m}m` : "—"}
                  {row.parsed.hsr_distance_m != null ? ` · HSR ${row.parsed.hsr_distance_m}m` : ""}
                  {row.parsed.sprints != null ? ` · ${row.parsed.sprints} sprints` : ""}
                  {!confident && row.match && <span className="text-amber-600 dark:text-amber-400"> · check this match</span>}
                </p>
              </div>
              <Select value={d} onValueChange={(v) => setDecisions((old) => ({ ...old, [i]: v }))}>
                <SelectTrigger className="w-full sm:w-56" data-testid={`gps-import-decision-${i}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CREATE}><span className="inline-flex items-center gap-1.5"><UserPlus className="h-3.5 w-3.5" /> Add as new player</span></SelectItem>
                  <SelectItem value={SKIP}>Skip this row</SelectItem>
                  {players.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      Match to {p.name}{row.suggestions?.find((s) => s.player_id === p.id) ? ` (${Math.round(row.suggestions.find((s) => s.player_id === p.id).score * 100)}%)` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>

      <Button className="mt-4 w-full" onClick={commit} disabled={committing} data-testid="gps-import-commit">
        {committing ? "Saving…" : `Confirm & save ${preview.rows.length} athlete(s)`}
      </Button>
    </div>
  );
}
