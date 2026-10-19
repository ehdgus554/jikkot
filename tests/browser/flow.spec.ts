import { test, expect } from "@playwright/test";
import {
  agree,
  choose,
  guestHome,
  daily,
  finishDaily,
  memberIdentity,
  login,
} from "./helpers";
test("home has one entry and four real tabs; guest health consent is separate and daily quota survives withdrawal", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "불편한 곳 풀기", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /운동 전 몸풀기/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "몸풀기", exact: true }).click();
  await page.getByRole("button", { name: /운동 전 몸풀기/ }).click();
  await expect(
    page.getByRole("heading", { name: "다시 만나 반가워요" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "‹ 이전", exact: true }).click();
  await guestHome(page);
  await daily(page);
  await finishDaily(page);
  await page.getByRole("button", { name: "개운해요", exact: true }).click();
  await page.getByRole("button", { name: "느낌 남기기", exact: true }).click();
  await page.getByRole("button", { name: "홈으로", exact: true }).click();
  await page.getByRole("button", { name: "마이", exact: true }).click();
  await page
    .getByRole("button", { name: "비회원 동의 철회·기록 삭제", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("삭제");
  await page.getByRole("button", { name: "홈", exact: true }).click();
  await page
    .getByRole("button", { name: "불편한 곳 풀기", exact: true })
    .click();
  await agree(page);
  await page
    .getByRole("button", { name: "동의하고 시작", exact: true })
    .click();
  await daily(page, false);
  await expect(page.getByRole("alert")).toContainText("오늘 체험");
});
test("email signup has no username, rejects one-character nickname and creates a real member after all consent", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "로그인 · 회원가입", exact: true })
    .click();
  await page
    .getByRole("button", { name: "이메일로 가입하기", exact: true })
    .click();
  await expect(page.getByLabel("아이디", { exact: true })).toHaveCount(0);
  const suffix = crypto.randomUUID().slice(0, 8);
  await page
    .getByLabel("이메일", { exact: true })
    .fill(suffix + "@example.test");
  await page.getByLabel("비밀번호", { exact: true }).fill("LocalTest123!");
  await page.getByLabel("비밀번호 확인", { exact: true }).fill("LocalTest123!");
  await page.getByLabel("닉네임", { exact: true }).fill("가");
  await agree(page);
  await page.getByRole("button", { name: "가입하기", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("2~20");
  await page.getByLabel("닉네임", { exact: true }).fill("가입" + suffix);
  await page.getByRole("button", { name: "가입하기", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "오늘도, 가볍게 풀어볼까요?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "마이", exact: true }).click();
  await expect(page.getByRole("heading")).toContainText("가입" + suffix);
});
test("Google emulator identity requires a chosen nickname and separate health consent before activation", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "로그인 · 회원가입", exact: true })
    .waitFor();
  await page.evaluate(
    async (suffix) => {
      const client = await import(/* @vite-ignore */ "/lib/firebase-client.ts");
      const url = performance
        .getEntriesByType("resource")
        .map((e) => e.name)
        .find((u) => /\/firebase_auth\.js(?:\?|$)/.test(u));
      if (!url) throw Error("Auth SDK missing");
      const sdk = await import(/* @vite-ignore */ url);
      const auth = client.firebaseAuth();
      if (!auth.emulatorConfig) throw Error("Fixture must be emulator-only");
      await sdk.signInWithCredential(
        auth,
        sdk.GoogleAuthProvider.credential(
          JSON.stringify({
            sub: "google-" + suffix,
            email: "google-" + suffix + "@example.test",
            name: "Must not become a nickname",
          }),
        ),
      );
    },
    crypto.randomUUID().slice(0, 8),
  );
  await expect(
    page.getByRole("heading", { name: "어떻게 불러드릴까요?" }),
  ).toBeVisible();
  await expect(page.getByLabel("닉네임", { exact: true })).toHaveValue("");
  await page
    .getByLabel("닉네임", { exact: true })
    .fill("구글" + crypto.randomUUID().slice(0, 8));
  await page
    .getByRole("checkbox", { name: "계정·개인정보 처리 동의", exact: true })
    .check();
  await expect(
    page.getByRole("button", { name: "닉네임과 동의 저장" }),
  ).toBeDisabled();
  await agree(page);
  await page
    .getByRole("button", { name: "닉네임과 동의 저장", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "오늘도, 가볍게 풀어볼까요?" }),
  ).toBeVisible();
});
test("member account deletion reauthenticates and removes real Auth and owned records", async ({
  page,
  request,
}) => {
  const u = await memberIdentity(request);
  await login(page, u);
  await page.getByRole("button", { name: "마이", exact: true }).click();
  await page.getByRole("button", { name: "회원 탈퇴", exact: true }).click();
  await page.getByLabel("비밀번호 재확인", { exact: true }).fill(u.password);
  await expect(
    page.getByRole("button", { name: "계정 삭제", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: "계정과 기록 삭제를 확인했어요" })
    .check();
  await page.getByRole("button", { name: "계정 삭제", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "계정과 이용 기록을 삭제",
  );
  const profile = await request.get(
    `http://127.0.0.1:8080/v1/projects/demo-jikkot/databases/(default)/documents/profiles/${u.localId}`,
    { headers: { Authorization: "Bearer owner" } },
  );
  expect(profile.status()).toBe(404);
});
test("legacy member nickname repair preserves historical records and My habits remain editable", async ({
  page,
  request,
}) => {
  const u = await memberIdentity(request);
  const headers = { Authorization: "Bearer owner" };
  const base = `http://127.0.0.1:8080/v1/projects/demo-jikkot/databases/(default)/documents`;
  expect(
    (
      await request.patch(
        `${base}/profiles/${u.localId}?updateMask.fieldPaths=nickname`,
        { headers, data: { fields: {} } },
      )
    ).status(),
  ).toBe(200);
  await page.goto("/");
  await page
    .getByRole("button", { name: "로그인 · 회원가입", exact: true })
    .click();
  await page.getByLabel("이메일", { exact: true }).fill(u.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(u.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "어떻게 불러드릴까요?" }),
  ).toBeVisible();
  await page.getByLabel("닉네임", { exact: true }).fill("보완" + u.suffix);
  await agree(page);
  await page
    .getByRole("button", { name: "닉네임과 동의 저장", exact: true })
    .click();
  await page.getByRole("button", { name: "마이", exact: true }).click();
  await page
    .getByRole("button", { name: "평소 습관 수정", exact: true })
    .click();
  await choose(page, "날개뼈를 뒤로 모으고 버텨요");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("평소 습관을 저장");
  const pref = await request.get(`${base}/personalPreferences/${u.localId}`, {
    headers,
  });
  expect(JSON.stringify(await pref.json())).toContain("retract");
});
