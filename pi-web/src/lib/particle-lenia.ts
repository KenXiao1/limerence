/**
 * Particle Lenia Loading Animation
 *
 * A simplified Particle Lenia simulation rendered on a small canvas,
 * used as a streaming/loading indicator in the chat UI.
 *
 * Particle Lenia is a continuous cellular automaton where particles
 * interact through kernel functions, creating organic, life-like
 * emergent behaviors — amoeba-like clustering, breathing, flowing.
 *
 * References:
 *   Bert Chan, "Lenia and Expanded Universe", ALIFE 2020
 *   https://google-research.github.io/self-organising-systems/particle-lenia/
 */

// ── Simulation ──────────────────────────────────────────────────

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Current growth value ∈ [-1, 1], affects visual intensity */
  g: number;
  /** Phase offset for per-particle color shimmer */
  phase: number;
}

/** Tunable parameters for the Lenia simulation */
interface LeniaParams {
  /** Number of particles */
  count: number;
  /** Interaction kernel radius (pixels in sim space) */
  kernelRadius: number;
  /** Target density for growth peak */
  mu: number;
  /** Width of growth bell curve */
  sigma: number;
  /** Integration time step */
  dt: number;
  /** Velocity damping per step */
  damping: number;
  /** Force multiplier */
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

  /** Initialize particles in a loose cluster near center */
  seed() {
    this.particles = [];
    const cx = this.width / 2;
    const cy = this.height / 2;
    const spread = Math.min(this.width, this.height) * 0.35;

    for (let i = 0; i < this.params.count; i++) {
      // Gaussian-ish distribution around center
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

  /**
   * Polynomial bump kernel with compact support.
   * K(r) = (1 - r²)² for r ∈ [0, 1), 0 otherwise.
   * Smooth, cheap to compute, no exp().
   */
  kernel(dist: number): number {
    const r = dist / this.params.kernelRadius;
    if (r >= 1) return 0;
    const t = 1 - r * r;
    return t * t;
  }

  /**
   * Derivative of kernel w.r.t. distance.
   * dK/d(dist) = dK/dr * dr/d(dist) = -4r(1-r²) / kernelRadius
   */
  kernelGrad(dist: number): number {
    const R = this.params.kernelRadius;
    const r = dist / R;
    if (r >= 1 || r < 0.001) return 0;
    return (-4 * r * (1 - r * r)) / R;
  }

  /** Lenia growth function: bell curve centered at μ with width σ */
  growth(density: number): number {
    const d = (density - this.params.mu) / this.params.sigma;
    return 2 * Math.exp(-0.5 * d * d) - 1;
  }

  step() {
    const { particles, params, width, height } = this;
    const n = particles.length;
    const dt = params.dt;
    const damp = params.damping;
    const fScale = params.forceScale;

    // Breathing modulation: slowly vary target density
    this.time += dt * 0.02;
    const breathe = 1 + 0.12 * Math.sin(this.time * 1.7) + 0.06 * Math.sin(this.time * 2.9);

    // Compute forces
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

        // Gradient of kernel field (direction toward higher density)
        const dk = this.kernelGrad(dist);
        gx += dk * (dx / dist);
        gy += dk * (dy / dist);
      }

      // Apply breathing modulation to density
      const g = this.growth(density * breathe);
      pi.g = g;

      // Force = growth * gradient (move toward favorable density)
      fx[i] = g * gx * fScale;
      fy[i] = g * gy * fScale;

      // Gentle centering force to prevent drift
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

    // Integrate
    for (let i = 0; i < n; i++) {
      const p = particles[i];
      p.vx = (p.vx + fx[i] * dt) * damp;
      p.vy = (p.vy + fy[i] * dt) * damp;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Soft boundary reflection
      const margin = 3;
      if (p.x < margin) { p.x = margin; p.vx = Math.abs(p.vx) * 0.5; }
      if (p.x > width - margin) { p.x = width - margin; p.vx = -Math.abs(p.vx) * 0.5; }
      if (p.y < margin) { p.y = margin; p.vy = Math.abs(p.vy) * 0.5; }
      if (p.y > height - margin) { p.y = height - margin; p.vy = -Math.abs(p.vy) * 0.5; }
    }
  }
}

// ── Renderer ────────────────────────────────────────────────────

interface RenderColors {
  /** Primary particle color [r, g, b] 0-255 */
  primary: [number, number, number];
  /** Accent color for high-growth particles */
  accent: [number, number, number];
  /** Glow color for the soft halo */
  glow: [number, number, number];
}

function getThemeColors(): RenderColors {
  const isDark = document.documentElement.classList.contains("dark");
  if (isDark) {
    return {
      primary: [180, 220, 190],   // soft sage
      accent: [130, 210, 100],    // limerence green
      glow: [100, 180, 80],       // deep green glow
    };
  }
  return {
    primary: [60, 100, 60],       // muted forest
    accent: [80, 150, 60],        // fresh green
    glow: [90, 160, 70],          // warm green glow
  };
}

class LeniaRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sim: ParticleLeniaSimulation;
  private dpr: number;
  private colors: RenderColors;
  /** Offscreen buffer for trail/glow compositing */
  private trailCanvas: HTMLCanvasElement;
  private trailCtx: CanvasRenderingContext2D;

