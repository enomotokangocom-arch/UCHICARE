import { getSession } from "@/server/uchi-os/auth/session";
import { prisma } from "@/server/uchi-os/db/client";
import { formatYearMonth } from "@/server/uchi-os/kpi-engine/dates";
import { PageHeader } from "@/components/uchi-os/PageHeader";
import { ImportUploader } from "@/components/uchi-os/import/ImportUploader";

export default async function ImportPage() {
  const session = await getSession();
  if (!session) return null;

  const batches = await prisma.dataImportBatch.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-10">
      <PageHeader title="Data Import" yearMonth={formatYearMonth(new Date())} />

      <ImportUploader />

      <div className="mt-6 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
        <p className="border-b border-neutral-200 px-5 py-3 text-sm font-semibold text-neutral-700">取り込み履歴</p>
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
              <th className="px-5 py-2 font-medium">ファイル</th>
              <th className="px-3 py-2 font-medium">種別</th>
              <th className="px-3 py-2 font-medium">状態</th>
              <th className="px-3 py-2 font-medium">件数/エラー</th>
              <th className="px-3 py-2 font-medium">日時</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-5 py-2.5 font-medium text-neutral-900">{b.fileName}</td>
                <td className="px-3 py-2.5 text-neutral-500">{b.targetEntity}</td>
                <td className="px-3 py-2.5">{b.status}</td>
                <td className="px-3 py-2.5">
                  {b.rowCount ?? "—"} / {b.errorCount ?? 0}
                </td>
                <td className="px-3 py-2.5 text-neutral-500">{b.createdAt.toLocaleString("ja-JP")}</td>
              </tr>
            ))}
            {batches.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-neutral-400">
                  取り込み履歴はまだありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
