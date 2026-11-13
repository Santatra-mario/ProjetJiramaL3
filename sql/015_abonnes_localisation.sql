/* =========================================================
   013 — LOCALISATION DÉTAILLÉE DES ABONNÉS
   ---------------------------------------------------------
   Complète la fiche abonné pour permettre une descente
   terrain fiable : région, fokontany, rue et point de repère.

   Colonnes déjà présentes dans le schéma initial :
     adresse, quartier, commune, latitude, longitude
   Colonnes ajoutées ici uniquement si elles manquent :
     region, fokontany, rue, repere

   Migration NON destructive : aucun DROP, aucune donnée
   existante n'est modifiée. Les coordonnées restent NULL
   lorsque la localisation GPS n'est pas vérifiée.
========================================================= */

ALTER TABLE abonnes
  ADD COLUMN IF NOT EXISTS region varchar(120),
  ADD COLUMN IF NOT EXISTS fokontany varchar(160),
  ADD COLUMN IF NOT EXISTS rue varchar(200),
  ADD COLUMN IF NOT EXISTS repere varchar(200);

/* Index partiel : seules les lignes réellement géolocalisées
   sont indexées, pour l'affichage cartographique du planning. */
CREATE INDEX IF NOT EXISTS idx_abonnes_localisation_gps
  ON abonnes (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

/* Garde-fous de cohérence : latitude/longitude vont ensemble
   et doivent rester dans les bornes géographiques. */
ALTER TABLE abonnes
  DROP CONSTRAINT IF EXISTS abonnes_gps_paire_check,
  ADD CONSTRAINT abonnes_gps_paire_check
    CHECK (
      (latitude IS NULL AND longitude IS NULL)
      OR (
        latitude IS NOT NULL AND longitude IS NOT NULL
        AND latitude BETWEEN -90 AND 90
        AND longitude BETWEEN -180 AND 180
      )
    );
