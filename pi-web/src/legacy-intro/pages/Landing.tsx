import LandingArchitecture from "../components/landing/LandingArchitecture";
import LandingFeatures from "../components/landing/LandingFeatures";
import LandingFooter from "../components/landing/LandingFooter";
import LandingHero from "../components/landing/LandingHero";
import LandingMemoryShowcase from "../components/landing/LandingMemoryShowcase";
import LandingNav from "../components/landing/LandingNav";
import { useTheme } from "../hooks/useTheme";

interface LandingProps {
  onStartChat: () => void;
  startingChat?: boolean;
  onLogin?: () => void;
  authEmail?: string | null;
  onLogout?: () => void;
}

export default function Landing({ onStartChat, startingChat = false, onLogin, authEmail, onLogout }: LandingProps) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <div
      className={`min-h-dvh transition-colors duration-500 ${
        isDark ? "bg-[#09090b] text-zinc-100" : "bg-[#faf8f6] text-zinc-900"
      }`}
    >
      <LandingNav
        isDark={isDark}
        onToggleTheme={toggle}
        onStartChat={onStartChat}
        startingChat={startingChat}
        onLogin={onLogin}
        authEmail={authEmail}
        onLogout={onLogout}
      />
      <LandingHero isDark={isDark} theme={theme} onStartChat={onStartChat} startingChat={startingChat} />
      <LandingFeatures isDark={isDark} />
      <LandingMemoryShowcase isDark={isDark} />
      <LandingArchitecture isDark={isDark} />
      <LandingFooter isDark={isDark} />
    </div>
  );
}
