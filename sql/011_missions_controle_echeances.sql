BEGIN;

-- Informations opérationnelles ajoutées aux missions existantes.
-- Les relevés et les missions déjà terminées restent inchangés.
ALTER TABLE public.missions_controle
  ADD COLUMN IF NOT EXISTS date_limite date,
  ADD COLUMN IF NOT EXISTS date_visite_reelle date,
  ADD COLUMN IF NOT EXISTS suivi_periodique boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS observations text,
  ADD COLUMN IF NOT EXISTS mission_parent_id integer
    REFERENCES public.missions_controle(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version_affectation integer NOT NULL DEFAULT 0;

-- Une mission périodique ne peut générer qu'une seule mission suivante.
CREATE UNIQUE INDEX IF NOT EXISTS idx_missions_controle_parent_unique
  ON public.missions_controle (mission_parent_id)
  WHERE mission_parent_id IS NOT NULL;

-- Une campagne clôturée garde son historique et ne bloque pas une nouvelle
-- campagne active du même Responsable pour le mois concerné.
DROP INDEX IF EXISTS public.idx_campagnes_controle_responsable_mois;
CREATE UNIQUE INDEX idx_campagnes_controle_responsable_mois
  ON public.campagnes_controle (created_by, mois)
  WHERE statut IN ('BROUILLON', 'PUBLIEE');

-- Clés idempotentes réservées aux nouvelles notifications de missions.
-- L'index ne touche pas aux événements historiques existants.
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_mission_v2_unique
  ON public.notifications (LOWER(TRIM(destinataire)), evenement_cle)
  WHERE type = 'MISSION_CONTROLE'
    AND evenement_cle LIKE 'mission:v2:%';

COMMIT;
