# 3. User Journey

## 3.1 全体像（経営者の1日）

```
朝  : CEO Morning を開く（5分） → Top5の判断事項を確認 → Action承認/修正/保留
日中: 現場から連絡があれば Station Dashboard / AI経営参謀Chat で深掘り
週次: Alerts / Action Center を確認し、進行中Actionの状況を確認
月次: Company Dashboard / Financial Dashboard で月次締め、Scenario Simulatorで来月の意思決定
```

## 3.2 オンボーディング（初回のみ）

| ステップ | 画面/操作 | ゴール |
|---|---|---|
| 1. アカウント作成 | Login/Signup | 組織(Organization)作成、Ownerユーザー作成 |
| 2. 拠点登録 | Settings > Stations | 拠点(Station)を1件以上登録 |
| 3. データ投入 | Data Import | financial_monthly / employees / visits / patients 等をCSV/Excelでアップロード、または手入力 |
| 4. 閾値確認 | Settings > Thresholds | Decision Ruleの閾値（拠点ごと変更可）をデフォルトのまま or 調整して確認 |
| 5. 初回CEO Morning | CEO Morning | 投入データに基づき初回のHealth Score・Alertが生成される |

## 3.3 日次ジャーニー：経営者

1. **起床後、スマホでUchi OSを開く**
2. CEO Morning が表示される。Uchi OS Score（例: 82/100, 前月比+3）を一瞥
3. TODAY セクションの最大5件のカードを確認。CRITICALが先頭
4. カードの中身を読む：問題 → 原因 → 予測影響 → 推奨Action（複数）
5. 各カードに対して「承認」「修正」「保留」「詳細を見る」のいずれかを選択
   - 承認 → Action が Human Approved になり、Owner（担当者）に通知される想定（Phase4で自動化）
   - 修正 → Action内容（Owner/Deadline/内容）をインライン編集して承認
   - 保留 → 理由を選択（情報不足/様子見/優先度低）してActionをPendingのまま残す
   - 詳細を見る → 該当拠点のStation Dashboardや根拠データへ遷移
6. 5分以内に全カードを処理し終える（North Star指標）
7. 気になる点があればAI経営参謀チャットで自然文質問（「仙台東が赤字なのはなぜ？」等）

## 3.4 週次ジャーニー：拠点管理者

1. Alerts 画面で自拠点に関するAlertを確認
2. Station Dashboard で稼働率・訪問件数・利用者推移を確認
3. Action Center で自分がOwnerになっているActionを確認、ステータスを更新（In Progress → Completed）
4. 完了したActionについて、実績（Actual Impact）を入力（Phase4のFeedback Loopに接続）

## 3.5 週次ジャーニー：営業責任者

1. Sales Dashboard で紹介元別売上・営業ROI・最終訪問日を確認
2. 「営業紹介率低下」「重要紹介元休眠」等のAlertを確認
3. AI推奨Action（例: 上位紹介元5事業所へ再訪）を承認しCRMメモ的に活用
4. 訪問結果を Sales Activity として記録（次回KPI計算に反映）

## 3.6 月次ジャーニー：経営者 + 経理

1. Financial Dashboard で当月実績を確認（人件費率、営業利益率、EBITDA、Cash Runway）
2. Company Dashboard で拠点別の比較、前年同月比を確認
3. Scenario Simulator で来月以降の採用/単価変更などをシミュレーション
4. 出店可能性/撤退検討のDecisionが出ている場合、経営会議の議題として詳細を確認

## 3.7 感情曲線（CEO Morningのジャーニー）

| フェーズ | 経営者の感情（Before） | Uchi OSでの体験（After） |
|---|---|---|
| ログイン前 | 「今日も色々な報告を待たないといけない」不安 | ログイン後即座に状況が要約されている安心感 |
| CRITICAL Alertを見た瞬間 | 「まずい、何が起きてる？」焦り | 原因と予測影響が既に分解されているため、次のアクションに集中できる |
| Action承認 | 「誰に何を指示すればいいか考える」手間 | 担当者・期限・期待効果まで下書き済みなので「承認」で完了 |
| 完了後 | 経営全体を把握できていない不安 | Health Scoreと5分で終わった達成感、他の時間を現場や戦略に使える
