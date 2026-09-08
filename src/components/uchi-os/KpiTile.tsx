import { DataSourceBadge, type DataSourceKind } from "@/components/uchi-os/DataSourceBadge";

interface KpiTileProps {
  label: string;
  formatted: string;
  insufficientData?: boolean;
  kind?: DataSourceKind;
}

export function KpiTile({ label, formatted, insufficientData, kind = "CALCULATED" }: KpiTileProps) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-neutral-500">{label}</p>
        <DataSourceBadge kind={kind} />
      </div>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-neutral-900">
        {insufficientData ? <span className="text-base font-normal text-neutral-400">データ不足</span> : formatted}
      </p>
    </div>
  );
}
