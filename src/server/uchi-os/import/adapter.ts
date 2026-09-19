import { prisma } from "@/server/uchi-os/db/client";
import { decryptSecret } from "@/server/uchi-os/security/encryption";
import { processRowsForEntity, type ImportResult } from "./importers";
import { IMPORT_ENTITIES, type ImportEntity } from "./schemas";

export class AdapterFetchError extends Error {}

/**
 * 14章 Adapter Layer: REST/JSONで外部システム(レセプト・勤怠・会計等)からデータを取得し、
 * CSV importと同じ行処理ロジック(processRowsForEntity)に通す。
 * レスポンスは行オブジェクトの配列、または { rows: [...] } のいずれかを受け付ける。
 */
async function fetchRows(connection: {
  baseUrl: string;
  authHeaderName: string | null;
  authTokenEncrypted: Uint8Array | null;
}): Promise<Record<string, unknown>[]> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (connection.authHeaderName && connection.authTokenEncrypted) {
    headers[connection.authHeaderName] = decryptSecret(Buffer.from(connection.authTokenEncrypted));
  }

  let response: Response;
  try {
    response = await fetch(connection.baseUrl, { headers });
  } catch (error) {
    throw new AdapterFetchError(`外部システムへの接続に失敗しました: ${String(error)}`);
  }
  if (!response.ok) {
    throw new AdapterFetchError(`外部システムがエラーを返しました (HTTP ${response.status})`);
  }

  const body: unknown = await response.json().catch(() => {
    throw new AdapterFetchError("外部システムの応答がJSONではありません");
  });

  const rows = Array.isArray(body) ? body : Array.isArray((body as { rows?: unknown })?.rows) ? (body as { rows: unknown[] }).rows : null;
  if (!rows) {
    throw new AdapterFetchError("外部システムの応答形式が不正です(配列、または { rows: [...] } を期待します)");
  }
  return rows as Record<string, unknown>[];
}

export async function syncExternalConnection(
  organizationId: string,
  connectionId: string,
): Promise<{ batchId: string; result: ImportResult }> {
  const connection = await prisma.externalConnection.findFirst({ where: { id: connectionId, organizationId } });
  if (!connection) throw new Error("ExternalConnectionが見つかりません");
  if (!IMPORT_ENTITIES.includes(connection.targetEntity as ImportEntity)) {
    throw new Error(`未対応のtargetEntityです: ${connection.targetEntity}`);
  }

  const batch = await prisma.dataImportBatch.create({
    data: {
      organizationId,
      externalConnectionId: connection.id,
      targetEntity: connection.targetEntity,
      fileName: `${connection.name}(REST同期)`,
      status: "PROCESSING",
    },
  });

  try {
    const rows = await fetchRows(connection);
    const result = await processRowsForEntity(organizationId, connection.targetEntity as ImportEntity, rows);

    await prisma.dataImportBatch.update({
      where: { id: batch.id },
      data: {
        status: result.errorCount > 0 ? (result.errorCount === result.rowCount ? "FAILED" : "PARTIAL") : "SUCCEEDED",
        rowCount: result.rowCount,
        errorCount: result.errorCount,
        errorDetail: result.errors,
        completedAt: new Date(),
      },
    });
    await prisma.externalConnection.update({
      where: { id: connection.id },
      data: {
        lastSyncedAt: new Date(),
        lastSyncStatus: result.errorCount > 0 ? (result.errorCount === result.rowCount ? "FAILED" : "PARTIAL") : "SUCCEEDED",
        lastSyncError: null,
      },
    });
    return { batchId: batch.id, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.dataImportBatch.update({
      where: { id: batch.id },
      data: { status: "FAILED", errorDetail: { message }, completedAt: new Date() },
    });
    await prisma.externalConnection.update({
      where: { id: connection.id },
      data: { lastSyncedAt: new Date(), lastSyncStatus: "FAILED", lastSyncError: message },
    });
    throw error;
  }
}
