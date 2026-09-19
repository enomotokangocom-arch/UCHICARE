"use client";

import { useEffect, useState, useCallback } from "react";

type TabKey = "occupations" | "areas" | "tags" | "inflow";

interface Occupation {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}
interface Area {
  id: string;
  name: string;
  isActive: boolean;
}
interface TagItem {
  id: string;
  code: string;
  label: string;
  category: string;
  isActive: boolean;
}
interface InflowSource {
  id: string;
  code: string;
  name: string;
  channel: string;
  isActive: boolean;
}

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "occupations", label: "職種" },
  { key: "areas", label: "エリア" },
  { key: "tags", label: "タグ" },
  { key: "inflow", label: "流入経路" },
];

export default function MastersPage() {
  const [tab, setTab] = useState<TabKey>("occupations");
  const [occupations, setOccupations] = useState<Occupation[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [inflowSources, setInflowSources] = useState<InflowSource[]>([]);

  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");

  const loadAll = useCallback(() => {
    return Promise.all([
      fetch("/api/crm/occupations").then((r) => r.json()),
      fetch("/api/crm/areas").then((r) => r.json()),
      fetch("/api/crm/tags").then((r) => r.json()),
      fetch("/api/crm/inflow-sources").then((r) => r.json()),
    ]).then(([o, a, t, i]) => {
      setOccupations(o.occupations ?? []);
      setAreas(a.areas ?? []);
      setTags(t.tags ?? []);
      setInflowSources(i.inflowSources ?? []);
    });
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function toggleActive(kind: TabKey, id: string, isActive: boolean) {
    const endpointMap: Record<TabKey, string> = {
      occupations: "occupations",
      areas: "areas",
      tags: "tags",
      inflow: "inflow-sources",
    };
    if (kind === "inflow") return; // inflow-sources APIにPATCHは未実装(拡張ポイント)
    await fetch(`/api/crm/${endpointMap[kind]}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    loadAll();
  }

  async function addOccupation() {
    if (!newCode || !newName) return;
    await fetch("/api/crm/occupations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: newCode, name: newName }),
    });
    setNewCode("");
    setNewName("");
    loadAll();
  }

  async function addArea() {
    if (!newName) return;
    await fetch("/api/crm/areas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    setNewName("");
    loadAll();
  }

  async function addInflowSource() {
    if (!newCode || !newName) return;
    await fetch("/api/crm/inflow-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: newCode, name: newName, channel: newName }),
    });
    setNewCode("");
    setNewName("");
    loadAll();
  }

  return (
    <div className="p-8">
      <h1 className="mb-6 text-xl font-bold text-slate-900">マスタ管理</h1>

      <div className="mb-4 flex gap-2 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t.key ? "border-teal-600 text-teal-700" : "border-transparent text-slate-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "occupations" && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex gap-2">
            <input placeholder="コード (例: JOB_XX)" value={newCode} onChange={(e) => setNewCode(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-sm" />
            <input placeholder="表示名" value={newName} onChange={(e) => setNewName(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-sm" />
            <button onClick={addOccupation} className="rounded-md bg-teal-600 px-3 py-1 text-sm font-medium text-white">追加</button>
          </div>
          <ul className="divide-y divide-slate-100">
            {occupations.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {o.name} <span className="text-xs text-slate-400">({o.code})</span>
                </span>
                <button onClick={() => toggleActive("occupations", o.id, o.isActive)} className={`text-xs ${o.isActive ? "text-emerald-600" : "text-slate-400"}`}>
                  {o.isActive ? "有効" : "無効"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "areas" && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex gap-2">
            <input placeholder="エリア名" value={newName} onChange={(e) => setNewName(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-sm" />
            <button onClick={addArea} className="rounded-md bg-teal-600 px-3 py-1 text-sm font-medium text-white">追加</button>
          </div>
          <ul className="divide-y divide-slate-100">
            {areas.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                <span>{a.name}</span>
                <button onClick={() => toggleActive("areas", a.id, a.isActive)} className={`text-xs ${a.isActive ? "text-emerald-600" : "text-slate-400"}`}>
                  {a.isActive ? "有効" : "無効"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "tags" && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <ul className="divide-y divide-slate-100">
            {tags.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {t.label} <span className="text-xs text-slate-400">({t.code} / {t.category})</span>
                </span>
                <button onClick={() => toggleActive("tags", t.id, t.isActive)} className={`text-xs ${t.isActive ? "text-emerald-600" : "text-slate-400"}`}>
                  {t.isActive ? "有効" : "無効"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "inflow" && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex gap-2">
            <input placeholder="コード" value={newCode} onChange={(e) => setNewCode(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-sm" />
            <input placeholder="流入経路名" value={newName} onChange={(e) => setNewName(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-sm" />
            <button onClick={addInflowSource} className="rounded-md bg-teal-600 px-3 py-1 text-sm font-medium text-white">追加</button>
          </div>
          <ul className="divide-y divide-slate-100">
            {inflowSources.map((i) => (
              <li key={i.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {i.name} <span className="text-xs text-slate-400">({i.channel})</span>
                </span>
                <span className="text-xs text-slate-400">{i.isActive ? "有効" : "無効"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
