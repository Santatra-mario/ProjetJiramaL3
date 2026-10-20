-- Diagnostic sans modification de données : exécuter avant la migration 004.
-- Montre la distribution des destinataires et les états d'archivage/masquage.
SELECT
  CASE
    WHEN LOWER(TRIM(destinataire)) IN (
      SELECT LOWER(TRIM(email)) FROM users WHERE email IS NOT NULL
    ) THEN 'DESTINATAIRE_EMAIL'
    WHEN UPPER(TRIM(destinataire)) IN ('ADMINISTRATEUR', 'RESPONSABLE', 'AGENT') THEN 'DESTINATAIRE_ROLE_HISTORIQUE'
    ELSE 'AUTRE_FORMAT_DESTINATAIRE'
  END AS categorie_destinataire,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE archive_le IS NOT NULL) AS archivees,
  COUNT(*) FILTER (WHERE archive_le IS NULL) AS actives,
  COUNT(*) FILTER (WHERE masquee_le IS NOT NULL) AS masquees,
  COUNT(*) FILTER (WHERE archive_le IS NOT NULL AND masquee_le IS NULL) AS archives_visibles
FROM notifications
GROUP BY 1
ORDER BY 1;

-- Détail des lignes historiques adressées à un rôle, sans exposer le message complet.
SELECT
  id,
  UPPER(TRIM(destinataire)) AS destinataire_historique,
  anomalie_id,
  statut,
  archive_le,
  masquee_le,
  created_at
FROM notifications
WHERE UPPER(TRIM(destinataire)) IN ('ADMINISTRATEUR', 'RESPONSABLE', 'AGENT')
ORDER BY created_at DESC NULLS LAST, id DESC
LIMIT 100;
