"use client";

import { useRouter } from "next/navigation";
import { api, Options, useApi } from "@/onboarding/ui/client";
import { HireForm, toForm } from "@/onboarding/ui/HireForm";
import { Alert, Card, PageTitle, useAction } from "@/onboarding/ui/kit";

export default function NewHirePage() {
  const router = useRouter();
  const { data: opts } = useApi<Options>("/options");
  const { run, busy, msg } = useAction();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageTitle sub="登録すると、部門に応じた標準チェックリスト・サービス・アカウント発行依頼が自動で作られます。">入職者を登録</PageTitle>
      <Alert tone="info">
        デモ・練習では架空の氏名を使ってください。実在の職員を登録するのは、ログイン必須の本番環境(npm run onboarding:init で初期化)のみです。
      </Alert>
      {msg}
      <Card>
        {opts && (
          <HireForm
            initial={toForm(null)}
            opts={opts}
            canAssign
            isNew
            busy={busy}
            onSubmit={(v) =>
              run(async () => {
                const r = await api<{ id: number }>("/hires", { method: "POST", body: v });
                router.push(`/onboarding/hires/${r.id}`);
              })
            }
          />
        )}
      </Card>
    </div>
  );
}
