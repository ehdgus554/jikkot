import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const click = async (name) =>
  page.getByRole("button", { name, exact: true }).click();
try {
  await page.goto("http://127.0.0.1:8787");
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
  await page.getByRole("button", { name: "루틴 완료", exact: true }).waitFor();
  const media = await page
    .locator("main img")
    .evaluate((n) => ({
      loaded: n.complete && n.naturalWidth > 0,
      source: n.getAttribute("src"),
    }));
  if (!media.loaded) throw new Error("Worker asset not loaded");
  await page.screenshot({
    path: "/tmp/jikkot-worker-routine-390.png",
    fullPage: true,
  });
  for (const label of ["루틴 완료", "편해졌다", "피드백 저장"])
    await click(label);
  await page.getByRole("heading", { name: "루틴을 마쳤어요" }).waitFor();
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    JSON.stringify({
      runtime: "Cloudflare local workerd",
      auth: "anonymous demo Auth",
      api: "Spark local recommendation and feedback saved",
      media,
      pageErrors: errors,
    }),
  );
  const guard = await page.request.get("http://127.0.0.1:8787/api/health");
  if (guard.status() !== 503) throw new Error("Missing server credential guard failed");
  console.log("PASS: Worker data API without server credential fails closed (503)");
} finally {
  await browser.close();
}
