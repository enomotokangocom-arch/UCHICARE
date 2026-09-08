-- CreateEnum
CREATE TYPE "StationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PLANNED', 'CLOSED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'STATION_MANAGER', 'SALES', 'HR', 'FINANCE', 'VIEWER');

-- CreateEnum
CREATE TYPE "EmployeeType" AS ENUM ('NURSE', 'THERAPIST', 'OFFICE', 'MANAGER', 'OTHER');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT');

-- CreateEnum
CREATE TYPE "RecruitmentStatus" AS ENUM ('OPEN', 'INTERVIEWING', 'OFFERED', 'FILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PatientEndReason" AS ENUM ('HOSPITALIZED', 'DECEASED', 'IMPROVED', 'TRANSFERRED', 'FAMILY_REQUEST', 'OTHER');

-- CreateEnum
CREATE TYPE "PatientEventType" AS ENUM ('ADMISSION', 'DISCHARGE', 'HOSPITALIZATION', 'CARE_LEVEL_CHANGE', 'COMPLAINT', 'INCIDENT', 'OTHER');

-- CreateEnum
CREATE TYPE "SalesActivityType" AS ENUM ('VISIT', 'CALL', 'EVENT', 'MATERIAL_SENT', 'OTHER');

-- CreateEnum
CREATE TYPE "KPIValueType" AS ENUM ('FACT', 'CALCULATED', 'AI_ESTIMATE');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "AIInsightKind" AS ENUM ('CAUSE_EXPLANATION', 'HYPOTHESIS', 'CHAT_ANSWER', 'ACTION_SUGGESTION', 'FORECAST_NARRATIVE');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "DecisionStatus" AS ENUM ('DRAFT', 'AI_RECOMMENDED', 'HUMAN_REVIEWED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('DRAFT', 'AI_RECOMMENDED', 'HUMAN_APPROVED', 'IN_PROGRESS', 'COMPLETED', 'RESULT_VERIFIED', 'REJECTED', 'HELD');

-- CreateEnum
CREATE TYPE "ApprovalCategory" AS ENUM ('HIRING', 'TERMINATION', 'SALARY', 'PERFORMANCE_REVIEW', 'INVESTMENT', 'LOAN', 'CONTRACT', 'NEW_STATION', 'WITHDRAWAL');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'PARTIAL');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "planTier" TEXT NOT NULL DEFAULT 'starter',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Tokyo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Station" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "status" "StationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Station_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "stationId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "employeeType" "EmployeeType" NOT NULL,
    "employmentType" "EmploymentType" NOT NULL,
    "fte" DOUBLE PRECISION NOT NULL,
    "monthlySalaryCost" DECIMAL(65,30) NOT NULL,
    "hiredAt" TIMESTAMP(3) NOT NULL,
    "resignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "targetEmployeeType" "EmployeeType" NOT NULL,
    "status" "RecruitmentStatus" NOT NULL,
    "postedAt" TIMESTAMP(3),
    "filledAt" TIMESTAMP(3),
    "employeeId" TEXT,
    "costOfHire" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecruitmentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "pseudoId" TEXT NOT NULL,
    "ageBand" TEXT,
    "careLevel" TEXT,
    "primaryDiagnosisCategory" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "endReason" "PatientEndReason",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientIdentity" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encryptedName" BYTEA NOT NULL,
    "encryptedAddress" BYTEA,
    "insurerNumberHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "type" "PatientEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "visitedAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "visitType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stationId" TEXT,
    "yearMonth" TEXT NOT NULL,
    "revenue" DECIMAL(65,30) NOT NULL,
    "laborCost" DECIMAL(65,30) NOT NULL,
    "otherFixedCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "otherVariableCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cashBalance" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralSource" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "isDormant" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesActivity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "referralSourceId" TEXT,
    "salesRepUserId" TEXT,
    "activityType" "SalesActivityType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "resultedInReferral" BOOLEAN NOT NULL DEFAULT false,
    "referredPatientCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KPISnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stationId" TEXT,
    "yearMonth" TEXT NOT NULL,
    "kpiCode" TEXT NOT NULL,
    "value" DECIMAL(65,30),
    "insufficientData" BOOLEAN NOT NULL DEFAULT false,
    "valueType" "KPIValueType" NOT NULL DEFAULT 'CALCULATED',
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KPISnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnomalyThreshold" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stationId" TEXT,
    "ruleCode" TEXT NOT NULL,
    "paramKey" TEXT NOT NULL,
    "paramValue" DECIMAL(65,30) NOT NULL,
    "updatedByUserId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnomalyThreshold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stationId" TEXT,
    "ruleCode" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "title" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "yearMonth" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "sourceKpiSnapshotIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIInsight" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "decisionId" TEXT,
    "kind" "AIInsightKind" NOT NULL,
    "inputSummary" JSONB NOT NULL,
    "outputText" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stationId" TEXT,
    "alertId" TEXT,
    "ruleCode" TEXT NOT NULL,
    "priority" "Priority" NOT NULL,
    "problemSummary" TEXT NOT NULL,
    "rootCause" JSONB NOT NULL,
    "predictedImpact" DECIMAL(65,30),
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" "DecisionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Action" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "requiresApprovalCategory" "ApprovalCategory",
    "deadline" TIMESTAMP(3),
    "expectedImpact" JSONB,
    "actualImpact" JSONB,
    "status" "ActionStatus" NOT NULL DEFAULT 'DRAFT',
    "holdReason" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inputParams" JSONB NOT NULL,
    "resultSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataImportBatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "targetEntity" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "rowCount" INTEGER,
    "errorCount" INTEGER,
    "errorDetail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DataImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Station_organizationId_idx" ON "Station"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE INDEX "Employee_organizationId_stationId_idx" ON "Employee"("organizationId", "stationId");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentRecord_employeeId_key" ON "RecruitmentRecord"("employeeId");

-- CreateIndex
CREATE INDEX "RecruitmentRecord_organizationId_stationId_idx" ON "RecruitmentRecord"("organizationId", "stationId");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_pseudoId_key" ON "Patient"("pseudoId");

-- CreateIndex
CREATE INDEX "Patient_organizationId_stationId_idx" ON "Patient"("organizationId", "stationId");

-- CreateIndex
CREATE UNIQUE INDEX "PatientIdentity_patientId_key" ON "PatientIdentity"("patientId");

-- CreateIndex
CREATE INDEX "PatientEvent_organizationId_patientId_idx" ON "PatientEvent"("organizationId", "patientId");

-- CreateIndex
CREATE INDEX "Visit_organizationId_stationId_visitedAt_idx" ON "Visit"("organizationId", "stationId", "visitedAt");

-- CreateIndex
CREATE INDEX "Visit_employeeId_visitedAt_idx" ON "Visit"("employeeId", "visitedAt");

-- CreateIndex
CREATE INDEX "FinancialRecord_organizationId_yearMonth_idx" ON "FinancialRecord"("organizationId", "yearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialRecord_organizationId_stationId_yearMonth_key" ON "FinancialRecord"("organizationId", "stationId", "yearMonth");

-- CreateIndex
CREATE INDEX "ReferralSource_organizationId_idx" ON "ReferralSource"("organizationId");

-- CreateIndex
CREATE INDEX "SalesActivity_organizationId_stationId_occurredAt_idx" ON "SalesActivity"("organizationId", "stationId", "occurredAt");

-- CreateIndex
CREATE INDEX "SalesActivity_referralSourceId_idx" ON "SalesActivity"("referralSourceId");

-- CreateIndex
CREATE INDEX "KPISnapshot_organizationId_yearMonth_kpiCode_idx" ON "KPISnapshot"("organizationId", "yearMonth", "kpiCode");

-- CreateIndex
CREATE UNIQUE INDEX "KPISnapshot_organizationId_stationId_yearMonth_kpiCode_key" ON "KPISnapshot"("organizationId", "stationId", "yearMonth", "kpiCode");

-- CreateIndex
CREATE UNIQUE INDEX "AnomalyThreshold_organizationId_stationId_ruleCode_paramKey_key" ON "AnomalyThreshold"("organizationId", "stationId", "ruleCode", "paramKey");

-- CreateIndex
CREATE INDEX "Alert_organizationId_status_severity_idx" ON "Alert"("organizationId", "status", "severity");

-- CreateIndex
CREATE INDEX "AIInsight_organizationId_decisionId_idx" ON "AIInsight"("organizationId", "decisionId");

-- CreateIndex
CREATE INDEX "Decision_organizationId_status_priority_idx" ON "Decision"("organizationId", "status", "priority");

-- CreateIndex
CREATE INDEX "Action_organizationId_status_idx" ON "Action"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Scenario_organizationId_idx" ON "Scenario"("organizationId");

-- CreateIndex
CREATE INDEX "DataImportBatch_organizationId_idx" ON "DataImportBatch"("organizationId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "Station" ADD CONSTRAINT "Station_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentRecord" ADD CONSTRAINT "RecruitmentRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentRecord" ADD CONSTRAINT "RecruitmentRecord_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentRecord" ADD CONSTRAINT "RecruitmentRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientEvent" ADD CONSTRAINT "PatientEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientEvent" ADD CONSTRAINT "PatientEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialRecord" ADD CONSTRAINT "FinancialRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialRecord" ADD CONSTRAINT "FinancialRecord_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralSource" ADD CONSTRAINT "ReferralSource_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesActivity" ADD CONSTRAINT "SalesActivity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesActivity" ADD CONSTRAINT "SalesActivity_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesActivity" ADD CONSTRAINT "SalesActivity_referralSourceId_fkey" FOREIGN KEY ("referralSourceId") REFERENCES "ReferralSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPISnapshot" ADD CONSTRAINT "KPISnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPISnapshot" ADD CONSTRAINT "KPISnapshot_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnomalyThreshold" ADD CONSTRAINT "AnomalyThreshold_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnomalyThreshold" ADD CONSTRAINT "AnomalyThreshold_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIInsight" ADD CONSTRAINT "AIInsight_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIInsight" ADD CONSTRAINT "AIInsight_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataImportBatch" ADD CONSTRAINT "DataImportBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
