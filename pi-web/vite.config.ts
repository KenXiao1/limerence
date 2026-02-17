import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      // pi-ai browser shim (LLM streaming communication)
      {
        find: /^@mariozechner\/pi-ai$/,
        replacement: path.resolve(__dirname, "src/shims/pi-ai-browser.ts"),
      },
      {
        find: /^\.\.\/env-api-keys\.js$/,
        replacement: path.resolve(__dirname, "src/shims/env-api-keys.ts"),
      },
      {
        find: /^@lmstudio\/sdk$/,
        replacement: path.resolve(__dirname, "src/shims/lmstudio-sdk.ts"),
      },
      {
        find: /@mariozechner\/pi-ai\/dist\/env-api-keys\.js$/,
        replacement: path.resolve(__dirname, "src/shims/env-api-keys.ts"),
      },
    ],
  },
});
