import { test, expect } from "@playwright/test";
import { guestHome, choose, memberIdentity, login } from "./helpers";
import { readFileSync } from "node:fs";
const body = JSON.parse(
  readFileSync("lib/personalization/release/body-selection.json", "utf8"),
) as typeof import("../../lib/personalization/release/body-selection.json");
test("body image surfaces select all ten areas at the active camera scale, with keyboard and one result card", async ({
  page,
}, info) => {
  await guestHome(page);
  await page.getByRole("radio", { name: "앉기 의자에 앉아서" }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const r of body.regions) {
    await page
      .getByRole("button", {
        name: r.section === "upper" ? "상체" : "하체",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", {
        name: r.view === "back" ? "뒤쪽 보기" : "앞쪽 보기",
      })
      .click();
    const camera = page.locator(".body-camera");
    await expect(camera).toHaveCSS("transition-duration", "0s");
    const box = await camera.boundingBox();
    expect(box).not.toBeNull();
    const tap = async (x: number, y: number) =>
      info.project.use.hasTouch
        ? page.touchscreen.tap(x, y)
        : page.mouse.click(x, y);
    await tap(
      box!.x + box!.width * r.point[0],
      box!.y + box!.height * r.point[1],
    );
    if (r.polygons.length > 1)
      await tap(
        box!.x + box!.width * (1 - r.point[0]),
        box!.y + box!.height * r.point[1],
      );
    await expect(page.locator(".body-selection-result")).toHaveText(
      "선택한 부위: " + r.label,
    );
    await expect(page.locator(".body-selection-result")).toHaveCount(1);
    await expect(page.locator(".body-chips")).toHaveCount(0);
  }
  await page.getByRole("button", { name: "상체", exact: true }).click();
  await page.getByRole("radio", { name: "목", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(page.locator(".body-selection-result")).toContainText("목");
  await page.screenshot({
    path: info.outputPath("body-direct-selection.png"),
    fullPage: true,
  });
});
test("four screens preserve same-value answers, clear only dependent answers and show a routine preview", async ({
  page,
}, info) => {
  await guestHome(page);
  await page.getByRole("radio", { name: "앉기 의자에 앉아서" }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByRole("radio", { name: "목", exact: true }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(page.locator("[data-view]")).toHaveAttribute(
    "data-view",
    "habits",
  );
  expect(await page.locator(".release-choice").count()).toBeLessThanOrEqual(6);
  await choose(page, "화면을 가까이 봐요");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await choose(page, "고개를 숙이고 오래 있었어요");
  await page.getByRole("button", { name: "이전 단계", exact: true }).click();
  await choose(page, "화면을 가까이 봐요");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "고개를 숙이고 오래 있었어요",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "추천 보기", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "오늘의 추천 루틴" }),
  ).toBeVisible();
  await expect(page.locator(".release-plan li")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "루틴 시작하기", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/전문가|상담|편한 방향/)).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath("four-answers-routine.png"),
    fullPage: true,
  });
});
test("records show real empty summary and direct today entry without additional surveys", async ({
  page,
  request,
}) => {
  const user = await memberIdentity(request);
  await login(page, user);
  await page.getByRole("button", { name: "내 기록", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "최근 몸풀기 요약" }),
  ).toBeVisible();
  await expect(page.getByText("최근 7일 0회 · 0일")).toBeVisible();
  await page.getByRole("button", { name: "오늘 몸풀기", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "지금 어떤 자세로 할 수 있나요?" }),
  ).toBeVisible();
});
