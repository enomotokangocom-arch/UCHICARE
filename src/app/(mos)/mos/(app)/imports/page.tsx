import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/mos/server/auth";
import { getDb } from "@/mos/server/db";
import { SOURCE_LABEL, type SourceType } from "@/mos/domain/types";
import { ImportStatusBadge } from "@/mos/ui/Badges";
import { Card, PageHeader } from "@/mos/ui/Card";
import { dateTime, num } from "@/mos/ui/format";
import { UploadForm } from "./UploadForm";

export const metadata: Metadata = { title: "ファイル取込" };

export default async function ImportsPage() {
  await requireUser(["ADMIN", "MANAGER"]);
  const batches = await getDb().importBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { uploadedBy: { select: { name: true } } },
  });
  return (
    <>
      <PageHeader title="ファイル取込" description="iBow・ZEST・銀行・会計事務所から公式にダウンロードしたファイルを取込みます（自動ログインは行いません）" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="アップロード" className="lg:col-span-1">
          <UploadForm />
          <div className="mt-4 text-xs leading-relaxed text-slate-600">
            <p className="font-semibold">対応ファイル（種別は自動判別）</p>
            <ul className="mt-1 list-disc pl-4">
              <li>GMOあおぞらネット銀行 明細（xlsx）</li>
              <li>仙台銀行 明細（xlsx / csv）</li>
              <li>居宅売上管理表（xlsx）</li>
              <li>残高試算表 年間推移・部門別（pdf）</li>
              <li>iBow 実施報告書（Implementation.xlsx）… 実施実績。氏名・住所・年齢は取込みません</li>
              <li>ZEST 経営指標（dashboard-経営指標.zip）… 予定ベースの指標。対象年月の指定が必要です</li>
              <li>iBow 月次売上（SalesList.csv）… 利用者別の明細は保存せず、保険種類別の合計だけを取込みます</li>
            </ul>
            <p className="mt-2">同じファイルを再度取込んでもデータは重複しません。</p>
          </div>
        </Card>
        <Card title="取込履歴" className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-1 text-left">日時</th>
                  <th className="text-left">ファイル</th>
                  <th className="text-left">種別</th>
                  <th className="text-left">結果</th>
                  <th className="text-right">取込</th>
                  <th className="text-right">重複</th>
                  <th className="text-right">保留</th>
                  <th className="text-right">エラー</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-t border-slate-100">
                    <td className="py-1.5 whitespace-nowrap text-xs">{dateTime(b.createdAt)}</td>
                    <td className="max-w-[220px] truncate">
                      <Link href={`/mos/imports/${b.id}`} className="text-teal-700 underline">
                        {b.fileName}
                      </Link>
                      {b.origin === "SAMPLE" && <span className="ml-1 rounded bg-violet-100 px-1 text-[10px] text-violet-800">サンプル</span>}
                    </td>
                    <td className="text-xs">{SOURCE_LABEL[b.sourceType as SourceType]}</td>
                    <td>
                      <ImportStatusBadge status={b.status} />
                    </td>
                    <td className="text-right tabular-nums">{num(b.importedRows)}</td>
                    <td className="text-right tabular-nums">{num(b.duplicateRows)}</td>
                    <td className="text-right tabular-nums">{num(b.heldRows)}</td>
                    <td className={`text-right tabular-nums ${b.errorCount ? "font-semibold text-red-700" : ""}`}>{num(b.errorCount)}</td>
                  </tr>
                ))}
                {batches.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-4 text-center text-slate-500">
                      取込履歴はまだありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
