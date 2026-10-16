-- 列マッピング方式の廃止（指示書の取込ファイルはすべて実ファイルで形式を確認し、専用の取込処理に置き換えたため）
-- マッピング待ちのまま残っている取込は失敗扱いにする（元ファイルは保持しない）
UPDATE "ImportBatch" SET "status" = 'FAILED' WHERE "status" = 'NEEDS_MAPPING';

-- AlterEnum
BEGIN;
CREATE TYPE "ImportStatus_new" AS ENUM ('PROCESSING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'DUPLICATE');
ALTER TABLE "ImportBatch" ALTER COLUMN "status" TYPE "ImportStatus_new" USING ("status"::text::"ImportStatus_new");
ALTER TYPE "ImportStatus" RENAME TO "ImportStatus_old";
ALTER TYPE "ImportStatus_new" RENAME TO "ImportStatus";
DROP TYPE "public"."ImportStatus_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "ColumnMapping" DROP CONSTRAINT "ColumnMapping_confirmedById_fkey";

-- DropForeignKey
ALTER TABLE "ImportBatch" DROP CONSTRAINT "ImportBatch_mappingId_fkey";

-- AlterTable
ALTER TABLE "ImportBatch" DROP COLUMN "headerInfo",
DROP COLUMN "mappingId",
DROP COLUMN "rawFile",
DROP COLUMN "rawPurgedAt";

-- DropTable
DROP TABLE "ColumnMapping";

-- DropEnum
DROP TYPE "MappingPurpose";

