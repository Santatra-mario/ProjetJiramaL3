-- Diagnostic non destructif : vérifier que PostgreSQL accepte les nouveaux statuts TRAITEE et REFUSEE.
-- Exécuter dans pgAdmin sur la base et le schéma utilisés par backend/.env.

SELECT
  table_schema,
  table_name,
  column_name,
  data_type,
  udt_name,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name = 'anomalies'
  AND column_name = 'statut';

SELECT
  con.conname AS nom_contrainte,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace ns ON ns.oid = rel.relnamespace
WHERE ns.nspname = current_schema()
  AND rel.relname = 'anomalies'
  AND con.contype = 'c'
  AND pg_get_constraintdef(con.oid) ILIKE '%statut%';

-- Si statut est VARCHAR/CHAR et aucune contrainte CHECK ne limite ses valeurs,
-- aucune migration n'est nécessaire. Si c'est un ENUM ou une CHECK limitante,
-- adapter le schéma avant d'utiliser TRAITEE/REFUSEE.
