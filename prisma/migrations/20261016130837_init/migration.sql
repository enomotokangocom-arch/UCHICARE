-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "DataOrigin" AS ENUM ('REAL', 'SAMPLE');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('BANK_GMO', 'BANK_SENDAI', 'KYOTAKU_SALES_XLSX', 'TRIAL_BALANCE_PDF', 'IBOW_SALES_CSV', 'IBOW_IMPLEMENTATION_XLSX', 'ZEST_METRICS_ZIP', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PROCESSING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'DUPLICATE', 'NEEDS_MAPPING');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('ERROR', 'WARNING', 'INFO');

-- CreateEnum
CREATE TYPE "Unit" AS ENUM ('COMPANY', 'HOMONKANGO', 'KYOTAKU', 'HQ');

-- CreateEnum
CREATE TYPE "Bank" AS ENUM ('GMO', 'SENDAI');

-- CreateEnum
CREATE TYPE "TxCategory" AS ENUM ('EXPENSE', 'PAYROLL', 'TAX_SOCIAL', 'INTERNAL_TRANSFER', 'CARD_SETTLEMENT', 'LOAN_PRINCIPAL', 'LOAN_REPAYMENT_MIXED', 'LOAN_INTEREST', 'REVENUE_RECEIPT', 'OTHER_INCOME', 'UNCLASSIFIED');

-- CreateEnum
CREATE TYPE "ClassifiedBy" AS ENUM ('RULE', 'MANUAL', 'TRANSFER_MATCH', 'NONE');

-- CreateEnum
CREATE TYPE "TxDirection" AS ENUM ('IN', 'OUT', 'ANY');

-- CreateEnum
CREATE TYPE "RuleField" AS ENUM ('DESCRIPTION', 'MEMO');

-- CreateEnum
CREATE TYPE "CostAllocation" AS ENUM ('DIRECT', 'COMMON', 'HQ');

-- CreateEnum
CREATE TYPE "CostBehavior" AS ENUM ('LABOR', 'FIXED', 'VARIABLE');

-- CreateEnum
CREATE TYPE "AccountSection" AS ENUM ('REVENUE', 'REVENUE_ADJUSTMENT', 'COGS', 'SGA', 'NON_OPERATING_INCOME', 'NON_OPERATING_EXPENSE', 'EXTRAORDINARY', 'SUBTOTAL');

-- CreateEnum
CREATE TYPE "FactState" AS ENUM ('ACTIVE', 'SUPERSEDED', 'HELD');

-- CreateEnum
CREATE TYPE "ValueStatus" AS ENUM ('ESTIMATED', 'RECONCILED', 'FINAL');

-- CreateEnum
CREATE TYPE "MonthStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "RevenueSource" AS ENUM ('KYOTAKU_SHEET', 'IBOW_SALES');

-- CreateEnum
CREATE TYPE "VisitSource" AS ENUM ('ZEST', 'IBOW');

-- CreateEnum
CREATE TYPE "VisitKind" AS ENUM ('SCHEDULED', 'ACTUAL');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('NURSE', 'PT', 'OT', 'ST', 'CARE_MANAGER', 'OTHER');

-- CreateEnum
CREATE TYPE "MappingPurpose" AS ENUM ('SALES', 'VISITS', 'METRICS');

-- CreateEnum
CREATE TYPE "TargetMetric" AS ENUM ('REVENUE', 'OPERATING_PROFIT', 'VISITS');

