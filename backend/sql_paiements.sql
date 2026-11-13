-- ==========================================================
-- MIGRATION ADDITIVE — TABLE PAIEMENTS
-- ==========================================================
-- Pourquoi elle est indispensable :
-- Le projet n'avait AUCUNE table de règlements. Le PDF de facture
-- devait donc afficher « MONTANT DÉJÀ PAYÉ : Donnée indisponible »
-- car aucun champ de paiement n'était jamais renvoyé par le backend.
-- Cette table est la source unique de vérité pour les versements
-- effectués par un abonné sur une période de facturation.
--
-- Elle n'affecte aucune table, aucune donnée ni aucun calcul existant.
-- À appliquer une seule fois :
--   psql -U <user> -d <db> -f sql_paiements.sql
-- ==========================================================

CREATE TABLE IF NOT EXISTS paiements (
  id            SERIAL PRIMARY KEY,
  abonne_id     INTEGER NOT NULL REFERENCES abonnes (id) ON DELETE CASCADE,
  periode       VARCHAR(7) NOT NULL,                 -- facturée : YYYY-MM
  montant       NUMERIC(12, 2) NOT NULL CHECK (montant > 0),
  mode          VARCHAR(40),                         -- espèces / virement / mobile money…
  reference     VARCHAR(60),                         -- reçu, transaction…
  date_paiement DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by    INTEGER REFERENCES users (id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recherche d'une facture : abonné + période.
CREATE INDEX IF NOT EXISTS idx_paiements_abonne_periode
  ON paiements (abonne_id, periode);

-- Aucun doublon pour une même référence de paiement (réordonnancement,
-- double soumission d'un formulaire…). Les paiements partiels restent
-- autorisés : plusieurs lignes pour la même facture sont légitimes.
CREATE UNIQUE INDEX IF NOT EXISTS uq_paiements_reference
  ON paiements (reference)
  WHERE reference IS NOT NULL AND TRIM(reference) <> '';
