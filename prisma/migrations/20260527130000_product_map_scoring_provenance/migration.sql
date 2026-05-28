ALTER TABLE "ProductMap"
ADD COLUMN "topicWatchlist" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "ProductMap"
SET "topicWatchlist" = ARRAY[
  'authorisation_and_passporting.initial_authorisation',
  'authorisation_and_passporting.change_of_control',
  'digital_assets_specific.white_paper_review',
  'ict_and_resilience.incident_reporting',
  'ict_and_resilience.third_party_arrangements',
  'aml_cft_sanctions.travel_rule',
  'conduct.complaints_handling'
]::TEXT[];

ALTER TABLE "ImpactScore"
ADD COLUMN "matchedTopics" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "matchedHomeJurisdictions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "matchedPassportJurisdictions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "criticalProductLineMatched" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "rawScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "floorAdjustment" DOUBLE PRECISION NOT NULL DEFAULT 0;
