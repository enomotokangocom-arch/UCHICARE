-- CreateTable
CREATE TABLE "StaffUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'RECRUITER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Occupation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InflowSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "campaign" TEXT,
    "qrUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lineUserId" TEXT,
    "lineDisplayName" TEXT,
    "name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "occupationId" TEXT,
    "occupationDetail" TEXT,
    "transferTiming" TEXT,
    "areaId" TEXT,
    "inflowSourceId" TEXT,
    "campaignParam" TEXT,
    "registeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLineReactionAt" DATETIME,
    "lastStaffContactAt" DATETIME,
    "leadStatus" TEXT NOT NULL DEFAULT 'LEAD_COLD',
    "leadScore" INTEGER NOT NULL DEFAULT 0,
    "stage" TEXT NOT NULL DEFAULT 'NURTURING',
    "assignedStaffId" TEXT,
    "memo" TEXT,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "blockedAt" DATETIME,
    "stepSequenceId" TEXT,
    "stepSequenceDay" INTEGER DEFAULT 0,
    "stepSequenceStartedAt" DATETIME,
    "lastRehearingSentAt" DATETIME,
    "onboardingState" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Candidate_occupationId_fkey" FOREIGN KEY ("occupationId") REFERENCES "Occupation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Candidate_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Candidate_inflowSourceId_fkey" FOREIGN KEY ("inflowSourceId") REFERENCES "InflowSource" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Candidate_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "StaffUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Candidate_stepSequenceId_fkey" FOREIGN KEY ("stepSequenceId") REFERENCES "StepSequence" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CandidateTag" (
    "candidateId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("candidateId", "tagId"),
    CONSTRAINT "CandidateTag_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CandidateTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CandidateEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT,
    "payload" TEXT,
    "scoreDelta" INTEGER DEFAULT 0,
    "actorType" TEXT NOT NULL DEFAULT 'SYSTEM',
    "actorStaffId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CandidateEvent_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CandidateEvent_actorStaffId_fkey" FOREIGN KEY ("actorStaffId") REFERENCES "StaffUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeadScoreRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actionCode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LeadScoreConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "warmThreshold" INTEGER NOT NULL DEFAULT 20,
    "hotThreshold" INTEGER NOT NULL DEFAULT 50,
    "decayEnabled" BOOLEAN NOT NULL DEFAULT false,
    "decayPoints" INTEGER NOT NULL DEFAULT 5,
    "decayAfterDays" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LineAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "channelId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LineMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT,
    "lineAccountId" TEXT,
    "direction" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "content" TEXT,
    "lineMessageId" TEXT,
    "webhookEventId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LineMessage_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LineMessage_lineAccountId_fkey" FOREIGN KEY ("lineAccountId") REFERENCES "LineAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LineInteraction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LineInteraction_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RichMenuConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slot" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "imageUrl" TEXT,
    "actionType" TEXT NOT NULL DEFAULT 'URL',
    "actionValue" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StepSequence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StepMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stepSequenceId" TEXT NOT NULL,
    "dayOffset" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "ctaOptions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StepMessage_stepSequenceId_fkey" FOREIGN KEY ("stepSequenceId") REFERENCES "StepSequence" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StepMessageOccupation" (
    "stepMessageId" TEXT NOT NULL,
    "occupationId" TEXT NOT NULL,

    PRIMARY KEY ("stepMessageId", "occupationId"),
    CONSTRAINT "StepMessageOccupation_stepMessageId_fkey" FOREIGN KEY ("stepMessageId") REFERENCES "StepMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StepMessageOccupation_occupationId_fkey" FOREIGN KEY ("occupationId") REFERENCES "Occupation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CandidateStepProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT NOT NULL,
    "stepMessageId" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CandidateStepProgress_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CandidateStepProgress_stepMessageId_fkey" FOREIGN KEY ("stepMessageId") REFERENCES "StepMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "ctaLabel" TEXT,
    "ctaUrl" TEXT,
    "targetOccupations" TEXT,
    "targetTimings" TEXT,
    "targetAreas" TEXT,
    "targetLeadStatuses" TEXT,
    "targetStages" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" DATETIME,
    "sentAt" DATETIME,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "aiPrompt" TEXT,
    "createdByStaffId" TEXT,
    "approvedByStaffId" TEXT,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Campaign_createdByStaffId_fkey" FOREIGN KEY ("createdByStaffId") REFERENCES "StaffUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Campaign_approvedByStaffId_fkey" FOREIGN KEY ("approvedByStaffId") REFERENCES "StaffUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CampaignAudience" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignAudience_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignAudience_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CampaignDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sentAt" DATETIME,
    "lineMessageId" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignDelivery_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignDelivery_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecruitmentActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT NOT NULL,
    "staffId" TEXT,
    "activityType" TEXT NOT NULL,
    "note" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecruitmentActivity_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecruitmentActivity_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CASUAL',
    "scheduledAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "location" TEXT,
    "note" TEXT,
    "calendarEventId" TEXT,
    "createdByStaffId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Interview_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Interview_createdByStaffId_fkey" FOREIGN KEY ("createdByStaffId") REFERENCES "StaffUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT NOT NULL,
    "scheduledAt" DATETIME,
    "facility" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "note" TEXT,
    "calendarEventId" TEXT,
    "createdByStaffId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Visit_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Visit_createdByStaffId_fkey" FOREIGN KEY ("createdByStaffId") REFERENCES "StaffUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT NOT NULL,
    "occupationId" TEXT,
    "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Application_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Application_occupationId_fkey" FOREIGN KEY ("occupationId") REFERENCES "Occupation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "candidateId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME,
    "readAt" DATETIME,
    "readByStaffId" TEXT,
    CONSTRAINT "Notification_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Notification_readByStaffId_fkey" FOREIGN KEY ("readByStaffId") REFERENCES "StaffUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "before" TEXT,
    "after" TEXT,
    "ip" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffUser_email_key" ON "StaffUser"("email");

-- CreateIndex
CREATE INDEX "StaffUser_role_idx" ON "StaffUser"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Occupation_code_key" ON "Occupation"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_code_key" ON "Tag"("code");

-- CreateIndex
CREATE UNIQUE INDEX "InflowSource_code_key" ON "InflowSource"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_lineUserId_key" ON "Candidate"("lineUserId");

-- CreateIndex
CREATE INDEX "Candidate_leadStatus_idx" ON "Candidate"("leadStatus");

-- CreateIndex
CREATE INDEX "Candidate_stage_idx" ON "Candidate"("stage");

-- CreateIndex
CREATE INDEX "Candidate_occupationId_idx" ON "Candidate"("occupationId");

-- CreateIndex
CREATE INDEX "Candidate_areaId_idx" ON "Candidate"("areaId");

-- CreateIndex
CREATE INDEX "Candidate_transferTiming_idx" ON "Candidate"("transferTiming");

-- CreateIndex
CREATE INDEX "Candidate_assignedStaffId_idx" ON "Candidate"("assignedStaffId");

-- CreateIndex
CREATE INDEX "Candidate_registeredAt_idx" ON "Candidate"("registeredAt");

-- CreateIndex
CREATE INDEX "Candidate_deletedAt_idx" ON "Candidate"("deletedAt");

-- CreateIndex
CREATE INDEX "CandidateEvent_candidateId_createdAt_idx" ON "CandidateEvent"("candidateId", "createdAt");

-- CreateIndex
CREATE INDEX "CandidateEvent_type_idx" ON "CandidateEvent"("type");

-- CreateIndex
CREATE UNIQUE INDEX "LeadScoreRule_actionCode_key" ON "LeadScoreRule"("actionCode");

-- CreateIndex
CREATE UNIQUE INDEX "LineMessage_lineMessageId_key" ON "LineMessage"("lineMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "LineMessage_webhookEventId_key" ON "LineMessage"("webhookEventId");

-- CreateIndex
CREATE INDEX "LineMessage_candidateId_createdAt_idx" ON "LineMessage"("candidateId", "createdAt");

-- CreateIndex
CREATE INDEX "LineInteraction_candidateId_createdAt_idx" ON "LineInteraction"("candidateId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RichMenuConfig_slot_key" ON "RichMenuConfig"("slot");

-- CreateIndex
CREATE INDEX "StepMessage_stepSequenceId_dayOffset_idx" ON "StepMessage"("stepSequenceId", "dayOffset");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateStepProgress_candidateId_stepMessageId_key" ON "CandidateStepProgress"("candidateId", "stepMessageId");

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignAudience_campaignId_candidateId_key" ON "CampaignAudience"("campaignId", "candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignDelivery_campaignId_candidateId_key" ON "CampaignDelivery"("campaignId", "candidateId");

-- CreateIndex
CREATE INDEX "RecruitmentActivity_candidateId_occurredAt_idx" ON "RecruitmentActivity"("candidateId", "occurredAt");

-- CreateIndex
CREATE INDEX "Interview_candidateId_idx" ON "Interview"("candidateId");

-- CreateIndex
CREATE INDEX "Visit_candidateId_idx" ON "Visit"("candidateId");

-- CreateIndex
CREATE INDEX "Application_candidateId_idx" ON "Application"("candidateId");

-- CreateIndex
CREATE INDEX "Notification_status_createdAt_idx" ON "Notification"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
