"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useHealthDataStore } from "@/lib/store";
import { ChatMessage, generateCannedReply, SUGGESTED_PROMPTS } from "@/lib/chatBot";

const INITIAL_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  text:
    "こんにちは。UCHICARE 健康経営アシスタントです。労働環境・ストレス・腰痛・介護の各データをもとに、御社の課題のキャッチアップをお手伝いします。下の候補質問か、自由に質問を入力してください。",
};

export default function ChatPage() {
  const submissions = useHealthDataStore((s) => s.submissions);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", text: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    const replyText = generateCannedReply(trimmed, submissions);
    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", text: replyText },
      ]);
      setIsTyping(false);
    }, 700);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <div className="mx-auto flex h-screen max-w-3xl flex-col px-6 py-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-900">企業課題チャット</h1>
        <p className="mt-1 text-sm text-slate-500">
          健康経営データをもとに企業課題をキャッチアップします(現在は簡易応答のプロトタイプです)
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {messages.map((message) => (
          <ChatBubble key={message.id} message={message} />
        ))}
        {isTyping && (
          <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-3 w-fit">
            <TypingDot delay="0ms" />
            <TypingDot delay="150ms" />
            <TypingDot delay="300ms" />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => sendMessage(prompt)}
            disabled={isTyping}
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-teal-400 hover:text-teal-700 disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="質問を入力してください(例: 腰痛リスクが高い部署は?)"
          className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={isTyping || !input.trim()}
          className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
        >
          送信
        </button>
      </form>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "rounded-br-sm bg-teal-600 text-white"
            : "rounded-bl-sm bg-slate-100 text-slate-800"
        }`}
      >
        {message.text}
      </div>
    </div>
  );
}

function TypingDot({ delay }: { delay: string }) {
  return (
    <span
      className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
      style={{ animationDelay: delay }}
    />
  );
}
