-- JIRAMA - Vérification des notifications d'anomalies
-- Rôles concernés : ADMINISTRATEUR, RESPONSABLE, AGENT.

-- 1) Supprimer les doublons d'une même anomalie
--    pour un même destinataire.
WITH duplicates AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY anomalie_id, LOWER(TRIM(destinataire))
            ORDER BY id
        ) AS rn
    FROM notifications
    WHERE anomalie_id IS NOT NULL
)
DELETE FROM notifications n
USING duplicates d
WHERE n.id = d.id
  AND d.rn > 1;

-- 2) Vérifier les utilisateurs actifs
--    pouvant recevoir les notifications d'anomalie.
SELECT
    UPPER(TRIM(role)) AS role,
    COUNT(*) AS utilisateurs_actifs
FROM users
WHERE LOWER(TRIM(statut)) = 'actif'
  AND UPPER(TRIM(role)) IN (
      'ADMINISTRATEUR',
      'RESPONSABLE',
      'AGENT'
  )
GROUP BY UPPER(TRIM(role))
ORDER BY role;

-- 3) Vérifier les notifications d'anomalies
--    reçues par chaque rôle.
SELECT
    UPPER(TRIM(u.role)) AS role,
    COUNT(n.id) AS notifications_anomalies
FROM users u
LEFT JOIN notifications n
    ON LOWER(TRIM(n.destinataire))
       = LOWER(TRIM(u.email))
   AND n.anomalie_id IS NOT NULL
WHERE LOWER(TRIM(u.statut)) = 'actif'
  AND UPPER(TRIM(u.role)) IN (
      'ADMINISTRATEUR',
      'RESPONSABLE',
      'AGENT'
  )
GROUP BY UPPER(TRIM(u.role))
ORDER BY role;