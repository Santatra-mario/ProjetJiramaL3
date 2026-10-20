-- RETOUR ARRIÈRE OPTIONNEL — ATTENTION : supprimer cette table efface les préférences enregistrées.
-- Ne pas exécuter si vous souhaitez conserver les thèmes et préférences utilisateur.
BEGIN;
DROP TABLE IF EXISTS user_settings;
COMMIT;
-- L'ancienne table user_activity_log n'est volontairement pas supprimée : elle peut contenir un historique existant.
