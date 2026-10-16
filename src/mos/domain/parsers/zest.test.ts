import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { loadFile, detectSourceType } from "../detect";
import { zestCsvFiles } from "../../testing/fixtures";
import { parseZest } from "./zest";

async function sheets(files = zestCsvFiles()) {
  const zip = zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));
  const f = await loadFile("dashboard-経営指標.zip", zip);
  if (f.kind !== "zip") throw new Error("zip ではありません");
  return { f, sheets: f.sheets };
}

describe("ZEST 経営指標", () => {
  it("見出し行で CSV を識別し、指標と内訳を読む", async () => {
    const { f, sheets: s } = await sheets();
    expect(detectSourceType("任意の名前.zip", f)).toMatchObject({ sourceType: "ZEST_METRICS_ZIP", detectedBy: "content" });
    const r = parseZest(s, "2026-08");
    expect(r.issues.filter((i) => i.severity === "ERROR")).toEqual([]);
    const m = Object.fromEntries(r.metrics.map((x) => [x.metricKey, x.value]));
    expect(m).toMatchObject({
      VISITS_PLANNED: 1500,
      VISIT_HOURS_PLANNED: 1200.5,
      USERS: 250,
      NEW_USERS: 10,
      TERMINAL_USERS: 0,
      CANCELLATIONS: 100,
      FTE: 15.5,
      "UTIL_JOB:理学療法士": 0.4,
      "UTIL_JOB:正看護師": 0.355,
      "CANCEL_REASON:入院": 60,
    });
    // 欠けている CSV は警告、使わない CSV は情報として記録
    expect(r.issues.some((i) => i.code === "METRIC_MISSING")).toBe(true);
    expect(r.issues.find((i) => i.code === "SHEET_SKIPPED")!.sheet).toContain("曜日別");
  });

  it("対象年月の指定が無ければ取込まない", async () => {
    const r = parseZest((await sheets()).sheets, null);
    expect(r.metrics).toEqual([]);
    expect(r.issues[0].code).toBe("PERIOD_REQUIRED");
  });

  it("日数が指定月と合わなければ取込まない（期間の指定ミス防止）", async () => {
    const r = parseZest((await sheets()).sheets, "2026-09");
    expect(r.metrics).toEqual([]);
    expect(r.issues[0]).toMatchObject({ code: "PERIOD_MISMATCH" });
    const ok = parseZest((await sheets(zestCsvFiles({ weekday: 20, holiday: 10 }))).sheets, "2026-09");
    expect(ok.metrics.length).toBeGreaterThan(0);
  });
});
