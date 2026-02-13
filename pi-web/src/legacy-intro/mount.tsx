import { createRoot, type Root } from "react-dom/client";
import Landing from "./pages/Landing";
import "./index.css";

let root: Root | null = null;
let rootContainer: HTMLElement | null = null;

export function mountLegacyIntro(container: HTMLElement, onStartChat: () => void) {
  if (!root || rootContainer !== container) {
    if (root) {
      root.unmount();
    }
    root = createRoot(container);
    rootContainer = container;
  }

  root.render(<Landing onStartChat={onStartChat} />);
}

export function unmountLegacyIntro() {
  if (root) {
    root.unmount();
    root = null;
    rootContainer = null;
  }
}
