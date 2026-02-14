import { t } from "../../../lib/i18n";

export interface LandingFeature {
  title: string;
  desc: string;
  icon: string;
  heartVariant: number;
}

export function getLandingFeatures(): LandingFeature[] {
  return [
    {
      title: t("landing.feat1Title"),
      desc: t("landing.feat1Desc"),
      icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
      heartVariant: 0,
    },
    {
      title: t("landing.feat2Title"),
      desc: t("landing.feat2Desc"),
      icon: "M11.42 15.17l-5.1-5.1a1 1 0 0 1 0-1.42l.71-.71a1 1 0 0 1 1.41 0L12 11.5l5.17-5.17a1 1 0 0 1 1.41 0l.71.71a1 1 0 0 1 0 1.42l-5.1 5.1M3.34 19a10 10 0 1 1 17.32 0",
      heartVariant: 1,
    },
    {
      title: t("landing.feat3Title"),
      desc: t("landing.feat3Desc"),
      icon: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7z",
      heartVariant: 2,
    },
    {
      title: t("landing.feat4Title"),
      desc: t("landing.feat4Desc"),
      icon: "M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2zm10-10V7a4 4 0 0 0-8 0v4h8z",
      heartVariant: 3,
    },
  ];
}

export interface RustCrateCard {
  name: string;
  title: string;
  sub: string;
}

export function getRustCrates(): RustCrateCard[] {
  return [
    { name: "limerence-ai", title: t("landing.archCrate1Title"), sub: t("landing.archCrate1Sub") },
    { name: "limerence-core", title: t("landing.archCrate2Title"), sub: t("landing.archCrate2Sub") },
    { name: "limerence-tui", title: t("landing.archCrate3Title"), sub: t("landing.archCrate3Sub") },
  ];
}

export interface AgentModuleCard {
  label: string;
  sub: string;
}

export function getAgentModules(): AgentModuleCard[] {
  return [
    { label: t("landing.archMod1"), sub: "SSE stream" },
    { label: t("landing.archMod2"), sub: "CJK tokenizer" },
    { label: t("landing.archMod3"), sub: "IndexedDB" },
    { label: t("landing.archMod4"), sub: t("landing.archMod4Sub") },
  ];
}
