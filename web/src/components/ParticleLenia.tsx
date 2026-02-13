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

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  species: number;
  // Per-frame computed fields
  U: number;
  ex: number;
  ey: number;
}

interface Species {
  R: number;
  mu_k: number;
  sigma_k: number;
  mu_g: number;
  sigma_g: number;
  color_d: [number, number, number];
  color_l: [number, number, number];
}

// Three species with parameters tuned for organic self-organization.
// mu_g / sigma_g control the "sweet spot" density each species prefers.
const SPECIES: Species[] = [
  { R: 90, mu_k: 0.5, sigma_k: 0.15, mu_g: 0.32, sigma_g: 0.06, color_d: [224, 64, 160], color_l: [180, 30, 120] },
  { R: 70, mu_k: 0.45, sigma_k: 0.14, mu_g: 0.28, sigma_g: 0.05, color_d: [34, 211, 238], color_l: [8, 145, 178] },
  { R: 80, mu_k: 0.55, sigma_k: 0.16, mu_g: 0.35, sigma_g: 0.07, color_d: [168, 85, 247], color_l: [126, 34, 206] },
];

// Asymmetric inter-species influence weights w[i][j]
// Species i feels species j with weight w[i][j]
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
  const particlesRef = useRef<Particle[]>([]);
  const animRef = useRef<number>(0);
  const sizeRef = useRef({ w: 0, h: 0 });

  // ── Initialization ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      sizeRef.current = { w: w * dpr, h: h * dpr };
    };

    resize();
    window.addEventListener("resize", resize);

    // Seed particles in small clusters per species
    const particles: Particle[] = [];
    const { w, h } = sizeRef.current;
    const nSpecies = SPECIES.length;
    const perSpecies = Math.floor(NUM_PARTICLES / nSpecies);

    for (let s = 0; s < nSpecies; s++) {
      // Each species starts in a random cluster region
      const cx = w * (0.2 + 0.6 * Math.random());
      const cy = h * (0.2 + 0.6 * Math.random());
      const spread = SPECIES[s].R * 1.2;

      for (let i = 0; i < perSpecies; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * spread;
        particles.push({
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          species: s,
          U: 0,
          ex: 0,
          ey: 0,
        });
      }
    }
    particlesRef.current = particles;

    return () => window.removeEventListener("resize", resize);
  }, []);

  // ── Simulation + Render loop ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const step = () => {
      const ps = particlesRef.current;
      const { w, h } = sizeRef.current;
      if (w === 0) {
        animRef.current = requestAnimationFrame(step);
        return;
      }

      const n = ps.length;

      // ── Pass 1: Accumulate field U_i and gradient E_i ──
      for (let i = 0; i < n; i++) {
        ps[i].U = 0;
        ps[i].ex = 0;
        ps[i].ey = 0;
      }

      for (let i = 0; i < n; i++) {
        const pi = ps[i];
        const si = SPECIES[pi.species];

        for (let j = i + 1; j < n; j++) {
          const pj = ps[j];

          let dx = pj.x - pi.x;
          let dy = pj.y - pi.y;

          // Toroidal wrap
          if (dx > w / 2) dx -= w;
          else if (dx < -w / 2) dx += w;
          if (dy > h / 2) dy -= h;
          else if (dy < -h / 2) dy += h;

          const dist = Math.sqrt(dx * dx + dy * dy) + 1e-8;
          const maxR = Math.max(si.R, SPECIES[pj.species].R);
          if (dist > maxR * 1.6) continue;

          const nx = dx / dist;
          const ny = dy / dist;

          // i ← j influence
          const wij = W[pi.species][pj.species];
          const kij = wij * kernel(dist / si.R, si.mu_k, si.sigma_k);
          pi.U += kij;
          pi.ex += kij * nx;
          pi.ey += kij * ny;

          // j ← i influence
          const sj = SPECIES[pj.species];
          const wji = W[pj.species][pi.species];
          const kji = wji * kernel(dist / sj.R, sj.mu_k, sj.sigma_k);
          pj.U += kji;
          pj.ex -= kji * nx;
          pj.ey -= kji * ny;
        }
      }

      // ── Pass 2: Compute forces and update velocities ──
      for (let i = 0; i < n; i++) {
        const pi = ps[i];
        const si = SPECIES[pi.species];

        // Signed growth: +1 = attract toward neighbors, −1 = repel
        const g = 2.0 * growth(pi.U, si.mu_g, si.sigma_g) - 1.0;

        // Normalize gradient direction
        const elen = Math.sqrt(pi.ex * pi.ex + pi.ey * pi.ey) + 1e-10;
        const enx = pi.ex / elen;
        const eny = pi.ey / elen;

        // Short-range repulsion (separate pass for clarity)
        let rx = 0, ry = 0;
        const rRep = si.R * 0.18;
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          let dx = ps[j].x - pi.x;
          let dy = ps[j].y - pi.y;
          if (dx > w / 2) dx -= w;
          else if (dx < -w / 2) dx += w;
          if (dy > h / 2) dy -= h;
          else if (dy < -h / 2) dy += h;
          const dist = Math.sqrt(dx * dx + dy * dy) + 1e-8;
          if (dist < rRep) {
            const rep = C_REP * (1.0 - dist / rRep);
            rx -= rep * dx / dist;
            ry -= rep * dy / dist;
          }
        }

        pi.vx = FRICTION * pi.vx + DT * (g * enx + rx);
        pi.vy = FRICTION * pi.vy + DT * (g * eny + ry);
      }

      // ── Update positions (toroidal) ──
      for (const p of ps) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x += w;
        else if (p.x > w) p.x -= w;
        if (p.y < 0) p.y += h;
        else if (p.y > h) p.y -= h;
      }

      // ── Render ──
      const isDark = document.documentElement.getAttribute("data-theme") !== "light";

      // Motion trail: semi-transparent clear
      ctx.fillStyle = isDark
        ? "rgba(9, 9, 11, 0.12)"
        : "rgba(250, 248, 246, 0.12)";
      ctx.fillRect(0, 0, w, h);

      for (const p of ps) {
        const sp = SPECIES[p.species];
        const [r, g, b] = isDark ? sp.color_d : sp.color_l;
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        const alpha = Math.min(0.2 + speed * 0.4, 0.9);
        const radius = 1.8 + speed * 0.6;

        // Outer glow
        const glowR = radius * 5;
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
        grad.addColorStop(0, `rgba(${r},${g},${b},${alpha * 0.5})`);
        grad.addColorStop(0.3, `rgba(${r},${g},${b},${alpha * 0.12})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(p.x - glowR, p.y - glowR, glowR * 2, glowR * 2);

        // Core dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(step);
    };

    animRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      style={{ opacity: theme === "dark" ? 0.6 : 0.4 }}
    />
  );
}
