import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/mos/server/auth";
import { getDb } from "@/mos/server/db";
import { SOURCE_LABEL, type SourceType } from "@/mos/domain/types";
import { ImportStatusBadge } from "@/mos/ui/Badges";
import { Card, PageHeader } from "@/mos/ui/Card";
import { dateTime, num } from "@/mos/ui/format";

export const metadata: Metadata = { title: "取込詳細" };

const SEVERITY = { ERROR: "エラー", WARNING: "警告", INFO: "情報" } as const;

export default async function ImportDetailPage(props: PageProps<"/mos/imports/[id]">) {
  await requireUser(["ADMIN", "MANAGER"]);
  const { id } = await props.params;
  const db = getDb();
  const batch = await db.importBatch.findUnique({
    where: { id },
    include: { issues: { orderBy: [{ severity: "asc" }, { rowNumber: "asc" }] }, uploadedBy: { select: { name: true } } },
  });
  if (!batch) notFound();

  return (
    <>
      <PageHeader title="取込詳細" description={batch.fileName}>
        <Link href="/mos/imports" className="text-sm text-teal-700 underline">
          取込履歴へ戻る
        </Link>
      </PageHeader>
      <Card>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-slate-500">結果</dt>
            <dd>
              <ImportStatusBadge status={batch.status} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">種別</dt>
            <dd>{SOURCE_LABEL[batch.sourceType as SourceType]}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">取込日時・実行者</dt>
            <dd>
              {dateTime(batch.createdAt)}・{batch.uploadedBy?.name ?? "システム"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">対象期間</dt>
            <dd>{batch.periodStart ? `${batch.periodStart} 〜 ${batch.periodEnd}` : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">行数</dt>
            <dd>{num(batch.totalRows)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">取込 / 重複スキップ / 保留</dt>
            <dd>
              {num(batch.importedRows)} / {num(batch.duplicateRows)} / {num(batch.heldRows)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">データ区分</dt>
            <dd>{batch.origin === "SAMPLE" ? "サンプル" : "実データ"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">ファイルの SHA-256</dt>
            <dd className="truncate font-mono text-xs" title={batch.sha256}>
              {batch.sha256.slice(0, 16)}…
            </dd>
          </div>
        </dl>
        {batch.duplicateOfId && (
          <p className="mt-3 text-sm">
            同じファイルの取込:{" "}
            <Link href={`/mos/imports/${batch.duplicateOfId}`} className="text-teal-700 underline">
              元の取込
            </Link>
          </p>
        )}
      </Card>

      <div className="mt-4">
        <Card title={`エラーログ・メッセージ（${batch.issues.length}件）`}>
          {batch.issues.length === 0 ? (
            <p className="text-sm text-slate-600">メッセージはありません。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="py-1 text-left">区分</th>
                    <th className="text-left">シート</th>
                    <th className="text-right">行</th>
                    <th className="text-left">列</th>
                    <th className="text-left">内容</th>
                  </tr>
                </thead>
                <tbody>
                  {batch.issues.map((i) => (
                    <tr key={i.id} className="border-t border-slate-100 align-top">
                      <td className={`py-1.5 whitespace-nowrap ${i.severity === "ERROR" ? "font-semibold text-red-700" : i.severity === "WARNING" ? "text-amber-700" : "text-slate-600"}`}>
                        {SEVERITY[i.severity]}
                      </td>
                      <td>{i.sheet ?? "—"}</td>
                      <td className="text-right">{i.rowNumber ?? "—"}</td>
                      <td>{i.column ?? "—"}</td>
                      <td>{i.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
