import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Download, Share2, FileSpreadsheet } from "lucide-react";
import apiV2, { formatApiError } from "@/lib/apiV2";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

async function fetchBlob(url, params) {
  const res = await apiV2.get(url, { params, responseType: "blob" });
  return res.data;
}

function triggerDownload(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

/** pdfUrl/excelUrl are paths relative to the v2 API (e.g. "/checkin/export/pdf").
 * Excel is optional -- only the command centre uses it. "Share" uses the native
 * share sheet when the browser supports sharing files (mainly mobile), and
 * falls back to a plain download everywhere else. showDaysFilter adds a
 * 7/14/30-day (or all-time) window picker for history exports (item 1). */
export function ExportButtons({ pdfUrl, excelUrl, filename, canShare = true, showDaysFilter = false }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(null); // "pdf" | "excel" | "share" | null
  const [days, setDays] = useState("all");
  const params = showDaysFilter && days !== "all" ? { days } : undefined;
  const suffix = showDaysFilter && days !== "all" ? `-${days}d` : "";

  const canUseWebShare = canShare && typeof navigator !== "undefined" && !!navigator.canShare;

  const download = async (kind) => {
    setBusy(kind);
    try {
      const url = kind === "excel" ? excelUrl : pdfUrl;
      const blob = await fetchBlob(url, kind === "pdf" ? params : undefined);
      triggerDownload(blob, kind === "excel" ? `${filename}.xlsx` : `${filename}${suffix}.pdf`);
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail) || t("export.couldntGenerate"));
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    setBusy("share");
    try {
      const blob = await fetchBlob(pdfUrl, params);
      const file = new File([blob], `${filename}${suffix}.pdf`, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
      } else {
        triggerDownload(blob, `${filename}${suffix}.pdf`);
      }
    } catch (err) {
      if (err?.name !== "AbortError") toast.error(formatApiError(err?.response?.data?.detail) || t("export.couldntShare"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showDaysFilter && (
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="h-8 w-[110px] text-xs" data-testid="export-days-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("export.allTime")}</SelectItem>
            <SelectItem value="7">{t("export.days", { count: 7 })}</SelectItem>
            <SelectItem value="14">{t("export.days", { count: 14 })}</SelectItem>
            <SelectItem value="30">{t("export.days", { count: 30 })}</SelectItem>
          </SelectContent>
        </Select>
      )}
      {canUseWebShare ? (
        <Button variant="outline" size="sm" onClick={share} disabled={!!busy} className="gap-1.5" data-testid="share-pdf-button">
          <Share2 className="h-3.5 w-3.5" /> {busy === "share" ? t("export.preparing") : t("export.sharePdf")}
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={() => download("pdf")} disabled={!!busy} className="gap-1.5" data-testid="download-pdf-button">
          <Download className="h-3.5 w-3.5" /> {busy === "pdf" ? t("export.preparing") : t("export.downloadPdf")}
        </Button>
      )}
      {excelUrl && (
        <Button variant="outline" size="sm" onClick={() => download("excel")} disabled={!!busy} className="gap-1.5" data-testid="download-excel-button">
          <FileSpreadsheet className="h-3.5 w-3.5" /> {busy === "excel" ? t("export.preparing") : t("export.downloadExcel")}
        </Button>
      )}
    </div>
  );
}
