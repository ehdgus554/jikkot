import { expect, type APIRequestContext, type Page } from "@playwright/test";
export async function guestHome(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "불편한 곳 풀기", exact: true })
    .click();
  await page.getByRole("button", { name: "이해하고 동의합니다" }).click();
  await expect(
    page.getByRole("button", { name: "불편한 곳 풀기", exact: true }),
  ).toBeVisible();
}
export async function seatedQuestions(page: Page) {
  await page
    .getByRole("button", { name: "불편한 곳 풀기", exact: true })
    .click();
  await page.getByRole("button", { name: "앉기", exact: false }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "어디가 불편한가요?" }),
  ).toBeVisible();
}
export async function neckRecommendation(page: Page) {
  await seatedQuestions(page);
  await page.getByRole("button", { name: "목", exact: true }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page
    .getByRole("button", {
      name: "일할 때 어깨에 힘이 들어가거나 올라가요",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page
    .getByRole("button", {
      name: "고개를 한쪽으로 돌리거나 같은 방향으로 오래 두었어요",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "내 루틴 보기", exact: true }).click();
}
export async function memberIdentity(request: APIRequestContext) {
  const suffix = crypto.randomUUID().slice(0, 8),
    email = `uiux-${suffix}@example.test`,
    password = crypto.randomUUID();
  const auth = await request.post(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key",
    { data: { email, password, returnSecureToken: true } },
  );
  expect(auth.status()).toBe(200);
  const user = await auth.json();
  const profile = await request.post("http://127.0.0.1:5002/api/signup", {
    headers: { Authorization: `Bearer ${user.idToken}` },
    data: {
      username: `uiux_${suffix}`,
      nickname: `uiux_${suffix}`,
      consents: { privacy: true, nonMedical: true, version: "draft-v1" },
    },
  });
  expect(profile.status()).toBe(200);
  return { ...user, email, password };
}
export async function login(
  page: Page,
  user: { email: string; password: string },
) {
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
