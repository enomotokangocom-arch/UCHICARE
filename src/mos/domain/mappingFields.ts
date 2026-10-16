// 列マッピングの項目定義（クライアントからも読むため Node 依存を持たない）
import type { BusinessUnit, JobType } from "./types";

export type MappingPurpose = "SALES" | "VISITS" | "METRICS";


export type FieldDef = { key: string; label: string; required?: boolean; idField?: boolean; valueMap?: string };

export const METRIC_KEYS: { key: string; label: string }[] = [
  { key: "VISITS_PLANNED", label: "訪問予定件数" },
  { key: "VISITS_DONE", label: "訪問実施件数" },
  { key: "VISITS_CANCELLED", label: "キャンセル件数" },
  { key: "USERS", label: "利用者数" },
  { key: "NEW_USERS", label: "新規利用者数" },
  { key: "ENDED_USERS", label: "終了利用者数" },
];

export const PURPOSE_FIELDS: Record<MappingPurpose, FieldDef[]> = {
  SALES: [
    { key: "yearMonth", label: "対象年月", required: true },
    { key: "amount", label: "売上金額（請求額）", required: true },
    { key: "quantity", label: "件数" },
    { key: "unit", label: "事業所", valueMap: "unit" },
  ],
  VISITS: [
    { key: "visitDate", label: "訪問日", required: true },
    { key: "staffId", label: "職員ID（ハッシュ化）", idField: true },
    { key: "jobType", label: "職種", valueMap: "jobType" },
    { key: "subjectId", label: "利用者ID（ハッシュ化）", idField: true },
    { key: "minutes", label: "提供時間（分）" },
    { key: "status", label: "状態（実施・キャンセル等）", valueMap: "status" },
    { key: "unit", label: "事業所", valueMap: "unit" },
  ],
  METRICS: [
    { key: "yearMonth", label: "対象年月", required: true },
    { key: "unit", label: "事業所", valueMap: "unit" },
    ...METRIC_KEYS.map((m) => ({ key: `metric:${m.key}`, label: `指標: ${m.label}` })),
  ],
};

export type VisitStatusValue = "DONE" | "PLANNED" | "CANCELLED";

export type ColumnMappingSpec = {
  purpose: MappingPurpose;
  /** 列名 → 項目キー（未指定の列は読まない） */
  fields: Record<string, string>;
  valueMaps: {
    status?: Record<string, VisitStatusValue>;
    jobType?: Record<string, JobType>;
    unit?: Record<string, BusinessUnit>;
  };
};

