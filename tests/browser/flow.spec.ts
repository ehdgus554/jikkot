import { test, expect } from "@playwright/test";
import {
  guestHome,
  neckRecommendation,
  memberIdentity,
  login,
} from "./helpers";

test("guest consent, locked menus, automatic feedback and KST daily quota", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "내 몸 풀어주기", exact: true })
    .click();
  await page.getByRole("button", { name: "동의하지 않습니다" }).click();
  await expect(
    page.getByRole("heading", { name: "동의가 필요해요" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "동의 다시 확인" }).click();
  await page.getByRole("button", { name: "이해하고 동의합니다" }).click();
  await page.getByRole("button", { name: "스트레칭", exact: false }).click();
  await expect(page.getByRole("dialog")).toContainText("준비 중");
  await page.keyboard.press("Escape");
  await neckRecommendation(page);
  await expect(
    page.getByRole("heading", { name: "견갑거근 대각선 스트레칭" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "마쳤어요", exact: true }).click();
  await page.getByRole("button", { name: "편해졌어요", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "오늘의 루틴을 마쳤어요." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "기록 확인하기" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "첫 화면으로", exact: true }).click();
  await page
    .getByRole("button", { name: "내 몸 풀어주기", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "오늘의 체험을 마쳤어요",
  );
  expect(errors).toEqual([]);
});

test("native email signup validates confirmation and consent; phone remains honestly unavailable", async ({
  page,
  request,
}) => {
  const suffix = crypto.randomUUID().slice(0, 8),
    username = `ui_${suffix}`,
    email = `ui-${suffix}@example.test`,
    password = crypto.randomUUID();
  await page.goto("/");
  await page
    .getByRole("button", { name: "로그인 · 회원가입", exact: true })
    .click();
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
  await page.getByLabel("아이디", { exact: true }).fill(username);
  await page.getByRole("button", { name: "아이디 중복 확인" }).click();
  await expect(
    page.getByRole("button", { name: "아이디 확인 완료" }),
  ).toBeVisible();
  await page.getByLabel("아이디", { exact: true }).fill(username + "x");
  await expect(
    page.getByRole("button", { name: "아이디 중복 확인" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "아이디 중복 확인" }).click();
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByLabel("비밀번호 확인", { exact: true }).fill("mismatch");
  await page.getByRole("button", { name: "인증하기", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "휴대폰 인증" }),
  ).toBeVisible();
  await expect(page.getByLabel("인증번호", { exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "회원가입으로 돌아가기" }).click();
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page.getByLabel("닉네임", { exact: true }).fill(username);
  await page.getByRole("button", { name: "닉네임 중복 확인" }).click();
  await expect(
    page.getByRole("button", { name: "가입하기", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: "개인정보 수집·이용 동의 필수" })
    .check();
  await expect(
    page.getByRole("button", { name: "가입하기", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: "의료서비스가 아님을 확인 필수" })
    .check();
  await page.getByRole("button", { name: "가입하기", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("일치하지");
  await page.getByLabel("비밀번호 확인", { exact: true }).fill(password);
  await page.getByRole("button", { name: "가입하기", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "직꼿에 오신 걸 환영해요." }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("jikkot.progress.v1") ?? ""),
  ).not.toContain(password);
  await page
    .getByRole("button", { name: "내 루틴 시작하기", exact: true })
    .click();
  await page.getByRole("button", { name: "‹ 이전", exact: true }).click();
  await page.getByRole("button", { name: username, exact: true }).click();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await page
    .getByRole("button", { name: "로그인 · 회원가입", exact: true })
    .click();
  await page
    .getByRole("button", { name: "비밀번호 재설정", exact: true })
    .click();
  await page.getByLabel("가입한 이메일").fill(email);
  await page
    .getByRole("button", { name: "비밀번호 재설정 메일 보내기" })
    .click();
  await expect(page.getByRole("status")).toContainText("안내가 발송");
  const codes = await (
    await request.get(
      "http://127.0.0.1:9099/emulator/v1/projects/demo-jikkot/oobCodes",
    )
  ).json();
  expect(
    codes.oobCodes.some(
      (code: { email: string; requestType: string }) =>
        code.email === email && code.requestType === "PASSWORD_RESET",
    ),
  ).toBe(true);
});

test("guest history never transfers; records save automatically and stay isolated between accounts", async ({
  page,
  request,
}) => {
  const first = await memberIdentity(request),
    second = await memberIdentity(request);
  await guestHome(page);
  await neckRecommendation(page);
  await page.getByRole("button", { name: "마쳤어요", exact: true }).click();
  await page.getByRole("button", { name: "편해졌어요", exact: true }).click();
  await page.getByRole("button", { name: "첫 화면으로", exact: true }).click();
  await login(page, first);
  const nickname = page.locator("header").getByRole("button");
  await expect(nickname).toHaveText(`uiux_${first.email.slice(5, 13)}`);
  await expect(page.getByRole("button", { name: "로그아웃", exact: true })).toHaveCount(0);
  await expect(nickname).toHaveCSS("cursor", "pointer");
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("jikkot.progress.v1")!).answers,
    ),
  ).toEqual({});
  await nickname.click();
  await expect(page.locator("header").getByRole("button", { name: "로그아웃", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(
    page.getByRole("heading", { name: "아직 기록이 없어요" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "‹ 이전", exact: true }).click();
  await neckRecommendation(page);
  await page.getByRole("button", { name: "마쳤어요", exact: true }).click();
  await page.getByRole("button", { name: "편해졌어요", exact: true }).click();
  await page
    .getByRole("button", { name: "기록 확인하기", exact: true })
    .click();
  await expect(page.locator("details")).toHaveCount(1);
  await page.locator("details summary").click();
  await expect(page.locator("details summary")).toHaveCSS("cursor", "pointer");
  await expect(page.locator("details")).toContainText("고개를 한쪽으로");
  await page.reload();
  await expect(page.locator("details")).toHaveCount(1);
  await page.getByRole("button", { name: "‹ 이전", exact: true }).click();
  await page.getByRole("button", { name: "첫 화면으로", exact: true }).click();
  await page.getByRole("button", { name: "내 기록", exact: true }).click();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "로그인 · 회원가입", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("jikkot.progress.v1")))
    .toBeNull();
  await login(page, second);
  await page.getByRole("button", { name: "내 기록", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "아직 기록이 없어요" }),
  ).toBeVisible();
  await expect(page.locator("details")).toHaveCount(0);
  const original = await request.get("http://127.0.0.1:5002/api/records", {
    headers: { Authorization: `Bearer ${first.idToken}` },
  });
  expect((await original.json()).records).toHaveLength(1);
});

test("lost recommendation and feedback responses retry fixed IDs after reload without duplicate records", async ({
  page,
}) => {
  await guestHome(page);
  let lost = false;
  await page.route("**/api/recommendations", async (route) => {
    if (!lost) {
      lost = true;
      await route.fetch();
      await route.abort();
    } else await route.continue();
  });
  await neckRecommendation(page);
  await expect(page.getByRole("alert")).toBeVisible();
  const recommendationId = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("jikkot.progress.v1")!).recommendationId,
  );
  await page.reload();
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await page.getByRole("button", { name: "마쳤어요", exact: true }).click();
  let failed = false;
  await page.route("**/api/feedback", async (route) => {
    if (!failed) {
      failed = true;
      await route.fetch();
      await route.abort();
    } else await route.continue();
  });
  await page.getByRole("button", { name: "편해졌어요", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  const submissionId = await page.evaluate(
    () => JSON.parse(localStorage.getItem("jikkot.progress.v1")!).submissionId,
  );
  await page.reload();
  await page
    .getByRole("button", { name: "저장 다시 시도", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "오늘의 루틴을 마쳤어요." }),
  ).toBeVisible();
  const restored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("jikkot.progress.v1")!),
  );
  expect(restored.submissionId).toBe(submissionId);
  expect(restored.recommendationId).toBe(recommendationId);
});

