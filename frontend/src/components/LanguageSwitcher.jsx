import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "es", label: "Español" },
  { code: "el", label: "Ελληνικά" },
];

export function LanguageSwitcher({ className = "" }) {
  const { i18n } = useTranslation();

  return (
    <Select value={i18n.language?.split("-")[0] || "en"} onValueChange={(v) => i18n.changeLanguage(v)}>
      <SelectTrigger className={`h-9 w-auto gap-1.5 border-none bg-transparent px-2 shadow-none ${className}`} data-testid="language-switcher">
        <Languages className="h-4 w-4 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {LANGUAGES.map((l) => (
          <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
