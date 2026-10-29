import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";

const Section = ({ title, children }) => (
  <section className="space-y-2">
    <h2 className="text-lg font-bold">{title}</h2>
    <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
  </section>
);

export default function Privacy() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary" data-testid="privacy-back-link">
            <ArrowLeft className="h-4 w-4" /> {t("common.back")}
          </Link>
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-black tracking-tight">{t("privacy.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("privacy.updated")}</p>
        </div>

        <p className="text-sm leading-relaxed">{t("privacy.intro")}</p>

        <Section title={t("privacy.collectTitle")}>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t("privacy.collect1")}</li>
            <li>{t("privacy.collect2")}</li>
            <li>{t("privacy.collect3")}</li>
            <li>{t("privacy.collect4")}</li>
          </ul>
        </Section>

        <Section title={t("privacy.whoTitle")}>
          <p>{t("privacy.whoBody")}</p>
        </Section>

        <Section title={t("privacy.whyTitle")}>
          <p>{t("privacy.whyBody")}</p>
        </Section>

        <Section title={t("privacy.youthTitle")}>
          <p>{t("privacy.youthBody")}</p>
        </Section>

        <Section title={t("privacy.keepTitle")}>
          <p>{t("privacy.keepBody")}</p>
        </Section>

        <Section title={t("privacy.choicesTitle")}>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t("privacy.choices1")}</li>
            <li>{t("privacy.choices2")}</li>
            <li>{t("privacy.choices3")}</li>
          </ul>
        </Section>

        <Section title={t("privacy.contactTitle")}>
          <p>
            {t("privacy.contactBody")}{" "}
            <a href="mailto:disharthjain98@gmail.com" className="font-semibold text-primary">disharthjain98@gmail.com</a>.
          </p>
        </Section>

        <p className="pt-4 text-xs text-muted-foreground">{t("privacy.disclaimer")}</p>
      </div>
    </div>
  );
}
