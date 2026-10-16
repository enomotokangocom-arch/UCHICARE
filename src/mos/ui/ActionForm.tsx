"use client";
import { useActionState } from "react";
import type { ActionState } from "../server/actions";

/** Server Action を呼び、結果メッセージを表示する汎用フォーム */
export function ActionForm({
  action,
  children,
  submitLabel,
  className = "",
  confirm,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children?: React.ReactNode;
  submitLabel: string;
  className?: string;
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button disabled={pending} className="rounded-md bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
          {pending ? "処理中…" : submitLabel}
        </button>
        {state?.error && <span role="alert" className="text-sm text-red-700">{state.error}</span>}
        {state?.message && <span className="text-sm text-emerald-700">{state.message}</span>}
      </div>
    </form>
  );
}

export const inputCls = "rounded-md border border-slate-300 px-2 py-1 text-sm";
