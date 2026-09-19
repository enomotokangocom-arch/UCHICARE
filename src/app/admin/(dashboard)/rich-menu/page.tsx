"use client";

import { useEffect, useState, useCallback } from "react";

interface Menu {
  id: string;
  slot: number;
  label: string;
  actionType: string;
  actionValue: string;
  isActive: boolean;
}

export default function RichMenuPage() {
  const [menus, setMenus] = useState<Menu[]>([]);

  const load = useCallback(() => {
    return fetch("/api/crm/rich-menu")
      .then((res) => res.json())
      .then((data) => setMenus(data.menus ?? []));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(id: string, patch: Partial<Menu>) {
    await fetch(`/api/crm/rich-menu/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    load();
  }

  return (
    <div className="p-8">
      <h1 className="mb-2 text-xl font-bold text-slate-900">リッチメニュー</h1>
      <p className="mb-6 text-sm text-slate-500">
        6つのメニュー項目のリンク先を管理します。画像・レイアウトのLINEへの実配信は別途 LINE Developers
        コンソールでの画像アップロードが必要です。
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {menus.map((m) => (
          <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-2 text-xs font-semibold text-slate-400">メニュー{m.slot}</p>
            <input
              defaultValue={m.label}
              onBlur={(e) => save(m.id, { label: e.target.value })}
              className="mb-2 w-full rounded-md border border-slate-300 px-2 py-1 text-sm font-medium"
            />
            <select
              defaultValue={m.actionType}
              onChange={(e) => save(m.id, { actionType: e.target.value as Menu["actionType"] })}
              className="mb-2 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
            >
              <option value="URL">URL遷移</option>
              <option value="POSTBACK">ボットアクション(POSTBACK)</option>
              <option value="MESSAGE">メッセージ送信</option>
            </select>
            <input
              defaultValue={m.actionValue}
              onBlur={(e) => save(m.id, { actionValue: e.target.value })}
              placeholder="URL または アクション値"
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
