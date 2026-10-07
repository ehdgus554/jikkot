import vinext from "vinext";
import { defineConfig, loadEnv } from "vite";
import { publicFirebaseKeys } from "./lib/service/deployment";

export default defineConfig(async ({ mode }) => {
  const localWorker = process.env.JIKKOT_LOCAL_WORKER === "true";
  const publicEnv = loadEnv(mode, process.cwd(), "VITE_");
  const preparation =
    process.env.JIKKOT_PREPARATION === "true" ||
    (mode === "production" &&
      !localWorker &&
      publicFirebaseKeys.every((key) => !publicEnv[key]?.trim()) &&
      publicEnv.VITE_USE_FIREBASE_EMULATORS !== "true");
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    define: {
      __JIKKOT_LOCAL_WORKER__: JSON.stringify(localWorker),
      __JIKKOT_PREPARATION__: JSON.stringify(preparation),
    },
    server: {
      host: "0.0.0.0",
    },
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
      }),
    ],
  };
});
