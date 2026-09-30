"use client";

import { useCallback, useEffect, useState } from "react";
import { currentLocation, goTo } from "./nav";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api/onboarding${path}`, {
    method: opts.method ?? "GET",
    headers: opts.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* 空応答 */
  }
  if (res.status === 401 && typeof window !== "undefined" && !currentLocation().startsWith("/onboarding/login")) {
    goTo("/onboarding/login?next=" + encodeURIComponent(currentLocation()));
  }
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string })?.error ?? "エラーが発生しました。");
  return data as T;
}

/** GETしてstateに保持し、reload() で再取得する */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await api<T>(path));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);
  return { data, error, loading, reload, setData };
}

export type Me = {
  actor: { id: number; name: string; login_id: string; role: "admin" | "preparer" | "issuer" | "viewer"; is_representative: boolean };
  mode: string | null;
};

export type Options = {
  departments: { id: number; code: string; name: string }[];
  offices: { id: number; name: string; department_id: number | null; active: number }[];
  jobTypes: { id: number; name: string; active: number }[];
  users: { id: number; name: string; role: string; is_representative: number }[];
  services: { id: number; name: string; active: number }[];
  companyGoogle: string | null;
};

export function fmtDate(v: unknown): string {
  if (!v) return "";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.replace(/-/g, "/");
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function todayLocal(): string {
  const d = new Date(Date.now() + 9 * 3600e3);
  return d.toISOString().slice(0, 10);
}
