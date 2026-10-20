-- Vérification en lecture seule des tables et colonnes utilisées par Paramètres.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('user_settings', 'audit_logs')
ORDER BY table_name;

SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('user_settings', 'audit_logs')
ORDER BY table_name, ordinal_position;
