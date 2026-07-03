UPDATE "ServiceOfferingRule"
SET "values" = ARRAY['authorisation_and_passporting.initial_authorisation']
WHERE "id" IN ('gc_micar_authorisation_topic', 'gc_psd_licence_topic')
  AND "values" = ARRAY['authorisation_and_passporting'];
