export function newId(prefix = "id"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayString(): string {
  return toDateString(new Date());
}

export function nowTimeString(): string {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function nowIsoLocal(): string {
  const d = new Date();
  return `${toDateString(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toDateString(d);
}

export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const result = new Date(y, m - 1 + months, d);
  return toDateString(result);
}

export function formatDate(date: string): string {
  if (!date) return "";
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  const wd = "日月火水木金土"[new Date(y, m - 1, d).getDay()];
  return `${y}/${m}/${d}(${wd})`;
}

export function formatDateTime(iso: string): string {
  if (!iso) return "";
  return `${formatDate(iso.slice(0, 10))} ${iso.slice(11, 16)}`;
}

/** Excelで文字化けしないよう BOM 付きの CSV をダウンロードする */
export function downloadCsv(filename: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const escape = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [header, ...rows].map((r) => r.map(escape).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
