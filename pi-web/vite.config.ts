import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Force package export resolution away from development bundles.
    // Lit dev bundle throws on class-field-shadowing in third-party components.
    conditions: ["browser", "module", "import", "default"],
    alias: [
      {
        find: /^@mariozechner\/pi-web-ui\/app\.css$/,
        replacement: path.resolve(__dirname, "src/shims/pi-web-ui-app.css"),
      },
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
