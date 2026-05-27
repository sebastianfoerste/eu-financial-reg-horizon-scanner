UPDATE "Classification"
SET "serviceOfferingIds" =
  array_append(array_remove("serviceOfferingIds", 'gc_regulatory_strategy_retainer'), 'gc_micar_authorisation')
WHERE 'micar' = ANY("regulationFamilies")
  AND 'authorisation_and_passporting.initial_authorisation' = ANY("topicPaths")
  AND NOT ('gc_micar_authorisation' = ANY("serviceOfferingIds"));

UPDATE "Classification"
SET "serviceOfferingIds" =
  array_append(array_remove("serviceOfferingIds", 'gc_regulatory_strategy_retainer'), 'gc_psd_licence')
WHERE ('psd' = ANY("regulationFamilies") OR 'emd' = ANY("regulationFamilies"))
  AND 'authorisation_and_passporting.initial_authorisation' = ANY("topicPaths")
  AND NOT ('gc_psd_licence' = ANY("serviceOfferingIds"));

UPDATE "Alert"
SET
  "status" = 'SKIPPED',
  "errorMessage" = 'Taxonomy service routing changed. Generate a new reviewed alert draft.'
WHERE "status"::text IN ('DRAFT', 'APPROVED', 'BLOCKED_BY_CONFIG', 'FAILED')
  AND "publicationId" IN (
    SELECT "publicationId"
    FROM "Classification"
    WHERE 'authorisation_and_passporting.initial_authorisation' = ANY("topicPaths")
      AND (
        'micar' = ANY("regulationFamilies")
        OR 'psd' = ANY("regulationFamilies")
        OR 'emd' = ANY("regulationFamilies")
      )
  );
