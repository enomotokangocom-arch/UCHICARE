import { test, expect } from "@playwright/test";

/**
 * Phase1 Definition of Done (docs/uchi-os/15-phase1-plan.md 15.3) の主要項目を検証するE2E。
 * 前提: `npm run seed:uchi-os` でサンプル組織(仙台東の異常データ含む)が投入済みであること。
 */

const OWNER_EMAIL = "owner@uchi-os-demo.jp";
const OWNER_PASSWORD = "uchi-os-demo-2026";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/uchi-os/login");
  await page.fill("#email", OWNER_EMAIL);
  await page.fill("#password", OWNER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/uchi-os");
}

test("未ログイン時はCEO Morningから/loginへリダイレクトされる", async ({ page }) => {
  await page.goto("/uchi-os");
  await page.waitForURL("**/uchi-os/login**");
  await expect(page.locator("h1")).toContainText("Uchi OS");
});

test("ログイン後、CEO Morningに Health Score と異常検知カードが表示される", async ({ page }) => {
  await login(page);

  await expect(page.getByText("Uchi OS SCORE")).toBeVisible();
  await expect(page.getByText(/\/ 100/)).toBeVisible();

  // 仙台東の異常(DR-01 売上低下)がTODAYカードとして検出されていること (DoD必須項目)
  const criticalCard = page.getByText("CRITICAL").first();
  await expect(criticalCard).toBeVisible();
  await expect(page.getByText(/仙台東ステーションの月間売上が前月比.*%低下しています/)).toBeVisible();

  // 原因・予測影響・推奨Actionが表示され、FACT/CALCULATEDバッジで区別されていること (22章)
  await expect(page.getByText("主な原因").first()).toBeVisible();
  await expect(page.getByText("予測影響").first()).toBeVisible();
  await expect(page.getByText("推奨Action").first()).toBeVisible();
  await expect(page.getByText("FACT").first()).toBeVisible();
  await expect(page.getByText("CALCULATED").first()).toBeVisible();
});

test("Actionを承認すると承認済み表示に変わる", async ({ page }) => {
  await login(page);

  const approveButtons = page.getByRole("button", { name: "承認" });
  await expect(approveButtons.first()).toBeVisible();
  await approveButtons.first().click();
  await expect(page.getByText("承認済み").first()).toBeVisible({ timeout: 10_000 });
});

test("詳細を見るボタンでStation Dashboardへ遷移する", async ({ page }) => {
  await login(page);
  await page.getByText("詳細を見る", { exact: false }).first().click();
  await page.waitForURL("**/uchi-os/dashboard/station/**");
  await expect(page.getByText("Station Dashboard")).toBeVisible();
});

test("主要ダッシュボード画面に遷移できる", async ({ page }) => {
  await login(page);

  await page.goto("/uchi-os/dashboard/company");
  await expect(page.getByText("Company Dashboard")).toBeVisible();
  await expect(page.getByText("拠点別比較")).toBeVisible();

  await page.goto("/uchi-os/dashboard/financial");
  await expect(page.getByText("Financial Dashboard")).toBeVisible();

  await page.goto("/uchi-os/dashboard/workforce");
  await expect(page.getByText("Workforce Dashboard")).toBeVisible();

  await page.goto("/uchi-os/alerts");
  await expect(page.getByRole("heading", { name: "Alerts" })).toBeVisible();

  await page.goto("/uchi-os/actions");
  await expect(page.getByRole("heading", { name: "Action Center" })).toBeVisible();
});

test("375px幅でCEO Morningが横スクロールなしで表示される（DoD必須項目）", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page);
  await expect(page.getByText("Uchi OS SCORE")).toBeVisible();

  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
});
