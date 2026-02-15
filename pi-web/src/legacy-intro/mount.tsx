import { createRoot, type Root } from "react-dom/client";
import Landing from "./pages/Landing";
import "./index.css";

let root: Root | null = null;
let rootContainer: HTMLElement | null = null;

export interface LegacyIntroOptions {
  onStartChat: () => void;
  startingChat?: boolean;
  onLogin?: () => void;
  authEmail?: string | null;
  onLogout?: () => void;
}

export function mountLegacyIntro(container: HTMLElement, onStartChat: () => void, options?: Omit<LegacyIntroOptions, "onStartChat">) {
  if (!root || rootContainer !== container) {
    if (root) {
      root.unmount();
    }
    root = createRoot(container);
    rootContainer = container;
  }

  root.render(
    <Landing
      onStartChat={onStartChat}
      startingChat={options?.startingChat}
      onLogin={options?.onLogin}
      authEmail={options?.authEmail}
      onLogout={options?.onLogout}
    />,
  );
}

export function unmountLegacyIntro() {
  if (root) {
    root.unmount();
    root = null;
    rootContainer = null;
  }
}
