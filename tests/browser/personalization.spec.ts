import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { readFileSync } from "node:fs";
const manifest = JSON.parse(
  readFileSync("lib/personalization/media-manifest.json", "utf8"),
) as { catalogId: string; path: string; sha256: string }[];
const uid = "jikkot-local-reviewer";
async function resetReview(request: APIRequestContext) {
  for (const path of [
    `reviewMemory/${uid}`,
    `reviewGrowth/${uid}`,
    `personalPreferences/${uid}`,
    `reviewPreferences/${uid}`,
  ]) {
    const r = await request.delete(
      `http://127.0.0.1:8080/v1/projects/demo-jikkot/databases/(default)/documents/${path}`,
      { headers: { Authorization: "Bearer owner" } },
    );
    expect([200, 404]).toContain(r.status());
  }
}
async function choose(page: Page, label: string) {
  const button = page
    .locator(".personal-experience")
    .getByRole("button", { name: label, exact: true })
    .last();
  if ((await button.getAttribute("aria-pressed")) !== "true")
    await button.click();
}
async function reviewer(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "로그인 · 회원가입", exact: true })
    .click();
  await page
    .getByLabel("이메일", { exact: true })
    .fill("reviewer@example.test");
  await page.getByLabel("비밀번호", { exact: true }).fill("LocalReview123!");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page
    .getByRole("button", { name: "콘텐츠 검토", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "내 이용 설정", exact: true }).click();
  await choose(page, "검토 전용 초안 모드");
  await page.getByRole("button", { name: "홈", exact: true }).click();
}
async function daily(page: Page) {
  await page
    .getByRole("button", { name: "불편한 곳 풀기", exact: true })
    .click();
  await choose(page, "의자에 앉기");
  await choose(page, "안정된 의자");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await choose(page, "등");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await choose(page, "날개뼈를 뒤로 모은 채 오래 버텨요");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await choose(page, "오늘 윗등이 굳거나 긴장된 느낌이에요");
  await choose(page, "최근 가볍게 앞으로 뻗었을 때 편했어요");
  await page.getByRole("button", { name: "내 동작 보기", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "팔 꼬아 앞으로 밀며 고개 숙이기",
      exact: true,
    }),
  ).toBeVisible();
}
test.beforeEach(async ({ request }) => resetReview(request));
test("review is real member-authorized, shows all 74 lazy assets, and guests cannot request draft content", async ({
  page,
  request,
}) => {
  const guest = await request.post(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key",
    { data: { returnSecureToken: true } },
  );
  const token = (await guest.json()).idToken;
  expect(
    (
      await request.get("http://127.0.0.1:5002/api/review/catalog", {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).status(),
  ).toBe(403);
  const images: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/assets/jikkot74/")) images.push(r.url());
  });
  await reviewer(page);
  expect(images.length).toBe(0);
  await page.getByRole("button", { name: "콘텐츠 검토", exact: true }).click();
  await expect(page.getByText("총 74개 등록", { exact: false })).toBeVisible();
  await page.getByLabel("콘텐츠 찾기").fill("D31");
  await page.locator(".review-catalog summary").click();
  await expect(
    page.getByText("의자·바닥 지지 미확정: 자동 배정 제외", { exact: true }),
  ).toBeVisible();
});
test("ten-region draft questionnaire preserves back navigation, original media and stage-specific adverse memory", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await reviewer(page);
  await daily(page);
  const image = page.locator(".personal-media");
  await expect(image).toHaveAttribute(
    "src",
    manifest.find((x) => x.catalogId === "O02")!.path,
  );
  expect(
    await image.evaluate(
      (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
    ),
  ).toBe(true);
  await expect(page.locator(".personal-experience")).not.toContainText("P03");
  await expect(page.locator(".personal-experience")).not.toContainText("O02");
  await page.getByRole("button", { name: "마쳤어요", exact: true }).click();
  await choose(page, "불편했어요");
  await expect(
    page.getByRole("group", { name: "어느 과정에서 불편했나요?" }),
  ).toBeVisible();
  await choose(page, "팔을 교차해 손을 잡고 앞으로 길게 뻗어요.");
  await page
    .getByRole("button", { name: "느낌 저장하기", exact: true })
    .click();
  await page
    .getByRole("button", { name: "조건에 맞는 다른 동작 확인", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "추가로 안내할 동작이 없어요" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "내부 추천 근거 확인", exact: true })
    .click();
  await expect(page.locator(".review-json")).toContainText("adverse-history");
  await expect(page.locator(".review-json")).toContainText("D24");
  expect(errors).toEqual([]);
});
test("lost creation and feedback responses restore the same server session without duplicate submissions", async ({
  page,
}) => {
  await reviewer(page);
  let lost = false;
  await page.route("**/api/personalization/sessions", async (route) => {
    if (route.request().method() === "POST" && !lost) {
      lost = true;
      await route.fetch();
      await route.abort();
    } else await route.continue();
  });
  await page
    .getByRole("button", { name: "불편한 곳 풀기", exact: true })
    .click();
  await choose(page, "의자에 앉기");
  await choose(page, "안정된 의자");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await choose(page, "등");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await choose(page, "날개뼈를 뒤로 모은 채 오래 버텨요");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await choose(page, "오늘 윗등이 굳거나 긴장된 느낌이에요");
  await choose(page, "최근 가볍게 앞으로 뻗었을 때 편했어요");
  await page.getByRole("button", { name: "내 동작 보기", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "팔 꼬아 앞으로 밀며 고개 숙이기",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "마쳤어요", exact: true }).click();
  await choose(page, "편해졌어요");
  let feedbackLost = false;
  await page.route(
    "**/api/personalization/sessions/*/events",
    async (route) => {
      if (
        route.request().postDataJSON()?.action === "feedback" &&
        !feedbackLost
      ) {
        feedbackLost = true;
        await route.fetch();
        await route.abort();
      } else await route.continue();
    },
  );
  await page
    .getByRole("button", { name: "느낌 저장하기", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page
    .getByRole("button", { name: "저장 다시 시도", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "오늘의 몸풀기를 마쳤어요" }),
  ).toBeVisible();
});
test("football bundle supports pause, real completion, spatial skip and purpose-specific optional feedback", async ({
  page,
}) => {
  await reviewer(page);
  await page
    .getByRole("button", { name: "운동 전 몸풀기", exact: true })
    .click();
  await choose(page, "축구");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  for (const s of [
    "서기",
    "벽",
    "한 발로 안정되게 서기 가능",
    "다리를 펼치거나 옆으로 움직일 공간",
    "마르고 미끄럽지 않은 바닥",
  ])
    await choose(page, s);
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await choose(page, "오늘은 특별히 불편한 곳이 없어요");
  await choose(page, "오늘 할 운동의 준비 움직임을 편한 범위에서 할 수 있어요");
  await page
    .getByRole("button", { name: "루틴 구성하기", exact: true })
    .click();
  await expect(page.locator(".personal-plan li")).toHaveCount(5);
  await page
    .getByRole("button", { name: "순서대로 시작하기", exact: true })
    .click();
  await page.getByRole("button", { name: "잠시 멈춤", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "이 동작을 수행했어요", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "재개", exact: true }).click();
  await page.getByRole("button", { name: "동작 넘기기", exact: true }).click();
  await page
    .getByRole("button", { name: "공간이 부족해요", exact: true })
    .click();
  for (let i = 0; i < 4; i++)
    await page
      .getByRole("button", { name: "이 동작을 수행했어요", exact: true })
      .click();
  await choose(page, "준비됐어요");
  await page
    .getByRole("button", { name: "느낌 저장하기", exact: true })
    .click();
  await page
    .getByRole("button", { name: "운동 선택으로", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "축구", exact: true }),
  ).toBeVisible();
});
test("leisure runs without calendar gating, stores one bundle feeling and leaves unconfirmed duration explicit", async ({
  page,
}) => {
  await reviewer(page);
  await page
    .getByRole("button", { name: "여유롭게 몸풀기", exact: true })
    .click();
  await choose(page, "5분 여유");
  await choose(page, "허리");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await choose(page, "의자에 앉기");
  await choose(page, "안정된 의자");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.locator("details summary").click();
  await choose(page, "오래 앉거나 운전하는 시간이 많아요");
  await choose(page, "한 자세에서 오래 움직이지 않아요");
  for (const s of [
    "앉은 뒤 엉덩이 뒤가 뻣뻣하고 굽힘·회전이 제한돼요",
    "최근 작은 무릎 당기기는 편했어요",
    "오늘 오래 같은 자세 뒤 전반적으로 굳은 느낌이에요",
    "최근 작은 움직임에는 불편이 없었어요",
    "최근 등을 작게 굽혔다 펴는 두 방향 모두 편했어요",
  ])
    await choose(page, s);
  await page
    .getByRole("button", { name: "루틴 구성하기", exact: true })
    .click();
  await expect(
    page.getByText("정확한 총 수행 시간", { exact: false }),
  ).toHaveCount(0);
  await expect(
    page.getByText("실시량과 전환 시간을 아직 확정하지 않은 묶음이에요.", {
      exact: false,
    }),
  ).toBeVisible();
  const count = await page.locator(".personal-plan li").count();
  expect(count).toBeGreaterThan(0);
  await page
    .getByRole("button", { name: "순서대로 시작하기", exact: true })
    .click();
  for (let i = 0; i < count; i++)
    await page
      .getByRole("button", { name: "이 동작을 수행했어요", exact: true })
      .click();
  await choose(page, "개운해요");
  await page
    .getByRole("button", { name: "느낌 저장하기", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "오늘의 몸풀기를 마쳤어요" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "내 기록 확인", exact: true }).click();
  const record = page.locator(".personal-record").first();
  await record.locator(":scope > summary").click();
  await record.getByText("묶음 느낌 정정", { exact: true }).click();
  await record
    .getByRole("button", { name: "비슷해요로 정정", exact: true })
    .click();
  await expect(record.locator(":scope > summary")).toContainText("비슷해요");
});
test("direct PNG URLs serve all new originals and key corrected assets without aliases", async ({
  request,
}) => {
  const { createHash } = await import("node:crypto");
  for (const image of manifest) {
    const r = await request.get(image.path);
    expect(r.status(), image.catalogId).toBe(200);
    expect(r.headers()["content-type"]).toContain("image/png");
    expect(
      createHash("sha256")
        .update(await r.body())
        .digest("hex"),
      image.catalogId,
    ).toBe(image.sha256);
  }
});
test("new question screens are keyboard-operable, preserve dependent answers and do not overflow", async ({
  page,
}, info) => {
  await reviewer(page);
  await page
    .getByRole("button", { name: "불편한 곳 풀기", exact: true })
    .click();
  await choose(page, "의자에 앉기");
  await choose(page, "안정된 의자");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await choose(page, "하체");
  for (const name of [
    "허벅지",
    "햄스트링(허벅지 뒤쪽)",
    "무릎",
    "종아리",
    "발목",
  ])
    await expect(
      page.locator(".personal-grid").getByRole("button", { name, exact: true }),
    ).toBeVisible();
  const ankle = page
    .locator(".personal-grid")
    .getByRole("button", { name: "발목", exact: true });
  await ankle.focus();
  await page.keyboard.press("Enter");
  await expect(ankle).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await choose(page, "걷기·달리기 등 반복 활동을 자주 해요");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByRole("button", { name: "‹ 이전", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "걷기·달리기 등 반복 활동을 자주 해요",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("personalization-questionnaire.png"),
    fullPage: true,
  });
});
