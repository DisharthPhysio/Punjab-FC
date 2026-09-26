import { useState } from "react";
import { toast } from "sonner";
import { Download, Share2, FileSpreadsheet } from "lucide-react";
import apiV2, { formatApiError } from "@/lib/apiV2";
import { Button } from "@/components/ui/button";

async function fetchBlob(url) {
  const res = await apiV2.get(url, { responseType: "blob" });
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
 * falls back to a plain download everywhere else. */
export function ExportButtons({ pdfUrl, excelUrl, filename, canShare = true }) {
  const [busy, setBusy] = useState(null); // "pdf" | "excel" | "share" | null

  const canUseWebShare = canShare && typeof navigator !== "undefined" && !!navigator.canShare;

  const download = async (kind) => {
    setBusy(kind);
    try {
      const url = kind === "excel" ? excelUrl : pdfUrl;
      const blob = await fetchBlob(url);
      triggerDownload(blob, kind === "excel" ? `${filename}.xlsx` : `${filename}.pdf`);
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail) || "Couldn't generate the file");
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    setBusy("share");
    try {
      const blob = await fetchBlob(pdfUrl);
      const file = new File([blob], `${filename}.pdf`, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
      } else {
        triggerDownload(blob, `${filename}.pdf`);
      }
    } catch (err) {
      if (err?.name !== "AbortError") toast.error(formatApiError(err?.response?.data?.detail) || "Couldn't share the file");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {canUseWebShare ? (
        <Button variant="outline" size="sm" onClick={share} disabled={!!busy} className="gap-1.5" data-testid="share-pdf-button">
          <Share2 className="h-3.5 w-3.5" /> {busy === "share" ? "Preparing…" : "Share PDF"}
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={() => download("pdf")} disabled={!!busy} className="gap-1.5" data-testid="download-pdf-button">
          <Download className="h-3.5 w-3.5" /> {busy === "pdf" ? "Preparing…" : "Download PDF"}
        </Button>
      )}
      {excelUrl && (
        <Button variant="outline" size="sm" onClick={() => download("excel")} disabled={!!busy} className="gap-1.5" data-testid="download-excel-button">
          <FileSpreadsheet className="h-3.5 w-3.5" /> {busy === "excel" ? "Preparing…" : "Download Excel"}
        </Button>
      )}
    </div>
  );
}
