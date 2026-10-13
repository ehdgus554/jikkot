import { test, expect, type Page } from "@playwright/test";
import { FirestoreRest } from "../../worker/firestore-rest";
import { guestHome, seatedQuestions } from "./helpers";
async function guest(page: Page) {
  await guestHome(page);
  await seatedQuestions(page);
}
const representativePaths = [
  [
    "어깨",
    "한쪽 팔을 앞으로 뻗어 마우스나 도구를 써요",
    "한쪽 손으로 마우스나 도구를 오래 사용했어요",
    "의자를 이용한 한쪽 가슴 열기",
    4,
  ],
  [
    "어깨",
    "가슴 운동이나 물건을 미는 일을 자주 해요",
    "물건을 밀거나 가슴 운동을 했어요",
    "쇄골 아래 바깥쪽 쓸어내기 마사지",
    11,
  ],
  [
    "어깨",
    "양팔을 앞에 둔 채 오래 작업해요",
    "양팔을 앞에 두고 컴퓨터·노트북 작업을 오래 했어요",
    "앉아서 뒷짐 가슴 열기",
    7,
  ],
  [
    "머리",
    "잘 모르겠어요 / 해당하는 습관이 없어요",
    "잘 기억나지 않아요",
    "관자놀이 누르며 입 열고 닫기",
    10,
  ],
  [
    "목",
    "잘 모르겠어요 / 해당하는 습관이 없어요",
    "잘 기억나지 않아요",
    "견갑거근 대각선 스트레칭",
    3,
  ],
  [
    "등",
    "잘 모르겠어요 / 해당하는 습관이 없어요",
    "잘 기억나지 않아요",
    "팔 꼬아 앞으로 밀며 고개 숙이기",
    2,
  ],
  [
    "허리",
    "잘 모르겠어요 / 해당하는 습관이 없어요",
    "잘 기억나지 않아요",
    "Figure-4 스트레칭 + 허벅지 당기기",
    1,
  ],
] as const;
for (const [area, habit, recent, title, number] of representativePaths) {
  test(`five-area browser path ${area} -> ${number}`, async ({ page }) => {
    await guest(page);
    await page.getByRole("button", { name: area, exact: true }).click();
    await page.getByRole("button", { name: "다음", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "평소 어떤 습관이 있나요?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: habit, exact: true }).click();
    await page.getByRole("button", { name: "다음", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "최근에는 무엇을 했나요?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: recent, exact: true }).click();
    await page
      .getByRole("button", { name: "내 루틴 보기", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(page.locator(".guide-image")).toHaveCount(1);
    await expect
      .poll(() =>
        page
          .locator(".guide-image")
          .evaluate(
            (img: HTMLImageElement) =>
              img.complete && img.naturalWidth === 1536,
          ),
      )
      .toBe(true);
    const progress = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("jikkot.progress.v1")!),
    );
    expect(progress.contentVersion).toBe("jikkot11-v2-fiveareas");
    expect(progress.routineId).toBe(
      `jikkot11-r${String(number).padStart(2, "0")}`,
    );
  });
}
test("previous detailed-area questionnaire restarts at five areas without losing guest identity or consent", async ({
  page,
}) => {
  await guest(page);
  const owner = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("jikkot.progress.v1")!);
    localStorage.setItem(
      "jikkot.progress.v1",
      JSON.stringify({
        ...state,
        contentVersion: "jikkot11-v1",
        screen: "recent",
        answers: {
          mode: "seated",
          area: "front_shoulder",
          habits: ["H_ONE_FORWARD"],
          recent: ["R_ONE_HAND"],
        },
      }),
    );
    return state.owner;
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "어디가 불편한가요?" }),
  ).toBeVisible();
  expect(
    await page
      .locator(".body-hit[aria-pressed]")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("aria-label")),
      ),
  ).toEqual(["머리", "목", "어깨", "등", "허리"]);
  const progress = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("jikkot.progress.v1")!),
  );
  expect(progress.owner).toEqual(owner);
  expect(progress.guestConsent).toBe(true);
  expect(progress.answers).toEqual({ mode: "seated" });
  expect(progress.contentVersion).toBe("jikkot11-v2-fiveareas");
});
test("three questions enforce special exclusivity, reset changed profiles and immediately return a single combined-input result", async ({
  page,
}) => {
  await guest(page);
  await expect(
    page.getByRole("heading", { name: "현재 가능한 자세" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "등", exact: true }).click();
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
  await page.getByRole("button", { name: "‹ 이전", exact: true }).click();
  await page
    .getByRole("button", {
      name: "팔을 높이 들거나 멀리 뻗는 일이 많아요",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(page.locator('button[aria-pressed="true"]')).toHaveCount(0);
  await page.getByRole("button", { name: "‹ 이전", exact: true }).click();
  await page.getByRole("button", { name: "‹ 이전", exact: true }).click();
  await page.getByRole("button", { name: "어깨", exact: true }).click();
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
  await page.getByRole("button", { name: "내 루틴 보기" }).click();
  await expect(
    page.getByRole("heading", { name: "쇄골 아래 바깥쪽 쓸어내기 마사지" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "마쳤어요", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "다음", exact: true }),
  ).toHaveCount(0);
  const progress = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("jikkot.progress.v1")!),
  );
  expect(progress.contentVersion).toBe("jikkot11-v2-fiveareas");
  expect(progress.routineId).toBe("jikkot11-r11");
  await expect(page.locator("main > section")).not.toContainText(
    "한쪽 손으로 마우스나 도구를 오래 사용한 행동",
  );
});
test("unknown answers produce the approved default with variable-length instructions and a readable mobile PNG", async ({
  page,
}) => {
  await guest(page);
  await page.getByRole("button", { name: "허리", exact: true }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page
    .getByRole("button", { name: "잘 모르겠어요 / 해당하는 습관이 없어요" })
    .click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByRole("button", { name: "잘 기억나지 않아요" }).click();
  await page.getByRole("button", { name: "내 루틴 보기" }).click();
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
  await db.doc(`profiles/${user.localId}/records/${crypto.randomUUID()}`).set({
    createdAt: Date.now() + 1,
    feedback: "same",
    changes: [],
    snapshot: {
      contentVersion: "jikkot11-v1",
      area: { id: "front_shoulder", label: "어깨 앞쪽" },
      routine: {
        id: "jikkot11-r04",
        name: "의자를 이용한 한쪽 가슴 열기",
        image: "/assets/routines/routine-04-single-chest.png",
      },
      habits: [],
      recent: [],
    },
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "로그인 · 회원가입", exact: true })
    .click();
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.getByRole("button", { name: "내 기록", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "목", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("details").filter({ hasText: "어깨 올렸다 힘 빼며 내리기" }),
  ).toContainText("어깨 올렸다 힘 빼며 내리기");
  await expect(
    page.locator("details").filter({ hasText: "어깨 올렸다 힘 빼며 내리기" }),
  ).not.toContainText("견갑거근");
  await expect(
    page.getByRole("heading", { name: "어깨 앞쪽", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("details").filter({ hasText: "의자를 이용한 한쪽 가슴 열기" }),
  ).toContainText("비슷해요");
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
test("member same feedback terminates without guessing substitutes or repeating questions", async ({
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
  await page
    .getByRole("button", { name: "로그인 · 회원가입", exact: true })
    .click();
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await seatedQuestions(page);
  await page.getByRole("button", { name: "목", exact: true }).click();
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
  await page.getByRole("button", { name: "내 루틴 보기" }).click();
  await expect(
    page.getByRole("heading", { name: "견갑거근 대각선 스트레칭" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "마쳤어요", exact: true }).click();
  await page.getByRole("button", { name: "비슷해요", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "추가로 안내할 동작이 없어요",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "어디가 불편한가요?" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "기록 확인하기", exact: true })
    .click();
  await expect(page.locator("details")).toHaveCount(1);
});
