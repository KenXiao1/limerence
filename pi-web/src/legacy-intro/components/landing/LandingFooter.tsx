interface LandingFooterProps {
  isDark: boolean;
}

export default function LandingFooter({ isDark }: LandingFooterProps) {
  return (
    <footer
      className={`relative z-10 border-t py-8 text-center text-xs ${
        isDark ? "border-zinc-800 text-zinc-600" : "border-zinc-200 text-zinc-400"
      }`}
    >
      <div className="flex items-center justify-center gap-3">
        <span>Limerence</span>
        <span className={isDark ? "text-zinc-800" : "text-zinc-300"}>·</span>
        <a
          href="https://github.com/KenXiao1/limerence"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-magenta"
        >
          GitHub
        </a>
      </div>
    </footer>
  );
}
