import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

after(async () => {
  await vite.close();
});

async function readCssTree(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return readCssTree(entryPath);
      }
      return entry.name.endsWith(".css") ? readFile(entryPath, "utf8") : "";
    }),
  );
  return contents.join("\n");
}

test("emits the catalog's animation and scrolling utilities", async () => {
  const css = await readCssTree(path.join(root, "dist"));

  assert.match(css, /--tw-enter-opacity/);
  assert.match(css, /scrollbar-width:\s*thin/);
  assert.match(css, /scrollbar-width:\s*none/);
  assert.match(css, /scrollbar-gutter:\s*stable/);
  assert.match(css, /scroll-fade-reveal-b/);
  assert.match(css, /mask-image:/);
  assert.match(css, /tw-shimmer/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test("forwards progress semantics to the primitive", async () => {
  const { Progress } = await vite.ssrLoadModule("/components/ui/progress.tsx");
  const html = renderToStaticMarkup(React.createElement(Progress, { value: 37 }));

  assert.match(html, /aria-valuenow="37"/);
  assert.match(html, /aria-valuetext="37%"/);
  assert.match(html, /data-state="loading"/);
});

test("emits chart themes for the starter's media dark mode", async () => {
  const { ChartStyle } = await vite.ssrLoadModule("/components/ui/chart.tsx");
  const html = renderToStaticMarkup(
    React.createElement(ChartStyle, {
      id: "contract",
      config: {
        latency: { theme: { light: "#ffffff", dark: "#000000" } },
      },
    }),
  );

  assert.match(html, /\[data-chart=contract\]/);
  assert.match(html, /@media \(prefers-color-scheme: dark\)/);
  assert.doesNotMatch(html, /\.dark/);
});

test("renders sidebar skeletons deterministically", async () => {
  const { SidebarMenuSkeleton } = await vite.ssrLoadModule(
    "/components/ui/sidebar.tsx",
  );
  const first = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));
  const second = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));

  assert.equal(first, second);
  assert.match(first, /--skeleton-width:70%/);
});

test("keeps recent actions and habits short and specific to each area", async () => {
  const {
    areas,
    habits,
    habitIdsByArea,
    recentActions,
    recentActionIdsByArea,
  } = await vite.ssrLoadModule("/app/jikkot-data.ts");

  for (const { id: area } of areas) {
    const recentIds = recentActionIdsByArea[area];
    const habitIds = habitIdsByArea[area];

    assert.equal(recentIds.length, 6, `${area} recent action count`);
    assert.equal(habitIds.length, 5, `${area} habit count`);
    assert.equal(recentIds.at(-1), "RA99");
    assert.equal(habitIds.at(-1), "HB99");
    assert.equal(new Set(recentIds).size, recentIds.length);
    assert.equal(new Set(habitIds).size, habitIds.length);

    for (const id of recentIds) {
      const item = recentActions.find((candidate) => candidate.id === id);
      assert.ok(item, `${id} exists`);
      assert.ok(item.areas.includes(area), `${id} belongs to ${area}`);
    }
    for (const id of habitIds) {
      const item = habits.find((candidate) => candidate.id === id);
      assert.ok(item, `${id} exists`);
      assert.ok(item.areas.includes(area), `${id} belongs to ${area}`);
    }
  }
});

test("keeps Korean copy intact and uses the VER9.1 pastel palette", async () => {
  const [globals, app, packageJson] = await Promise.all([
    readFile(path.join(root, "app/globals.css"), "utf8"),
    readFile(path.join(root, "app/jikkot-app.tsx"), "utf8"),
    readFile(path.join(root, "package.json"), "utf8"),
  ]);

  assert.match(globals, /word-break:\s*keep-all/);
  assert.match(globals, /text-wrap:\s*pretty/);
  assert.match(globals, /#ecebff/);
  assert.match(globals, /#ffb9a8/);
  assert.match(app, /VER9\.1 PROTOTYPE/);
  assert.equal(JSON.parse(packageJson).version, "9.1.0");

  const legacyGreen = /#(?:123b32|0d2a24|286a58|1a5043|edf5f1|dcebe5)/i;
  assert.doesNotMatch(globals, legacyGreen);
  assert.doesNotMatch(app, legacyGreen);
});
