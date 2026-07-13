INSERT INTO "Source" (
  "id",
  "code",
  "displayName",
  "jurisdictionCode",
  "baseUrl",
  "feedType",
  "language",
  "isActive"
)
VALUES (
  'source:legora-synthetic',
  'legora-synthetic',
  'Synthetic research workspace source',
  'eu',
  'https://example.invalid/horizon-synthetic',
  'API',
  'en',
  false
)
ON CONFLICT ("id") DO NOTHING;

WITH referenced_publications AS (
  SELECT "publicationId" AS id FROM "ResearchPlan"
  UNION
  SELECT "publicationId" AS id FROM "BriefRevision"
)
INSERT INTO "Publication" (
  "id",
  "sourceId",
  "sourceUrl",
  "externalId",
  "title",
  "fetchedAt",
  "language",
  "publicationType",
  "rawHash",
  "bodyText",
  "hasAttachments"
)
SELECT
  id,
  'source:legora-synthetic',
  'https://example.invalid/horizon-synthetic/' || replace(id, ':', '-'),
  id,
  'Synthetic research workspace publication ' || id,
  TIMESTAMP '2026-07-13 00:00:00',
  'en',
  'other',
  repeat('0', 64),
  'Synthetic backfill record created before research workspace constraints.',
  false
FROM referenced_publications
ON CONFLICT ("id") DO NOTHING;

WITH referenced_versions AS (
  SELECT DISTINCT ON ("publicationVersionId")
    "publicationVersionId" AS id,
    "publicationId"
  FROM (
    SELECT "publicationVersionId", "publicationId" FROM "ResearchPlan"
    UNION ALL
    SELECT "publicationVersionId", "publicationId" FROM "BriefRevision"
  ) refs
  ORDER BY "publicationVersionId", "publicationId"
), numbered_versions AS (
  SELECT
    refs.id,
    refs."publicationId",
    COALESCE(existing.max_version, 0)
      + ROW_NUMBER() OVER (PARTITION BY refs."publicationId" ORDER BY refs.id) AS "versionNumber"
  FROM referenced_versions refs
  LEFT JOIN (
    SELECT "publicationId", MAX("versionNumber") AS max_version
    FROM "PublicationVersion"
    GROUP BY "publicationId"
  ) existing ON existing."publicationId" = refs."publicationId"
  LEFT JOIN "PublicationVersion" current_version ON current_version.id = refs.id
  WHERE current_version.id IS NULL
)
INSERT INTO "PublicationVersion" (
  "id",
  "publicationId",
  "versionNumber",
  "fetchedAt",
  "rawHash",
  "bodyText",
  "changeSummary"
)
SELECT
  id,
  "publicationId",
  "versionNumber",
  TIMESTAMP '2026-07-13 00:00:00',
  repeat('0', 64),
  'Synthetic backfill record created before research workspace constraints.',
  'Deterministic synthetic relation backfill.'
FROM numbered_versions;

ALTER TABLE "ResearchPlan"
  ADD CONSTRAINT "ResearchPlan_publicationId_fkey"
  FOREIGN KEY ("publicationId") REFERENCES "Publication"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchPlan"
  ADD CONSTRAINT "ResearchPlan_publicationVersionId_fkey"
  FOREIGN KEY ("publicationVersionId") REFERENCES "PublicationVersion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BriefRevision"
  ADD CONSTRAINT "BriefRevision_publicationId_fkey"
  FOREIGN KEY ("publicationId") REFERENCES "Publication"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BriefRevision"
  ADD CONSTRAINT "BriefRevision_publicationVersionId_fkey"
  FOREIGN KEY ("publicationVersionId") REFERENCES "PublicationVersion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
