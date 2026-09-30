/**
 * 初期マスタデータ(サービス・部門・標準チェックリスト)。
 *
 * 方針:
 * - 指示で確定している情報のみ登録します(発行担当の役割、部門ごとの対象範囲、会社Googleアカウントなど)。
 * - URL・アプリの配置方式・発行担当者(個人)・認証情報の参照先など、組織判断が必要な項目は
 *   推測で埋めず「未設定」のまま残し、管理設定の「初回に入力する未設定項目」に表示します。
 */

export const DEPARTMENTS = [
  { code: "houmon", name: "訪問看護", sort: 1 },
  { code: "kyotaku", name: "居宅介護支援", sort: 2 },
];

export const JOB_TYPES = ["看護師", "准看護師", "理学療法士", "作業療法士", "言語聴覚士", "介護支援専門員", "事務"];

type Req = "required" | "optional" | "excluded" | "confirm";

export interface ServiceSeed {
  code: string;
  name: string;
  account_type: string;
  needs_issuance: number;
  requires_email: number;
  issuer_label: string | null;
  owner_mode: string;
  account_note: string | null;
  procedure: string;
  completion_criteria: string;
  standard_days: number | null;
  dept: { houmon: Req; kyotaku: Req };
}

const COMMON_LOGIN_CRITERIA =
  "iPhone・iPadそれぞれで起動し、本人のアカウントでログインできる。本人名・所属・権限・通知が正しいことを確認した。";

