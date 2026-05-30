CREATE TYPE "AgentKind" AS ENUM (
  'SOURCE_MONITOR',
  'REVIEW_QA',
  'BRIEFING',
  'CLASSIFICATION_TRIAGE',
  'DIFF_EXPLAINER',
  'IMPACT_EXPLANATION',
  'ALERT_DRAFT',
  'SERVICE_ROUTING',
  'AUDIT_QA'
);

CREATE TYPE "AgentRunStatus" AS ENUM (
  'QUEUED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'BLOCKED_BY_POLICY'
);

CREATE TYPE "AgentArtifactType" AS ENUM (
  'FINDING',
  'REVIEW_SUGGESTION',
  'BRIEFING_DRAFT',
  'ALERT_DRAFT',
  'SERVICE_RULE_SUGGESTION',
  'SOURCE_DILIGENCE_NOTE',
  'IMPACT_EXPLANATION'
);

CREATE TYPE "AgentArtifactStatus" AS ENUM (
  'DRAFT',
  'APPROVED',
  'DISMISSED',
  'APPLIED'
);

CREATE TYPE "AgentLlmPolicy" AS ENUM (
  'NONE',
  'PUBLICATION_ONLY',
  'REDACTED_LOCAL_FACTS'
);

CREATE TABLE "AgentDefinition" (
  "id" TEXT NOT NULL,
  "kind" "AgentKind" NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "schedule" TEXT,
  "capabilities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "llmPolicy" "AgentLlmPolicy" NOT NULL DEFAULT 'NONE',
  "maxRuntimeSeconds" INTEGER NOT NULL DEFAULT 60,
  "maxCostCents" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AgentDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentToolPermission" (
  "id" TEXT NOT NULL,
  "agentDefinitionId" TEXT NOT NULL,
  "capability" TEXT NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AgentToolPermission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentRun" (
  "id" TEXT NOT NULL,
  "agentDefinitionId" TEXT,
  "kind" "AgentKind" NOT NULL,
  "status" "AgentRunStatus" NOT NULL DEFAULT 'QUEUED',
  "organisationId" TEXT,
  "triggeredByUserId" TEXT,
  "trigger" TEXT NOT NULL,
  "agentVersion" TEXT NOT NULL,
  "inputHash" TEXT NOT NULL,
  "outputHash" TEXT,
  "model" TEXT,
  "promptVersion" TEXT,
  "costCents" INTEGER,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "errorMessage" TEXT,

  CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentRunStep" (
  "id" TEXT NOT NULL,
  "agentRunId" TEXT NOT NULL,
  "stepKey" TEXT NOT NULL,
  "status" "AgentRunStatus" NOT NULL DEFAULT 'RUNNING',
  "inputJson" JSONB NOT NULL,
  "outputJson" JSONB,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),

  CONSTRAINT "AgentRunStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentArtifact" (
  "id" TEXT NOT NULL,
  "agentRunId" TEXT NOT NULL,
  "organisationId" TEXT,
  "publicationId" TEXT,
  "productMapId" TEXT,
  "type" "AgentArtifactType" NOT NULL,
  "status" "AgentArtifactStatus" NOT NULL DEFAULT 'DRAFT',
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "provenanceJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,

  CONSTRAINT "AgentArtifact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentDefinition_kind_key" ON "AgentDefinition"("kind");
CREATE UNIQUE INDEX "AgentToolPermission_agentDefinitionId_capability_key" ON "AgentToolPermission"("agentDefinitionId", "capability");
CREATE INDEX "AgentToolPermission_capability_isEnabled_idx" ON "AgentToolPermission"("capability", "isEnabled");
CREATE INDEX "AgentRun_kind_startedAt_idx" ON "AgentRun"("kind", "startedAt");
CREATE INDEX "AgentRun_organisationId_startedAt_idx" ON "AgentRun"("organisationId", "startedAt");
CREATE INDEX "AgentRun_status_startedAt_idx" ON "AgentRun"("status", "startedAt");
CREATE INDEX "AgentRunStep_agentRunId_startedAt_idx" ON "AgentRunStep"("agentRunId", "startedAt");
CREATE INDEX "AgentArtifact_organisationId_status_idx" ON "AgentArtifact"("organisationId", "status");
CREATE INDEX "AgentArtifact_publicationId_type_idx" ON "AgentArtifact"("publicationId", "type");
CREATE INDEX "AgentArtifact_type_status_idx" ON "AgentArtifact"("type", "status");
CREATE INDEX "AgentArtifact_createdAt_idx" ON "AgentArtifact"("createdAt");

ALTER TABLE "AgentToolPermission"
ADD CONSTRAINT "AgentToolPermission_agentDefinitionId_fkey"
FOREIGN KEY ("agentDefinitionId") REFERENCES "AgentDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentRun"
ADD CONSTRAINT "AgentRun_agentDefinitionId_fkey"
FOREIGN KEY ("agentDefinitionId") REFERENCES "AgentDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AgentRunStep"
ADD CONSTRAINT "AgentRunStep_agentRunId_fkey"
FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentArtifact"
ADD CONSTRAINT "AgentArtifact_agentRunId_fkey"
FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
