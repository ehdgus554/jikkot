import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";

const site = process.env.JIKKOT_SITE_URL ?? "http://127.0.0.1:8788";
const cases = [
  ["어깨", "한쪽 팔을 앞으로 뻗어 마우스나 도구를 써요", "한쪽 손으로 마우스나 도구를 오래 사용했어요", "의자를 이용한 한쪽 가슴 열기", 4],
  ["어깨", "가슴 운동이나 물건을 미는 일을 자주 해요", "물건을 밀거나 가슴 운동을 했어요", "쇄골 아래 바깥쪽 쓸어내기 마사지", 11],
  ["어깨", "양팔을 앞에 둔 채 오래 작업해요", "양팔을 앞에 두고 컴퓨터·노트북 작업을 오래 했어요", "앉아서 뒷짐 가슴 열기", 7],
  ["머리", null, null, "관자놀이 누르며 입 열고 닫기", 10],
  ["목", null, null, "견갑거근 대각선 스트레칭", 3],
  ["등", null, null, "팔 꼬아 앞으로 밀며 고개 숙이기", 2],
  ["허리", null, null, "Figure-4 스트레칭 + 허벅지 당기기", 1],
];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
try {
  const images = JSON.parse(await readFile("docs/jikkot11-image-manifest.json", "utf8"));
  const context = await browser.newContext();
  for (const image of images) {
    const response = await context.request.get(new URL(image.target, site).href);
    assert.equal(response.status(), 200, image.target);
    assert.match(response.headers()["content-type"], /image\/png/);
    assert.equal(createHash("sha256").update(await response.body()).digest("hex"), image.sha256);
  }
  console.log(`PASS: ${site}, original PNG routes 11/11 HTTP 200 and SHA-256 match`);
  await context.close();
  for (const width of [360, 390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const [area, habit, recent, title, number] of cases) {
      const click = (name) => page.getByRole("button", { name, exact: true }).click();
      const response = await page.goto(site);
      assert.equal(response.status(), 200);
      for (const label of ["비회원으로 체험하기", "이해하고 동의합니다", "루틴 시작하기"]) await click(label);
      await page.getByRole("heading", { name: "어디가 불편한가요?", exact: true }).waitFor();
      assert.deepEqual(await page.locator("button[aria-pressed]").allTextContents(), ["머리", "목", "어깨", "등", "허리"]);
      for (const label of [area, "다음", habit ?? "잘 모르겠어요 / 해당하는 습관이 없어요", "다음", recent ?? "잘 기억나지 않아요", "동작 추천받기"]) await click(label);
      await page.getByRole("heading", { name: title, exact: true }).waitFor();
      assert.equal(await page.locator("main img").count(), 1);
      await page.waitForFunction(() => {
        const image = document.querySelector("main img");
        return image?.complete && image.naturalWidth === 1536;
      });
      assert.equal(await page.locator("main img").evaluate((image) => getComputedStyle(image).objectFit), "contain");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.getByRole("button", { name: "다음", exact: true }).count().then((count) => assert.equal(count, 0));
      console.log(`PASS: ${site}, ${width}px ${area} -> routine ${number}, exactly three questions, native PNG`);
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
} finally {
  await browser.close();
}