export const SERVICES: ServiceSeed[] = [
  {
    code: "efax", name: "eFAX", account_type: "unset", needs_issuance: 0, requires_email: 0,
    issuer_label: null, owner_mode: "unset", account_note: null,
    procedure: "配置方式・使用アカウントが確定したら手順を記入してください。",
    completion_criteria: COMMON_LOGIN_CRITERIA, standard_days: null,
    dept: { houmon: "required", kyotaku: "required" },
  },
  {
    code: "mybridge", name: "myBridge", account_type: "unset", needs_issuance: 0, requires_email: 0,
    issuer_label: null, owner_mode: "unset", account_note: null,
    procedure: "配置方式・使用アカウントが確定したら手順を記入してください。",
    completion_criteria: COMMON_LOGIN_CRITERIA, standard_days: null,
    dept: { houmon: "required", kyotaku: "required" },
  },
  {
    code: "zoom", name: "ZOOM", account_type: "unset", needs_issuance: 0, requires_email: 0,
    issuer_label: null, owner_mode: "unset", account_note: null,
    procedure: "配置方式・使用アカウントが確定したら手順を記入してください。",
    completion_criteria: COMMON_LOGIN_CRITERIA, standard_days: null,
    dept: { houmon: "required", kyotaku: "required" },
  },
  {
    code: "casio_dm2", name: "CASIO DESIGN MAKER2", account_type: "unset", needs_issuance: 0, requires_email: 0,
    issuer_label: null, owner_mode: "unset", account_note: null,
    procedure: "配置方式・使用アカウントが確定したら手順を記入してください。",
    completion_criteria: "iPhone・iPadそれぞれで起動し、必要な機能(印刷等)が使えることを確認した。", standard_days: null,
    dept: { houmon: "required", kyotaku: "required" },
  },
  {
    code: "mcs", name: "MCS", account_type: "individual", needs_issuance: 1, requires_email: 1,
    issuer_label: null, owner_mode: "unset",
    account_note: "個別アカウントの発行が必要。発行担当者は未設定です(管理設定で登録してください)。",
    procedure: "発行担当者が確定したら、発行依頼の方法と初回ログイン手順を記入してください。",
    completion_criteria: COMMON_LOGIN_CRITERIA, standard_days: null,
    dept: { houmon: "required", kyotaku: "required" },
  },
  {
    code: "chatgpt", name: "ChatGPT", account_type: "unset", needs_issuance: 0, requires_email: 0,
    issuer_label: null, owner_mode: "unset", account_note: null,
    procedure: "使用するアカウント(会社共有か個別か)が確定したら手順を記入してください。",
    completion_criteria: COMMON_LOGIN_CRITERIA, standard_days: null,
    dept: { houmon: "required", kyotaku: "required" },
  },
  {
    code: "zest", name: "ZEST", account_type: "individual_email", needs_issuance: 1, requires_email: 1,
    issuer_label: "責任者", owner_mode: "transferred",
    account_note: "メールアドレス確定後、責任者が発行します。",
    procedure: "1. 確定したメールアドレスで責任者へ発行を依頼する\n2. 発行後、発行されたIDを記録する(パスワードは記録しない)\n3. iPhone・iPadでログインを確認する",
    completion_criteria: COMMON_LOGIN_CRITERIA, standard_days: 5,
    dept: { houmon: "required", kyotaku: "required" },
  },
  {
    code: "ibow", name: "iBOW", account_type: "individual_email", needs_issuance: 1, requires_email: 1,
    issuer_label: "事務", owner_mode: "transferred",
    account_note: "メールアドレス確定後、事務が発行します(訪問看護のみ)。",
    procedure: "1. 確定したメールアドレスで事務へ発行を依頼する\n2. 発行後、発行されたIDを記録する(パスワードは記録しない)\n3. iPhone・iPadでログインを確認する",
    completion_criteria: COMMON_LOGIN_CRITERIA, standard_days: 5,
    dept: { houmon: "required", kyotaku: "excluded" },
  },
  {
    code: "lineworks", name: "LINE WORKS", account_type: "individual_email", needs_issuance: 1, requires_email: 1,
    issuer_label: "事務", owner_mode: "transferred",
    account_note: "メールアドレス確定後、事務が発行します。",
    procedure: "1. 確定したメールアドレスで事務へ発行を依頼する\n2. 発行後、発行されたIDを記録する(パスワードは記録しない)\n3. iPhone・iPadでログインし、所属グループと通知を確認する",
    completion_criteria: COMMON_LOGIN_CRITERIA, standard_days: 5,
    dept: { houmon: "required", kyotaku: "required" },
  },
  {
    code: "enursing", name: "福利厚生eNursing", account_type: "individual", needs_issuance: 1, requires_email: 1,
    issuer_label: "榎本(代表)", owner_mode: "enomoto",
    account_note: "現在は榎本が発行しています。管理権限の移管後、管理設定で発行担当者を変更してください。",
    procedure: "1. 榎本へ発行を依頼する(権限移管後は新しい発行担当者へ)\n2. 発行後、発行されたIDを記録する\n3. ログインを確認する",
    completion_criteria: COMMON_LOGIN_CRITERIA, standard_days: 7,
    dept: { houmon: "required", kyotaku: "required" },
  },
  {
    code: "gsheets", name: "Googleスプレッドシート", account_type: "company_google", needs_issuance: 0, requires_email: 0,
    issuer_label: null, owner_mode: "unset",
    account_note: "会社Googleアカウントを使用します(アカウント名は管理設定「会社Googleアカウント」参照)。",
    procedure: "配置方式が確定したら手順を記入してください。",
    completion_criteria: COMMON_LOGIN_CRITERIA, standard_days: null,
    dept: { houmon: "required", kyotaku: "required" },
  },
  {
    code: "gmaps", name: "Googleマップ", account_type: "company_google", needs_issuance: 0, requires_email: 0,
    issuer_label: null, owner_mode: "unset",
    account_note: "会社Googleアカウントを使用します(アカウント名は管理設定「会社Googleアカウント」参照)。",
    procedure: "配置方式が確定したら手順を記入してください。",
    completion_criteria: "iPhone・iPadそれぞれで起動し、位置情報の許可と会社アカウントでのログインを確認した。", standard_days: null,
    dept: { houmon: "required", kyotaku: "required" },
  },
  {
    code: "company_hp", name: "会社HP", account_type: "unset", needs_issuance: 0, requires_email: 0,
    issuer_label: null, owner_mode: "unset", account_note: null,
    procedure: "URLが確定したら、Safariからホーム画面へ追加する手順を記入してください。",
    completion_criteria: "iPhone・iPadのホーム画面から会社HPが開ける。", standard_days: null,
    dept: { houmon: "required", kyotaku: "required" },
  },
  {
    code: "king_of_time", name: "KING of 勤怠", account_type: "unset", needs_issuance: 0, requires_email: 0,
    issuer_label: null, owner_mode: "unset", account_note: "追加候補。利用要否を確認してください。",
    procedure: "利用が決まったら手順を記入してください。",
    completion_criteria: COMMON_LOGIN_CRITERIA, standard_days: null,
    dept: { houmon: "confirm", kyotaku: "confirm" },
  },
  {
    code: "notion", name: "Notion", account_type: "unset", needs_issuance: 0, requires_email: 0,
    issuer_label: null, owner_mode: "unset", account_note: "追加候補。利用要否を確認してください。",
    procedure: "利用が決まったら手順を記入してください。",
    completion_criteria: COMMON_LOGIN_CRITERIA, standard_days: null,
    dept: { houmon: "confirm", kyotaku: "confirm" },
  },
];