  constructor(
    canvas: HTMLCanvasElement,
    simWidth: number,
    simHeight: number,
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.colors = getThemeColors();

    // Set canvas resolution
    canvas.width = simWidth * this.dpr;
    canvas.height = simHeight * this.dpr;
    canvas.style.width = `${simWidth}px`;
    canvas.style.height = `${simHeight}px`;
    this.ctx.scale(this.dpr, this.dpr);

    // Trail buffer
    this.trailCanvas = document.createElement("canvas");
    this.trailCanvas.width = canvas.width;
    this.trailCanvas.height = canvas.height;
    this.trailCtx = this.trailCanvas.getContext("2d")!;
    this.trailCtx.scale(this.dpr, this.dpr);

    this.sim = new ParticleLeniaSimulation(simWidth, simHeight);
  }

  /** Refresh colors on theme change */
  refreshColors() {
    this.colors = getThemeColors();
  }

  /** Run one simulation step and render */
  frame(time: number) {
    this.sim.step();
    this.render(time);
  }

  private render(time: number) {
    const { ctx, sim, colors } = this;
    const w = sim.width;
    const h = sim.height;

    // Fade trail buffer for ghosting effect
    const tCtx = this.trailCtx;
    tCtx.globalCompositeOperation = "destination-out";
    tCtx.fillStyle = "rgba(0,0,0,0.15)";
    tCtx.fillRect(0, 0, w, h);
    tCtx.globalCompositeOperation = "source-over";

    // Draw particles onto trail buffer
    for (const p of sim.particles) {
      const intensity = (p.g + 1) / 2; // map [-1,1] → [0,1]
      const shimmer = 0.5 + 0.5 * Math.sin(time * 0.003 + p.phase * 6);

      // Lerp between primary and accent based on growth
      const t = intensity * 0.7 + shimmer * 0.3;
      const r = Math.round(colors.primary[0] + (colors.accent[0] - colors.primary[0]) * t);
      const g = Math.round(colors.primary[1] + (colors.accent[1] - colors.primary[1]) * t);
      const b = Math.round(colors.primary[2] + (colors.accent[2] - colors.primary[2]) * t);

      const alpha = 0.35 + intensity * 0.55;
      const radius = 2.2 + intensity * 2.5 + shimmer * 0.8;

      // Soft glow halo
      const grad = tCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 2.5);
      grad.addColorStop(0, `rgba(${colors.glow[0]},${colors.glow[1]},${colors.glow[2]},${alpha * 0.2})`);
      grad.addColorStop(1, `rgba(${colors.glow[0]},${colors.glow[1]},${colors.glow[2]},0)`);
      tCtx.fillStyle = grad;
      tCtx.beginPath();
      tCtx.arc(p.x, p.y, radius * 2.5, 0, Math.PI * 2);
      tCtx.fill();

      // Core particle
      const coreGrad = tCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
      coreGrad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
      coreGrad.addColorStop(0.6, `rgba(${r},${g},${b},${alpha * 0.6})`);
      coreGrad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      tCtx.fillStyle = coreGrad;
      tCtx.beginPath();
      tCtx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      tCtx.fill();
    }