test("OAuth cancellation and unconfigured providers stay honest; draft policy shows actual operator", async ({
  page,
}) => {
  await page.goto("/?oauthError=cancelled");
  await expect(
    page.getByRole("heading", { name: /나를 위한 루틴/ }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("취소");
  await page
    .getByRole("button", { name: "카카오로 계속하기 · 준비 중" })
    .click();
  await expect(page.getByRole("alert")).toContainText("연결 준비 중");
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
  await page
    .getByRole("button", {
      name: "보기 : 개인정보 수집·이용 동의",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText("운영자: Jikkot");
  await expect(page.getByRole("dialog")).toContainText("문의 이메일: 미정");
  await expect(page.getByRole("dialog")).toContainText("운영 약관 검토 미완료");
});

test("guest worse feedback shows real instruction processes, restores them and ends without invented alternatives", async ({
  page,
}) => {
  await guestHome(page);
  await neckRecommendation(page);
  await page.getByRole("button", { name: "마쳤어요", exact: true }).click();
  await page.getByRole("button", { name: "더 불편해요", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "어느 과정에서 불편했나요?" }),
  ).toBeVisible();
  await expect(page.locator("main")).not.toContainText(
    "지금은 동작을 멈춰주세요",
  );
  await expect(page.locator("main")).not.toContainText(
    "더 불편해진 동작을 계속할 필요는 없어요",
  );
  await page
    .getByRole("button", {
      name: "고개를 반대쪽으로 돌린 뒤 그쪽 겨드랑이를 보듯 대각선으로 숙여요.",
      exact: true,
    })
    .click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "어느 과정에서 불편했나요?" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "잘 모르겠어요", exact: true })
    .click();
  await page.getByRole("button", { name: "확인", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "오늘의 루틴을 마쳤어요." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "기록 확인하기" })).toHaveCount(
    0,
  );
});

