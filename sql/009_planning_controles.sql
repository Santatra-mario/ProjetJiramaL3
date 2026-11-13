BEGIN;

-- Le schéma existant stocke l'adresse dans abonnes.adresse. Ces champs
-- facultatifs permettent de classer les abonnés et d'utiliser uniquement
-- les coordonnées réellement renseignées par un administrateur.
ALTER TABLE public.abonnes
  ADD COLUMN IF NOT EXISTS quartier text,
  ADD COLUMN IF NOT EXISTS commune text,
  ADD COLUMN IF NOT EXISTS latitude numeric(9, 6),
  ADD COLUMN IF NOT EXISTS longitude numeric(9, 6);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'abonnes_coordonnees_controle_check'
      AND conrelid = 'public.abonnes'::regclass
  ) THEN
    ALTER TABLE public.abonnes
      ADD CONSTRAINT abonnes_coordonnees_controle_check
      CHECK (
        ((latitude IS NULL) = (longitude IS NULL))
        AND (
          latitude IS NULL
          OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.campagnes_controle (
  id serial PRIMARY KEY,
  mois date NOT NULL,
  date_debut date NOT NULL,
  date_fin date NOT NULL,
  statut varchar(20) NOT NULL DEFAULT 'BROUILLON',
  created_by integer NOT NULL REFERENCES public.users(id),
  updated_by integer REFERENCES public.users(id),
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT campagnes_controle_mois_check
    CHECK (EXTRACT(DAY FROM mois) = 1),
  CONSTRAINT campagnes_controle_dates_check
    CHECK (date_debut <= date_fin AND date_debut >= mois AND date_fin < mois + INTERVAL '1 month'),
  CONSTRAINT campagnes_controle_statut_check
    CHECK (statut IN ('BROUILLON', 'PUBLIEE', 'CLOTUREE', 'ANNULEE'))
);

CREATE TABLE IF NOT EXISTS public.missions_controle (
  id serial PRIMARY KEY,
  campagne_id integer NOT NULL REFERENCES public.campagnes_controle(id) ON DELETE CASCADE,
  abonne_id integer NOT NULL REFERENCES public.abonnes(id),
  compteur_id integer NOT NULL REFERENCES public.compteurs(id),
  agent_id integer REFERENCES public.users(id),
  date_prevue date,
  statut varchar(24) NOT NULL DEFAULT 'EN_ATTENTE',
  priorite varchar(20),
  nouvelle_visite boolean NOT NULL DEFAULT false,
  motif_reprogrammation text,
  releve_id integer UNIQUE REFERENCES public.releves(id) ON DELETE SET NULL,
  created_by integer NOT NULL REFERENCES public.users(id),
  updated_by integer REFERENCES public.users(id),
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT missions_controle_statut_check
    CHECK (statut IN ('EN_ATTENTE', 'PLANIFIEE', 'EN_COURS', 'TERMINEE', 'A_REPROGRAMMER', 'ANNULEE')),
  CONSTRAINT missions_controle_priorite_check
    CHECK (priorite IS NULL OR priorite IN ('NORMALE', 'HAUTE', 'URGENTE'))
);

CREATE INDEX IF NOT EXISTS idx_campagnes_controle_mois
  ON public.campagnes_controle (mois, id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_campagnes_controle_responsable_mois
  ON public.campagnes_controle (created_by, mois)
  WHERE statut <> 'ANNULEE';
CREATE INDEX IF NOT EXISTS idx_missions_controle_campagne_date
  ON public.missions_controle (campagne_id, date_prevue, id);
CREATE INDEX IF NOT EXISTS idx_missions_controle_agent_statut
  ON public.missions_controle (agent_id, statut, date_prevue);
CREATE INDEX IF NOT EXISTS idx_missions_controle_compteur_date
  ON public.missions_controle (compteur_id, date_prevue);

COMMIT;
