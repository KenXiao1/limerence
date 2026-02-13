import { useRef, useEffect } from "react";
import type { Theme } from "../hooks/useTheme";

interface Props {
  theme: Theme;
  /** Visual variant (0-3) */
  variant?: number;
  /** Canvas size in CSS pixels */
  size?: number;
}

/*
 * GlowOrb — morphing luminous blob for feature card decoration.
 *
 * A soft organic shape defined in polar coordinates:
 *   r(θ, t) = base + Σ_k A_k · sin(n_k·θ + ω_k·t + φ_k)
 *
 * Filled with a radial gradient and animated with gentle breathing.
 * Each variant has unique harmonic structure producing distinct shapes.
 */

interface Harmonic {
  /** Angular frequency (lobes) */
  n: number;
  /** Amplitude as fraction of base radius */
  amp: number;
  /** Time rotation speed */
  omega: number;
  /** Phase offset */
  phi: number;
}

interface OrbVariant {
  harmonics: Harmonic[];
  /** Breathing speed multiplier */
  breathe: number;
  /** Hue shift from base magenta (degrees) */
  hueShift: number;
}

const VARIANTS: OrbVariant[] = [
  {
    // 0: Gentle trefoil — soft three-lobed shape
    harmonics: [
      { n: 3, amp: 0.18, omega: 0.4, phi: 0 },
      { n: 5, amp: 0.06, omega: -0.3, phi: 1.2 },
      { n: 2, amp: 0.08, omega: 0.2, phi: 2.5 },
    ],
    breathe: 0.7,
    hueShift: 0,
  },
  {
    // 1: Amoeba — organic, slowly shifting
    harmonics: [
      { n: 2, amp: 0.22, omega: 0.3, phi: 0 },
      { n: 3, amp: 0.12, omega: -0.5, phi: 0.8 },
      { n: 7, amp: 0.04, omega: 0.7, phi: 3.1 },
      { n: 5, amp: 0.07, omega: -0.2, phi: 1.5 },
    ],
    breathe: 0.5,
    hueShift: -20,
  },
  {
    // 2: Star pulse — sharper, more geometric
    harmonics: [
      { n: 5, amp: 0.2, omega: 0.35, phi: 0 },
      { n: 3, amp: 0.1, omega: -0.25, phi: 1.0 },
      { n: 8, amp: 0.05, omega: 0.6, phi: 2.0 },
    ],
    breathe: 0.9,
    hueShift: 15,
  },
  {
    // 3: Liquid drop — smooth, flowing
    harmonics: [
      { n: 2, amp: 0.15, omega: 0.25, phi: 0 },
      { n: 4, amp: 0.1, omega: -0.4, phi: 0.5 },
      { n: 6, amp: 0.05, omega: 0.55, phi: 2.8 },
      { n: 3, amp: 0.08, omega: 0.15, phi: 4.0 },
    ],
    breathe: 0.6,
    hueShift: -10,
  },
];

export default function FourierHeart({ theme, variant = 0, size = 200 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    const v = VARIANTS[variant] ?? VARIANTS[0];
    const cx = size / 2;
    const cy = size / 2;
    const baseR = size * 0.3;
    const steps = 120; // polygon resolution
    let t = 0;

    const draw = () => {
      const isDark = document.documentElement.getAttribute("data-theme") !== "light";
      ctx.clearRect(0, 0, size, size);

      // Breathing: gentle radius oscillation
      const breath = 1.0 + 0.06 * Math.sin(t * v.breathe);

      // Build the blob path
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const theta = (i / steps) * Math.PI * 2;
        let r = baseR * breath;
        for (const h of v.harmonics) {
          r += baseR * h.amp * Math.sin(h.n * theta + h.omega * t + h.phi);
        }
        const px = cx + r * Math.cos(theta);
        const py = cy + r * Math.sin(theta);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();

      // Color: magenta-ish with per-variant hue shift
      // Dark: hsl(330 + shift, 70%, 56%)  Light: hsl(330 + shift, 60%, 40%)
      const hue = 330 + v.hueShift;
      const coreColor = isDark
        ? `hsl(${hue} 70% 56%)`
        : `hsl(${hue} 60% 40%)`;
      const midColor = isDark
        ? `hsla(${hue} 70% 56% / 0.15)`
        : `hsla(${hue} 60% 40% / 0.12)`;
      const edgeColor = isDark
        ? `hsla(${hue} 70% 56% / 0)`
        : `hsla(${hue} 60% 40% / 0)`;

      // Radial gradient fill
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 1.4);
      grad.addColorStop(0, isDark
        ? `hsla(${hue} 70% 56% / 0.35)`
        : `hsla(${hue} 60% 40% / 0.3)`);
      grad.addColorStop(0.6, midColor);
      grad.addColorStop(1, edgeColor);
      ctx.fillStyle = grad;
      ctx.fill();

      // Stroke the outline with soft glow
      ctx.save();
      ctx.shadowColor = coreColor;
      ctx.shadowBlur = 12;
      ctx.strokeStyle = isDark
        ? `hsla(${hue} 70% 56% / 0.5)`
        : `hsla(${hue} 60% 40% / 0.4)`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();

      // Inner bright core (smaller, brighter blob)
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const theta = (i / steps) * Math.PI * 2;
        let r = baseR * 0.4 * breath;
        for (const h of v.harmonics) {
          r += baseR * 0.15 * h.amp * Math.sin(h.n * theta + h.omega * t * 1.3 + h.phi);
        }
        const px = cx + r * Math.cos(theta);
        const py = cy + r * Math.sin(theta);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      const innerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 0.5);
      innerGrad.addColorStop(0, isDark
        ? `hsla(${hue} 80% 70% / 0.4)`
        : `hsla(${hue} 70% 55% / 0.35)`);
      innerGrad.addColorStop(1, isDark
        ? `hsla(${hue} 70% 56% / 0)`
        : `hsla(${hue} 60% 40% / 0)`);
      ctx.fillStyle = innerGrad;
      ctx.fill();

      t += 0.02;
      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [variant, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className="pointer-events-none"
    />
  );
}
