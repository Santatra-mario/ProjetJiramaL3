BEGIN;
DO $$
DECLARE
    tables_to_truncate TEXT;
BEGIN
    SELECT string_agg(
        format('%I.%I', schemaname, tablename),
        ', '
    )
    INTO tables_to_truncate
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN (
          'knex_migrations',
          'knex_migrations_lock',
          'SequelizeMeta',
          'typeorm_migrations',
          'prisma_migrations'
      )
      AND tablename NOT ILIKE '%migration%';
    IF tables_to_truncate IS NOT NULL THEN
        EXECUTE 'TRUNCATE TABLE '
            || tables_to_truncate
            || ' RESTART IDENTITY CASCADE';
        RAISE NOTICE 'Donn?es applicatives supprim?es.';
    ELSE
        RAISE NOTICE 'Aucune table applicative trouv?e.';
    END IF;
END $$;
COMMIT;
