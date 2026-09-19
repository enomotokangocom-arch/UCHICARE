"use client";

import { useEffect, useState, useCallback } from "react";

interface Staff {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

export default function UsersPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "RECRUITER" });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    return fetch("/api/crm/staff")
      .then((res) => res.json())
      .then((data) => setStaff(data.staff ?? []));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createStaff() {
    setError(null);
    const res = await fetch("/api/crm/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setForm({ name: "", email: "", password: "", role: "RECRUITER" });
    load();
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch(`/api/crm/staff/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    load();
  }

  async function changeRole(id: string, role: string) {
    await fetch(`/api/crm/staff/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    load();
  }

  return (
    <div className="p-8">
      <h1 className="mb-6 text-xl font-bold text-slate-900">スタッフ管理</h1>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-bold text-slate-900">新規スタッフ追加</h2>
        {error && <p className="mb-2 text-xs text-rose-600">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <input placeholder="氏名" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="rounded-md border border-slate-300 px-2 py-1 text-sm" />
          <input placeholder="メールアドレス" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="rounded-md border border-slate-300 px-2 py-1 text-sm" />
          <input placeholder="初期パスワード (8文字以上)" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="rounded-md border border-slate-300 px-2 py-1 text-sm" />
          <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="rounded-md border border-slate-300 px-2 py-1 text-sm">
            <option value="ADMIN">ADMIN</option>
            <option value="RECRUITER">RECRUITER</option>
            <option value="VIEWER">VIEWER</option>
          </select>
          <button onClick={createStaff} className="rounded-md bg-teal-600 px-4 py-1.5 text-sm font-semibold text-white">追加</button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">氏名</th>
              <th className="px-4 py-2">メール</th>
              <th className="px-4 py-2">ロール</th>
              <th className="px-4 py-2">状態</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {staff.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2">{s.name}</td>
                <td className="px-4 py-2 text-slate-500">{s.email}</td>
                <td className="px-4 py-2">
                  <select defaultValue={s.role} onChange={(e) => changeRole(s.id, e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-xs">
                    <option value="ADMIN">ADMIN</option>
                    <option value="RECRUITER">RECRUITER</option>
                    <option value="VIEWER">VIEWER</option>
                  </select>
                </td>
                <td className="px-4 py-2">
                  <button onClick={() => toggleActive(s.id, s.isActive)} className={`text-xs font-medium ${s.isActive ? "text-emerald-600" : "text-slate-400"}`}>
                    {s.isActive ? "有効" : "無効"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