test("member worse feedback stores selected process and finishes when no approved alternative exists", async ({
  page,
  request,
}) => {
  const user = await memberIdentity(request);
  await page.goto("/");
  await login(page, user);
  await neckRecommendation(page);
  await page.getByRole("button", { name: "마쳤어요", exact: true }).click();
  await page.getByRole("button", { name: "더 불편해요", exact: true }).click();
  await page
    .getByRole("button", {
      name: "고개를 반대쪽으로 돌린 뒤 그쪽 겨드랑이를 보듯 대각선으로 숙여요.",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "확인", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "추가로 안내할 동작이 없어요" }),
  ).toBeVisible();
  const records = await (
    await request.get("http://127.0.0.1:5002/api/records", {
      headers: { Authorization: `Bearer ${user.idToken}` },
    })
  ).json();
  expect(records.records).toHaveLength(1);
  expect(records.records[0].changes[0].id).toBe("step-2");
  expect(records.records[0].feedback).toBe("worse");
});

test("standing and lying show unavailable posture before questionnaire without consuming a recommendation", async ({
  page,
}) => {
  await guestHome(page);
  let recommendations = 0;
  page.on("request", (request) => {
    if (
      request.url().endsWith("/api/recommendations") &&
      request.method() === "POST"
    )
      recommendations++;
  });
  await page
    .getByRole("button", { name: "내 몸 풀어주기", exact: true })
    .click();
  await page.getByRole("button", { name: "서기", exact: false }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "이 자세의 동작을 준비하고 있어요" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "‹ 이전", exact: true }).click();
  await page.getByRole("button", { name: "눕기", exact: false }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "이 자세의 동작을 준비하고 있어요" }),
  ).toBeVisible();
  expect(recommendations).toBe(0);
  await page.getByRole("button", { name: "앉아서 이용하기" }).click();
  await expect(
    page.getByRole("heading", { name: "어디가 불편한가요?" }),
  ).toBeVisible();
});

test("rapid feedback double-click sends exactly one submission", async ({
  page,
}) => {
  await guestHome(page);
  await neckRecommendation(page);
  await page.getByRole("button", { name: "마쳤어요", exact: true }).click();
  let count = 0;
  await page.route("**/api/feedback", async (route) => {
    count++;
    await new Promise((resolve) => setTimeout(resolve, 200));
    await route.continue();
  });
  await page
    .getByRole("button", { name: "편해졌어요", exact: true })
    .evaluate((button) => {
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
    });
  await expect(
    page.getByRole("heading", { name: "오늘의 루틴을 마쳤어요." }),
  ).toBeVisible();
  expect(count).toBe(1);
});

test("real Auth emulator Google identity requires both consents before server profile activation", async ({
  page,
}) => {
  const suffix = crypto.randomUUID().slice(0, 8);
  await page.goto("/");
  await page
    .getByRole("button", { name: "로그인 · 회원가입", exact: true })
    .waitFor();
  await page.evaluate(async (suffix) => {
    // Drive SDK auth state with the official emulator, not a UI member checkbox.
    // This tests onboarding, not the live Google OAuth popup.
    const client = await import(/* @vite-ignore */ "/lib/firebase-client.ts");
    const sdkUrl = performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .find((url) => /\/firebase_auth\.js(?:\?|$)/.test(url));
    if (!sdkUrl) throw new Error("Auth SDK resource missing");
    const sdk = await import(/* @vite-ignore */ sdkUrl);
    const auth = client.firebaseAuth();
    if (!auth.emulatorConfig) throw new Error("This fixture is emulator-only");
    const token = JSON.stringify({
      sub: `uiux-google-${suffix}`,
      email: `uiux-google-${suffix}@example.test`,
      name: "UIUX Google",
    });
    await sdk.signInWithCredential(
      auth,
      sdk.GoogleAuthProvider.credential(token),
    );
  }, suffix);
  await expect(
    page.getByRole("heading", { name: "직꼿 가입을 완료해주세요" }),
  ).toBeVisible();
  await page.getByLabel("닉네임", { exact: true }).fill(`google_${suffix}`);
  await expect(
    page.getByRole("button", { name: "동의하고 시작하기" }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: "개인정보 수집·이용 동의 필수" })
    .check();
  await expect(
    page.getByRole("button", { name: "동의하고 시작하기" }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: "의료서비스가 아님을 확인 필수" })
    .check();
  await page.getByRole("button", { name: "동의하고 시작하기" }).click();
  await expect(
    page.getByRole("heading", { name: "직꼿에 오신 걸 환영해요." }),
  ).toBeVisible();
});
