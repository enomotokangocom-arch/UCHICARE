"use client";

import { useState } from "react";
import clsx from "clsx";
import { useMe } from "@/onboarding/ui/me";
import { Alert, PageTitle } from "@/onboarding/ui/kit";
import {
  AuditTab, BasicTab, DataTab, DeptTab, OfficesTab, ServicesTab, TemplatesTab, UnsetTab, UsersTab,
} from "@/onboarding/ui/SettingsTabs";

const TABS = [
  { k: "unset", label: "初回に入力する未設定項目" },
  { k: "basic", label: "基本設定" },
  { k: "services", label: "サービス一覧" },
  { k: "dept", label: "部門別サービス" },
  { k: "templates", label: "標準手順" },
  { k: "offices", label: "事業所・職種" },
  { k: "users", label: "ユーザー" },
  { k: "audit", label: "変更履歴" },
  { k: "data", label: "バックアップ・認証情報" },
] as const;

export default function SettingsPage() {
  const me = useMe();
  const [tab, setTab] = useState<(typeof TABS)[number]["k"]>("unset");
  if (me.actor.role !== "admin") return <Alert tone="error">管理設定は管理者のみ利用できます。</Alert>;
  return (
    <div className="space-y-4">
      <PageTitle sub="サービス・部門別の対象・標準手順・担当者を編集します。すべての変更は変更履歴に残ります。">管理設定</PageTitle>
      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={clsx("rounded-t-lg px-3 py-2 text-sm font-medium", tab === t.k ? "border border-b-white border-slate-200 bg-white text-teal-700" : "text-slate-600 hover:bg-slate-100")}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "unset" && <UnsetTab />}
      {tab === "basic" && <BasicTab />}
      {tab === "services" && <ServicesTab />}
      {tab === "dept" && <DeptTab />}
      {tab === "templates" && <TemplatesTab />}
      {tab === "offices" && <OfficesTab />}
      {tab === "users" && <UsersTab />}
      {tab === "audit" && <AuditTab />}
      {tab === "data" && <DataTab />}
    </div>
  );
}
