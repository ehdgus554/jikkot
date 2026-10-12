import { test, expect, type Page } from "@playwright/test";
import { FirestoreRest } from "../../worker/firestore-rest";
async function guest(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "비회원으로 체험하기" }).click();
  await page.getByRole("button", { name: "이해하고 동의합니다" }).click();
  await page.getByRole("button", { name: "루틴 시작하기" }).click();
  await expect(
    page.getByRole("heading", { name: "어디가 불편한가요?" }),
  ).toBeVisible();
}
test("three questions enforce special exclusivity, reset changed profiles and immediately return a single combined-input result", async ({
  page,
}) => {
  await guest(page);
  await expect(
    page.getByRole("heading", { name: "현재 가능한 자세" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "날개뼈 사이", exact: true }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  const pinch = page.getByRole("button", {
    name: "등을 펴려고 날개뼈를 모으고 힘을 줘요",
  });
  const unknown = page.getByRole("button", {
    name: "잘 모르겠어요 / 해당하는 습관이 없어요",
  });
  await pinch.click();
  await unknown.click();
  await expect(pinch).toHaveAttribute("aria-pressed", "false");
  await pinch.click();
  await expect(unknown).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "높은 곳을 정리하거나 팔을 위로·멀리 뻗는 일을 했어요",
    }),
  ).toBeVisible();
  const computer = page.getByRole("button", {
    name: "양팔을 앞에 두고 컴퓨터·노트북 작업을 오래 했어요",
  });
  const none = page.getByRole("button", { name: "특별히 한 행동이 없어요" });
  const forgotten = page.getByRole("button", { name: "잘 기억나지 않아요" });
  await computer.click();
  await none.click();
  await expect(computer).toHaveAttribute("aria-pressed", "false");
  await forgotten.click();
  await expect(none).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "이전", exact: true }).click();
  await page.getByRole("button", { name: "이전", exact: true }).click();
  await page.getByRole("button", { name: "어깨 앞쪽", exact: true }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(page.locator('button[aria-pressed="true"]')).toHaveCount(0);
  await page
    .getByRole("button", { name: "가슴 운동이나 물건을 미는 일을 자주 해요" })
    .click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(page.locator('button[aria-pressed="true"]')).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "한쪽 손으로 마우스나 도구를 오래 사용했어요",
    })
    .click();
  await page
    .getByRole("button", { name: "물건을 밀거나 가슴 운동을 했어요" })
    .click();
  await page.getByRole("button", { name: "동작 추천받기" }).click();
  await expect(
    page.getByRole("heading", { name: "쇄골 아래 바깥쪽 쓸어내기 마사지" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "루틴 완료", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "다음", exact: true }),
  ).toHaveCount(0);
  const progress = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("jikkot.progress.v1")!),
  );
  expect(progress.contentVersion).toBe("jikkot11-v1");
  expect(progress.routineId).toBe("jikkot11-r11");
  await expect(page.locator("main > section")).not.toContainText(
    "한쪽 손으로 마우스나 도구를 오래 사용한 행동",
  );
});
test("unknown answers produce the approved default with variable-length instructions and a readable mobile PNG", async ({
  page,
}) => {
  await guest(page);
  await page.getByRole("button", { name: "허리 아래쪽", exact: true }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page
    .getByRole("button", { name: "잘 모르겠어요 / 해당하는 습관이 없어요" })
    .click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByRole("button", { name: "잘 기억나지 않아요" }).click();
  await page.getByRole("button", { name: "동작 추천받기" }).click();
  await expect(
    page.getByRole("heading", { name: "Figure-4 스트레칭 + 허벅지 당기기" }),
  ).toBeVisible();
  await expect(page.locator("article ol li")).toHaveCount(3);
  const image = page.getByRole("img", {
    name: "Figure-4 스트레칭 + 허벅지 당기기 동작 안내",
    exact: true,
  });
  await expect(image).toBeVisible();
  await expect
    .poll(() =>
      image.evaluate(
        (node: HTMLImageElement) => node.complete && node.naturalWidth > 0,
      ),
    )
    .toBe(true);
  expect(await image.evaluate((node) => getComputedStyle(node).objectFit)).toBe(
    "contain",
  );
  await page.getByRole("button", { name: "안내 이미지 확대" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Figure-4 스트레칭 + 허벅지 당기기",
  );
  await page.keyboard.press("Escape");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("legacy MV snapshots remain visible under their original area and name", async ({
  page,
  request,
}) => {
  const suffix = crypto.randomUUID().slice(0, 8),
    email = `history-${suffix}@example.test`,
    password = crypto.randomUUID();
  const user = await (
    await request.post(
      "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key",
      { data: { email, password, returnSecureToken: true } },
    )
  ).json();
  const response = await request.post("http://127.0.0.1:5002/api/signup", {
    headers: { Authorization: `Bearer ${user.idToken}` },
    data: {
      username: "old_" + suffix,
      nickname: "old_" + suffix,
      consents: { privacy: true, nonMedical: true, version: "draft-v1" },
    },
  });
  expect(response.status()).toBe(200);
  const db = new FirestoreRest(
    { FIREBASE_PROJECT_ID: "demo-jikkot" },
    "http://127.0.0.1:8080",
  );
  await db.doc(`profiles/${user.localId}/records/${crypto.randomUUID()}`).set({
    createdAt: Date.now(),
    feedback: "better",
    changes: [],
    snapshot: {
      contentVersion: "mvp-9.1-adapter-v1",
      area: { id: "NECK", label: "목" },
      routine: {
        id: "MV009",
        name: "어깨 올렸다 힘 빼며 내리기",
        image: "/assets/routines/R11.webp",
      },
      habits: [],
      recent: [],
    },
  });
  await page.goto("/");
  await page.getByRole("button", { name: "로그인하기", exact: true }).click();
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.getByRole("button", { name: "기록 확인", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "목", exact: true }),
  ).toBeVisible();
  await expect(page.locator("article")).toContainText(
    "어깨 올렸다 힘 빼며 내리기",
  );
  await expect(page.locator("article")).not.toContainText("견갑거근");
});
test("all eleven approved PNG routes return original images without aliases or external URLs", async ({
  request,
}) => {
  const { readFile } = await import("node:fs/promises");
  const manifest = JSON.parse(
    await readFile("docs/jikkot11-image-manifest.json", "utf8"),
  ) as { target: string; sha256: string }[];
  const { createHash } = await import("node:crypto");
  for (const image of manifest) {
    const response = await request.get(image.target);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
    expect(
      createHash("sha256")
        .update(await response.body())
        .digest("hex"),
    ).toBe(image.sha256);
  }
});
test("member feedback follows approved same-area alternatives without repeated moves or extra questions", async ({
  page,
  request,
}) => {
  const suffix = crypto.randomUUID().slice(0, 8),
    email = `chain-${suffix}@example.test`,
    password = crypto.randomUUID();
  const user = await (
    await request.post(
      "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key",
      { data: { email, password, returnSecureToken: true } },
    )
  ).json();
  expect(
    (
      await request.post("http://127.0.0.1:5002/api/signup", {
        headers: { Authorization: `Bearer ${user.idToken}` },
        data: {
          username: "chain_" + suffix,
          nickname: "chain_" + suffix,
          consents: { privacy: true, nonMedical: true, version: "draft-v1" },
        },
      })
    ).status(),
  ).toBe(200);
  await page.goto("/");
  await page.getByRole("button", { name: "로그인하기", exact: true }).click();
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.getByRole("button", { name: "루틴 시작하기" }).click();
  await page
    .getByRole("button", { name: "목·승모근 주변", exact: true })
    .click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page
    .getByRole("button", { name: "일할 때 어깨에 힘이 들어가거나 올라가요" })
    .click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page
    .getByRole("button", {
      name: "고개를 한쪽으로 돌리거나 같은 방향으로 오래 두었어요",
    })
    .click();
  await page
    .getByRole("button", { name: "물건을 들거나 팔을 든 채 오래 버텼어요" })
    .click();
  await page.getByRole("button", { name: "동작 추천받기" }).click();
  await expect(
    page.getByRole("heading", { name: "견갑거근 대각선 스트레칭" }),
  ).toBeVisible();
  for (const [feedback, title] of [
    ["비슷하다", "앉아서 손깍지 끼고 팔 뒤로 뻗기"],
    ["더 불편하다", "앉아서 뒷짐 가슴 열기"],
    ["비슷하다", "추가 추천이 없습니다"],
  ]) {
    await page.getByRole("button", { name: "루틴 완료", exact: true }).click();
    await page.getByRole("button", { name: feedback, exact: true }).click();
    await page
      .getByRole("button", { name: "피드백 저장", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "어디가 불편한가요?" }),
    ).toHaveCount(0);
  }
});
