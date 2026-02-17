/**
 * LeniaBubble — React wrapper for the Particle Lenia canvas animation.
 * Shows an organic, self-organising particle system while waiting for LLM response.
 */

import { useRef, useEffect, useCallback } from "react";

// ── Simulation (extracted from lib/particle-lenia.ts) ────────────

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  phase: number;
}

interface LeniaParams {
  count: number;
  kernelRadius: number;
  mu: number;
  sigma: number;
  dt: number;
  damping: number;
  forceScale: number;
}

const DEFAULT_PARAMS: LeniaParams = {
  count: 36,
  kernelRadius: 22,
  mu: 0.28,
  sigma: 0.07,
  dt: 0.35,
  damping: 0.88,
  forceScale: 1.6,
};

class ParticleLeniaSimulation {
  particles: Particle[] = [];
  width: number;
  height: number;
  params: LeniaParams;
  time = 0;

  constructor(width: number, height: number, params: Partial<LeniaParams> = {}) {
    this.width = width;
    this.height = height;
    this.params = { ...DEFAULT_PARAMS, ...params };
    this.seed();
  }

  seed() {
    this.particles = [];
    const cx = this.width / 2;
    const cy = this.height / 2;
    const spread = Math.min(this.width, this.height) * 0.35;

    for (let i = 0; i < this.params.count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = spread * (0.2 + 0.8 * Math.random());
      this.particles.push({
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        g: 0,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  private kernel(dist: number): number {
    const r = dist / this.params.kernelRadius;
    if (r >= 1) return 0;
    const t = 1 - r * r;
    return t * t;
  }

  private kernelGrad(dist: number): number {
    const R = this.params.kernelRadius;
    const r = dist / R;
    if (r >= 1 || r < 0.001) return 0;
    return (-4 * r * (1 - r * r)) / R;
  }

  private growth(density: number): number {
    const d = (density - this.params.mu) / this.params.sigma;
    return 2 * Math.exp(-0.5 * d * d) - 1;
  }

  step() {
    const { particles, params, width, height } = this;
    const n = particles.length;
    const dt = params.dt;
    const damp = params.damping;
    const fScale = params.forceScale;

    this.time += dt * 0.02;
    const breathe = 1 + 0.12 * Math.sin(this.time * 1.7) + 0.06 * Math.sin(this.time * 2.9);

    const fx = new Float32Array(n);
    const fy = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      const pi = particles[i];
      let density = 0;
      let gx = 0;
      let gy = 0;

      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const pj = particles[j];
        const dx = pj.x - pi.x;
        const dy = pj.y - pi.y;
        const dist = Math.sqrt(dx * dx + dy * dy) + 1e-4;

        const k = this.kernel(dist);
        density += k;

        const dk = this.kernelGrad(dist);
        gx += dk * (dx / dist);
        gy += dk * (dy / dist);
      }

      const g = this.growth(density * breathe);
      pi.g = g;

      fx[i] = g * gx * fScale;
      fy[i] = g * gy * fScale;

      const dcx = pi.x - width / 2;
      const dcy = pi.y - height / 2;
      const centerDist = Math.sqrt(dcx * dcx + dcy * dcy);
      const maxDrift = Math.min(width, height) * 0.38;
      if (centerDist > maxDrift) {
        const pull = 0.02 * (centerDist - maxDrift);
        fx[i] -= pull * (dcx / centerDist);
        fy[i] -= pull * (dcy / centerDist);
      }
    }

    for (let i = 0; i < n; i++) {
      const p = particles[i];
      p.vx = (p.vx + fx[i] * dt) * damp;
      p.vy = (p.vy + fy[i] * dt) * damp;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const margin = 3;
      if (p.x < margin) { p.x = margin; p.vx = Math.abs(p.vx) * 0.5; }
      if (p.x > width - margin) { p.x = width - margin; p.vx = -Math.abs(p.vx) * 0.5; }
      if (p.y < margin) { p.y = margin; p.vy = Math.abs(p.vy) * 0.5; }
      if (p.y > height - margin) { p.y = height - margin; p.vy = -Math.abs(p.vy) * 0.5; }
    }
  }
}

// ── Renderer ────────────────────────────────────────────────────

type RGB = [number, number, number];

interface RenderColors {
  primary: RGB;
  accent: RGB;
  glow: RGB;
}

function getThemeColors(): RenderColors {
  const isDark = document.documentElement.classList.contains("dark");
  if (isDark) {
    return {
      primary: [180, 220, 190],
      accent: [130, 210, 100],
      glow: [100, 180, 80],
    };
  }
  return {
    primary: [60, 100, 60],
    accent: [80, 150, 60],
    glow: [90, 160, 70],
  };
}

function renderFrame(
  ctx: CanvasRenderingContext2D,
  trailCtx: CanvasRenderingContext2D,
  sim: ParticleLeniaSimulation,
  colors: RenderColors,
  time: number,
) {
  const w = sim.width;
  const h = sim.height;

  // Fade trails
  trailCtx.globalCompositeOperation = "destination-out";
  trailCtx.fillStyle = "rgba(0,0,0,0.15)";
  trailCtx.fillRect(0, 0, w, h);
  trailCtx.globalCompositeOperation = "source-over";

  // Draw particles
  for (const p of sim.particles) {
    const intensity = (p.g + 1) / 2;
    const shimmer = 0.5 + 0.5 * Math.sin(time * 0.003 + p.phase * 6);

    const t = intensity * 0.7 + shimmer * 0.3;
    const r = Math.round(colors.primary[0] + (colors.accent[0] - colors.primary[0]) * t);
    const g = Math.round(colors.primary[1] + (colors.accent[1] - colors.primary[1]) * t);
    const b = Math.round(colors.primary[2] + (colors.accent[2] - colors.primary[2]) * t);

    const alpha = 0.35 + intensity * 0.55;
    const radius = 2.2 + intensity * 2.5 + shimmer * 0.8;

    // Glow
    const grad = trailCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 2.5);
    grad.addColorStop(0, `rgba(${colors.glow[0]},${colors.glow[1]},${colors.glow[2]},${alpha * 0.2})`);
    grad.addColorStop(1, `rgba(${colors.glow[0]},${colors.glow[1]},${colors.glow[2]},0)`);
    trailCtx.fillStyle = grad;
    trailCtx.beginPath();
    trailCtx.arc(p.x, p.y, radius * 2.5, 0, Math.PI * 2);
    trailCtx.fill();

    // Core
    const coreGrad = trailCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
    coreGrad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
    coreGrad.addColorStop(0.6, `rgba(${r},${g},${b},${alpha * 0.6})`);
    coreGrad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    trailCtx.fillStyle = coreGrad;
    trailCtx.beginPath();
    trailCtx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    trailCtx.fill();
  }

  // Connection lines
  for (let i = 0; i < sim.particles.length; i++) {
    const pi = sim.particles[i];
    for (let j = i + 1; j < sim.particles.length; j++) {
      const pj = sim.particles[j];
      const dx = pj.x - pi.x;
      const dy = pj.y - pi.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const threshold = sim.params.kernelRadius * 0.7;
      if (dist < threshold) {
        const lineAlpha = (1 - dist / threshold) * 0.12;
        trailCtx.strokeStyle = `rgba(${colors.glow[0]},${colors.glow[1]},${colors.glow[2]},${lineAlpha})`;
        trailCtx.lineWidth = 0.6;
        trailCtx.beginPath();
        trailCtx.moveTo(pi.x, pi.y);
        trailCtx.lineTo(pj.x, pj.y);
        trailCtx.stroke();
      }
    }
  }

  // Composite
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(trailCtx.canvas, 0, 0, trailCtx.canvas.width, trailCtx.canvas.height, 0, 0, w, h);
}

// ── React component ─────────────────────────────────────────────

const SIM_WIDTH = 120;
const SIM_HEIGHT = 40;

export function LeniaBubble({ visible }: { visible: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<{
    sim: ParticleLeniaSimulation;
    trailCanvas: HTMLCanvasElement;
    trailCtx: CanvasRenderingContext2D;
    colors: RenderColors;
    raf: number;
  } | null>(null);

  const startAnimation = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SIM_WIDTH * dpr;
    canvas.height = SIM_HEIGHT * dpr;
    canvas.style.width = `${SIM_WIDTH}px`;
    canvas.style.height = `${SIM_HEIGHT}px`;
    ctx.scale(dpr, dpr);

    const trailCanvas = document.createElement("canvas");
    trailCanvas.width = canvas.width;
    trailCanvas.height = canvas.height;
    const trailCtx = trailCanvas.getContext("2d")!;
    trailCtx.scale(dpr, dpr);

    const sim = new ParticleLeniaSimulation(SIM_WIDTH, SIM_HEIGHT);
    const colors = getThemeColors();

    const state = { sim, trailCanvas, trailCtx, colors, raf: 0 };
    stateRef.current = state;

    const loop = (time: number) => {
      sim.step();
      renderFrame(ctx, trailCtx, sim, state.colors, time);
      state.raf = requestAnimationFrame(loop);
    };
    state.raf = requestAnimationFrame(loop);
  }, []);

  const stopAnimation = useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    cancelAnimationFrame(state.raf);
    state.trailCanvas.width = 0;
    state.trailCanvas.height = 0;
    stateRef.current = null;
  }, []);

  useEffect(() => {
    if (visible) {
      startAnimation();
    } else {
      stopAnimation();
    }
    return stopAnimation;
  }, [visible, startAnimation, stopAnimation]);

  // Watch theme changes to refresh colors
  useEffect(() => {
    if (!visible) return;
    const observer = new MutationObserver(() => {
      if (stateRef.current) {
        stateRef.current.colors = getThemeColors();
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    return () => observer.disconnect();
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="flex justify-start px-4 py-2">
      <div className="max-w-[80%] rounded-2xl bg-muted px-4 py-3">
        <canvas
          ref={canvasRef}
          className="block"
          aria-label="AI is thinking"
          role="status"
          aria-hidden="false"
        />
      </div>
    </div>
  );
}
