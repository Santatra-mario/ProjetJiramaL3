BEGIN;

-- Autorise un état terminal qui distingue un abonné supprimé
-- d'un abonné simplement inactif et encore réactivable.
ALTER TABLE public.abonnes
  DROP CONSTRAINT IF EXISTS abonnes_statut_check;

ALTER TABLE public.abonnes
  ADD CONSTRAINT abonnes_statut_check
  CHECK (statut IN ('actif', 'inactif', 'supprime'));

COMMIT;
