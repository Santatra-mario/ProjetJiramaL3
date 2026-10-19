-- JIRAMA - Migration 003 : décision d'anomalie, retour utilisateur et archivage.
-- À exécuter depuis la racine jirama-L3 après sauvegarde :
-- psql -U <utilisateur> -d <base> -v ON_ERROR_STOP=1 -f sql/003_decisions_anomalies_archivage.sql
-- Migration additive : aucune ligne de relevé/anomalie/notification n'est supprimée.

BEGIN;

ALTER TABLE anomalies
  ADD COLUMN IF NOT EXISTS decision_admin VARCHAR(24) NULL,
  ADD COLUMN IF NOT EXISTS motif_decision TEXT NULL,
  ADD COLUMN IF NOT EXISTS decide_par INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS date_decision TIMESTAMP NULL;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS masquee_le TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS archive_le TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS evenement_cle VARCHAR(180) NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_anomalies_decision_admin'
      AND conrelid = 'anomalies'::regclass
  ) THEN
    ALTER TABLE anomalies
      ADD CONSTRAINT ck_anomalies_decision_admin
      CHECK (decision_admin IS NULL OR decision_admin IN ('ACCEPTE', 'REFUSE', 'A_VERIFIER'));
  END IF;
END $$;

-- Normaliser le type historique attendu par l'interface.
UPDATE notifications
SET type = 'ALERTE_ANOMALIE'
WHERE anomalie_id IS NOT NULL
  AND UPPER(TRIM(type)) IN ('ANOMALIE', 'ALERTE ANOMALIE');

-- Enlever l'ancien index avant la normalisation, puis conserver une seule
-- alerte de détection active par anomalie/destinataire. Les notifications de
-- décision (DECISION_ANOMALIE) sont exclues de ce nettoyage.
DROP INDEX IF EXISTS uq_notifications_anomalie_destinataire;

WITH alertes AS (
  SELECT id,
         anomalie_id,
         ROW_NUMBER() OVER (
           PARTITION BY anomalie_id, LOWER(TRIM(destinataire))
           ORDER BY
             CASE
               WHEN masquee_le IS NULL AND archive_le IS NULL THEN 0
               WHEN masquee_le IS NULL THEN 1
               ELSE 2
             END,
             created_at ASC NULLS LAST,
             id ASC
         ) AS rang
  FROM notifications
  WHERE anomalie_id IS NOT NULL
    AND UPPER(TRIM(type)) = 'ALERTE_ANOMALIE'
)
UPDATE notifications n
SET evenement_cle = CASE
      WHEN alertes.rang = 1 THEN 'ANOMALIE_DETECTEE'
      ELSE 'HISTORIQUE_DOUBLON_' || n.id::text
    END,
    masquee_le = CASE
      WHEN alertes.rang > 1 THEN COALESCE(n.masquee_le, CURRENT_TIMESTAMP)
      ELSE n.masquee_le
    END
FROM alertes
WHERE alertes.id = n.id;

-- L'ancien index unique ne permettait qu'un événement par anomalie/destinataire,
-- empêchant la notification distincte d'une décision Admin.
DROP INDEX IF EXISTS uq_notifications_evenement_destinataire;
CREATE UNIQUE INDEX uq_notifications_evenement_destinataire
  ON notifications (anomalie_id, (LOWER(TRIM(destinataire))), evenement_cle)
  WHERE anomalie_id IS NOT NULL
    AND evenement_cle IS NOT NULL
    AND masquee_le IS NULL;

DROP INDEX IF EXISTS idx_notifications_visibles;
CREATE INDEX idx_notifications_visibles
  ON notifications (LOWER(TRIM(destinataire)))
  WHERE masquee_le IS NULL AND archive_le IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_archivees
  ON notifications (LOWER(TRIM(destinataire)), archive_le DESC)
  WHERE masquee_le IS NULL AND archive_le IS NOT NULL;

COMMIT;
