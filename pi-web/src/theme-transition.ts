/**
 * Theme transition using View Transitions API.
 * Radiates a circular clip from the click origin.
 * Falls back to instant switch when API is unavailable or user prefers reduced motion.
 */

type ThemeApplyFn = () => void;

function supportsViewTransition(): boolean {
  return "startViewTransition" in document && typeof (document as any).startViewTransition === "function";
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function startThemeTransition(event: MouseEvent | null, apply: ThemeApplyFn): void {
  // Fallback: just apply immediately
  if (!supportsViewTransition() || prefersReducedMotion() || !event) {
    apply();
    return;
  }

  const x = event.clientX;
  const y = event.clientY;

  // Calculate the max radius needed to cover the entire viewport
  const maxRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );

  const transition = (document as any).startViewTransition(() => {
    apply();
  });

  transition.ready.then(() => {
    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${maxRadius}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration: 400,
        easing: "ease-out",
        pseudoElement: "::view-transition-new(root)",
      },
    );
  }).catch(() => {
    // Transition was skipped or cancelled — that's fine
  });
}
