/**
 * Particle Lenia Loading Animation
 *
 * A simplified Particle Lenia simulation rendered on a small canvas,
 * used as a streaming/loading indicator in the chat UI.
 *
 * Instead of relying on MutationObserver to detect library-internal
 * streaming state, this module is event-driven: the app calls
 * showLeniaBubble() when a prompt is sent and hideLeniaBubble()
 * when the first streaming token arrives.
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

  kernel(dist: number): number {
    const r = dist / this.params.kernelRadius;
    if (r >= 1) return 0;
    const t = 1 - r * r;
    return t * t;
  }

  kernelGrad(dist: number): number {
    const R = this.params.kernelRadius;
    const r = dist / R;
    if (r >= 1 || r < 0.001) return 0;
    return (-4 * r * (1 - r * r)) / R;
  }

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

interface RenderColors {
  primary: [number, number, number];
  accent: [number, number, number];
  glow: [number, number, number];
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

class LeniaRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sim: ParticleLeniaSimulation;
  private dpr: number;
  private colors: RenderColors;
  private trailCanvas: HTMLCanvasElement;
  private trailCtx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement, simWidth: number, simHeight: number) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.colors = getThemeColors();

    canvas.width = simWidth * this.dpr;
    canvas.height = simHeight * this.dpr;
    canvas.style.width = `${simWidth}px`;
    canvas.style.height = `${simHeight}px`;
    this.ctx.scale(this.dpr, this.dpr);

    this.trailCanvas = document.createElement("canvas");
    this.trailCanvas.width = canvas.width;
    this.trailCanvas.height = canvas.height;
    this.trailCtx = this.trailCanvas.getContext("2d")!;
    this.trailCtx.scale(this.dpr, this.dpr);

    this.sim = new ParticleLeniaSimulation(simWidth, simHeight);
  }

  refreshColors() {
    this.colors = getThemeColors();
  }

  frame(time: number) {
    this.sim.step();
    this.render(time);
  }

  private render(time: number) {
    const { ctx, sim, colors } = this;
    const w = sim.width;
    const h = sim.height;

    const tCtx = this.trailCtx;
    tCtx.globalCompositeOperation = "destination-out";
    tCtx.fillStyle = "rgba(0,0,0,0.15)";
    tCtx.fillRect(0, 0, w, h);
    tCtx.globalCompositeOperation = "source-over";

    for (const p of sim.particles) {
      const intensity = (p.g + 1) / 2;
      const shimmer = 0.5 + 0.5 * Math.sin(time * 0.003 + p.phase * 6);

      const t = intensity * 0.7 + shimmer * 0.3;
      const r = Math.round(colors.primary[0] + (colors.accent[0] - colors.primary[0]) * t);
      const g = Math.round(colors.primary[1] + (colors.accent[1] - colors.primary[1]) * t);
      const b = Math.round(colors.primary[2] + (colors.accent[2] - colors.primary[2]) * t);

      const alpha = 0.35 + intensity * 0.55;
      const radius = 2.2 + intensity * 2.5 + shimmer * 0.8;

      const grad = tCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 2.5);
      grad.addColorStop(0, `rgba(${colors.glow[0]},${colors.glow[1]},${colors.glow[2]},${alpha * 0.2})`);
      grad.addColorStop(1, `rgba(${colors.glow[0]},${colors.glow[1]},${colors.glow[2]},0)`);
      tCtx.fillStyle = grad;
      tCtx.beginPath();
      tCtx.arc(p.x, p.y, radius * 2.5, 0, Math.PI * 2);
      tCtx.fill();

      const coreGrad = tCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
      coreGrad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
      coreGrad.addColorStop(0.6, `rgba(${r},${g},${b},${alpha * 0.6})`);
      coreGrad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      tCtx.fillStyle = coreGrad;
      tCtx.beginPath();
      tCtx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      tCtx.fill();
    }

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

// ── Event-driven bubble ─────────────────────────────────────────

const BUBBLE_ID = "lenia-loading-bubble";
const SIM_WIDTH = 120;
const SIM_HEIGHT = 40;

let _renderer: LeniaRenderer | null = null;
let _raf = 0;
let _bubbleEl: HTMLElement | null = null;
let _scrollArea: HTMLElement | null = null;
let _themeObserver: MutationObserver | null = null;
let _shownAt = 0;
let _hideTimer = 0;
let _cleanupTimer = 0;

const MIN_VISIBLE_MS = 120;

/**
 * Show a Lenia loading bubble in the chat area.
 * Call this immediately when the user sends a message.
 *
 * DOM structure of AgentInterface (light DOM):
 *   agent-interface
 *     div.flex.flex-col.h-full
 *       div.flex-1.overflow-y-auto          ← scroll area
 *         div.max-w-3xl.mx-auto.p-4.pb-0   ← Lit-managed content
 *           div.flex.flex-col.gap-3
 *             message-list
 *             streaming-message-container
 *       div.shrink-0                        ← input area
 *
 * We append the bubble to the scroll area (overflow-y-auto) as a
 * sibling of the max-w-3xl div. This is outside Lit's template
 * management so it won't be removed on re-render.
 */
