import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
});
try {
  for (const width of [360, 390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } }),
      errors = [],
      authRequests = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (
        /identitytoolkit|securetoken|cloudfunctions|:5001|:9099/.test(r.url())
      )
        authRequests.push(r.url());
    });
    await page.goto("http://127.0.0.1:8788");
    await page
      .getByRole("heading", { name: "잠깐 움직이는 시간을 준비하고 있어요" })
      .waitFor();
    assert.equal(await page.getByRole("button").count(), 0);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.reload();
    await page
      .getByRole("heading", { name: "잠깐 움직이는 시간을 준비하고 있어요" })
      .waitFor();
    assert.deepEqual(errors, []);
    assert.deepEqual(authRequests, []);
    if (width === 360)
      await page.screenshot({
        path: "/tmp/jikkot-preparation-360.png",
        fullPage: true,
      });
    console.log(
      `PASS: ${width}px preparation page, reload, no overflow, no auth/API requests or fake service controls`,
    );
    await page.close();
  }
} finally {
  await browser.close();
}
