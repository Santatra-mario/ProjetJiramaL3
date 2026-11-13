/* =========================================================
   013 — PREMIER RELEVÉ (INDEX INITIAL) D'UN COMPTEUR
   =========================================================

   Un compteur nouvellement enregistré n'a aucun historique.
   Son premier relevé ne peut donc pas avoir d'ancien index ni
   de consommation calculée par différence.

   Cette migration, non destructive :

   1. ajoute `type_releve` ('INITIAL' | 'PERIODIQUE') aux relevés ;
   2. ajoute `observation` (facultative, premier relevé) ;
   3. rend `ancien_index` et `consommation` nullables ;
   4. garantit par contrainte qu'un relevé INITIAL n'a ni ancien
      index, ni date de référence, ni consommation ;
   5. garantit par contrainte qu'un relevé PERIODIQUE conserve ses
      ancien index et consommation (comportement actuel inchangé) ;
   6. interdit deux relevés INITIAL pour le même compteur.

   Les relevés existants restent intacts : ils deviennent
   PERIODIQUE avec leurs valeurs actuelles.
========================================================= */

BEGIN;

ALTER TABLE releves
  ADD COLUMN IF NOT EXISTS type_releve VARCHAR(16);

ALTER TABLE releves
  ADD COLUMN IF NOT EXISTS observation TEXT;

UPDATE releves
SET type_releve = 'PERIODIQUE'
WHERE type_releve IS NULL;

ALTER TABLE releves
  ALTER COLUMN type_releve SET DEFAULT 'PERIODIQUE';

ALTER TABLE releves
  ALTER COLUMN type_releve SET NOT NULL;

ALTER TABLE releves
  ALTER COLUMN ancien_index DROP NOT NULL;

ALTER TABLE releves
  ALTER COLUMN consommation DROP NOT NULL;

ALTER TABLE releves
  DROP CONSTRAINT IF EXISTS chk_releve_type;

ALTER TABLE releves
  ADD CONSTRAINT chk_releve_type
  CHECK (type_releve IN ('INITIAL', 'PERIODIQUE'));

ALTER TABLE releves
  DROP CONSTRAINT IF EXISTS chk_releve_initial;

ALTER TABLE releves
  ADD CONSTRAINT chk_releve_initial
  CHECK (
    type_releve <> 'INITIAL'
    OR (
      ancien_index IS NULL
      AND consommation IS NULL
      AND date_ancien_releve IS NULL
    )
  );

ALTER TABLE releves
  DROP CONSTRAINT IF EXISTS chk_releve_periodique;

ALTER TABLE releves
  ADD CONSTRAINT chk_releve_periodique
  CHECK (
    type_releve <> 'PERIODIQUE'
    OR (ancien_index IS NOT NULL AND consommation IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_releves_initial_par_compteur
  ON releves (compteur_id)
  WHERE type_releve = 'INITIAL';

COMMENT ON COLUMN releves.type_releve IS
  'INITIAL = premier relevé du compteur (aucun ancien index, aucune consommation calculée) ; PERIODIQUE = relevé de consommation.';

COMMENT ON COLUMN releves.observation IS
  'Observation libre saisie lors du premier relevé (facultative).';

COMMIT;
