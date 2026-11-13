-- 014 — Affectations préparatoires Agent → Quartier
--
-- Le planning du Responsable est préparé en deux temps :
--   1. le Responsable choisit les Agents et les quartiers (Jour 1) ;
--   2. il choisit ensuite les abonnés et les compteurs, ce qui crée les
--      missions individuelles de `missions_controle`.
--
-- Jusqu'ici l'étape 1 ne vivait que dans l'état React de la page : dès que
-- les compteurs n'étaient pas encore ajoutés, le détail du Jour 1 affichait
-- « 0 Agent / 0 quartier ». Cette table conserve donc la préparation
-- elle-même, indépendamment des missions individuelles.
--
-- Migration strictement additive : aucune table, colonne ni donnée existante
-- n'est modifiée. Le quartier vide ('') représente un abonné sans quartier
-- renseigné, comme dans le reste du projet.

CREATE TABLE IF NOT EXISTS affectations_controle (
  id          SERIAL PRIMARY KEY,
  campagne_id INTEGER NOT NULL REFERENCES campagnes_controle(id) ON DELETE CASCADE,
  agent_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quartier    VARCHAR(160) NOT NULL DEFAULT '',
  created_by  INTEGER REFERENCES users(id),
  created_at  TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT affectations_controle_unique UNIQUE (campagne_id, agent_id, quartier)
);

CREATE INDEX IF NOT EXISTS idx_affectations_controle_campagne
  ON affectations_controle (campagne_id);

CREATE INDEX IF NOT EXISTS idx_affectations_controle_agent
  ON affectations_controle (agent_id);
