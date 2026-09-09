"use client";

import { useEffect, useRef, useState } from "react";
import { streamChatReply } from "./streamChatReply";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

const SUGGESTED_QUESTIONS = [
  "今月どう？",
  "一番危ない拠点は？",
  "採用していい？",
  "営業先はどこを優先すべき？",
];

export function ChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/uchi-os/chat/history")
      .then((r) => r.json())
      .then((body) => {
        if (Array.isArray(body.messages)) {
          setMessages(body.messages.map((m: { role: "user" | "assistant"; text: string }) => ({ role: m.role, text: m.text })));
        }
      })
      .finally(() => setHistoryLoaded(true));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || isStreaming) return;
    setError(null);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }, { role: "assistant", text: "" }]);
    setIsStreaming(true);

    try {
      const response = await streamChatReply(text, (accumulated) => {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", text: accumulated };
          return next;
        });
      });

      if (!response.ok) {
        const errorText = await response.text();
        setError(errorText || "エラーが発生しました");
        setMessages((prev) => prev.slice(0, -1));
      }
    } catch {
      setError("通信エラーが発生しました");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-3xl flex-col px-4 py-6 md:h-screen md:px-8 md:py-10">
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">AI経営参謀 Chat</h1>
        <p className="mt-1 text-xs text-neutral-400">
          結論→根拠→数値→リスク→推奨Actionの順で回答します。回答内容はAI ESTIMATEです。
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-4">
        {historyLoaded && messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-neutral-400">
            <p>質問を入力するか、下の候補から選んでください</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-sm bg-neutral-900 px-4 py-2.5 text-sm text-white"
                  : "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-violet-50 px-4 py-2.5 text-sm text-violet-950"
              }
            >
              {m.text || (isStreaming && i === messages.length - 1 ? "…" : "")}
            </div>
          </div>
        ))}
        {error && <p className="text-center text-xs text-red-600">{error}</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        className="mt-3 flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="今月どう？ 一番危ない拠点は？"
          disabled={isStreaming}
          className="flex-1 rounded-xl border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:border-neutral-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-40"
        >
          送信
        </button>
      </form>
    </div>
  );
}
