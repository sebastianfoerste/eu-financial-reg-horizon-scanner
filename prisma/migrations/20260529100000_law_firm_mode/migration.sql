CREATE TYPE "OrganisationTenantKind" AS ENUM (
  'REGULATED_ENTITY',
  'LAW_FIRM',
  'COMPLIANCE_CONSULTANCY',
  'INTERNAL'
);

CREATE TYPE "FirmMatterType" AS ENUM (
  'REGULATORY_ADVISORY',
  'AUTHORISATION',
  'TRANSACTION_DILIGENCE',
  'FUND_STRUCTURING',
  'DISPUTE',
  'IMPLEMENTATION',
  'OUTSOURCING'
);

CREATE TYPE "FirmMatterStatus" AS ENUM (
  'OPEN',
  'MONITORING',
  'PAUSED',
  'CLOSED'
);

CREATE TYPE "ConfidentialityLevel" AS ENUM (
  'STANDARD',
  'CONFIDENTIAL',
  'HIGHLY_CONFIDENTIAL',
  'PRIVILEGED'
);

CREATE TYPE "AccessPolicy" AS ENUM (
  'FIRM_INTERNAL',
  'MATTER_TEAM',
  'CLIENT_VISIBLE',
  'RESTRICTED'
);

CREATE TYPE "MatterSignalStatus" AS ENUM (
  'NEW',
  'TRIAGED',
  'BRIEF_DRAFTED',
  'CLIENT_READY',
  'ARCHIVED'
);

CREATE TYPE "ClientBriefStatus" AS ENUM (
  'DRAFT',
  'SENIOR_REVIEW',
  'PARTNER_REVIEW',
  'CLIENT_READY',
  'ARCHIVED'
);

CREATE TYPE "KnowledgeAssetKind" AS ENUM (
  'PRECEDENT',
  'CHECKLIST',
  'PLAYBOOK',
  'CLIENT_MEMO',
  'DILIGENCE_INSERT',
  'BOARD_NOTE',
  'AUTHORITY_DIALOGUE_NOTE'
);

CREATE TYPE "KnowledgeAssetStatus" AS ENUM (
  'DRAFT',
  'APPROVED',
  'ARCHIVED'
);

CREATE TYPE "FirmProfile" AS ENUM (
  'GLOBAL_ELITE',
  'TECH_BOUTIQUE',
  'FINTECH_SPECIALIST'
);

CREATE TYPE "OpportunityStage" AS ENUM (
  'IDENTIFIED',
  'REVIEWING',
  'PROPOSED',
  'WON',
  'LOST',
  'ARCHIVED'
);

ALTER TABLE "Organisation"
ADD COLUMN "tenantKind" "OrganisationTenantKind" NOT NULL DEFAULT 'REGULATED_ENTITY';

