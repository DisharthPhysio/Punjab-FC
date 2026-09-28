import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "@/locales/en.json";
import hi from "@/locales/hi.json";
import es from "@/locales/es.json";
import el from "@/locales/el.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, hi: { translation: hi }, es: { translation: es }, el: { translation: el } },
    fallbackLng: "en",
    supportedLngs: ["en", "hi", "es", "el"],
    interpolation: { escapeValue: false },
    detection: { order: ["localStorage", "navigator"], lookupLocalStorage: "pfc_lang", caches: ["localStorage"] },
  });

export default i18n;
