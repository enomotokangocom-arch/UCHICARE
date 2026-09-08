import { z } from "zod";

// 14章: CSV/Excel Import。Phase1は financial_monthly と stations から着手する (15章 T4)。

export const stationRowSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  openedAt: z.string().optional(), // "2024-01-01"
});
export type StationRow = z.infer<typeof stationRowSchema>;

export const financialMonthlyRowSchema = z.object({
  stationName: z.string().optional(), // 空欄 = 法人全体(HQ)行
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/, "yearMonthは YYYY-MM 形式で入力してください"),
  revenue: z.coerce.number(),
  laborCost: z.coerce.number(),
  otherFixedCost: z.coerce.number().optional().default(0),
  otherVariableCost: z.coerce.number().optional().default(0),
  cashBalance: z.coerce.number().optional(),
});
export type FinancialMonthlyRow = z.infer<typeof financialMonthlyRowSchema>;

export const IMPORT_ENTITIES = ["stations", "financial_monthly"] as const;
export type ImportEntity = (typeof IMPORT_ENTITIES)[number];

export const IMPORT_TEMPLATES: Record<ImportEntity, string> = {
  stations: "name,address,openedAt\n東京中央,東京都千代田区1-1-1,2020-04-01\n",
  financial_monthly:
    "stationName,yearMonth,revenue,laborCost,otherFixedCost,otherVariableCost,cashBalance\n" +
    "東京中央,2026-08,10000000,6000000,500000,300000,\n" +
    ",2026-08,0,0,1000000,0,20000000\n",
};
