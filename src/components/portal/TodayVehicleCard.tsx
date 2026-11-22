"use client";

import Link from "next/link";
import { usePortalStore, useCurrentStaff, useVehicleName } from "@/lib/portal/store";
import { todayString } from "@/lib/portal/util";
import { Card, StatusPill, buttonClass } from "./ui";

/** ホーム: 今日の自分の運行(運行中かどうか・記録した運行) */
export function TodayVehicleCard() {
  const current = useCurrentStaff();
  const logs = usePortalStore((s) => s.vehicleLogs);
  const vehicleName = useVehicleName();
  const today = todayString();
  const mine = logs
    .filter((l) => l.driverId === current?.id && l.date === today)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const driving = mine.find((l) => l.startTime && !l.endTime);

  return (
    <Card>
      <h2 className="text-sm font-bold text-slate-900">🚗 今日の運行</h2>
      {driving ? (
        <div className="mt-3 rounded-lg bg-amber-50 p-3">
          <StatusPill tone="warn">運行中</StatusPill>
          <p className="mt-1 text-sm font-semibold text-slate-800">{vehicleName(driving.vehicleId)}</p>
          <p className="text-xs text-slate-500">{driving.startTime} 出発 ・ 帰ったら帰着時刻とメーターを入力してください</p>
        </div>
      ) : mine.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm">
          {mine.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <span className="truncate">{vehicleName(l.vehicleId)}</span>
              <span className="whitespace-nowrap text-xs text-slate-500">
                {l.startTime}〜{l.endTime}
                {l.startOdometer !== null && l.endOdometer !== null && ` ・ ${l.endOdometer - l.startOdometer}km`}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-center text-sm font-bold text-amber-600">今日の運行記録はまだありません</p>
      )}
      <Link href={driving ? `/portal/vehicle-log?edit=${driving.id}` : "/portal/vehicle-log"} className={`${buttonClass.primary} mt-3 w-full`}>
        {driving ? "帰着を記録する" : "運行を記録する"}
      </Link>
    </Card>
  );
}
