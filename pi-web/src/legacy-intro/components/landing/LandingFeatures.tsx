import FourierHeart from "../FourierHeart";
import { getLandingFeatures } from "./landing-data";
import { useI18n } from "../../hooks/useI18n";

interface LandingFeaturesProps {
  isDark: boolean;
}

export default function LandingFeatures({ isDark }: LandingFeaturesProps) {
  const { t } = useI18n();
  const features = getLandingFeatures();

  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
      <div className="mb-12 text-center">
        <h2
          className="font-serif text-2xl font-bold tracking-tight sm:text-3xl"
        >
          {t("landing.featuresTitle")}
        </h2>
        <p className={`mt-2 text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{t("landing.featuresSubtitle")}</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {features.map((feature, index) => (
          <div
            key={index}
            className={`group relative overflow-hidden rounded-2xl border p-6 transition-all hover:scale-[1.01] ${
              isDark
                ? "border-zinc-700/80 bg-zinc-900/60 backdrop-blur-sm hover:border-zinc-600"
                : "border-zinc-200 bg-white/60 backdrop-blur-sm hover:border-zinc-300 hover:shadow-lg hover:shadow-zinc-200/50"
            }`}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="absolute -right-4 -top-4 opacity-30 transition-opacity group-hover:opacity-60">
              <FourierHeart variant={feature.heartVariant} size={140} />
            </div>

            <div className="relative z-10">
              <div
                className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${
                  isDark ? "bg-magenta/10" : "bg-magenta-dark/8"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className={`h-5 w-5 ${isDark ? "text-magenta" : "text-magenta-dark"}`}
                >
                  <path d={feature.icon} />
                </svg>
              </div>
              <h3 className="text-sm font-semibold tracking-wide">{feature.title}</h3>
              <p className={`mt-1.5 text-sm leading-relaxed ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{feature.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
