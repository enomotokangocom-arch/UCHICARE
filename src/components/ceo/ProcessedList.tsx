import { Decision } from "@/lib/ceo/types";

/** 「AIが処理済み」セクション。CEOへの通知疲れを避けるため、深刻な項目のみをカード化し、
 * それ以外(green severityや優先度の低いDecision)はここに1行サマリーとして集約する。 */
export function ProcessedList({ decisions }: { decisions: Decision[] }) {
  if (decisions.length === 0) {
    return <p className="text-sm text-slate-400">現在、追加でAIが監視している項目はありません。</p>;
  }

  return (
    <ul className="divide-y divide-slate-100">
      {decisions.map((d) => (
        <li key={d.decisionId} className="flex items-center justify-between gap-3 py-2 text-sm">
          <div className="flex items-center gap-2 text-slate-600">
            <span className={d.severity === "green" ? "text-emerald-500" : "text-amber-500"}>●</span>
            <span>{d.title}</span>
          </div>
          <span className="whitespace-nowrap text-xs text-slate-400">
            {d.severity === "green" ? "異常なし・監視継続中" : "優先度低・監視継続中"}
          </span>
        </li>
      ))}
    </ul>
  );
}
