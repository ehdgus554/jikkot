import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
});
try {
  for (const width of [360, 390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    const calls = [],
      errors = [];
    page.on("request", (request) => {
      if (
        /\/api\/|identitytoolkit|securetoken|cloudfunctions|:9099|:5002/.test(
          request.url(),
        )
      )
        calls.push(request.url());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    const click = (name) =>
      page.getByRole("button", { name, exact: true }).click();
    await page.goto("http://127.0.0.1:8788/");
    await page.getByRole("heading", { name: "잠깐 움직여볼까요?" }).waitFor();
    assert.match(await page.getByRole("status").innerText(), /미리보기/);
    for (const label of [
      "비회원으로 체험하기",
      "이해하고 동의합니다",
      "루틴 시작하기",
      "앉아서만 할 수 있음",
      "다음",
      "목",
      "다음",
      "오래 앉아 있어도 자세를 자주 바꾸지 않는다",
      "다음",
      "모니터를 오래 봤다",
      "동작 추천받기",
    ])
      await click(label);
    await page
      .getByRole("button", { name: "루틴 완료", exact: true })
      .waitFor();
    assert.equal(await page.locator("main img").count(), 1);
    for (const label of ["루틴 완료", "편해졌다", "완료 화면 미리보기"])
      await click(label);
    await page.getByRole("heading", { name: "루틴을 마쳤어요" }).waitFor();
    assert.equal(
      await page.evaluate(() => localStorage.getItem("jikkot.progress.v1")),
      null,
    );
    await page.reload();
    await page.getByRole("heading", { name: "잠깐 움직여볼까요?" }).waitFor();
    await click("로그인하기");
    assert.equal(
      await page
        .getByRole("button", { name: "로그인", exact: true })
        .isDisabled(),
      true,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "구글", exact: true })
        .isDisabled(),
      true,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(calls, []);
    console.log(
      `PASS: ${width}px public questionnaire/routine/completion preview, no account/API/storage requests`,
    );
    await page.close();
  }
} finally {
  await browser.close();
}
