# 5. Database Schema

PostgreSQL + Prisma を前提とした論理スキーマ（Prisma schema 記法で表現）。
全ての業務テーブルは `organizationId` を持ち、テナント分離する（09章でRLSポリシーと併用）。
患者情報は氏名等の直接識別子を持たず、`pseudoId`（匿名ID）で処理する（16章・09章参照）。

```prisma
// ================= Tenant / Identity =================

model Organization {
  id            String   @id @default(cuid())
  name          String
  planTier      String   // starter / growth / enterprise
  timezone      String   @default("Asia/Tokyo")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  stations      Station[]
  users         User[]
  employees     Employee[]
  patients      Patient[]
  financialRecords FinancialRecord[]
  salesActivities  SalesActivity[]
  referralSources  ReferralSource[]
  recruitmentRecords RecruitmentRecord[]
  kpiSnapshots     KPISnapshot[]
  alerts           Alert[]
  aiInsights       AIInsight[]
  decisions        Decision[]
  actions          Action[]
  scenarios        Scenario[]
  thresholds       AnomalyThreshold[]
  auditLogs        AuditLog[]
  importBatches    DataImportBatch[]
}

model Station {
  id             String   @id @default(cuid())
  organizationId String
  name           String
  address        String?
  openedAt       DateTime?
  closedAt       DateTime?
  status         StationStatus @default(ACTIVE)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id])
  employees      Employee[]
  patients       Patient[]
  visits         Visit[]
  financialRecords FinancialRecord[]
  salesActivities  SalesActivity[]
  kpiSnapshots     KPISnapshot[]
  alerts           Alert[]
  decisions        Decision[]
  thresholds       AnomalyThreshold[]

  @@index([organizationId])
}

enum StationStatus { ACTIVE INACTIVE PLANNED CLOSED }

model User {
  id             String   @id @default(cuid())
  organizationId String
  email          String   @unique
  name           String
  role           UserRole
  employeeId     String?  @unique   // 従業員としても登録されている場合のリンク
  isActive       Boolean  @default(true)
  lastLoginAt    DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id])
  employee       Employee? @relation(fields: [employeeId], references: [id])
  approvedActions Action[] @relation("ActionApprover")
  ownedActions    Action[] @relation("ActionOwner")
  auditLogs       AuditLog[]

  @@index([organizationId])
}

enum UserRole { OWNER ADMIN STATION_MANAGER SALES HR FINANCE VIEWER }

// ================= Workforce =================

model Employee {
  id             String   @id @default(cuid())
  organizationId String
  stationId      String
  name           String
  employeeType   EmployeeType
  employmentType EmploymentType   // FULL_TIME / PART_TIME / CONTRACT
  fte            Float            // Full-Time Equivalent, 0.0-1.0+
  monthlySalaryCost Decimal       // 会社負担人件費（給与+社保等）
  hiredAt        DateTime
  resignedAt     DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id])
  station        Station @relation(fields: [stationId], references: [id])
  visits         Visit[]
  user           User?
  recruitmentRecord RecruitmentRecord?

  @@index([organizationId, stationId])
}

enum EmployeeType { NURSE THERAPIST OFFICE MANAGER OTHER }
enum EmploymentType { FULL_TIME PART_TIME CONTRACT }

model RecruitmentRecord {
  id             String   @id @default(cuid())
  organizationId String
  stationId      String
  targetEmployeeType EmployeeType
  status         RecruitmentStatus
  postedAt       DateTime?
  filledAt       DateTime?
  employeeId     String?  @unique
  costOfHire     Decimal?
  createdAt      DateTime @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id])
  employee       Employee? @relation(fields: [employeeId], references: [id])

  @@index([organizationId, stationId])
}

enum RecruitmentStatus { OPEN INTERVIEWING OFFERED FILLED CANCELLED }

// ================= Patients / Visits (匿名化) =================

model Patient {
  id             String   @id @default(cuid())
  organizationId String
  stationId      String
  pseudoId       String   @unique   // 表示・AI分析に使う匿名ID（例: PT-0001）
  ageBand        String?            // "70-79" 等、5-10歳幅の年代帯のみ保持（個人特定を避ける）
  careLevel      String?            // 要介護度等の区分値
  primaryDiagnosisCategory String?  // 疾患"カテゴリ"のみ（自由記述の傷病名は持たない）
  startedAt      DateTime
  endedAt        DateTime?
  endReason      PatientEndReason?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id])
  station        Station @relation(fields: [stationId], references: [id])
  visits         Visit[]
  events         PatientEvent[]

  @@index([organizationId, stationId])
}

enum PatientEndReason { HOSPITALIZED DECEASED IMPROVED TRANSFERRED FAMILY_REQUEST OTHER }

// 氏名・住所・保険者番号等の直接識別情報が必要な場合は、
// 別テーブル PatientIdentity に分離し、アクセス権限を最小人数(経理/請求担当)に限定する。
// AI分析・Uchi OS本体機能はこのテーブルを一切参照しない。
model PatientIdentity {
  id             String   @id @default(cuid())
  patientId      String   @unique
  encryptedName  Bytes    // アプリ層で暗号化して保存（09章）
  encryptedAddress Bytes?
  insurerNumberHash String? // 突合用途はハッシュ化のみ保持
  createdAt      DateTime @default(now())
}

model PatientEvent {
  id             String   @id @default(cuid())
  organizationId String
  patientId      String
  type           PatientEventType
  occurredAt     DateTime
  note           String?   // 定型メモのみ。自由記述PIIは入力しない運用ルール
  createdAt      DateTime @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id])
  patient        Patient @relation(fields: [patientId], references: [id])

  @@index([organizationId, patientId])
}

enum PatientEventType { ADMISSION DISCHARGE HOSPITALIZATION CARE_LEVEL_CHANGE COMPLAINT INCIDENT OTHER }

model Visit {
  id             String   @id @default(cuid())
  organizationId String
  stationId      String
  patientId      String
  employeeId     String
  visitedAt      DateTime
  durationMinutes Int
  visitType      String?  // 通常/緊急/初回 等
  createdAt      DateTime @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id])
  station        Station @relation(fields: [stationId], references: [id])
  patient        Patient @relation(fields: [patientId], references: [id])
  employee       Employee @relation(fields: [employeeId], references: [id])

  @@index([organizationId, stationId, visitedAt])
  @@index([employeeId, visitedAt])
}

// ================= Financial =================

model FinancialRecord {
  id             String   @id @default(cuid())
  organizationId String
  stationId      String?  // null = 法人全体（本部費用等）
  yearMonth      String   // "2026-08" 形式
  revenue        Decimal
  laborCost      Decimal
  otherFixedCost Decimal  @default(0)
  otherVariableCost Decimal @default(0)
  cashBalance    Decimal? // 月末現預金（法人全体のみ、stationId=null行に記録）
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id])
  station        Station? @relation(fields: [stationId], references: [id])

  @@unique([organizationId, stationId, yearMonth])
  @@index([organizationId, yearMonth])
}

// ================= Sales / Referral =================

model ReferralSource {
  id             String   @id @default(cuid())
  organizationId String
  name           String
  type           String?  // 居宅介護支援事業所 / 病院 / クリニック 等
  isDormant      Boolean  @default(false) // 90日以上紹介なし等で自動更新
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id])
  salesActivities SalesActivity[]

  @@index([organizationId])
}

model SalesActivity {
  id             String   @id @default(cuid())
  organizationId String
  stationId      String
  referralSourceId String?
  salesRepUserId String?
  activityType   SalesActivityType
  occurredAt     DateTime
  resultedInReferral Boolean @default(false)
  referredPatientCount Int  @default(0)
  createdAt      DateTime @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id])
  station        Station @relation(fields: [stationId], references: [id])
  referralSource ReferralSource? @relation(fields: [referralSourceId], references: [id])

  @@index([organizationId, stationId, occurredAt])
  @@index([referralSourceId])
}

enum SalesActivityType { VISIT CALL EVENT MATERIAL_SENT OTHER }

// ================= KPI / Alert / AI / Decision / Action =================

model KPISnapshot {
  id             String   @id @default(cuid())
  organizationId String
  stationId      String?  // null = 法人全体集計
  yearMonth      String
  kpiCode        String   // 06章のKPIコードと一致 (例: "revenue_per_nurse")
  value          Decimal
  valueType      KPIValueType @default(CALCULATED)
  computedAt     DateTime @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id])
  station        Station? @relation(fields: [stationId], references: [id])

  @@unique([organizationId, stationId, yearMonth, kpiCode])
  @@index([organizationId, yearMonth, kpiCode])
}

enum KPIValueType { FACT CALCULATED AI_ESTIMATE }

model AnomalyThreshold {
  id             String   @id @default(cuid())
  organizationId String
  stationId      String?  // null = 組織全体デフォルト。station指定で上書き可能
  ruleCode       String   // 07章の DR-xx と一致
  paramKey       String   // 例: "revenue_drop_pct"
  paramValue     Decimal
  updatedByUserId String?
  updatedAt      DateTime @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id])
  station        Station? @relation(fields: [stationId], references: [id])

  @@unique([organizationId, stationId, ruleCode, paramKey])
}

model Alert {
  id             String   @id @default(cuid())
  organizationId String
  stationId      String?
  ruleCode       String   // DR-xx
  severity       Severity
  title          String
  detectedAt     DateTime @default(now())
  yearMonth      String
  status         AlertStatus @default(OPEN)
  sourceKpiSnapshotIds String[] // 根拠となったKPISnapshot.id群
  createdAt      DateTime @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id])
  station        Station? @relation(fields: [stationId], references: [id])
  decisions      Decision[]

  @@index([organizationId, status, severity])
}

enum Severity { INFO WARNING CRITICAL }
enum AlertStatus { OPEN ACKNOWLEDGED RESOLVED DISMISSED }

model AIInsight {
  id             String   @id @default(cuid())
  organizationId String
  decisionId     String?
  kind           AIInsightKind  // CAUSE_EXPLANATION / HYPOTHESIS / CHAT_ANSWER / ACTION_SUGGESTION
  inputSummary   Json     // LLMに渡した構造化データ（監査用に保存。PIIを含まないことを保証）
  outputText     String
  model          String   // 使用したLLMモデル名
  confidence     Float?
  createdAt      DateTime @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id])
  decision       Decision? @relation(fields: [decisionId], references: [id])

  @@index([organizationId, decisionId])
}

enum AIInsightKind { CAUSE_EXPLANATION HYPOTHESIS CHAT_ANSWER ACTION_SUGGESTION FORECAST_NARRATIVE }

model Decision {
  id             String   @id @default(cuid())
  organizationId String
  stationId      String?
  alertId        String?
  ruleCode       String
  priority       Priority
  problemSummary String            // FACT/CALCULATEDに基づく問題文（コード生成）
  rootCause      Json              // 決定論的な原因分解の内訳（金額・件数の内訳）
  predictedImpact Decimal?         // 円ベースの予測影響額（Forecast Engine計算）
  confidence     Float             // 0.0-1.0、算出方法は07章参照
  status         DecisionStatus @default(DRAFT)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id])
  station        Station? @relation(fields: [stationId], references: [id])
  alert          Alert? @relation(fields: [alertId], references: [id])
  aiInsights     AIInsight[]
  actions        Action[]

  @@index([organizationId, status, priority])
}

enum Priority { CRITICAL HIGH MEDIUM LOW }
enum DecisionStatus { DRAFT AI_RECOMMENDED HUMAN_REVIEWED DISMISSED }

model Action {
  id             String   @id @default(cuid())
  organizationId String
  decisionId     String
  title          String
  description    String
  ownerUserId    String?
  requiresApprovalCategory ApprovalCategory?  // 採用/解雇/給与/... 該当時は必須Human Approval
  deadline       DateTime?
  expectedImpact Json      // { metric: "new_patients", value: 3, unit: "人" } 等の構造化目標
  actualImpact   Json?     // Result Verified時に記録
  status         ActionStatus @default(DRAFT)
  approvedByUserId String?
  approvedAt     DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id])
  decision       Decision @relation(fields: [decisionId], references: [id])
  owner          User? @relation("ActionOwner", fields: [ownerUserId], references: [id])
  approver       User? @relation("ActionApprover", fields: [approvedByUserId], references: [id])

  @@index([organizationId, status])
}

enum ActionStatus { DRAFT AI_RECOMMENDED HUMAN_APPROVED IN_PROGRESS COMPLETED RESULT_VERIFIED REJECTED }
enum ApprovalCategory { HIRING TERMINATION SALARY PERFORMANCE_REVIEW INVESTMENT LOAN CONTRACT NEW_STATION WITHDRAWAL }

model Scenario {
  id             String   @id @default(cuid())
  organizationId String
  createdByUserId String
  name           String
  inputParams    Json     // { type: "HIRE_NURSE", count: 2, stationId: "...", effectiveMonth: "2026-10" }
  resultSummary  Json?    // Calculation Engineが返した3ヶ月後の予測値一式
  createdAt      DateTime @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id])

  @@index([organizationId])
}

// ================= Platform / Audit =================

model DataImportBatch {
  id             String   @id @default(cuid())
  organizationId String
  uploadedByUserId String
  targetEntity   String   // "financial_monthly" 等
  fileName       String
  status         ImportStatus @default(PENDING)
  rowCount       Int?
  errorCount     Int?
  errorDetail    Json?
  createdAt      DateTime @default(now())
  completedAt    DateTime?

  organization   Organization @relation(fields: [organizationId], references: [id])

  @@index([organizationId])
}

enum ImportStatus { PENDING PROCESSING SUCCEEDED FAILED PARTIAL }

model AuditLog {
  id             String   @id @default(cuid())
  organizationId String
  userId         String?
  action         String   // "action.approve", "patient.export", "user.login" 等
  targetType     String
  targetId       String
  metadata       Json?
  ipAddress      String?
  createdAt      DateTime @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id])
  user           User? @relation(fields: [userId], references: [id])

  @@index([organizationId, createdAt])
  @@index([targetType, targetId])
}
```

## 5.1 設計上の要点

- **`organizationId` は例外なく全業務テーブルに存在**し、Prismaのクエリミドルウェア + PostgreSQL RLS の
  二重でテナント分離を強制する（09章）。
- **患者の直接識別情報（氏名・住所等）は `PatientIdentity` テーブルに完全分離**し、Uchi OSの分析・AI機能は
  `Patient`（`pseudoId` ベース）のみを参照する。`PatientIdentity` へのアクセスはRBAC上ごく少数のロール
  （請求担当等）に限定し、Audit Logで全アクセスを記録する。
- **KPISnapshot** はKPI Engineの出力を保存する唯一の場所。Rule EngineもDecision EngineもここからKPIを読む
  （生データから毎回再計算しない）ことで、一貫性と監査性を担保する。
- **`valueType` (FACT/CALCULATED/AI_ESTIMATE)** を KPISnapshot・AIInsight に持たせ、UI表示時のバッジ分岐に
  使う（22章）。
- **Decision.rootCause / Action.expectedImpact / actualImpact は JSON** とし、KPIコードと数値のペアで
  構造化して保存する。LLMが生成する自然文とは別に、数値根拠は必ずコード側で計算した値を保存する。
