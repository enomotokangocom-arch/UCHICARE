/**
 * /api/uchi-os/chat にリクエストし、ストリーミングされたテキストを逐次 onChunk に渡す。
 * コンポーネント本体の外に置くのは、react-compiler(immutability lint)が
 * コンポーネント/フック内でのローカル変数の再代入を禁止するため
 * (既存の src/lib/chatClient.ts と同じパターン)。
 */
export async function streamChatReply(message: string, onChunk: (accumulatedText: string) => void): Promise<Response> {
  const response = await fetch("/api/uchi-os/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  if (!response.ok || !response.body) {
    return response;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    accumulated += decoder.decode(value, { stream: true });
    onChunk(accumulated);
  }

  return response;
}
