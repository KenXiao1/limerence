import { useRef, useEffect } from "react";
import type { Theme } from "../hooks/useTheme";

interface Props {
  theme: Theme;
}

/*
 * Particle Lenia — continuous artificial life simulation
 *
 * Proper field-based algorithm (two-pass):
 *   Pass 1 — accumulate scalar field U_i and gradient E_i per particle:
 *     U_i = Σ_{j≠i} K( |p_i − p_j| / R )
 *     E_i = Σ_{j≠i} K( |p_i − p_j| / R ) · (p_j − p_i) / |p_j − p_i|
 *
 *   Pass 2 — motion via growth function applied to the *field*, not per-pair:
 *     g_i  = 2·G(U_i) − 1          (signed growth, −1 … +1)
 *     v_i  = μ·v_i + dt·( g_i · normalize(E_i) + F_rep_i )
 *
 *   Kernel:    K(r) = exp( −(r − μ_K)² / (2·σ_K²) )
 *   Growth:    G(u) = exp( −(u − μ_G)² / (2·σ_G²) )
 *   Repulsion: F_rep = c_rep · max(1 − r/r_rep, 0) · away_direction
 *
 * Reference: bestiariotopologico.blogspot.com/2024/07/que-son-las-particulas-lenia.html
 */

const NUM_PARTICLES = 300;
const DT = 0.18;
const FRICTION = 0.82;
const C_REP = 8.0;
const MAX_DPR = 1.5;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  species: number;
  U: number;
  ex: number;
  ey: number;
  rx: number;
  ry: number;
}

// Three species with parameters tuned for organic self-organization.
// mu_g / sigma_g control the "sweet spot" density each species prefers.
const SPECIES = [
  { R: 90, mu_k: 0.5, sigma_k: 0.15, mu_g: 0.32, sigma_g: 0.06, rRep: 90 * 0.18, color_d: [255, 130, 200] as const, color_l: [180, 30, 120] as const },
  { R: 70, mu_k: 0.45, sigma_k: 0.14, mu_g: 0.28, sigma_g: 0.05, rRep: 70 * 0.18, color_d: [120, 240, 255] as const, color_l: [8, 145, 178] as const },
  { R: 80, mu_k: 0.55, sigma_k: 0.16, mu_g: 0.35, sigma_g: 0.07, rRep: 80 * 0.18, color_d: [210, 150, 255] as const, color_l: [126, 34, 206] as const },
];

// Asymmetric inter-species influence weights w[i][j]
const W = [
  [1.0, 0.5, 0.3],
  [0.3, 1.0, 0.6],
  [0.6, 0.3, 1.0],
];

function kernel(r: number, mu: number, sigma: number): number {
  const d = (r - mu) / sigma;
  return Math.exp(-0.5 * d * d);
}

function growth(u: number, mu: number, sigma: number): number {
  const d = (u - mu) / sigma;
  return Math.exp(-0.5 * d * d);
}

