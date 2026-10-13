import { test, expect } from "@playwright/test";
import { guestHome } from "./helpers";

test("approved artwork, loaded fonts, title metadata and responsive UI match the handoff", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const capture = async (screen: string) => {
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      screen,
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`${screen}.png`),
      fullPage: true,
    });
  };
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "내 몸 풀어주기", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(
      () =>
        document.fonts.check('400 16px "LINE Seed KR"', "직꼿") &&
        document.fonts.check('700 16px "LINE Seed KR"', "직꼿") &&
        document.fonts.check("400 16px Nunito", "Jikkot"),
    ),
  ).toBe(true);
  await expect(page).toHaveTitle("직꼿");
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    "직꼿",
  );
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute(
    "content",
    "직꼿",
  );
  await expect(page.locator(".logo")).toHaveAttribute(
    "src",
    "/assets/brand/wordmark-ui.png",
  );
  expect(
    await page
      .locator(".logo")
      .evaluate(
        (image: HTMLImageElement) =>
          Math.abs(
            image.width / image.height -
              image.naturalWidth / image.naturalHeight,
          ) < 0.05,
      ),
  ).toBe(true);
  const cta = await page
    .getByRole("button", { name: "내 몸 풀어주기", exact: true })
    .evaluate((button) => ({
      size: parseFloat(getComputedStyle(button).fontSize),
      weight: Number(getComputedStyle(button).fontWeight),
    }));
  expect(cta.size).toBeGreaterThanOrEqual(18.67);
  expect(cta.weight).toBeGreaterThanOrEqual(700);
  await capture("home");
  await page
    .getByRole("button", { name: "로그인 · 회원가입", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Google로 계속하기", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".google img")).toHaveAttribute(
    "src",
    "/assets/brand/google-g-logo.png",
  );
  await capture("login");
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
  expect(
    await page
      .getByLabel("아이디", { exact: true })
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
  ).toBeGreaterThanOrEqual(16);
  await capture("signup");
  await page.getByRole("button", { name: "인증하기", exact: true }).click();
  await capture("phone-unavailable");
  await guestHome(page);
  await capture("consented-home");
  await page
    .getByRole("button", { name: "내 몸 풀어주기", exact: true })
    .click();
  await capture("posture");
  for (const name of ["앉기", "눕기", "서기", "앉기"]) {
    const card = page.getByRole("button", { name, exact: false });
    await expect(card).toHaveCSS("cursor", "pointer");
    await card.click();
    await expect(card).toHaveAttribute("aria-pressed", "true");
    await expect(card).toHaveCSS("background-color", "rgb(255, 241, 237)");
    await expect(card).toHaveCSS("border-top-color", "rgb(239, 117, 100)");
    await expect(card.locator(".tick")).toHaveCSS("color", "rgb(37, 42, 118)");
    await expect(page.locator('.wide-choice[aria-pressed="true"]')).toHaveCount(1);
  }
  await page.getByRole("button", { name: "앉기", exact: false }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await capture("body");
  await expect(page.locator(".step")).toHaveCount(3);
  const neck = page.getByRole("button", { name: "목", exact: true });
  await expect(neck).toHaveCSS("cursor", "pointer");
  await neck.focus();
  await expect(page.locator(".body-label.neck")).toHaveCSS("opacity", "1");
  await page.keyboard.press("Enter");
  await expect(neck).toHaveAttribute("aria-pressed", "true");
  await neck.dispatchEvent("pointercancel");
  await expect(neck).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press(" ");
  await expect(neck).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "어깨", exact: true }).click();
  await capture("body-selected");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await capture("habits");
  await expect(page.locator("select")).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "양팔을 앞에 둔 채 오래 작업해요",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await capture("recent");
  await page
    .getByRole("button", {
      name: "양팔을 앞에 두고 컴퓨터·노트북 작업을 오래 했어요",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "내 루틴 보기", exact: true }).click();
  await page.getByRole("button", { name: "마쳤어요", exact: true }).waitFor();
  await capture("routine");
  await page
    .getByRole("button", { name: "안내 이미지 확대", exact: true })
    .click();
  await capture("image-zoom");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "마쳤어요", exact: true }).click();
  await capture("feedback");
  await page.getByRole("button", { name: "편해졌어요", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "오늘의 루틴을 마쳤어요." }),
  ).toBeVisible();
  await capture("complete");
  expect(errors).toEqual([]);
});

test("font loading failure is visible instead of being silently hidden by fallback fonts", async ({
  page,
}) => {
  await page.route("**/assets/fonts/LINESeedKR-Rg.woff2", (route) =>
    route.abort(),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "글꼴을 불러오지 못했어요",
  );
});
