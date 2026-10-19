import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  use: {
    launchOptions: { executablePath: process.env.CHROMIUM_PATH },
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile-320",
      use: { viewport: { width: 320, height: 568 }, hasTouch: true },
    },
    {
      name: "mobile-390",
      use: { viewport: { width: 390, height: 844 }, hasTouch: true },
    },
    { name: "tablet-768", use: { viewport: { width: 768, height: 1024 } } },
    {
      name: "mobile-430",
      use: { viewport: { width: 430, height: 932 }, hasTouch: true },
    },
    { name: "desktop-1440", use: { viewport: { width: 1440, height: 900 } } },
  ],
});
