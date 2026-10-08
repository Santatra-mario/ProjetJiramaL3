@"
-- JIRAMA - optimisation module Responsable
-- À exécuter une seule fois dans jirama_db

CREATE INDEX IF NOT EXISTS idx_releves_date_releve
  ON releves(date_releve);

CREATE INDEX IF NOT EXISTS idx_releves_compteur_date
  ON releves(compteur_id, date_releve);

CREATE INDEX IF NOT EXISTS idx_anomalies_releve
  ON anomalies(releve_id);

CREATE INDEX IF NOT EXISTS idx_anomalies_statut_date
  ON anomalies(statut, date_detection);

CREATE INDEX IF NOT EXISTS idx_users_role_statut
  ON users(role, statut);
"@ | Set-Content -Encoding UTF8 .\sql\responsable_indexes.sql