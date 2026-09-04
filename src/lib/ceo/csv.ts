import { BranchMonthlyMetric, CeoDataset, NurseProductivityRecord } from "./types";

const BRANCH_METRIC_COLUMNS: (keyof BranchMonthlyMetric)[] = [
  "branch",
  "month",
  "daysElapsed",
  "daysInMonth",
  "revenueActualMtd",
  "revenueBudget",
  "profitBudget",
  "laborCost",
  "variableCost",
  "fixedCost",
  "visitHours",
  "availableHours",
  "nurseCount",
  "currentPatients",
  "newPatients",
  "dischargedPatients",
  "hospitalizedPatients",
  "resumedPatients",
  "avgRevenuePerPatient",
  "salesActivities",
  "referrals",
  "contracts",
];

const NURSE_COLUMNS: (keyof NurseProductivityRecord)[] = [
  "nurse",
  "branch",
  "month",
  "visitProvidedHours",
  "workHours",
  "revenue",
  "visitCount",
  "workDays",
  "travelHours",
];

const NUMERIC_BRANCH_FIELDS = new Set(BRANCH_METRIC_COLUMNS.filter((c) => c !== "branch" && c !== "month"));
const NUMERIC_NURSE_FIELDS = new Set(NURSE_COLUMNS.filter((c) => c !== "nurse" && c !== "branch" && c !== "month"));

export class CsvParseError extends Error {}

/** 簡易CSVパーサ(ダブルクォート囲み・カンマエスケープに対応)。 */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function toRecords<T extends object>(
  text: string,
  expectedColumns: (keyof T)[],
  numericFields: Set<keyof T>,
  schemaLabel: string
): T[] {
  const rows = parseCsvRows(text);
  if (rows.length < 1) {
    throw new CsvParseError(`${schemaLabel}: CSVが空です。`);
  }
  const header = rows[0].map((h) => h.trim());
  const missing = expectedColumns.filter((c) => !header.includes(c as string));
  if (missing.length > 0) {
    throw new CsvParseError(`${schemaLabel}: 必須列が不足しています: ${missing.join(", ")}`);
  }

  return rows.slice(1).map((cells, rowIndex) => {
    const record = {} as T;
    expectedColumns.forEach((col) => {
      const colIndex = header.indexOf(col as string);
      const raw = (cells[colIndex] ?? "").trim();
      if (numericFields.has(col)) {
        const num = Number(raw);
        if (Number.isNaN(num)) {
          throw new CsvParseError(
            `${schemaLabel}: ${rowIndex + 2}行目の「${String(col)}」が数値として読み取れません(値: "${raw}")`
          );
        }
        (record as Record<string, unknown>)[col as string] = num;
      } else {
        (record as Record<string, unknown>)[col as string] = raw;
      }
    });
    return record;
  });
}

export function parseBranchMetricsCsv(text: string): BranchMonthlyMetric[] {
  return toRecords<BranchMonthlyMetric>(text, BRANCH_METRIC_COLUMNS, NUMERIC_BRANCH_FIELDS, "拠点別月次データ");
}

export function parseNurseProductivityCsv(text: string): NurseProductivityRecord[] {
  return toRecords<NurseProductivityRecord>(text, NURSE_COLUMNS, NUMERIC_NURSE_FIELDS, "看護師別生産性データ");
}

function toCsv<T extends object>(rows: T[], columns: (keyof T)[]): string {
  const header = columns.join(",");
  const body = rows
    .map((row) =>
      columns
        .map((col) => {
          const value = (row as Record<string, unknown>)[col as string];
          const str = String(value ?? "");
          return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
        })
        .join(",")
    )
    .join("\n");
  return `${header}\n${body}\n`;
}

export function branchMetricsToCsv(rows: BranchMonthlyMetric[]): string {
  return toCsv(rows, BRANCH_METRIC_COLUMNS);
}

export function nurseProductivityToCsv(rows: NurseProductivityRecord[]): string {
  return toCsv(rows, NURSE_COLUMNS);
}

export function datasetToSampleCsvFiles(dataset: CeoDataset): { filename: string; content: string }[] {
  return [
    { filename: "monthly_branch_metrics.csv", content: branchMetricsToCsv(dataset.branchMetrics) },
    { filename: "nurse_productivity.csv", content: nurseProductivityToCsv(dataset.nurseProductivity) },
  ];
}
