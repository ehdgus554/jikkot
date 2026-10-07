import vinext from "vinext";
import { defineConfig } from "vite";
import { firebaseBuildEnv } from "./scripts/firebase-build-env";

export default defineConfig(async ({ mode }) => {
  const localWorker = process.env.JIKKOT_LOCAL_WORKER === "true";
  const publicEnv = firebaseBuildEnv(mode);
  const preparation = process.env.JIKKOT_PREPARATION === "true";
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    define: {
      ...Object.fromEntries(
        Object.entries(publicEnv).map(([key, value]) => [
          `import.meta.env.${key}`,
          JSON.stringify(value),
        ]),
      ),
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
