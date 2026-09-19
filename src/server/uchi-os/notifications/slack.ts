// Phase4 通知・自動化: Slack Incoming Webhookへメッセージを送るだけの薄いラッパー。
// AI client(ai/client.ts)と同じ方針: 通知の失敗でAlert Engine本体の処理を止めてはいけないため、例外を投げない。
export async function postSlackMessage(webhookUrl: string, text: string): Promise<void> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) {
      console.error(`[uchi-os] Slack webhook returned HTTP ${response.status}`);
    }
  } catch (error) {
    console.error("[uchi-os] Slack webhook request failed:", error);
  }
}