-- CreateEnum
CREATE TYPE "RecalcTrigger" AS ENUM ('CRON', 'MANUAL', 'IMPORT', 'CLOSE');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "detail" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "detectedBy" TEXT NOT NULL,
    "origin" "DataOrigin" NOT NULL DEFAULT 'REAL',
    "status" "ImportStatus" NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "heldRows" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TEXT,
    "periodEnd" TEXT,
    "duplicateOfId" TEXT,
    "rawFile" BYTEA,
    "rawPurgedAt" TIMESTAMP(3),
    "headerInfo" JSONB,
    "mappingId" TEXT,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportIssue" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sheet" TEXT,
    "rowNumber" INTEGER,
    "column" TEXT,

    CONSTRAINT "ImportIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColumnMapping" (
    "id" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "headerSignature" TEXT NOT NULL,
    "purpose" "MappingPurpose" NOT NULL,
    "fields" JSONB NOT NULL,
    "valueMaps" JSONB NOT NULL,
    "note" TEXT,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ColumnMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "bank" "Bank" NOT NULL,
    "accountKey" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankTransaction" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "origin" "DataOrigin" NOT NULL,
    "accountId" TEXT NOT NULL,
    "txDate" DATE NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "seq" INTEGER,
    "description" TEXT NOT NULL,
    "memo" TEXT,
    "txType" TEXT,
    "counterpartyBank" TEXT,
    "deposit" INTEGER NOT NULL,
    "withdrawal" INTEGER NOT NULL,
    "balance" INTEGER,
    "fingerprint" TEXT NOT NULL,
    "category" "TxCategory" NOT NULL DEFAULT 'UNCLASSIFIED',
    "accountTitle" TEXT,
    "unit" "Unit",
    "allocation" "CostAllocation",
    "behavior" "CostBehavior",
    "classifiedBy" "ClassifiedBy" NOT NULL DEFAULT 'NONE',
    "ruleId" TEXT,
    "transferPairId" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassificationRule" (
    "id" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "bank" "Bank",
    "direction" "TxDirection" NOT NULL DEFAULT 'ANY',
    "field" "RuleField" NOT NULL DEFAULT 'DESCRIPTION',
    "pattern" TEXT NOT NULL,
    "category" "TxCategory" NOT NULL,
    "accountTitle" TEXT,
    "unit" "Unit",
    "allocation" "CostAllocation",
    "behavior" "CostBehavior",
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassificationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevenueFact" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "origin" "DataOrigin" NOT NULL,
    "source" "RevenueSource" NOT NULL,
    "unit" "Unit" NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "quantity" INTEGER,
    "detail" JSONB,
    "state" "FactState" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevenueFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrialBalanceLine" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "origin" "DataOrigin" NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "yearMonth" TEXT,
    "segment" "Unit" NOT NULL,
    "accountName" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "state" "FactState" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrialBalanceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitRecord" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "origin" "DataOrigin" NOT NULL,
    "source" "VisitSource" NOT NULL,
    "kind" "VisitKind" NOT NULL,
    "visitDate" DATE NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "unit" "Unit" NOT NULL,
    "staffKey" TEXT,
    "jobType" "JobType",
    "subjectKey" TEXT,
    "minutes" INTEGER,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "fingerprint" TEXT NOT NULL,

    CONSTRAINT "VisitRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricValue" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "origin" "DataOrigin" NOT NULL,
    "source" "VisitSource" NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "unit" "Unit" NOT NULL,
    "metricKey" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "state" "FactState" NOT NULL,

    CONSTRAINT "MetricValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountTitle" (
    "name" TEXT NOT NULL,
    "section" "AccountSection" NOT NULL,
    "behavior" "CostBehavior",
    "allocation" "CostAllocation",
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AccountTitle_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "MonthClose" (
    "yearMonth" TEXT NOT NULL,
    "status" "MonthStatus" NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenReason" TEXT,

    CONSTRAINT "MonthClose_pkey" PRIMARY KEY ("yearMonth")
);

-- CreateTable
CREATE TABLE "Target" (
    "id" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "unit" "Unit" NOT NULL,
    "metric" "TargetMetric" NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "Target_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffCapacity" (
    "id" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "unit" "Unit" NOT NULL,
    "jobType" "JobType" NOT NULL,
    "headcount" INTEGER NOT NULL,
    "availableMinutes" INTEGER NOT NULL,

    CONSTRAINT "StaffCapacity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "RecalcRun" (
    "id" TEXT NOT NULL,
    "trigger" "RecalcTrigger" NOT NULL,
    "status" "RunStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "message" TEXT,
    "months" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RecalcRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlySnapshot" (
    "id" TEXT NOT NULL,
    "origin" "DataOrigin" NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "unit" "Unit" NOT NULL,
    "valueStatus" "ValueStatus" NOT NULL,
    "data" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "frozen" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MonthlySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AuditLog_at_idx" ON "AuditLog"("at");

-- CreateIndex
CREATE INDEX "ImportBatch_sha256_origin_idx" ON "ImportBatch"("sha256", "origin");

-- CreateIndex
CREATE INDEX "ImportBatch_createdAt_idx" ON "ImportBatch"("createdAt");

-- CreateIndex
CREATE INDEX "ImportIssue_batchId_idx" ON "ImportIssue"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "ColumnMapping_sourceType_headerSignature_key" ON "ColumnMapping"("sourceType", "headerSignature");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_accountKey_key" ON "BankAccount"("accountKey");

-- CreateIndex
CREATE UNIQUE INDEX "BankTransaction_fingerprint_key" ON "BankTransaction"("fingerprint");

-- CreateIndex
CREATE INDEX "BankTransaction_origin_yearMonth_category_idx" ON "BankTransaction"("origin", "yearMonth", "category");

-- CreateIndex
CREATE INDEX "BankTransaction_txDate_idx" ON "BankTransaction"("txDate");

-- CreateIndex
CREATE INDEX "RevenueFact_origin_yearMonth_unit_source_state_idx" ON "RevenueFact"("origin", "yearMonth", "unit", "source", "state");

-- CreateIndex
CREATE INDEX "TrialBalanceLine_origin_yearMonth_segment_state_idx" ON "TrialBalanceLine"("origin", "yearMonth", "segment", "state");

-- CreateIndex
CREATE UNIQUE INDEX "VisitRecord_fingerprint_key" ON "VisitRecord"("fingerprint");

-- CreateIndex
CREATE INDEX "VisitRecord_origin_yearMonth_kind_idx" ON "VisitRecord"("origin", "yearMonth", "kind");

-- CreateIndex
CREATE INDEX "MetricValue_origin_yearMonth_metricKey_state_idx" ON "MetricValue"("origin", "yearMonth", "metricKey", "state");

-- CreateIndex
CREATE UNIQUE INDEX "Target_yearMonth_unit_metric_key" ON "Target"("yearMonth", "unit", "metric");

-- CreateIndex
CREATE UNIQUE INDEX "StaffCapacity_yearMonth_unit_jobType_key" ON "StaffCapacity"("yearMonth", "unit", "jobType");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlySnapshot_origin_yearMonth_unit_key" ON "MonthlySnapshot"("origin", "yearMonth", "unit");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_mappingId_fkey" FOREIGN KEY ("mappingId") REFERENCES "ColumnMapping"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportIssue" ADD CONSTRAINT "ImportIssue_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColumnMapping" ADD CONSTRAINT "ColumnMapping_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevenueFact" ADD CONSTRAINT "RevenueFact_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialBalanceLine" ADD CONSTRAINT "TrialBalanceLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitRecord" ADD CONSTRAINT "VisitRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricValue" ADD CONSTRAINT "MetricValue_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthClose" ADD CONSTRAINT "MonthClose_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