export function showLeniaBubble() {
  if (_bubbleEl && !_bubbleEl.isConnected) {
    _bubbleEl = null;
    _scrollArea = null;
  }

  if (_bubbleEl) {
    _shownAt = nowMs();
    if (_hideTimer) {
      clearTimeout(_hideTimer);
      _hideTimer = 0;
    }
    if (_cleanupTimer) {
      clearTimeout(_cleanupTimer);
      _cleanupTimer = 0;
    }
    _bubbleEl.classList.remove("lenia-bubble-exit");
    return;
  }

  // Find the scroll area inside agent-interface (supports light DOM and shadow DOM)
  const agentInterface = document.querySelector("agent-interface") as HTMLElement | null;
  if (!agentInterface) {
    console.warn("[Lenia] agent-interface not found");
    return;
  }

  const scrollArea =
    findScrollArea(agentInterface) ?? (agentInterface.shadowRoot ? findScrollArea(agentInterface.shadowRoot) : null);
  if (!scrollArea) {
    console.warn("[Lenia] scroll area (.overflow-y-auto/.overflow-y-scroll) not found");
    return;
  }

  // Create the bubble element
  const bubble = document.createElement("div");
  bubble.id = BUBBLE_ID;
  bubble.setAttribute("aria-label", "AI is thinking");
  bubble.setAttribute("role", "status");

  // Create canvas inside
  const canvas = document.createElement("canvas");
  canvas.className = "lenia-loader-canvas";
  canvas.setAttribute("aria-hidden", "true");
  bubble.appendChild(canvas);

  // Append to scroll area — outside Lit's managed template tree
  scrollArea.appendChild(bubble);

  _bubbleEl = bubble;
  _scrollArea = scrollArea as HTMLElement;
  _shownAt = nowMs();

  // Start renderer
  _renderer = new LeniaRenderer(canvas, SIM_WIDTH, SIM_HEIGHT);

  const loop = (time: number) => {
    _renderer?.frame(time);
    _raf = requestAnimationFrame(loop);
  };
  _raf = requestAnimationFrame(loop);

  // Auto-scroll to show the bubble
  requestAnimationFrame(() => {
    scrollArea.scrollTop = scrollArea.scrollHeight;
  });

  // Watch theme changes
  if (!_themeObserver) {
    _themeObserver = new MutationObserver(() => {
      _renderer?.refreshColors();
    });
    _themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
  }
}

function findScrollArea(root: ParentNode): HTMLElement | null {
  const direct = root.querySelector?.(".overflow-y-auto, .overflow-y-scroll") as HTMLElement | null;
  if (direct) return direct;

  const messageList = root.querySelector?.("message-list") as HTMLElement | null;
  if (!messageList) return null;

  return (messageList.closest?.(".overflow-y-auto, .overflow-y-scroll") as HTMLElement | null) ?? null;
}

/**
 * Hide and remove the Lenia loading bubble.
 * Call this when the first streaming token arrives (message_start event).
 */
export function hideLeniaBubble(options?: { force?: boolean }) {
  if (_bubbleEl && !_bubbleEl.isConnected) {
    _bubbleEl = null;
    _scrollArea = null;
  }
  if (!_bubbleEl) return;

  if (options?.force) {
    if (_hideTimer) {
      clearTimeout(_hideTimer);
      _hideTimer = 0;
    }
  } else {
    const elapsed = nowMs() - _shownAt;
    if (elapsed < MIN_VISIBLE_MS) {
      if (_hideTimer) return;
      _hideTimer = window.setTimeout(() => {
        _hideTimer = 0;
        hideLeniaBubble(options);
      }, Math.max(0, Math.ceil(MIN_VISIBLE_MS - elapsed)));
      return;
    }
  }

  if (_hideTimer) {
    clearTimeout(_hideTimer);
    _hideTimer = 0;
  }

  // Fade out
  if (!options?.force) {
    _bubbleEl.classList.add("lenia-bubble-exit");
  }

  const el = _bubbleEl;
  const cleanup = () => {
    cancelAnimationFrame(_raf);
    _raf = 0;
    _renderer?.destroy();
    _renderer = null;
    el.remove();
    if (_bubbleEl === el) {
      _bubbleEl = null;
      _scrollArea = null;
    }
    if (_cleanupTimer) {
      clearTimeout(_cleanupTimer);
      _cleanupTimer = 0;
    }
  };

  // Remove after animation or immediately if reduced motion
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (options?.force || prefersReduced) {
    cleanup();
  } else {
    if (_cleanupTimer) return;
    _cleanupTimer = window.setTimeout(() => {
      _cleanupTimer = 0;
      cleanup();
    }, 200);
  }
}

/** Clean up everything (for HMR / unmount) */
export function destroyLeniaLoader() {
  hideLeniaBubble({ force: true });
  _themeObserver?.disconnect();
  _themeObserver = null;
}

function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}
