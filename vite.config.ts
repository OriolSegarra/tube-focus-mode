import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import baseManifest from "./manifest.json";

// Production only: the dev server needs localhost for hot reload, which this would block.
// Scripts only from the extension itself, network only to TypeSafe.
const PROD_CSP = "script-src 'self'; object-src 'self'; connect-src 'self' https://api.typesafe.ai";

export default defineConfig(({ command }) => {
  const isBuild = command === "build";
  const manifest = isBuild
    ? { ...baseManifest, content_security_policy: { extension_pages: PROD_CSP } }
    : baseManifest;

  return {
    plugins: [react(), crx({ manifest })],
    resolve: {
      alias: {
        "@": "/src",
      },
    },
    // Debug logs (including every video title) stay out of the shipped build; errors stay in.
    esbuild: isBuild ? { pure: ["console.log", "console.debug"] } : undefined,
    server: {
      port: 5173,
      strictPort: true,
      hmr: {
        port: 5173,
      },
    },
  };
});
