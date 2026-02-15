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
      icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4",
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
    { label: t("landing.archMod5"), sub: t("landing.archMod5Sub") },
  ];
}
