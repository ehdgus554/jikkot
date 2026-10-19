import { test, expect } from "@playwright/test";
import { guestHome, daily } from "./helpers";
test("three illustrated posture cards, continuous 450ms body camera, accessible chips and reduced motion work across sizes", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await guestHome(page);
  await expect(page.getByRole("radio")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "다음", exact: true }),
  ).toBeDisabled();
  await page.getByRole("radio", { name: "앉기 의자에 앉아서" }).focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "어디가 불편하세요?" }),
  ).toHaveCSS("font-size", "20px");
  const camera = page.locator(".body-camera");
  const upperTop = await camera.evaluate((e) => e.getBoundingClientRect().top);
  await page.getByRole("button", { name: "하체", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "허벅지 뒤쪽", exact: true }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "허벅지 뒤쪽", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "허벅지 뒤쪽", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await expect
    .poll(() => camera.evaluate((e) => e.getBoundingClientRect().top))
    .toBeLessThan(upperTop - 100);
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: "상체", exact: true }).click();
    await page.getByRole("button", { name: "하체", exact: true }).click();
  }
  expect(await page.locator(".body-camera").count()).toBe(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(camera).toHaveCSS("transition-duration", "0s");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("release-body.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("one home entry, real policy/contact, 200 percent text and four-tab footer do not overflow", async ({
  page,
}, info) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "불편한 곳 풀기", exact: true })
    .waitFor();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".release-nav button")).toHaveCount(4);
  expect(
    await page
      .locator(".release-home img")
      .evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0),
  ).toBe(true);
  await page.evaluate(() => {
    for (const e of document.querySelectorAll<HTMLElement>(
      "h1,p,button,label,small",
    ))
      e.style.fontSize = parseFloat(getComputedStyle(e).fontSize) * 2 + "px";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("release-home-200-text.png"),
    fullPage: true,
  });
  await page.reload();
  await page.getByRole("button", { name: "마이", exact: true }).click();
  await page
    .getByRole("button", { name: "이용 안내와 개인정보", exact: true })
    .click();
  await expect(
    page.getByText("운영자: 김동현.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "ehdgus554@gmail.com", exact: true }),
  ).toHaveAttribute("href", "mailto:ehdgus554@gmail.com");
  await expect(
    page.getByText("local-emulator", { exact: false }),
  ).toBeVisible();
});
test("midnight expires the active guest screen and clears stored progress", async ({
  page,
}) => {
  await page.clock.install();
  await guestHome(page);
  await daily(page);
  await page.clock.fastForward(86400001);
  await expect(page.getByRole("status")).toContainText("한국 시간 자정");
  await expect(
    page.getByRole("button", { name: "불편한 곳 풀기", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).every(
        (key) => !key.startsWith("jikkot.release."),
      ),
    ),
  ).toBe(true);
});
