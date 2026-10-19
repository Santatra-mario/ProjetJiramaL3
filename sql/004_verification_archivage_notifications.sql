-- Vérification en lecture seule du schéma nécessaire à l'archivage JIRAMA.
-- Ce script ne modifie aucune donnée.

SELECT table_schema, table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'notifications'
  AND column_name IN ('archive_le', 'masquee_le')
ORDER BY table_schema, column_name;

SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename = 'notifications'
  AND indexname ILIKE '%archive%'
ORDER BY schemaname, indexname;