export default function ParticleLenia({ theme }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    // ── Visibility: pause simulation when hero scrolls off-screen ──
    let visible = true;
    const observer = new IntersectionObserver(
      ([e]) => { visible = e.isIntersecting; },
      { threshold: 0 },
    );
    observer.observe(canvas);

    // ── Canvas sizing (capped DPR for background effect) ──
    let w = 0, h = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      w = canvas.clientWidth * dpr;
      h = canvas.clientHeight * dpr;
      canvas.width = w;
      canvas.height = h;
    };
    resize();
    window.addEventListener("resize", resize);

    // ── Seed particles in clusters per species ──
    const ps: Particle[] = [];
    const perSpecies = Math.floor(NUM_PARTICLES / SPECIES.length);
    for (let s = 0; s < SPECIES.length; s++) {
      const cx = w * (0.2 + 0.6 * Math.random());
      const cy = h * (0.2 + 0.6 * Math.random());
      const spread = SPECIES[s].R * 1.2;
      for (let i = 0; i < perSpecies; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * spread;
        ps.push({
          x: cx + Math.cos(a) * r,
          y: cy + Math.sin(a) * r,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          species: s,
          U: 0, ex: 0, ey: 0, rx: 0, ry: 0,
        });
      }
    }
    const n = ps.length;

    // ── Animation loop ──
    let animId = 0;
    const step = () => {
      animId = requestAnimationFrame(step);
      if (!visible || w === 0) return;

      // Reset accumulators
      for (let i = 0; i < n; i++) {
        ps[i].U = 0; ps[i].ex = 0; ps[i].ey = 0;
        ps[i].rx = 0; ps[i].ry = 0;
      }

      // ── Combined field accumulation + repulsion (symmetric, O(n(n-1)/2)) ──
      for (let i = 0; i < n; i++) {
        const pi = ps[i];
        const si = SPECIES[pi.species];
        for (let j = i + 1; j < n; j++) {
          const pj = ps[j];
          let dx = pj.x - pi.x;
          let dy = pj.y - pi.y;
          // Toroidal wrap
          if (dx > w / 2) dx -= w; else if (dx < -w / 2) dx += w;
          if (dy > h / 2) dy -= h; else if (dy < -h / 2) dy += h;

          const dist = Math.sqrt(dx * dx + dy * dy) + 1e-8;
          const sj = SPECIES[pj.species];
          if (dist > Math.max(si.R, sj.R) * 1.6) continue;

          const nx = dx / dist;
          const ny = dy / dist;

          // Field i←j
          const wij = W[pi.species][pj.species];
          const kij = wij * kernel(dist / si.R, si.mu_k, si.sigma_k);
          pi.U += kij; pi.ex += kij * nx; pi.ey += kij * ny;

          // Field j←i (symmetric)
          const wji = W[pj.species][pi.species];
          const kji = wji * kernel(dist / sj.R, sj.mu_k, sj.sigma_k);
          pj.U += kji; pj.ex -= kji * nx; pj.ey -= kji * ny;

          // Repulsion i←j
          if (dist < si.rRep) {
            const rep = C_REP * (1.0 - dist / si.rRep);
            pi.rx -= rep * nx; pi.ry -= rep * ny;
          }
          // Repulsion j←i
          if (dist < sj.rRep) {
            const rep = C_REP * (1.0 - dist / sj.rRep);
            pj.rx += rep * nx; pj.ry += rep * ny;
          }
        }
      }

      // ── Update velocities + positions ──
      for (let i = 0; i < n; i++) {
        const p = ps[i];
        const si = SPECIES[p.species];
        const g = 2.0 * growth(p.U, si.mu_g, si.sigma_g) - 1.0;
        const el = Math.sqrt(p.ex * p.ex + p.ey * p.ey) + 1e-10;
        p.vx = FRICTION * p.vx + DT * (g * p.ex / el + p.rx);
        p.vy = FRICTION * p.vy + DT * (g * p.ey / el + p.ry);
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x += w; else if (p.x > w) p.x -= w;
        if (p.y < 0) p.y += h; else if (p.y > h) p.y -= h;
      }

      // ── Render ──
      const isDark = document.documentElement.getAttribute("data-theme") !== "light";

      // Motion trail
      ctx.fillStyle = isDark ? "rgba(9,9,11,0.12)" : "rgba(250,248,246,0.12)";
      ctx.fillRect(0, 0, w, h);

      for (const p of ps) {
        const sp = SPECIES[p.species];
        const [r, g, b] = isDark ? sp.color_d : sp.color_l;
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        const alpha = isDark
          ? Math.min(0.4 + speed * 0.4, 1.0)
          : Math.min(0.2 + speed * 0.4, 0.9);
        const radius = 1.8 + speed * 0.6;
        const glowR = radius * 5;

        // Outer glow
        const glowCore = isDark ? alpha * 0.7 : alpha * 0.5;
        const glowMid = isDark ? alpha * 0.22 : alpha * 0.12;
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
        grad.addColorStop(0, `rgba(${r},${g},${b},${glowCore})`);
        grad.addColorStop(0.3, `rgba(${r},${g},${b},${glowMid})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(p.x - glowR, p.y - glowR, glowR * 2, glowR * 2);

        // Core dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.fill();
      }
    };

    animId = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      style={{ opacity: theme === "dark" ? 0.85 : 0.4 }}
    />
  );
}
