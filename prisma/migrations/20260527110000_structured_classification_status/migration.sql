CREATE TYPE "ClassificationRunStatus" AS ENUM ('STUB', 'GENERATED', 'FALLBACK');

ALTER TABLE "Classification"
  ADD COLUMN "classifierStatus" "ClassificationRunStatus" NOT NULL DEFAULT 'STUB',
  ADD COLUMN "classifierError" TEXT;
