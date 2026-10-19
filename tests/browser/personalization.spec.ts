import { test, expect } from "@playwright/test";
import {
  memberIdentity,
  login,
  startBundle,
  leavePlan,
  choose,
  guestHome,
  daily,
} from "./helpers";
test("eight sports have real five-stage previews; public warmup has actual walking dosage and a timer never completes an item", async ({
  page,
  request,
}, info) => {
  test.setTimeout(240000);
  const u = await memberIdentity(request);
  await login(page, u);
  const sports =
    info.project.name === "desktop-1440"
      ? ["러닝", "축구", "등산", "헬스", "골프", "테니스", "수영", "자전거"]
      : ["수영"];
  for (const sport of sports) {
    await startBundle(page, "warmup", sport);
    await expect(page.locator(".release-plan li")).toHaveCount(5);
    await expect(page.getByText(/5단계 · 5개 동작/)).toBeVisible();
    await expect(page.locator(".release-plan")).toContainText("180초");
    await leavePlan(page);
  }
  await startBundle(page, "warmup", "축구");
  await page.getByRole("button", { name: "몸풀기 시작", exact: true }).click();
  await expect(page.getByRole("timer")).toBeVisible();
  await page
    .getByRole("button", { name: "보조 타이머 시작", exact: true })
    .click();
  await page.getByRole("button", { name: "잠시 멈춤", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "이 동작 마쳤어요", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "재개", exact: true }).click();
  await page
    .getByRole("button", { name: "이 동작 마쳤어요", exact: true })
    .click();
  await page.getByRole("button", { name: "동작 넘기기", exact: true }).click();
  await page
    .getByRole("button", { name: "자세나 도구가 어려워요", exact: true })
    .click();
  for (let i = 0; i < 3; i++)
    await page
      .getByRole("button", { name: "이 동작 마쳤어요", exact: true })
      .click();
  await choose(page, "준비됐어요");
  await page.getByRole("button", { name: "느낌 남기기", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "오늘의 느낌을 남겼어요" }),
  ).toBeVisible();
});
test("healthy leisure supports all 24 profile/time/preferences with actual summaries and deliberate rounds", async ({
  page,
  request,
}, info) => {
  test.setTimeout(240000);
  const u = await memberIdentity(request);
  await login(page, u);
  const profiles =
    info.project.name === "desktop-1440"
      ? [
          "앉기 의자에 앉아서",
          "서기 서 있는 상태에서",
          "눕기 마른 매트에 누워서",
          "매트",
        ]
      : ["앉기 의자에 앉아서", "눕기 마른 매트에 누워서"];
  const times =
    info.project.name === "desktop-1440" ? ["5분", "10분"] : ["5분"];
  const prefs =
    info.project.name === "desktop-1440" ? ["전신", "상체", "하체"] : ["전신"];
  for (const profile of profiles)
    for (const time of times)
      for (const focus of prefs) {
        await startBundle(
          page,
          "leisure",
          time,
          profile === "매트" ? "눕기 마른 매트에 누워서" : profile,
          (profile === "매트" ? "매트" : "") + focus,
        );
        await expect(page.locator(".release-plan li")).not.toHaveCount(0);
        await expect(page.getByText(/진행량과 자세 전환/)).toBeVisible();
        await expect(
          page.getByText(/검토 전용|콘텐츠 검토 중|미확정/),
        ).toHaveCount(0);
        await leavePlan(page);
      }
});
test("lost recommendation/feedback responses restore fixed IDs without duplicate records and permit correction/deletion", async ({
  page,
  request,
}) => {
  const u = await memberIdentity(request);
  await login(page, u);
  await page
    .getByRole("button", { name: "불편한 곳 풀기", exact: true })
    .click();
  let dropped = false;
  await page.route("**/api/personalization/sessions", async (route) => {
    const r = await route.fetch();
    if (!dropped) {
      dropped = true;
      await route.abort("failed");
    } else await route.fulfill({ response: r });
  });
  await daily(page, false);
  await expect(page.getByRole("alert")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "양손을 앞으로 뻗어 윗등 늘리기" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "마쳤어요", exact: true }).click();
  let feedbackLost = false;
  await page.route(
    "**/api/personalization/sessions/*/events",
    async (route) => {
      const data = route.request().postDataJSON();
      const r = await route.fetch();
      if (data.action === "feedback" && !feedbackLost) {
        feedbackLost = true;
        await route.abort("failed");
      } else await route.fulfill({ response: r });
    },
  );
  await choose(page, "개운해요");
  await page.getByRole("button", { name: "느낌 남기기", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "오늘의 느낌을 남겼어요" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "내 기록 보기", exact: true }).click();
  await expect(page.locator(".release-record")).toHaveCount(1);
  await page.locator(".release-record>summary").click();
  await page.getByText("당시 느낌 정정", { exact: true }).click();
  await page
    .getByRole("button", { name: "비슷해요로 정정", exact: true })
    .click();
  await expect(page.locator(".release-record>summary")).toContainText(
    "비슷해요",
  );
  await page.getByRole("button", { name: "이 기록 삭제", exact: true }).click();
  await expect(page.locator(".release-record")).toHaveCount(0);
});
test("daily first adverse reaction uses real stages and exhausts aliases instead of inventing a fallback", async ({
  page,
}) => {
  await guestHome(page);
  await daily(page);
  await page.getByRole("button", { name: "마쳤어요", exact: true }).click();
  await choose(page, "더 불편해요");
  await expect(
    page.getByRole("group", { name: "어느 과정에서 불편했나요?" }),
  ).toBeVisible();
  await choose(page, "과정은 정확히 모르겠어요");
  await page.getByRole("button", { name: "느낌 남기기", exact: true }).click();
  await page
    .getByRole("button", { name: "다른 동작 살펴보기", exact: true })
    .click();
  await expect(
    page.getByText("지금 조건에 맞는 다른 동작이 없어요.", { exact: false }),
  ).toBeVisible();
});

test("starting immediately after login waits for the actual consent context", async ({
  page,
  request,
}) => {
  const u = await memberIdentity(request);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/personalization/context", async (route) => {
    await gate;
    await route.continue();
  });
  await login(page, u);
  await expect(
    page.getByRole("button", { name: "불편한 곳 풀기", exact: true }),
  ).toBeDisabled();
  release();
  await expect(
    page.getByRole("button", { name: "불편한 곳 풀기", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "불편한 곳 풀기", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "지금 어떤 상태인가요?" }),
  ).toBeVisible();
});
