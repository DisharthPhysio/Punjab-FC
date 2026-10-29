import { enUS } from "date-fns/locale/en-US";
import { hi } from "date-fns/locale/hi";
import { es } from "date-fns/locale/es";
import { el } from "date-fns/locale/el";

const LOCALES = { en: enUS, hi, es, el };

/** date-fns locale for the language picked in the app (used by the calendar's month/weekday names). */
export const dateFnsLocale = (lng) => LOCALES[(lng || "en").split("-")[0]] || enUS;

/** Today as YYYY-MM-DD in the device's own timezone. (The app used to take it from toISOString(),
 * which is the UTC date and can be a day behind the server's date for several hours each day.) */
export function localDateStr(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "2026-10-24" -> "24 Oct" in the app language. */
export function formatDay(dateStr, lng, opts = { day: "numeric", month: "short" }) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString(lng, opts);
}
