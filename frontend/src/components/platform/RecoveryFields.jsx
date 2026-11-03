import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RECOVERY_QUESTION_IDS } from "@/lib/recovery";

/** Question picker + answer box. mode="set" (sign-up / one-time prompt) shows the "remember this" warning;
 *  mode="reset" (forgot password) asks the person to pick the SAME question they chose before. */
export function RecoveryFields({ question, answer, onQuestion, onAnswer, mode = "set", idPrefix = "rec", required = true, note }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4 rounded-xl border border-border bg-secondary/30 p-4" data-testid={`${idPrefix}-fields`}>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-q`}>{mode === "reset" ? t("recovery.whichQuestion") : t("recovery.question")}</Label>
        <Select value={question || undefined} onValueChange={onQuestion}>
          <SelectTrigger id={`${idPrefix}-q`} data-testid={`${idPrefix}-question`}><SelectValue placeholder={t("recovery.choose")} /></SelectTrigger>
          <SelectContent>
            {RECOVERY_QUESTION_IDS.map((id) => <SelectItem key={id} value={id} data-testid={`${idPrefix}-q-${id}`}>{t(`recovery.questions.${id}`)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-a`}>{t("recovery.answer")}</Label>
        <Input
          id={`${idPrefix}-a`} required={required} value={answer} onChange={(e) => onAnswer(e.target.value)} autoComplete="off"
          placeholder={question === "birth_date" ? t("recovery.dobHint") : t("recovery.answerPlaceholder")} data-testid={`${idPrefix}-answer`}
        />
      </div>
      {mode === "set" ? (
        <p className="flex gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400" data-testid={`${idPrefix}-warning`}>
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{t("recovery.warning")}</span>
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{t("recovery.resetHint")}</p>
      )}
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