export interface TemplateSeed {
  code: string;
  sort_no: number;
  title: string;
  assignee_type: "preparer" | "checker";
  requirement: "required" | "optional";
  prerequisites: string[];
  procedure: string;
  completion_criteria: string;
  related_urls: string;
  account_info: string;
  device_check: "none" | "both";
  due_offset_days: number;
  completion_mode: "manual" | "system";
  condition?: string | null;
}

export const TEMPLATES: TemplateSeed[] = [
  {
    code: "hire_info", sort_no: 10, title: "入社情報を確認する", assignee_type: "preparer", requirement: "required",
    prerequisites: [],
    procedure: [
      "1. 入職者の氏名・ローマ字表記・職種・部門・所属事業所・入社日を、採用担当者の情報と照合する",
      "2. ローマ字表記の綴りを本人または採用担当者に確認する(各サービスの登録名に使用します)",
      "3. 準備担当者・代行担当者・確認管理者が決まっているか確認する(未定なら管理者へ連絡)",
      "4. 「利用要否の確認」となっているサービス(KING of 勤怠・Notion等)があれば、管理者に要否を確認する",
    ].join("\n"),
    completion_criteria: "入職者詳細の基本情報がすべて入力され、ローマ字表記の確認が済んでいる。",
    related_urls: "", account_info: "なし", device_check: "none", due_offset_days: -21, completion_mode: "manual",
  },
  {
    code: "device_secure", sort_no: 20, title: "iPhone・iPadを確保する", assignee_type: "preparer", requirement: "required",
    prerequisites: ["hire_info"],
    procedure: [
      "1. 端末台帳で「在庫」のiPhone・iPadを探す",
      "2. 在庫がなければ管理者に購入・手配を依頼する",
      "3. 端末の外観・充電・画面割れを確認する",
    ].join("\n"),
    completion_criteria: "貸与予定のiPhone・iPadが手元にあり、故障がない。",
    related_urls: "", account_info: "なし", device_check: "both", due_offset_days: -18, completion_mode: "manual",
  },
  {
    code: "device_register", sort_no: 30, title: "端末を台帳に登録する", assignee_type: "preparer", requirement: "required",
    prerequisites: ["device_secure"],
    procedure: [
      "1. 「端末台帳」画面で、iPhone・iPadそれぞれの管理番号・機種・シリアル番号を登録する",
      "   (シリアル番号は 設定 > 一般 > 情報 で確認できます)",
      "2. iPhoneは電話番号も登録する",
      "3. 利用者にこの入職者を割り当てる",
      "4. 端末パスコードは台帳に書かず、会社の認証情報管理ツールに保存し「参照先」だけを登録する",
    ].join("\n"),
    completion_criteria: "iPhone・iPadの両方が端末台帳に登録され、利用者がこの入職者になっている。",
    related_urls: "", account_info: "なし", device_check: "both", due_offset_days: -17, completion_mode: "manual",
  },
  {
    code: "apple_reserve", sort_no: 40, title: "Appleアカウントの番号を予約する", assignee_type: "preparer", requirement: "required",
    prerequisites: ["hire_info"],
    procedure: [
      "1. 入職者詳細の「Appleアカウント」欄で「次の番号を予約する」を押す",
      "2. 表示された番号と予定メールアドレス(例: uchicare037@icloud.com)を確認する",
      "※ この操作はツール上の番号の確保です。Apple側のアカウントはまだ作成されていません。",
      "※ 番号は自動で重複しないよう採番されます。手入力で番号を決めないでください。",
    ].join("\n"),
    completion_criteria: "この入職者に予約中の番号が1つ割り当てられている。",
    related_urls: "", account_info: "予約した番号の予定メールアドレス", device_check: "none", due_offset_days: -17, completion_mode: "manual",
  },
  {
    code: "apple_create", sort_no: 50, title: "Apple AccountとiCloudメールを作成する", assignee_type: "preparer", requirement: "required",
    prerequisites: ["apple_reserve"],
    procedure: [
      "1. 予約した番号の予定メールアドレスで、Apple AccountとiCloudメールを作成する(Apple側の作業は人が行います)",
      "2. パスワードは会社の認証情報管理ツールで作成・保存する(このツールには入力しない)",
      "3. 作成できたら、入職者詳細の「Appleアカウント」欄で「作成済みとして記録」を押し、実際に作成したメールアドレスを入力する",
      "4. 作成できなかった場合は「作成できなかった」を押し、理由を記録する(番号は管理者の判断なしに再利用されません)",
    ].join("\n"),
    completion_criteria: "Appleアカウントの状態が「作成済み」になり、メールアドレスが確定している。",
    related_urls: "", account_info: "予約したApple Account(予定メールアドレス)", device_check: "none", due_offset_days: -16, completion_mode: "manual",
  },
  {
    code: "recovery_record", sort_no: 60, title: "認証コード受信先と復旧情報を記録する", assignee_type: "preparer", requirement: "required",
    prerequisites: ["apple_create"],
    procedure: [
      "1. 2ファクタ認証の認証コード受信先(電話番号等)を決め、端末台帳の「認証コード受信先」に記録する",
      "2. 認証先の管理担当者を端末台帳に記録する",
      "3. 復旧キー等の復旧情報は認証情報管理ツールに保存し、入職者詳細の「認証情報の参照先」に保管場所だけを登録する",
    ].join("\n"),
    completion_criteria: "端末台帳に認証コード受信先と管理担当者が記録され、復旧情報の参照先が登録されている。",
    related_urls: "", account_info: "作成したApple Account", device_check: "none", due_offset_days: -16, completion_mode: "manual",
  },
  {
    code: "issue_request", sort_no: 70, title: "確定したメールアドレスで各サービスの発行を依頼する", assignee_type: "preparer", requirement: "required",
    prerequisites: ["apple_create"],
    procedure: [
      "1. 入職者詳細の「アカウント発行依頼」を開く",
      "2. 依頼先ごとに「依頼文を作成」を押し、内容を確認してコピーする",
      "3. LINE WORKS等で依頼先に送る(ツールからは自動送信されません)",
      "4. 送ったら「依頼した記録をつける」を押し、依頼日と方法を記録する",
      "※ 各サービスのパスワードは別途管理者が設定します。Appleのパスワードを流用しないでください。",
    ].join("\n"),
    completion_criteria: "発行が必要な必須サービスすべてについて、依頼した記録がある。",
    related_urls: "", account_info: "確定したApple(iCloud)メールアドレス", device_check: "none", due_offset_days: -15, completion_mode: "manual",
  },
  {
    code: "device_setup", sort_no: 80, title: "iPhone・iPadの設定アプリで初期設定する", assignee_type: "preparer", requirement: "required",
    prerequisites: ["device_register", "apple_create"],
    procedure: [
      "iPhone・iPadそれぞれで以下を行い、端末ごとに確認欄へチェックします。",
      "1. 会社Wi-Fiに接続する(Wi-Fiのパスワードは認証情報管理ツール参照)",
      "2. 設定 > 一般 > ソフトウェアアップデート でOSを最新にする",
      "3. 設定 > 一般 > 情報 > 名前 で端末名を設定する(命名規則は管理設定参照)",
      "4. 設定 > Face ID(Touch ID)とパスコード で画面ロックとパスコードを設定する(パスコードは認証情報管理ツールに保存し、ここには書かない)",
      "5. 設定の一番上から、確定したApple Accountでサインインする",
      "6. メールアプリでiCloudメールの受信を確認する",
      "7. 設定 > 通知、プライバシーとセキュリティ(カメラ・マイク・位置情報)で必要な許可を設定する",
      "8. 設定 > [氏名] > 探す がオンか確認し、iCloudの同期範囲(写真・連絡先等)を会社方針どおりにする",
    ].join("\n"),
    completion_criteria: "iPhone・iPadの両方で上記1〜8が完了し、それぞれの確認欄にチェックがある。",
    related_urls: "", account_info: "確定したApple Account / 会社Wi-Fi", device_check: "both", due_offset_days: -10, completion_mode: "manual",
  },
  {
    code: "confirm_placement", sort_no: 85, title: "未確定サービスのアプリ・URL・配置方式を既存端末で確定する", assignee_type: "checker", requirement: "required",
    prerequisites: [],
    procedure: [
      "会社で使う正しいアプリ・URL・配置方式が確定していないサービスがあります。",
      "1. 既に使っている職員の端末を見て、App Storeのアプリ名(提供元)またはWebのURLを確認する",
      "2. 管理設定 > サービス一覧 で、配置方式・URL・App StoreのURLを入力し「配置方式を確定済み」にする",
      "3. 推測でURLを登録しないでください。不明な場合は榎本に確認してください。",
    ].join("\n"),
    completion_criteria: "対象サービスすべてが管理設定で「配置方式を確定済み」になっている。",
    related_urls: "", account_info: "なし", device_check: "none", due_offset_days: -12, completion_mode: "manual",
    condition: "unconfirmed_placement",
  },
  {
    code: "app_placement", sort_no: 90, title: "アプリのインストールとWebのホーム画面保存を行う", assignee_type: "preparer", requirement: "required",
    prerequisites: ["device_setup", "confirm_placement"],
    procedure: [
      "入職者詳細の「サービス」表を見ながら、iPhone・iPadそれぞれで行います。",
      "【アプリの場合】",
      "1. App Storeを開き、サービス一覧に登録されたアプリ(提供元も確認)を入手する",
      "2. App StoreのURLをAirDropで受け取ってから開いてもよい(AirDropで共有するのは入手リンクのみで、アプリ本体は移送しない)",
      "【Webの場合】",
      "1. Safariでサービス一覧のURLを開く(URLはAirDropで受け取ってもよい)",
      "2. 共有ボタン > 「ホーム画面に追加」を押す",
      "3. 名前をサービス名に揃えて追加する",
      "4. 終わったら、サービス表の「配置」欄にiPhone・iPadそれぞれチェックする",
    ].join("\n"),
    completion_criteria: "必須サービスすべてがiPhone・iPadのホーム画面に配置されている。",
    related_urls: "", account_info: "確定したApple Account(App Storeで使用)", device_check: "both", due_offset_days: -9, completion_mode: "manual",
  },
  {
    code: "service_login", sort_no: 100, title: "各サービスへログインする", assignee_type: "preparer", requirement: "required",
    prerequisites: ["app_placement", "issue_request"],
    procedure: [
      "1. 発行されたID(アカウント発行依頼欄に記録)で各サービスにログインする",
      "2. パスワードは管理者が別途設定・管理しています。認証情報管理ツールの参照先を確認してください(このツールには表示・入力しない)",
      "3. Googleスプレッドシート・Googleマップは会社Googleアカウントでログインする",
      "4. ログインできたら、サービス表の「ログイン確認」をiPhone・iPadそれぞれ記録する",
    ].join("\n"),
    completion_criteria: "必須サービスすべてで、iPhone・iPadそれぞれのログイン確認が記録されている。",
    related_urls: "", account_info: "各サービスの発行ID / 会社Googleアカウント", device_check: "both", due_offset_days: -7, completion_mode: "manual",
  },
  {
    code: "service_verify", sort_no: 110, title: "本人名、所属、権限、通知、必要機能を確認する", assignee_type: "preparer", requirement: "required",
    prerequisites: ["service_login"],
    procedure: [
      "各サービスで次を確認し、サービス表の「内容確認」に記録します。",
      "1. 表示される氏名が本人の名前になっている",
      "2. 所属事業所・部署が正しい",
      "3. 権限(閲覧のみ・編集可など)が職種に合っている",
      "4. 通知が届く設定になっている",
      "5. 業務で使う機能(記録・写真添付・電話など)が動く",
    ].join("\n"),
    completion_criteria: "必須サービスすべての内容確認が記録されている。",
    related_urls: "", account_info: "各サービスの本人アカウント", device_check: "both", due_offset_days: -6, completion_mode: "manual",
  },
  {
    code: "open_items", sort_no: 120, title: "未完了項目の担当者と期限を記録する", assignee_type: "preparer", requirement: "required",
    prerequisites: [],
    procedure: [
      "1. 入職者詳細の「未完了項目」を確認する",
      "2. 未完了の作業・発行待ちのサービスに、対応者と期限が入っているか確認する",
      "3. 入っていなければ入力する(担当変更が必要な場合は管理者に依頼)",
      "4. 入社日までに終わらないものは、コメントに理由と見込みを書く",
    ].join("\n"),
    completion_criteria: "未完了の項目すべてに対応者と期限がある。",
    related_urls: "", account_info: "なし", device_check: "none", due_offset_days: -5, completion_mode: "manual",
  },
  {
    code: "admin_confirm", sort_no: 130, title: "管理者が準備完了を確認する", assignee_type: "checker", requirement: "required",
    prerequisites: [],
    procedure: [
      "準備担当者が「準備完了にする」を押すと確認待ちになります。",
      "1. iPhone・iPadを実際に操作し、主要サービスが起動・ログインできることを確認する",
      "2. 端末台帳・Appleアカウント・認証コード受信先の記録を確認する",
      "3. 問題なければ入職者詳細で「管理者確認を記録」を押し、確認内容を記録する",
    ].join("\n"),
    completion_criteria: "管理者の確認記録がある(入職者の状態が「管理者確認済み」)。",
    related_urls: "", account_info: "なし", device_check: "none", due_offset_days: -3, completion_mode: "system",
  },
  {
    code: "lend", sort_no: 140, title: "職員へ貸与し、操作説明を記録する", assignee_type: "preparer", requirement: "required",
    prerequisites: ["admin_confirm"],
    procedure: [
      "1. 職員にiPhone・iPadを渡す",
      "2. 画面ロックの解除、主要アプリの場所、困ったときの連絡先を説明する",
      "3. 初回に職員本人がパスワードを変更するサービスがあれば一緒に行う",
      "4. 入職者詳細で「貸与を記録」を押し、貸与日と説明内容を記録する",
    ].join("\n"),
    completion_criteria: "貸与日と操作説明の記録がある(入職者の状態が「貸与済み」)。",
    related_urls: "", account_info: "なし", device_check: "none", due_offset_days: 0, completion_mode: "system",
  },
];

