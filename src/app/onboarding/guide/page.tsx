import { Card, PageTitle } from "@/onboarding/ui/kit";

const FLOW = [
  { who: "管理者", what: "入職者を登録する", how: "「入職者を登録」で氏名・ローマ字・部門・事業所・入社日・準備担当者・確認管理者を入力。部門に応じて作業・サービス・発行依頼が自動で作られます。" },
  { who: "準備担当者", what: "作業チェックリストを上から進める", how: "入職者詳細の作業名を押すと、手順・完了条件・関連URL・使用アカウントが表示されます。手順を見ながら進め、iPhone・iPadそれぞれの確認欄にチェックし「完了にする」を押します。条件を満たさないと完了にできないので、足りない記録が画面に表示されます。" },
  { who: "準備担当者", what: "Apple番号を予約 → Apple側で作成 → 記録", how: "入職者詳細「Appleアカウント」で「次の番号を予約する」(番号は自動採番・重複なし)。Apple側で人がアカウントを作成したら「作成済みとして記録」。これでメールアドレスが確定します。" },
  { who: "準備担当者", what: "各サービスの発行を依頼する", how: "「アカウント発行依頼」で依頼するサービスを選び「依頼文を作成」→コピーしてLINE WORKS等で送信→「依頼した記録をつける」。メールアドレス確定前は、メールが必要な依頼は記録できません。" },
  { who: "事務・責任者", what: "発行したら記録する", how: "担当サービスの行で発行日と「発行されたID」を入力し「発行済みにする」。パスワードは入力しません。" },
  { who: "準備担当者", what: "配置・ログイン・内容確認", how: "「サービス」表でiPhone・iPadそれぞれの配置とログイン確認、内容確認(本人名・所属・権限・通知)にチェック。両端末でログインできると発行依頼が「ログイン確認済み」になります。" },
  { who: "準備担当者", what: "準備完了にする", how: "必須作業がすべて完了(または理由付きで対象外)になると「準備完了にする」が押せます。" },
  { who: "管理者", what: "動作確認して記録する", how: "端末を実際に操作して確認し、確認内容を入力して「管理者確認を記録」。" },
  { who: "準備担当者", what: "貸与して操作説明を記録する", how: "職員に端末を渡して説明し、貸与日と説明内容を「貸与を記録」で残します。" },
];

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageTitle sub="榎本が毎回設定しなくても、担当者が手順を見て完了できるようにするためのツールです。">使い方</PageTitle>
      <Card title="準備の流れ">
        <ol className="space-y-3">
          {FLOW.map((f, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">{i + 1}</span>
              <div>
                <p className="text-sm font-bold">{f.what} <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-normal text-slate-600">{f.who}</span></p>
                <p className="text-sm text-slate-600">{f.how}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>
      <Card title="作業の状態">
        <ul className="grid gap-1 text-sm md:grid-cols-2">
          <li><b>未着手</b>: まだ始めていない</li>
          <li><b>進行中</b>: 作業中(確認欄にチェックすると自動でこの状態になります)</li>
          <li><b>発行待ち</b>: 他の人の発行を待っている</li>
          <li><b>確認待ち</b>: 管理者等の確認を待っている</li>
          <li><b>完了</b>: 完了条件を満たした</li>
          <li><b>対象外</b>: この入職者には不要(理由の入力が必要)</li>
        </ul>
        <p className="mt-2 text-xs text-slate-500">任意の作業は、必須作業の完了率には含めません。</p>
      </Card>
      <Card title="困ったとき">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>「完了にできない」: 作業画面の「まだ満たしていない条件」を確認してください。</li>
          <li>サービスのURLやアプリが分からない: 「未確定サービスのアプリ・URL・配置方式を既存端末で確定する」作業で管理者が確定します。推測で入れないでください。</li>
          <li>「榎本対応」と表示される作業: まだ権限が移管されていないため榎本への依頼が必要です(ダッシュボードに一覧表示)。</li>
          <li>パスワード: このツールには入力しません。認証情報管理ツールの参照先を確認してください。</li>
          <li>AirDrop: App Storeのリンク・WebのURL・必要なファイルの共有に使います。アプリ本体の移送には使いません。</li>
        </ul>
      </Card>
    </div>
  );
}
