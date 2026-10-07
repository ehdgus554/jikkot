import { test, expect, type Page } from "@playwright/test";
async function guest(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "비회원으로 체험하기" }).click();
  await page.getByRole("button", { name: "이해하고 동의합니다" }).click();
  await expect(
    page.getByRole("button", { name: "루틴 시작하기" }),
  ).toBeVisible();
}
async function questionnaire(page: Page, lostResponse = false) {
  await page.getByRole("button", { name: "루틴 시작하기" }).click();
  await page.getByRole("button", { name: "앉아서만 할 수 있음" }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByRole("button", { name: "목", exact: true }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "평소 생활 습관" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("선택");
  for (const label of [
    "오래 앉아 있어도 자세를 자주 바꾸지 않는다",
    "화면을 볼 때 머리가 어깨보다 앞으로 나오는 편이다",
    "앉아 있을 때 어깨와 등이 둥글게 말리는 편이다",
  ])
    await page.getByRole("button", { name: label }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(page.getByRole("heading", { name: "최근 상태" })).toBeVisible();
  await expect(page.getByText("해당 없음")).toHaveCount(0);
  for (const label of [
    "모니터를 오래 봤다",
    "휴대폰을 내려다보는 시간이 길었다",
    "키보드나 마우스를 오래 사용했다",
  ])
    await page.getByRole("button", { name: label }).click();
  await page.getByRole("button", { name: "동작 추천받기" }).click();
  if (lostResponse) {
    await expect(page.getByRole("alert")).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "추천 확인 · 재시도" }).click();
  }
  await expect(
    page.getByRole("button", { name: "루틴 완료", exact: true }),
  ).toBeVisible();
}
test("consent blocks entry, multiselect single routine, reload, feedback and locked feature modal", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "비회원으로 체험하기" }).click();
  await page.getByRole("button", { name: "동의하지 않습니다" }).click();
  await expect(
    page.getByRole("heading", { name: "동의 없이는 이용할 수 없습니다" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "초기 화면", exact: true }).click();
  await guest(page);
  await page.getByRole("button", { name: "스트레칭", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("서비스 준비 중");
  await page.keyboard.press("Escape");
  await questionnaire(page);
  await expect(page.locator("main img")).toHaveCount(1);
  const id = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("jikkot.progress.v1")!).recommendationId,
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "루틴 완료", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("jikkot.progress.v1")!)
          .recommendationId,
    ),
  ).toBe(id);
  await page.getByRole("button", { name: "루틴 완료", exact: true }).click();
  await page.getByRole("button", { name: "비슷하다", exact: true }).click();
  await page.getByRole("button", { name: "피드백 저장", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("로그인이 필요합니다");
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "루틴을 마쳤어요" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "첫 화면", exact: true }).click();
  await page.getByRole("button", { name: "루틴 시작하기" }).click();
  await expect(page.getByRole("dialog")).toContainText("오늘 체험 완료");
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "비회원으로 체험하기" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("signup duplicate confirmation clears when text changes and keyboard can open login", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "로그인하기", exact: true }).click();
  await page
    .getByRole("button", { name: "직접 회원가입", exact: true })
    .click();
  const input = page.getByLabel("아이디 (영문 소문자·숫자·밑줄 4~20자)");
  await input.fill("b_" + crypto.randomUUID().slice(0, 8));
  await page.getByRole("button", { name: "아이디 중복 확인" }).click();
  await expect(
    page.getByRole("button", { name: "아이디 확인 완료" }),
  ).toBeVisible();
  await input.fill("b_" + crypto.randomUUID().slice(0, 8));
  await expect(
    page.getByRole("button", { name: "아이디 중복 확인" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "가입하고 시작하기" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "가입·복구 포기" }).click();
  await page.getByRole("button", { name: "로그인하기" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "로그인", exact: true }),
  ).toBeVisible();
});
test("guest login resets all answers, member history saves each feedback and logout preserves server history", async ({
  page,
  request,
}) => {
  const authURL =
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:";
  const apiURL = "http://127.0.0.1:5001/demo-jikkot/asia-northeast3/api";
  const suffix = crypto.randomUUID().slice(0, 8),
    phoneNumber =
      "+1650555" + String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  const sent = await (
    await request.post(authURL + "sendVerificationCode?key=demo-key", {
      data: { phoneNumber, recaptchaToken: "emulator-only" },
    })
  ).json();
  const codes = await (
    await request.get(
      "http://127.0.0.1:9099/emulator/v1/projects/demo-jikkot/verificationCodes",
    )
  ).json();
  const code = codes.verificationCodes.find(
    (q: { sessionInfo: string }) => q.sessionInfo === sent.sessionInfo,
  ).code;
  const user = await (
    await request.post(authURL + "signInWithPhoneNumber?key=demo-key", {
      data: { sessionInfo: sent.sessionInfo, code },
    })
  ).json();
  const username = "web_" + suffix,
    password = crypto.randomUUID();
  const signup = await request.post(apiURL + "/signup", {
    headers: { Authorization: `Bearer ${user.idToken}` },
    data: {
      username,
      password,
      email: `web-${suffix}@example.test`,
      nickname: "web_" + suffix,
      consents: { privacy: true, nonMedical: true, version: "draft-v1" },
    },
  });
  expect(signup.status()).toBe(200);
  await guest(page);
  await questionnaire(page);
  await page.getByRole("button", { name: "루틴 완료", exact: true }).click();
  await page.getByRole("button", { name: "편해졌다", exact: true }).click();
  await page.getByRole("button", { name: "피드백 저장", exact: true }).click();
  await page.getByRole("button", { name: "기록 확인", exact: true }).click();
  await page.getByRole("button", { name: "로그인하기", exact: true }).click();
  async function login() {
    await page.getByLabel("아이디", { exact: true }).fill(username);
    await page.getByLabel("비밀번호", { exact: true }).fill(password);
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "루틴 시작하기" }),
    ).toBeVisible();
  }
  await login();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("jikkot.progress.v1")!).answers,
    ),
  ).toEqual({});
  await page.getByRole("button", { name: "기록 확인", exact: true }).click();
  await expect(page.getByText("저장된 기록이 없습니다.")).toBeVisible();
  await page.getByRole("button", { name: "돌아가기", exact: true }).click();
  await questionnaire(page);
  await page.getByRole("button", { name: "루틴 완료", exact: true }).click();
  await page.getByRole("button", { name: "편해졌다", exact: true }).click();
  await page.getByRole("button", { name: "피드백 저장", exact: true }).click();
  await page
    .getByRole("button", { name: "다른 루틴 보기", exact: true })
    .click();
  await page.locator("main > section button").first().click();
  await expect(
    page.getByRole("button", { name: "루틴 완료", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "목록으로" }).click();
  await page.getByRole("button", { name: "돌아가기", exact: true }).click();
  await page.getByRole("button", { name: "기록 확인", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(1);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "부위별 기록", exact: true }),
  ).toBeVisible();
  await expect(page.locator("article")).toHaveCount(1);
  await page.getByRole("button", { name: "돌아가기", exact: true }).click();
  await page.getByRole("button", { name: "첫 화면", exact: true }).click();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "비회원으로 체험하기" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("jikkot.progress.v1")),
  ).toBeNull();
  await page.getByRole("button", { name: "로그인하기", exact: true }).click();
  await login();
  await page.getByRole("button", { name: "기록 확인", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(1);
});