    // Draw connection lines between close particles (membrane effect)
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
          tCtx.strokeStyle = `rgba(${colors.glow[0]},${colors.glow[1]},${colors.glow[2]},${lineAlpha})`;
          tCtx.lineWidth = 0.6;
          tCtx.beginPath();
          tCtx.moveTo(pi.x, pi.y);
          tCtx.lineTo(pj.x, pj.y);
          tCtx.stroke();
        }
      }
    }

    // Composite trail onto main canvas
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(
      this.trailCanvas,
      0, 0, this.trailCanvas.width, this.trailCanvas.height,
      0, 0, w, h,
    );
  }

  destroy() {
    this.trailCanvas.width = 0;
    this.trailCanvas.height = 0;
  }
}

// ── DOM Integration ─────────────────────────────────────────────

const CANVAS_CLASS = "lenia-loader-canvas";
const SIM_WIDTH = 110;
const SIM_HEIGHT = 36;

/** Active loader instances keyed by the streaming container element */
const activeLoaders = new Map<Element, { renderer: LeniaRenderer; raf: number }>();

function attachLoader(container: Element) {
  if (activeLoaders.has(container)) return;

  // Find the dot indicator span
  const dotSpan = container.querySelector(
    ":scope > div > span.animate-pulse, :scope > div > span.bg-muted-foreground",
  );
  const parentDiv = dotSpan?.parentElement ?? container.querySelector(":scope > div");
  if (!parentDiv) return;

  // Create canvas
  const canvas = document.createElement("canvas");
  canvas.className = CANVAS_CLASS;
  canvas.setAttribute("aria-hidden", "true");
  canvas.setAttribute("role", "presentation");

  // Insert canvas
  if (dotSpan) {
    dotSpan.insertAdjacentElement("afterend", canvas);
  } else {
    parentDiv.appendChild(canvas);
  }

  const renderer = new LeniaRenderer(canvas, SIM_WIDTH, SIM_HEIGHT);

  let raf = 0;
  const loop = (time: number) => {
    renderer.frame(time);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  activeLoaders.set(container, { renderer, raf });
}

function detachLoader(container: Element) {
  const entry = activeLoaders.get(container);
  if (!entry) return;

  cancelAnimationFrame(entry.raf);
  entry.renderer.destroy();
  activeLoaders.delete(container);

  // Remove canvas
  const canvas = container.querySelector(`.${CANVAS_CLASS}`);
  canvas?.remove();
}

/** Clean up all active loaders */
function detachAll() {
  for (const [container] of activeLoaders) {
    detachLoader(container);
  }
}

// ── Public API ──────────────────────────────────────────────────

let observer: MutationObserver | null = null;

/**
 * Initialize the Particle Lenia loader system.
 * Call once at app startup. Uses MutationObserver to automatically
 * detect streaming-message-container elements and attach/detach
 * the animation.
 */
export function initLeniaLoader() {
  if (observer) return;

  // Attach to any already-present containers
  document.querySelectorAll("streaming-message-container").forEach(attachLoader);

  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // Check added nodes
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.tagName === "STREAMING-MESSAGE-CONTAINER") {
          // Small delay to let the inner DOM render
          requestAnimationFrame(() => attachLoader(node));
        }
        // Also check descendants
        node.querySelectorAll?.("streaming-message-container").forEach((el) => {
          requestAnimationFrame(() => attachLoader(el));
        });
      }

      // Check removed nodes
      for (const node of mutation.removedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.tagName === "STREAMING-MESSAGE-CONTAINER") {
          detachLoader(node);
        }
        node.querySelectorAll?.("streaming-message-container").forEach(detachLoader);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Listen for theme changes to refresh colors
  const themeObserver = new MutationObserver(() => {
    for (const [, entry] of activeLoaders) {
      entry.renderer.refreshColors();
    }
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-theme"],
  });
}

/** Tear down the loader system (for cleanup/HMR) */
export function destroyLeniaLoader() {
  detachAll();
  observer?.disconnect();
  observer = null;
}
