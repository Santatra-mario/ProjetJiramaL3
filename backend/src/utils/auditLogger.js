const pool = require('../config/db');

/**
 * Journal d'audit non bloquant : une panne du journal ne doit jamais annuler
 * une opération métier déjà validée. Les détails transmis doivent être
 * dépourvus de mots de passe, jetons et autres secrets.
 */
async function logAudit({
  actorId = null,
  actorRole = null,
  action,
  resourceType = null,
  resourceId = null,
  result = 'SUCCES',
  details = {},
}) {
  try {
    await pool.query(
      `
        INSERT INTO audit_logs (
          acteur_id,
          acteur_role,
          action_code,
          ressource_type,
          ressource_id,
          resultat,
          details
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      `,
      [
        actorId ? Number(actorId) : null,
        actorRole ? String(actorRole).trim().toUpperCase() : null,
        String(action || 'ACTION_INCONNUE').slice(0, 100),
        resourceType ? String(resourceType).slice(0, 80) : null,
        resourceId === null || resourceId === undefined ? null : String(resourceId).slice(0, 120),
        String(result || 'SUCCES').slice(0, 20),
        JSON.stringify(details && typeof details === 'object' ? details : {}),
      ]
    );
  } catch (error) {
    // Le journal est secondaire : ne pas faire échouer l'action métier.
    console.warn('Journal d’audit indisponible :', error?.message || error);
  }
}

module.exports = { logAudit };
