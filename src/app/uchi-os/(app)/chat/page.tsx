export default function ChatPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 text-center md:px-8">
      <p className="text-4xl">💬</p>
      <h1 className="mt-3 text-lg font-semibold text-neutral-900">AI経営参謀 Chat</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Phase3で実装予定の機能です（02-mvp-scope.md）。LLM Reasoning Layer接続後、
        「今月どう？」「一番危ない拠点は？」といった質問に、結論→根拠→数値→リスク→推奨Actionの順で
        回答します。
      </p>
    </div>
  );
}
