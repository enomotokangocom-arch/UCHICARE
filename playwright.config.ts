import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    launchOptions: {
      executablePath: "/opt/pw-browsers/chromium",
      args: ["--no-sandbox"],
    },
  },
  // モバイル幅の検証は「375px幅でCEO Morningが...」テスト内でsetViewportSizeにより行う。
  // iPhoneデバイスエミュレーション(isMobile:true)はサンドボックス環境のChromiumで
  // 安定して起動しないため、単一のdesktopプロジェクトのみを使用する。
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
