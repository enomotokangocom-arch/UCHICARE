import { test, expect } from "@playwright/test";

/**
 * Phase2 (Alert Engine本実装・20 Decision Rules・Action Center状態遷移) のE2E。
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

test("Alertsに複数ルールが表示され、確認ボタンでACKNOWLEDGEDに遷移する", async ({ page }) => {
  await login(page);
  await page.goto("/uchi-os/alerts");

  await expect(page.getByText("DR-01").first()).toBeVisible();
  await expect(page.getByText("DR-04").first()).toBeVisible();

  const confirmButtons = page.getByRole("button", { name: "確認" });
  const count = await confirmButtons.count();
  expect(count).toBeGreaterThan(0);
  await confirmButtons.first().click();
  await expect(page.getByText("確認済み").first()).toBeVisible({ timeout: 10_000 });
});

test("Action Centerでステータスタブとフィルタが機能する", async ({ page }) => {
  await login(page);
  await page.goto("/uchi-os/actions");
  await expect(page.getByRole("heading", { name: "Action Center" })).toBeVisible();

  await page.getByRole("link", { name: "AI提案" }).click();
  await page.waitForURL("**/uchi-os/actions?status=AI_RECOMMENDED**");
  await expect(page.getByText("AI提案").first()).toBeVisible();
});

test("Actionを却下すると却下ラベルに変わる", async ({ page }) => {
  await login(page);
  await page.goto("/uchi-os/actions?status=AI_RECOMMENDED");

  const rejectButtons = page.getByRole("button", { name: "却下" });
  await expect(rejectButtons.first()).toBeVisible();
  await rejectButtons.first().click();
  await page.goto("/uchi-os/actions?status=REJECTED");
  await expect(page.getByText("却下").first()).toBeVisible();
});

test("Settingsで閾値を編集して保存できる", async ({ page }) => {
  await login(page);
  await page.goto("/uchi-os/settings");
  await expect(page.getByText("Decision Rule 閾値")).toBeVisible();

  const input = page.locator('input[type="number"]').first();
  await input.fill("-6");
  await page.getByRole("button", { name: "保存" }).first().click();
  await expect(page.getByText(/を保存しました/)).toBeVisible({ timeout: 10_000 });
});

test("AI Decisionsで却下できる", async ({ page }) => {
  await login(page);
  await page.goto("/uchi-os/decisions");
  await expect(page.getByRole("heading", { name: "AI Decisions" })).toBeVisible();

  const dismissButtons = page.getByRole("button", { name: "却下する" });
  const count = await dismissButtons.count();
  if (count > 0) {
    await dismissButtons.first().click();
    await expect(page.getByText("DISMISSED").first()).toBeVisible({ timeout: 10_000 });
  }
});
