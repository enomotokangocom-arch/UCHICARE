"use client";

import clsx from "clsx";
import { ReactNode } from "react";
import { BUSINESS_UNITS } from "@/lib/portal/defaults";
import { BusinessUnitId, Staff } from "@/lib/portal/types";

export const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50";

export const buttonClass = {
  primary:
    "inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none",
  danger:
    "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50",
  ghost:
    "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100",
};

export function PageHeader({
  icon,
  title,
  description,
  actions,
}: {
  icon: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-brand-700 sm:text-2xl">
          <span>{icon}</span>
          {title}
        </h1>
        <span className="mt-2 block h-0.5 w-10 rounded-full bg-gold-400" aria-hidden />
        {description && <p className="mt-2 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5", className)}>
      {children}
    </div>
  );
}

export function Field({
  label,
  required,
  hint,
  children,
  className,
  group,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  className?: string;
  /** チェックボックス群など複数の入力を含む場合は true(label の入れ子を避ける) */
  group?: boolean;
}) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className={clsx("block", className)}>
      <span className="mb-1 block text-xs font-semibold text-slate-600">
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </Tag>
  );
}

export function UnitBadge({ unitId }: { unitId: BusinessUnitId }) {
  const unit = BUSINESS_UNITS.find((u) => u.id === unitId);
  if (!unit) return null;
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        unit.badgeClass
      )}
    >
      {unit.shortName}
    </span>
  );
}

export function UnitBadges({ units }: { units: BusinessUnitId[] }) {
  if (units.length === 0 || units.length === BUSINESS_UNITS.length) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
        全社
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap gap-1">
      {units.map((u) => (
        <UnitBadge key={u} unitId={u} />
      ))}
    </span>
  );
}

/** 事業所の絞り込みタブ */
export function UnitFilter({
  value,
  onChange,
}: {
  value: BusinessUnitId | "all";
  onChange: (v: BusinessUnitId | "all") => void;
}) {
  const options: { id: BusinessUnitId | "all"; label: string }[] = [
    { id: "all", label: "すべて" },
    ...BUSINESS_UNITS.map((u) => ({ id: u.id, label: u.name })),
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={clsx(
            "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
            value === o.id ? "bg-brand-700 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 事業所の複数選択チェックボックス */
export function UnitCheckboxes({
  value,
  onChange,
}: {
  value: BusinessUnitId[];
  onChange: (v: BusinessUnitId[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {BUSINESS_UNITS.map((u) => (
        <label key={u.id} className="flex items-center gap-1.5 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand-600"
            checked={value.includes(u.id)}
            onChange={(e) =>
              onChange(e.target.checked ? [...value, u.id] : value.filter((x) => x !== u.id))
            }
          />
          {u.name}
        </label>
      ))}
    </div>
  );
}

export function StaffSelect({
  staff,
  value,
  onChange,
  placeholder = "選択してください",
  required,
}: {
  staff: Staff[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} required={required}>
      <option value="">{placeholder}</option>
      {staff.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}({s.role})
        </option>
      ))}
    </select>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-400">
      {children}
    </div>
  );
}

export function StatusPill({ tone, children }: { tone: "ok" | "warn" | "danger" | "neutral" | "info"; children: ReactNode }) {
  const tones = {
    ok: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    warn: "bg-amber-50 text-amber-700 ring-amber-200",
    danger: "bg-rose-50 text-rose-700 ring-rose-200",
    neutral: "bg-slate-100 text-slate-600 ring-slate-200",
    info: "bg-sky-50 text-sky-700 ring-sky-200",
  };
  return (
    <span className={clsx("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", tones[tone])}>
      {children}
    </span>
  );
}

/** 達成度のバー(0〜1)。1以上は緑 */
export function ProgressBar({ ratio, label, className }: { ratio: number | null; label?: string; className?: string }) {
  if (ratio === null || !Number.isFinite(ratio)) return <span className="text-xs text-slate-400">-</span>;
  const done = ratio >= 1;
  return (
    <span className={clsx("flex items-center gap-2", className)}>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <span className={clsx("block h-full rounded-full", done ? "bg-emerald-500" : "bg-brand-500")} style={{ width: `${Math.min(1, ratio) * 100}%` }} />
      </span>
      <span className={clsx("w-12 text-right text-xs font-bold", done ? "text-emerald-700" : "text-slate-700")}>{label ?? `${Math.round(ratio * 100)}%`}</span>
    </span>
  );
}
