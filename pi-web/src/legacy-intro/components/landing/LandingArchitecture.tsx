import { getAgentModules, getRustCrates } from "./landing-data";
import { useI18n } from "../../hooks/useI18n";

interface LandingArchitectureProps {
  isDark: boolean;
}

export default function LandingArchitecture({ isDark }: LandingArchitectureProps) {
  const { t } = useI18n();
  const RUST_CRATES = getRustCrates();
  const AGENT_MODULES = getAgentModules();

  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
      <div className="mb-12 text-center">
        <h2
          className="font-serif text-2xl font-bold tracking-tight sm:text-3xl"
        >
          {t("landing.archTitle")}
        </h2>
        <p className="mt-2 text-sm text-zinc-500">{t("landing.archSubtitle")}</p>
      </div>

      <div
        className={`relative overflow-hidden rounded-2xl border p-6 sm:p-10 ${
          isDark
            ? "border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm"
            : "border-zinc-200 bg-white/60 backdrop-blur-sm"
        }`}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle, ${isDark ? "#fff" : "#000"} 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative flex flex-col gap-8">
          <div>
            <div className="mb-4 flex items-center gap-2.5">
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${isDark ? "bg-amber-500/15" : "bg-amber-600/10"}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={`h-3.5 w-3.5 ${isDark ? "text-amber-500" : "text-amber-600"}`}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <span className={`text-xs font-semibold tracking-wide ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>{t("landing.archRustCore")}</span>
                <span className={`ml-2 font-mono text-[10px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>Cargo Workspace</span>
              </div>
            </div>

            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              {RUST_CRATES.map((crateItem, index) => (
                <div key={crateItem.name} className="flex flex-1 items-center gap-3 sm:gap-2">
                  <div
                    className={`flex-1 rounded-xl border px-4 py-3 ${
                      isDark ? "border-amber-500/20 bg-amber-500/[0.04]" : "border-amber-600/15 bg-amber-600/[0.03]"
                    }`}
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      <div
                        className={`h-1.5 w-1.5 rounded-full ${isDark ? "bg-amber-500" : "bg-amber-600"}`}
                        style={{ boxShadow: isDark ? "0 0 6px #f59e0b" : "0 0 6px #d97706" }}
                      />
                      <span className={`font-mono text-[11px] font-medium ${isDark ? "text-amber-400" : "text-amber-700"}`}>{crateItem.name}</span>
                    </div>
                    <div className={`text-[11px] font-medium ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>{crateItem.title}</div>
                    <div className={`font-mono text-[9px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>{crateItem.sub}</div>
                  </div>
                  {index < 2 && (
                    <span className={`hidden text-sm sm:block ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>→</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center py-2">
            <div className="hidden sm:flex sm:flex-col sm:items-center sm:gap-1">
              <div className={`h-6 border-l border-dashed ${isDark ? "border-zinc-600" : "border-zinc-300"}`} />
              <span
                className={`rounded-full px-3 py-1 font-mono text-[10px] font-medium ${
                  isDark ? "bg-zinc-800/60 text-zinc-400" : "bg-zinc-100/80 text-zinc-500"
                }`}
              >
                {t("landing.archTsPort")}
              </span>
              <div className={`h-6 border-l border-dashed ${isDark ? "border-zinc-600" : "border-zinc-300"}`} />
            </div>
            <div className="flex w-full items-center gap-3 sm:hidden">
              <div className={`h-px flex-1 ${isDark ? "bg-zinc-700" : "bg-zinc-300"}`} />
              <span className={`font-mono text-[10px] font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{t("landing.archTsPort")}</span>
              <div className={`h-px flex-1 ${isDark ? "bg-zinc-700" : "bg-zinc-300"}`} />
            </div>
          </div>

          <div className="flex flex-col gap-8 lg:flex-row lg:gap-6">
            <div className="flex-1">
              <div className="mb-4 flex items-center gap-2.5">
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${isDark ? "bg-magenta/15" : "bg-magenta-dark/10"}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={`h-3.5 w-3.5 ${isDark ? "text-magenta" : "text-magenta-dark"}`}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a9 9 0 11-18 0V5.25"
                    />
                  </svg>
                </div>
                <div>
                  <span className={`text-xs font-semibold tracking-wide ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>{t("landing.archBrowser")}</span>
                  <span className={`ml-2 font-mono text-[10px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>React + TypeScript</span>
                </div>
              </div>

              <div
                className={`rounded-xl border p-4 ${
                  isDark ? "border-magenta/20 bg-magenta/[0.04]" : "border-magenta-dark/15 bg-magenta-dark/[0.03]"
                }`}
              >
                <div className="mb-3 flex items-center gap-2">
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${isDark ? "bg-magenta" : "bg-magenta-dark"}`}
                    style={{ boxShadow: isDark ? "0 0 6px #e040a0" : "0 0 6px #a02070" }}
                  />
                  <span className={`font-mono text-[11px] font-medium ${isDark ? "text-magenta-light" : "text-magenta-dark"}`}>Agent Loop</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {AGENT_MODULES.map((moduleItem, idx) => (
                    <div
                      key={moduleItem.label}
                      className={`rounded-lg px-3 py-2 ${
                        idx === 4
                          ? isDark ? "bg-magenta/10 ring-1 ring-magenta/20" : "bg-magenta-dark/5 ring-1 ring-magenta-dark/15"
                          : isDark ? "bg-zinc-800/60" : "bg-zinc-100/80"
                      }`}
                    >
                      <div className={`text-[11px] font-medium ${
                        idx === 4
                          ? isDark ? "text-magenta-light" : "text-magenta-dark"
                          : isDark ? "text-zinc-300" : "text-zinc-700"
                      }`}>{moduleItem.label}</div>
                      <div className={`font-mono text-[9px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>{moduleItem.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="hidden lg:flex lg:flex-col lg:items-center lg:justify-center lg:gap-4 lg:px-2">
              <div className="flex flex-col items-center gap-1">
                <span className={`font-mono text-[9px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>stream</span>
                <div className="relative flex items-center">
                  <div className={`h-px w-16 ${isDark ? "bg-zinc-700" : "bg-zinc-300"}`} />
                  <div
                    className={`absolute h-1.5 w-1.5 rounded-full ${isDark ? "bg-magenta" : "bg-magenta-dark"}`}
                    style={{
                      animation: "archPulse 2s ease-in-out infinite",
                      left: 0,
                    }}
                  />
                  <svg viewBox="0 0 8 8" className={`h-2 w-2 ${isDark ? "text-zinc-700" : "text-zinc-300"}`}>
                    <path d="M0 0 L8 4 L0 8 Z" fill="currentColor" />
                  </svg>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className={`font-mono text-[9px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>fetch</span>
                <div className="relative flex items-center">
                  <div className={`h-px w-16 ${isDark ? "bg-zinc-700" : "bg-zinc-300"}`} />
                  <div
                    className={`absolute h-1.5 w-1.5 rounded-full ${isDark ? "bg-cyan" : "bg-cyan-dark"}`}
                    style={{
                      animation: "archPulse 2s ease-in-out infinite 0.8s",
                      left: 0,
                    }}
                  />
                  <svg viewBox="0 0 8 8" className={`h-2 w-2 ${isDark ? "text-zinc-700" : "text-zinc-300"}`}>
                    <path d="M0 0 L8 4 L0 8 Z" fill="currentColor" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 lg:hidden">
              <div className={`h-8 w-px ${isDark ? "bg-zinc-700" : "bg-zinc-300"}`} />
              <span className={`font-mono text-[9px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>stream / fetch</span>
              <div className={`h-8 w-px ${isDark ? "bg-zinc-700" : "bg-zinc-300"}`} />
            </div>

            <div className="lg:w-64">
              <div className="mb-4 flex items-center gap-2.5">
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${isDark ? "bg-cyan/15" : "bg-cyan-dark/10"}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={`h-3.5 w-3.5 ${isDark ? "text-cyan" : "text-cyan-dark"}`}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z"
                    />
                  </svg>
                </div>
                <div>
                  <span className={`text-xs font-semibold tracking-wide ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>Edge Functions</span>
                  <span className={`ml-2 font-mono text-[10px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>Netlify · Deno</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div
                  className={`rounded-xl border px-4 py-3 ${
                    isDark ? "border-cyan/15 bg-cyan/[0.03]" : "border-cyan-dark/12 bg-cyan-dark/[0.03]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-1.5 w-1.5 rounded-full ${isDark ? "bg-cyan" : "bg-cyan-dark"}`}
                      style={{ boxShadow: isDark ? "0 0 6px #22d3ee" : "0 0 6px #0891b2" }}
                    />
                    <span className={`font-mono text-[11px] font-medium ${isDark ? "text-cyan-light" : "text-cyan-dark"}`}>chat-proxy.ts</span>
                  </div>
                  <p className="mt-1 text-[10px] text-zinc-500">{t("landing.archProxy")}</p>
                </div>

                <div
                  className={`rounded-xl border px-4 py-3 ${
                    isDark ? "border-cyan/15 bg-cyan/[0.03]" : "border-cyan-dark/12 bg-cyan-dark/[0.03]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-1.5 w-1.5 rounded-full ${isDark ? "bg-cyan" : "bg-cyan-dark"}`}
                      style={{ boxShadow: isDark ? "0 0 6px #22d3ee" : "0 0 6px #0891b2" }}
                    />
                    <span className={`font-mono text-[11px] font-medium ${isDark ? "text-cyan-light" : "text-cyan-dark"}`}>web-search.ts</span>
                  </div>
                  <p className="mt-1 text-[10px] text-zinc-500">{t("landing.archSearch")}</p>
                </div>

                <div className={`mt-1 flex items-center gap-2 rounded-lg px-3 py-2 ${isDark ? "bg-zinc-800/40" : "bg-zinc-100/60"}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={`h-3 w-3 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                    />
                  </svg>
                  <span className={`font-mono text-[9px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
                    {t("landing.archPrivacy")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