CREATE TABLE "LawFirmClient" (
  "id" TEXT NOT NULL,
  "firmOrganisationId" TEXT NOT NULL,
  "linkedOrganisationId" TEXT,
  "displayName" TEXT NOT NULL,
  "legalName" TEXT,
  "sector" TEXT,
  "relationshipPartnerName" TEXT NOT NULL,
  "responsibleAssociateName" TEXT,
  "confidentialityLevel" "ConfidentialityLevel" NOT NULL DEFAULT 'CONFIDENTIAL',
  "defaultAccessPolicy" "AccessPolicy" NOT NULL DEFAULT 'FIRM_INTERNAL',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LawFirmClient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PracticeGroup" (
  "id" TEXT NOT NULL,
  "firmOrganisationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "focusDescription" TEXT NOT NULL,
  "leadPartnerName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PracticeGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FirmMatter" (
  "id" TEXT NOT NULL,
  "firmOrganisationId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "practiceGroupId" TEXT,
  "matterCode" TEXT,
  "title" TEXT NOT NULL,
  "matterType" "FirmMatterType" NOT NULL,
  "status" "FirmMatterStatus" NOT NULL DEFAULT 'OPEN',
  "sensitivity" "ConfidentialityLevel" NOT NULL DEFAULT 'CONFIDENTIAL',
  "accessPolicy" "AccessPolicy" NOT NULL DEFAULT 'MATTER_TEAM',
  "relationshipPartnerName" TEXT NOT NULL,
  "responsibleAssociateName" TEXT NOT NULL,
  "jurisdictionTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "regulationFamilies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "activities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "licenceTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "topicPaths" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FirmMatter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MatterPublication" (
  "id" TEXT NOT NULL,
  "matterId" TEXT NOT NULL,
  "publicationId" TEXT NOT NULL,
  "relevanceScore" DOUBLE PRECISION NOT NULL,
  "relevanceBucket" "ImpactBucket" NOT NULL,
  "rationale" TEXT NOT NULL,
  "suggestedAction" TEXT NOT NULL,
  "status" "MatterSignalStatus" NOT NULL DEFAULT 'NEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MatterPublication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientBrief" (
  "id" TEXT NOT NULL,
  "firmOrganisationId" TEXT NOT NULL,
  "matterId" TEXT NOT NULL,
  "publicationId" TEXT,
  "status" "ClientBriefStatus" NOT NULL DEFAULT 'DRAFT',
  "title" TEXT NOT NULL,
  "audience" TEXT NOT NULL,
  "disclaimerProfile" TEXT NOT NULL DEFAULT 'internal_review',
  "body" TEXT NOT NULL,
  "sourceProvenanceJson" JSONB NOT NULL,
  "reviewerName" TEXT,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClientBrief_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeAsset" (
  "id" TEXT NOT NULL,
  "firmOrganisationId" TEXT NOT NULL,
  "matterId" TEXT,
  "publicationId" TEXT,
  "kind" "KnowledgeAssetKind" NOT NULL,
  "status" "KnowledgeAssetStatus" NOT NULL DEFAULT 'DRAFT',
  "visibility" "AccessPolicy" NOT NULL DEFAULT 'FIRM_INTERNAL',
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "body" TEXT,
  "regulationFamilies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "activities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "licenceTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "topicPaths" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "jurisdictions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sourceProvenanceJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "KnowledgeAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegulatoryPlaybook" (
  "id" TEXT NOT NULL,
  "firmOrganisationId" TEXT NOT NULL,
  "practiceGroupId" TEXT,
  "firmProfile" "FirmProfile" NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "triggerRegulationFamilies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "triggerTopics" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "triggerLicenceTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "workflowSteps" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "outputTemplates" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RegulatoryPlaybook_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EthicalWall" (
  "id" TEXT NOT NULL,
  "matterId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "accessPolicy" "AccessPolicy" NOT NULL DEFAULT 'RESTRICTED',
  "allowedUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "restrictedUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EthicalWall_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommercialOpportunity" (
  "id" TEXT NOT NULL,
  "firmOrganisationId" TEXT NOT NULL,
  "clientId" TEXT,
  "matterId" TEXT,
  "publicationId" TEXT,
  "serviceOfferingId" TEXT,
  "stage" "OpportunityStage" NOT NULL DEFAULT 'IDENTIFIED',
  "title" TEXT NOT NULL,
  "rationale" TEXT NOT NULL,
  "nextAction" TEXT NOT NULL,
  "ownerName" TEXT NOT NULL,
  "estimatedValueEur" DECIMAL(12,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CommercialOpportunity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Organisation_tenantKind_idx" ON "Organisation"("tenantKind");
CREATE UNIQUE INDEX "LawFirmClient_firmOrganisationId_displayName_key" ON "LawFirmClient"("firmOrganisationId", "displayName");
CREATE INDEX "LawFirmClient_firmOrganisationId_idx" ON "LawFirmClient"("firmOrganisationId");
CREATE INDEX "LawFirmClient_confidentialityLevel_idx" ON "LawFirmClient"("confidentialityLevel");
CREATE UNIQUE INDEX "PracticeGroup_firmOrganisationId_slug_key" ON "PracticeGroup"("firmOrganisationId", "slug");
CREATE INDEX "PracticeGroup_firmOrganisationId_idx" ON "PracticeGroup"("firmOrganisationId");
CREATE UNIQUE INDEX "FirmMatter_firmOrganisationId_matterCode_key" ON "FirmMatter"("firmOrganisationId", "matterCode");
CREATE INDEX "FirmMatter_firmOrganisationId_status_idx" ON "FirmMatter"("firmOrganisationId", "status");
CREATE INDEX "FirmMatter_clientId_idx" ON "FirmMatter"("clientId");
CREATE INDEX "FirmMatter_practiceGroupId_idx" ON "FirmMatter"("practiceGroupId");
CREATE UNIQUE INDEX "MatterPublication_matterId_publicationId_key" ON "MatterPublication"("matterId", "publicationId");
CREATE INDEX "MatterPublication_publicationId_relevanceBucket_idx" ON "MatterPublication"("publicationId", "relevanceBucket");
CREATE INDEX "MatterPublication_matterId_status_idx" ON "MatterPublication"("matterId", "status");
CREATE INDEX "ClientBrief_firmOrganisationId_status_idx" ON "ClientBrief"("firmOrganisationId", "status");
CREATE INDEX "ClientBrief_matterId_status_idx" ON "ClientBrief"("matterId", "status");
CREATE INDEX "ClientBrief_publicationId_idx" ON "ClientBrief"("publicationId");
CREATE INDEX "KnowledgeAsset_firmOrganisationId_kind_idx" ON "KnowledgeAsset"("firmOrganisationId", "kind");
CREATE INDEX "KnowledgeAsset_matterId_idx" ON "KnowledgeAsset"("matterId");
CREATE INDEX "KnowledgeAsset_publicationId_idx" ON "KnowledgeAsset"("publicationId");
CREATE INDEX "RegulatoryPlaybook_firmOrganisationId_firmProfile_idx" ON "RegulatoryPlaybook"("firmOrganisationId", "firmProfile");
CREATE INDEX "RegulatoryPlaybook_practiceGroupId_idx" ON "RegulatoryPlaybook"("practiceGroupId");
CREATE INDEX "EthicalWall_matterId_idx" ON "EthicalWall"("matterId");
CREATE INDEX "CommercialOpportunity_firmOrganisationId_stage_idx" ON "CommercialOpportunity"("firmOrganisationId", "stage");
CREATE INDEX "CommercialOpportunity_clientId_idx" ON "CommercialOpportunity"("clientId");
CREATE INDEX "CommercialOpportunity_matterId_idx" ON "CommercialOpportunity"("matterId");
CREATE INDEX "CommercialOpportunity_publicationId_idx" ON "CommercialOpportunity"("publicationId");

ALTER TABLE "LawFirmClient"
ADD CONSTRAINT "LawFirmClient_firmOrganisationId_fkey"
FOREIGN KEY ("firmOrganisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LawFirmClient"
ADD CONSTRAINT "LawFirmClient_linkedOrganisationId_fkey"
FOREIGN KEY ("linkedOrganisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PracticeGroup"
ADD CONSTRAINT "PracticeGroup_firmOrganisationId_fkey"
FOREIGN KEY ("firmOrganisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FirmMatter"
ADD CONSTRAINT "FirmMatter_firmOrganisationId_fkey"
FOREIGN KEY ("firmOrganisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FirmMatter"
ADD CONSTRAINT "FirmMatter_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "LawFirmClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FirmMatter"
ADD CONSTRAINT "FirmMatter_practiceGroupId_fkey"
FOREIGN KEY ("practiceGroupId") REFERENCES "PracticeGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MatterPublication"
ADD CONSTRAINT "MatterPublication_matterId_fkey"
FOREIGN KEY ("matterId") REFERENCES "FirmMatter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MatterPublication"
ADD CONSTRAINT "MatterPublication_publicationId_fkey"
FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientBrief"
ADD CONSTRAINT "ClientBrief_firmOrganisationId_fkey"
FOREIGN KEY ("firmOrganisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientBrief"
ADD CONSTRAINT "ClientBrief_matterId_fkey"
FOREIGN KEY ("matterId") REFERENCES "FirmMatter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientBrief"
ADD CONSTRAINT "ClientBrief_publicationId_fkey"
FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "KnowledgeAsset"
ADD CONSTRAINT "KnowledgeAsset_firmOrganisationId_fkey"
FOREIGN KEY ("firmOrganisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KnowledgeAsset"
ADD CONSTRAINT "KnowledgeAsset_matterId_fkey"
FOREIGN KEY ("matterId") REFERENCES "FirmMatter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "KnowledgeAsset"
ADD CONSTRAINT "KnowledgeAsset_publicationId_fkey"
FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RegulatoryPlaybook"
ADD CONSTRAINT "RegulatoryPlaybook_firmOrganisationId_fkey"
FOREIGN KEY ("firmOrganisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RegulatoryPlaybook"
ADD CONSTRAINT "RegulatoryPlaybook_practiceGroupId_fkey"
FOREIGN KEY ("practiceGroupId") REFERENCES "PracticeGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EthicalWall"
ADD CONSTRAINT "EthicalWall_matterId_fkey"
FOREIGN KEY ("matterId") REFERENCES "FirmMatter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommercialOpportunity"
ADD CONSTRAINT "CommercialOpportunity_firmOrganisationId_fkey"
FOREIGN KEY ("firmOrganisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommercialOpportunity"
ADD CONSTRAINT "CommercialOpportunity_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "LawFirmClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CommercialOpportunity"
ADD CONSTRAINT "CommercialOpportunity_matterId_fkey"
FOREIGN KEY ("matterId") REFERENCES "FirmMatter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CommercialOpportunity"
ADD CONSTRAINT "CommercialOpportunity_publicationId_fkey"
FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CommercialOpportunity"
ADD CONSTRAINT "CommercialOpportunity_serviceOfferingId_fkey"
FOREIGN KEY ("serviceOfferingId") REFERENCES "ServiceOffering"("id") ON DELETE SET NULL ON UPDATE CASCADE;
