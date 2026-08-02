import { ChatDataSummary } from "./chatBot";

export interface StreamChatReplyParams {
  messages: { role: "user" | "assistant"; text: string }[];
  summary: ChatDataSummary;
  onChunk: (accumulatedText: string) => void;
}

/**
 * /api/chat にリクエストし、ストリーミングされたテキストを逐次 onChunk に渡す。
 * 一度もチャンクを受信しなかった場合は false を返す。
 */
export async function streamChatReply({ messages, summary, onChunk }: StreamChatReplyParams): Promise<boolean> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages, summary }),
  });

  if (!response.ok || !response.body) {
    throw new Error(await response.text());
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";
  let received = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (!chunk) continue;
    accumulated += chunk;
    received = true;
    onChunk(accumulated);
  }

  return received;
}
