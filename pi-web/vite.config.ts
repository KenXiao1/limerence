import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

function getNodeModulePackageName(id: string): string | null {
  const normalizedId = id.replace(/\\/g, "/");
  const marker = "/node_modules/";
  const markerIndex = normalizedId.lastIndexOf(marker);
  if (markerIndex === -1) return null;

  const modulePath = normalizedId.slice(markerIndex + marker.length);
  const parts = modulePath.split("/");
  if (parts.length === 0) return null;

  if (parts[0].startsWith("@")) {
    if (parts.length < 2) return null;
    return `${parts[0]}/${parts[1]}`;
  }

  return parts[0];
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      {
        find: /^@lmstudio\/sdk$/,
        replacement: path.resolve(__dirname, "src/shims/lmstudio-sdk.ts"),
      },
    ],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const packageName = getNodeModulePackageName(id);
          if (!packageName) return;

          if (packageName === "react" || packageName === "react-dom" || packageName === "scheduler") {
            return "vendor-react";
          }

          if (packageName.startsWith("@assistant-ui/")) {
            return "vendor-assistant-ui";
          }

          if (packageName.startsWith("@supabase/")) {
            return "vendor-supabase";
          }

          if (packageName === "ai" || packageName.startsWith("@ai-sdk/")) {
            return "vendor-ai-sdk";
          }

          if (packageName === "sql.js") {
            return "vendor-sqljs";
          }

          if (packageName === "js-tiktoken") {
            return "vendor-tiktoken";
          }

          if (packageName === "lucide-react") {
            return "vendor-icons";
          }

          return "vendor-misc";
        },
      },
    },
  },
});
