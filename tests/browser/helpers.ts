import { expect, type Page, type APIRequestContext } from "@playwright/test";
export const consents = {
  privacy: true,
  healthPersonalization: true,
  nonMedical: true,
  version: "2026-10-19",
};
export async function memberIdentity(request: APIRequestContext) {
  const suffix = crypto.randomUUID().slice(0, 8),
    email = "release-" + suffix + "@example.test",
    password = "LocalTest123!";
  const r = await request.post(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key",
    { data: { email, password, returnSecureToken: true } },
  );
  expect(r.status()).toBe(200);
  const user = await r.json();
  const activated = await request.post("http://127.0.0.1:5002/api/signup", {
    headers: { Authorization: "Bearer " + user.idToken },
    data: { nickname: "회원" + suffix, consents },
  });
  expect(activated.status()).toBe(200);
  return { ...user, email, password, suffix };
}
export async function login(
  page: Page,
  user: { email: string; password: string },
) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "로그인 · 회원가입", exact: true })
    .click();
  await page.getByLabel("이메일", { exact: true }).fill(user.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "불편한 곳 풀기", exact: true }),
  ).toBeVisible();
}
export async function choose(page: Page, label: string) {
  const b = page.getByRole("button", { name: label, exact: true });
  if ((await b.getAttribute("aria-pressed")) !== "true") await b.click();
}
export async function agree(page: Page) {
  for (const label of [
    "계정·개인정보 처리 동의",
    "건강 관련 입력 처리에 대한 별도 동의",
    "일반 몸풀기 안내·비의료 서비스 확인",
  ])
    await page.getByRole("checkbox", { name: label, exact: true }).check();
}
export async function guestHome(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "불편한 곳 풀기", exact: true })
    .click();
  await agree(page);
  await page
    .getByRole("button", { name: "동의하고 시작", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "지금 어떤 상태인가요?" }),
  ).toBeVisible();
}
export async function daily(page: Page, expectResult = true) {
  await page.getByRole("radio", { name: "앉기 의자에 앉아서" }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByRole("radio", { name: "등", exact: true }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  for (let i = 0; i < 12; i++) {
    if (
      await page
        .getByRole("button", {
          name: "날개뼈를 뒤로 모은 채 오래 버텨요",
          exact: true,
        })
        .count()
    )
      await choose(page, "날개뼈를 뒤로 모은 채 오래 버텨요");
    const b = page.getByRole("button", { name: /^(계속|다음)$/ });
    const last = (await b.innerText()) === "다음";
    await b.click();
    if (last) {
      await expect(
        page.getByRole("heading", { name: "최근엔 어떤 느낌이었나요?" }),
      ).toBeVisible();
      break;
    }
  }
  for (let i = 0; i < 12; i++) {
    for (const label of [
      "오늘 윗등이 굳거나 긴장된 느낌이에요",
      "최근 가볍게 앞으로 뻗었을 때 편했어요",
    ])
      if (await page.getByRole("button", { name: label, exact: true }).count())
        await choose(page, label);
    await page.getByRole("button", { name: /^(계속|다음)$/ }).click();
    if (
      await page
        .getByRole("heading", { name: "필요한 지지를 확인해요" })
        .count()
    )
      break;
  }
  await choose(page, "안정된 의자");
  await page.getByRole("button", { name: "동작 보기", exact: true }).click();
  if (expectResult)
    await expect(
      page.getByRole("heading", { name: "양손을 앞으로 뻗어 윗등 늘리기" }),
    ).toBeVisible();
}
export async function checkSupports(page: Page) {
  for (let i = 0; i < 6; i++) {
    for (const b of await page
      .locator(".release-choices .release-choice")
      .all()) {
      if ((await b.getAttribute("aria-pressed")) !== "true") await b.click();
    }
    const next = page.getByRole("button", { name: /^(계속|다음)$/ });
    await next.click();
    if (
      await page
        .getByRole("heading", { name: /오늘은 편하게|편한 범위만/ })
        .count()
    )
      return;
  }
  throw Error("Support pages did not finish");
}
export async function startBundle(
  page: Page,
  purpose: "warmup" | "leisure",
  choice: string,
  profile = "앉기 의자에 앉아서",
  focus = "전신",
) {
  await page.getByRole("button", { name: "몸풀기", exact: true }).click();
  await page
    .getByRole("button", {
      name: purpose === "warmup" ? /운동 전 몸풀기/ : /여유롭게 몸풀기/,
    })
    .click();
  if (purpose === "warmup") {
    await choose(page, choice);
    await page.getByRole("button", { name: "다음", exact: true }).click();
  } else {
    await choose(page, choice);
    await page.getByRole("button", { name: "다음", exact: true }).click();
    await page.getByRole("radio", { name: profile, exact: true }).click();
    if (profile === "눕기 마른 매트에 누워서" && focus.startsWith("매트")) {
      await choose(page, "바닥 앉기·네발 자세 등 자세 전환도 가능해요");
      focus = focus.replace("매트", "");
    }
    await page.getByRole("button", { name: "다음", exact: true }).click();
  }
  await checkSupports(page);
  if (purpose === "leisure" && focus !== "전신") {
    await page.getByRole("button", { name: focus, exact: true }).click();
    await checkSupports(page);
  }
  await choose(
    page,
    purpose === "warmup"
      ? "준비 움직임을 편한 범위에서 할 수 있어요"
      : "오늘 특별한 불편이 없고 작은 움직임은 편해요",
  );
  await page.getByRole("button", { name: "순서 확인", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "몸풀기 시작", exact: true }),
  ).toBeVisible();
}
export async function leavePlan(page: Page) {
  await page.getByRole("button", { name: "진행 나가기" }).click();
  await page
    .getByRole("button", { name: "잠시 멈추고 나가기", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "불편한 곳 풀기", exact: true }),
  ).toBeVisible();
}
