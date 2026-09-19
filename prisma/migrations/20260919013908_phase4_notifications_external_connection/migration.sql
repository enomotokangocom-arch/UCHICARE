-- CreateEnum
CREATE TYPE "ExternalConnectorType" AS ENUM ('REST_JSON');

-- CreateEnum
CREATE TYPE "ExternalConnectionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ERROR');

-- AlterTable
ALTER TABLE "DataImportBatch" ADD COLUMN     "externalConnectionId" TEXT,
ALTER COLUMN "uploadedByUserId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "dailyDigestEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "digestEmailRecipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "notifyOnCriticalAlert" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slackWebhookUrl" TEXT;

-- CreateTable
CREATE TABLE "ExternalConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetEntity" TEXT NOT NULL,
    "connectorType" "ExternalConnectorType" NOT NULL DEFAULT 'REST_JSON',
    "baseUrl" TEXT NOT NULL,
    "authHeaderName" TEXT,
    "authTokenEncrypted" BYTEA,
    "status" "ExternalConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncStatus" "ImportStatus",
    "lastSyncError" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalConnection_organizationId_idx" ON "ExternalConnection"("organizationId");

-- AddForeignKey
ALTER TABLE "DataImportBatch" ADD CONSTRAINT "DataImportBatch_externalConnectionId_fkey" FOREIGN KEY ("externalConnectionId") REFERENCES "ExternalConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalConnection" ADD CONSTRAINT "ExternalConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
