"use client";

import clsx from "clsx";
import { ReactNode, useState } from "react";
import { HIRE_STATUS_LABELS, HireStatus, TASK_STATUS_LABELS, TaskStatus } from "../shared/labels";

export function Card({ title, children, actions, className, id }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={clsx("rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:break-inside-avoid print:shadow-none", className)}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base font-bold text-slate-900">{title}</h2>}
          {actions && <div className="flex flex-wrap gap-2 print:hidden">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost"; size?: "sm" | "md" };
export function Button({ variant = "primary", size = "md", className, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 print:hidden",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-4 py-2 text-sm",
        variant === "primary" && "bg-teal-600 text-white hover:bg-teal-700",
        variant === "secondary" && "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
        variant === "danger" && "border border-rose-300 bg-white text-rose-700 hover:bg-rose-50",
        variant === "ghost" && "text-teal-700 hover:bg-teal-50",
        className,
      )}
    />
  );
}

const TASK_COLORS: Record<TaskStatus, string> = {
  todo: "bg-slate-100 text-slate-700",
  doing: "bg-sky-100 text-sky-800",
  waiting_issue: "bg-amber-100 text-amber-800",
  waiting_check: "bg-violet-100 text-violet-800",
  done: "bg-emerald-100 text-emerald-800",
  na: "bg-slate-200 text-slate-500",
};
export function TaskBadge({ status }: { status: string }) {
  return <span className={clsx("inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold", TASK_COLORS[status as TaskStatus])}>{TASK_STATUS_LABELS[status as TaskStatus] ?? status}</span>;
}

const HIRE_COLORS: Record<HireStatus, string> = {
  preparing: "bg-sky-100 text-sky-800",
  ready: "bg-violet-100 text-violet-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  lent: "bg-teal-700 text-white",
};
export function HireBadge({ status }: { status: string }) {
  return <span className={clsx("inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", HIRE_COLORS[status as HireStatus])}>{HIRE_STATUS_LABELS[status as HireStatus] ?? status}</span>;
}

export function Tag({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "amber" | "rose" | "teal" | "violet" | "sky" }) {
  const map = {
    slate: "bg-slate-100 text-slate-600", amber: "bg-amber-100 text-amber-800", rose: "bg-rose-100 text-rose-700",
    teal: "bg-teal-100 text-teal-800", violet: "bg-violet-100 text-violet-800", sky: "bg-sky-100 text-sky-800",
  };
  return <span className={clsx("inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold", map[tone])}>{children}</span>;
}

export function Unset({ children = "未設定" }: { children?: ReactNode }) {
  return <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">{children}</span>;
}

export function Field({ label, children, hint, required }: { label: string; children: ReactNode; hint?: ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-600">
        {label}
        {required && <span className="ml-1 text-rose-600">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

export const inputCls = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100";

export function Progress({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
        <div className={clsx("h-full rounded-full", value === 100 ? "bg-emerald-500" : "bg-teal-500")} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-semibold tabular-nums text-slate-700">{value}%</span>
    </div>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "error" | "success" | "warn"; children: ReactNode }) {
  return (
    <div
      className={clsx(
        "whitespace-pre-line rounded-lg px-4 py-3 text-sm",
        tone === "info" && "bg-sky-50 text-sky-900 ring-1 ring-sky-200",
        tone === "error" && "bg-rose-50 text-rose-900 ring-1 ring-rose-200",
        tone === "success" && "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200",
        tone === "warn" && "bg-amber-50 text-amber-900 ring-1 ring-amber-200",
      )}
    >
      {children}
    </div>
  );
}

/** 操作結果メッセージ(エラー・成功)と実行中状態をまとめて扱う */
export function useAction() {
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<unknown>, success?: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      if (success) setMsg({ tone: "success", text: success });
      return true;
    } catch (e) {
      setMsg({ tone: "error", text: (e as Error).message });
      return false;
    } finally {
      setBusy(false);
    }
  }
  const view = msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null;
  return { run, busy, msg: view, setMsg };
}

export function Check({ checked, onChange, disabled, label }: { checked: boolean; onChange?: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <label className={clsx("inline-flex items-center gap-1.5 text-xs", disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer")}>
      <input
        type="checkbox"
        className="h-4 w-4 accent-teal-600"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      {label}
    </label>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">{children}</p>;
}

export function PageTitle({ children, sub, actions }: { children: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{children}</h1>
        {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 print:hidden">{actions}</div>}
    </div>
  );
}
