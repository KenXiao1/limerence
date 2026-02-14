/**
 * Resizable divider — reusable drag-to-resize component.
 * Renders a vertical divider that can be dragged to resize an adjacent panel.
 */

import { html } from "lit";

export interface ResizeDividerOptions {
  /** Current width of the panel being resized */
  currentWidth: number;
  /** Minimum allowed width */
  minWidth: number;
  /** Maximum allowed width */
  maxWidth: number;
  /** Whether a drag is currently in progress */
  isDragging: boolean;
  /** Called on each mouse move with the new width */
  onResize: (width: number) => void;
  /** Called when drag ends with the final width */
  onResizeEnd: (width: number) => void;
  /** Called when drag starts */
  onResizeStart?: () => void;
  /**
   * Resize direction: "left" means dragging left increases width
   * (panel is on the right side of the divider).
   */
  direction?: "left" | "right";
}

export function startResize(e: MouseEvent, opts: ResizeDividerOptions) {
  e.preventDefault();
  opts.onResizeStart?.();

  const startX = e.clientX;
  const startWidth = opts.currentWidth;
  const sign = opts.direction === "right" ? 1 : -1;

  const onMove = (ev: MouseEvent) => {
    const delta = (ev.clientX - startX) * sign;
    const next = Math.min(opts.maxWidth, Math.max(opts.minWidth, startWidth + delta));
    opts.onResize(next);
  };

  const onUp = () => {
    opts.onResizeEnd(opts.currentWidth);
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
  };

  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}

export function renderResizeDivider(opts: ResizeDividerOptions) {
  return html`
    <div
      class="limerence-resize-handle ${opts.isDragging ? "is-dragging" : ""}"
      @mousedown=${(e: Event) => startResize(e as MouseEvent, opts)}
    ></div>
  `;
}