test("lost recommendation response and feedback save failure preserve fixed IDs through reload", async ({
  page,
}) => {
  await guest(page);
  let lost = false;
  await page.route("**/api/recommendations", async (route) => {
    if (!lost) {
      lost = true;
      await route.fetch();
      await route.abort();
    } else await route.continue();
  });
  await questionnaire(page, true);
  const recommendationId = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("jikkot.progress.v1")!).recommendationId,
  );
  await page.getByRole("button", { name: "루틴 완료", exact: true }).click();
  await page.getByRole("button", { name: "편해졌다", exact: true }).click();
  let failed = false;
  await page.route("**/api/feedback", async (route) => {
    if (!failed) {
      failed = true;
      await route.abort();
    } else await route.continue();
  });
  await page.getByRole("button", { name: "피드백 저장", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  const submissionId = await page.evaluate(
    () => JSON.parse(localStorage.getItem("jikkot.progress.v1")!).submissionId,
  );
  await page.reload();
  await page.getByRole("button", { name: "피드백 저장 재시도" }).click();
  await expect(
    page.getByRole("heading", { name: "루틴을 마쳤어요" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("jikkot.progress.v1")!).submissionId,
    ),
  ).toBe(submissionId);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("jikkot.progress.v1")!)
          .recommendationId,
    ),
  ).toBe(recommendationId);
});
test("SMS signup UI and phone recovery use real emulator proof with consent gate", async ({
  page,
  request,
}) => {
  const suffix = crypto.randomUUID().slice(0, 8),
    username = "sms_" + suffix,
    password = crypto.randomUUID(),
    phoneNumber =
      "+1650555" + String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  await page.goto("/");
  await page.getByRole("button", { name: "로그인하기", exact: true }).click();
  await page
    .getByRole("button", { name: "직접 회원가입", exact: true })
    .click();
  await page.getByLabel("아이디 (영문 소문자·숫자·밑줄 4~20자)").fill(username);
  await page.getByRole("button", { name: "아이디 중복 확인" }).click();
  await page.getByLabel("비밀번호 (8~72자)").fill(password);
  await page
    .getByLabel("이메일 (가입 정보)")
    .fill(`sms-${suffix}@example.test`);
  await page.getByLabel("닉네임 (한글·영문·숫자·밑줄 2~20자)").fill(username);
  await page.getByRole("button", { name: "닉네임 중복 확인" }).click();
  async function verify() {
    await page.getByLabel("휴대폰 번호").fill(phoneNumber);
    await page.getByRole("button", { name: "인증 문자 받기" }).click();
    await expect(
      page.getByRole("button", { name: "인증 확인", exact: true }),
    ).toBeEnabled();
    const data = await (
      await request.get(
        "http://127.0.0.1:9099/emulator/v1/projects/demo-jikkot/verificationCodes",
      )
    ).json();
    const code = data.verificationCodes
      .filter((q: { phoneNumber: string }) => q.phoneNumber === phoneNumber)
      .at(-1).code;
    await page.getByLabel("문자 인증 코드").fill(code);
    await page.getByRole("button", { name: "인증 확인", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "휴대폰 확인 완료" }),
    ).toBeVisible();
  }
  await verify();
  await expect(
    page.getByRole("button", { name: "가입하고 시작하기" }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: "개인정보 수집·이용 동의 (필수)" })
    .check();
  await page
    .getByRole("checkbox", { name: /진단·치료를 제공하는 의료 서비스/ })
    .check();
  await page.getByRole("button", { name: "가입하고 시작하기" }).click();
  await expect(
    page.getByRole("button", { name: "루틴 시작하기" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await page.getByRole("button", { name: "로그인하기", exact: true }).click();
  await page
    .getByRole("button", { name: "아이디 찾기 · 비밀번호 재설정" })
    .click();
  await verify();
  await page.getByRole("button", { name: "계정 복구하기" }).click();
  await expect(page.getByRole("status")).toContainText(username);
});
test("social cancellation stays at login and unconfigured providers explain the connection status", async ({
  page,
}) => {
  await page.goto("/?oauthError=cancelled");
  await expect(
    page.getByRole("heading", { name: "로그인", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("취소");
  await page.getByRole("button", { name: "카카오 (준비 중)" }).click();
  await expect(page.getByRole("alert")).toContainText("연결 준비 중");
  await expect(
    page.getByRole("heading", { name: "로그인", exact: true }),
  ).toBeVisible();
});
