import { DataSourceBadge } from "@/components/uchi-os/DataSourceBadge";
import type { ForecastInterval } from "@/server/uchi-os/forecast-engine/simple-forecast";

function formatValue(value: number, kind: "yen" | "number") {
  if (kind === "yen") return `¥${Math.round(value).toLocaleString("ja-JP")}`;
  return Math.round(value).toLocaleString("ja-JP");
}

interface ForecastTileProps {
  label: string;
  horizonLabel: string;
  forecast: ForecastInterval | null;
  kind?: "yen" | "number";
}

/** 09章 Forecast Engine の出力を表示する共通タイル。予測値は常に AI ESTIMATE バッジを付与する。 */
export function ForecastTile({ label, horizonLabel, forecast, kind = "yen" }: ForecastTileProps) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-neutral-500">
          {label} ({horizonLabel})
        </p>
        <DataSourceBadge kind="AI_ESTIMATE" />
      </div>
      {forecast ? (
        <>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight text-neutral-900">
            {formatValue(forecast.value, kind)}
          </p>
          <p className="mt-0.5 text-xs text-neutral-400">
            予測区間: {formatValue(forecast.low, kind)} 〜 {formatValue(forecast.high, kind)}
          </p>
        </>
      ) : (
        <p className="mt-1.5 text-base font-normal text-neutral-400">データ不足</p>
      )}
    </div>
  );
}