/** 設定値の初期値。null は「未設定」として管理設定に表示されます。 */
export const DEFAULT_SETTINGS: Record<string, string | null> = {
  apple_prefix: "uchicare",
  apple_domain: "icloud.com",
  apple_last_issued: "36",
  company_google_account: "uchicare0105@gmail.com",
  representative_name: "榎本",
  credential_store_name: null,
  company_wifi_name: null,
  device_naming_rule: null,
  auth_code_policy: null,
  kyotaku_record_system: null,
  prep_deadline_offset_days: "-3",
};

export const SETTING_LABELS: Record<string, string> = {
  apple_prefix: "Appleアカウントのメール接頭辞",
  apple_domain: "Appleアカウントのメールドメイン",
  apple_last_issued: "発行済みの最新番号(これより大きい番号から予約)",
  company_google_account: "会社Googleアカウント",
  representative_name: "代表者名(依頼先の表示名)",
  credential_store_name: "認証情報の管理ツール名・保管庫",
  company_wifi_name: "会社Wi-Fiの名前(SSID)",
  device_naming_rule: "端末名の命名規則",
  auth_code_policy: "2ファクタ認証の認証コード受信先の方針",
  kyotaku_record_system: "居宅介護支援の記録・請求システム",
  prep_deadline_offset_days: "準備期限(入社日からの日数)",
};
