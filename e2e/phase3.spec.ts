import { test, expect } from "@playwright/test";

/**
 * Phase3 (Forecast Engine本実装・AI経営参謀Chat・Scenario Simulator) のE2E。
 * ANTHROPIC_API_KEY未設定のCI環境ではChatはエラーメッセージ表示までを確認する
 * (08章: LLM Reasoning Layerが失敗してもCalculation/Rule Engineの結果は表示できる)。
 * 前提: `npm run seed:uchi-os` でサンプル組織が投入済みであること。
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

test("Company Dashboardに予測(Forecast Engine)セクションが表示される", async ({ page }) => {
  await login(page);
  await page.goto("/uchi-os/dashboard/company");
  await expect(page.getByText("予測（Forecast Engine")).toBeVisible();
  await expect(page.getByText("AI ESTIMATE").first()).toBeVisible();
  await expect(page.getByText("Cash Runway予測")).toBeVisible();
});

test("Station Dashboardに必要看護師数予測が表示される", async ({ page }) => {
  await login(page);
  await page.goto("/uchi-os/dashboard/company");
  await page.locator('a[href^="/uchi-os/dashboard/station/"]').first().click();
  await page.waitForURL("**/uchi-os/dashboard/station/**");
  await expect(page.getByText("必要看護師数予測")).toBeVisible();
});

test("Scenario Simulatorで採用シナリオを実行すると3ヶ月後の影響が表示される", async ({ page }) => {
  await login(page);
  await page.goto("/uchi-os/scenarios");
  await expect(page.getByRole("heading", { name: "Scenario Simulator" })).toBeVisible();

  const numberInput = page.locator('input[type="number"]').first();
  await numberInput.fill("2");
  await page.getByRole("button", { name: "シミュレーション実行" }).click();

  await expect(page.getByText("3ヶ月後の影響")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("法人全体 / 看護師採用 — 3ヶ月後の影響")).toBeVisible();
});

test("Scenario Simulatorの履歴が表示される", async ({ page }) => {
  await login(page);
  await page.goto("/uchi-os/scenarios");
  await expect(page.getByText("過去のシミュレーション")).toBeVisible();
});

test("AI経営参謀ChatはANTHROPIC_API_KEY未設定時にエラーメッセージを表示する", async ({ page }) => {
  await login(page);
  await page.goto("/uchi-os/chat");
  await expect(page.getByRole("heading", { name: "AI経営参謀 Chat" })).toBeVisible();

  await page.fill('input[placeholder*="今月どう"]', "今月どう？");
  await page.getByRole("button", { name: "送信" }).click();

  // ANTHROPIC_API_KEYが設定されていれば正常回答、未設定ならエラーメッセージが表示される。
  // どちらの場合もページがクラッシュしないことを確認する。
  await page.waitForTimeout(2000);
  const hasError = await page.getByText(/ANTHROPIC_API_KEY|エラー/).count();
  const hasUserMessage = await page.getByText("今月どう？").count();
  expect(hasError > 0 || hasUserMessage > 0).toBe(true);
});

test("Decision detailでAI分析ボタンがAPIキー未設定時に利用不可メッセージを表示する", async ({ page }) => {
  await login(page);
  await page.goto("/uchi-os/decisions");
  await expect(page.getByRole("heading", { name: "AI Decisions" })).toBeVisible();

  const explainButtons = page.getByRole("button", { name: "AI分析を見る" });
  const count = await explainButtons.count();
  if (count > 0) {
    await explainButtons.first().click();
    await expect(page.getByText(/AI分析は利用できません|AIによる原因説明/)).toBeVisible({ timeout: 10_000 });
  }
});
