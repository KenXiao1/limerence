import { useI18n } from "../../hooks/useI18n";

interface LandingMemoryShowcaseProps {
  isDark: boolean;
}

export default function LandingMemoryShowcase({ isDark }: LandingMemoryShowcaseProps) {
  const { t } = useI18n();

  const flowSteps = [
    { label: t("landing.memoryFlow1"), icon: "💬", delay: "0s" },
    { label: t("landing.memoryFlow2"), icon: "🔍", delay: "0.6s" },
    { label: t("landing.memoryFlow3"), icon: "💾", delay: "1.2s" },
    { label: t("landing.memoryFlow4"), icon: "📁", delay: "1.8s" },
  ];

  const stats = [
    { title: t("landing.memoryStat1"), desc: t("landing.memoryStat1Desc") },
    { title: t("landing.memoryStat2"), desc: t("landing.memoryStat2Desc") },
    { title: t("landing.memoryStat3"), desc: t("landing.memoryStat3Desc") },
  ];

  const terminalLines = [
    "## 用户档案",
    "- 名字：小明",
    "- 喜欢：编程、音乐、咖啡",
    "- 生日：1月15日",
    "",
    "## 长期记忆",
    "最近在学 Rust，对 WASM 很感兴趣",
    "喜欢在深夜写代码",
    "养了一只叫「比特」的猫",
  ];

  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
      <div className="mb-12 text-center">
        <h2 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl">
          {t("landing.memoryTitle")}
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          {t("landing.memorySubtitle")}
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        {/* Left: Memory flow diagram */}
        <div className="flex-1">
          <div
            className={`relative overflow-hidden rounded-2xl border p-6 ${
              isDark
                ? "border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm"
                : "border-zinc-200 bg-white/60 backdrop-blur-sm"
            }`}
          >
            <div className="flex flex-col items-center gap-3">
              {flowSteps.map((step, i) => (
                <div key={step.label} className="flex w-full flex-col items-center">
                  <div
                    className={`flex w-full max-w-xs items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                      isDark
                        ? "border-magenta/20 bg-magenta/[0.04]"
                        : "border-magenta-dark/15 bg-magenta-dark/[0.03]"
                    }`}
                    style={{
                      animation: "memoryFlow 3.2s ease-in-out infinite",
                      animationDelay: step.delay,
                    }}
                  >
                    <span className="text-base">{step.icon}</span>
                    <span
                      className={`text-xs font-medium ${
                        isDark ? "text-zinc-300" : "text-zinc-700"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {i < flowSteps.length - 1 && (
                    <div
                      className={`my-1 h-4 border-l border-dashed ${
                        isDark ? "border-zinc-600" : "border-zinc-300"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Simulated terminal */}
        <div className="flex-1">
          <div
            className={`relative overflow-hidden rounded-2xl border ${
              isDark
                ? "border-zinc-800/80 bg-zinc-950/80"
                : "border-zinc-200 bg-zinc-900/95"
            }`}
          >
            {/* Terminal title bar */}
            <div className="flex items-center gap-2 border-b border-zinc-700/50 px-4 py-2.5">
              <div className="flex gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
                <div className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
              </div>
              <span className="ml-2 font-mono text-[10px] text-zinc-500">
                memory/PROFILE.md
              </span>
            </div>

            {/* Terminal content */}
            <div className="p-4">
              <pre className="font-mono text-xs leading-relaxed">
                {terminalLines.map((line, i) => (
                  <div key={i} className="flex">
                    <span className="mr-3 select-none text-zinc-600">
                      {String(i + 1).padStart(2, " ")}
                    </span>
                    <span
                      className={
                        line.startsWith("##")
                          ? "font-semibold text-magenta"
                          : line.startsWith("-")
                            ? "text-cyan-light"
                            : "text-zinc-400"
                      }
                    >
                      {line || "\u00A0"}
                    </span>
                  </div>
                ))}
                <div className="flex">
                  <span className="mr-3 select-none text-zinc-600">
                    {String(terminalLines.length + 1).padStart(2, " ")}
                  </span>
                  <span
                    className="inline-block h-4 w-1.5 bg-magenta"
                    style={{ animation: "blink 1s step-end infinite" }}
                  />
                </div>
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: Tech badges */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.title}
            className={`rounded-xl border px-4 py-3 text-center ${
              isDark
                ? "border-zinc-800/80 bg-zinc-900/40"
                : "border-zinc-200 bg-white/60"
            }`}
          >
            <div
              className={`text-xs font-semibold ${
                isDark ? "text-zinc-200" : "text-zinc-800"
              }`}
            >
              {stat.title}
            </div>
            <div className="mt-0.5 text-[11px] text-zinc-500">{stat.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
