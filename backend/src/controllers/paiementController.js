const pool = require('../config/db');

/* =========================================================
   PAIEMENTS DE FACTURE
   Source unique de vérité pour le « MONTANT DÉJÀ PAYÉ »
   affiché sur la facture PDF.
   Une facture est identifiée par (abonne_id, periode YYYY-MM).
========================================================= */

/**
 * Formate un nombre en chaîne numérique stable pour pg.
 */
function montantNumerique(value) {
  const nombre = Number(value);

  if (!Number.isFinite(nombre)) {
    return null;
  }

  return nombre.toFixed(2);
}

/* =========================================================
   LECTURE — somme des paiements d'une facture
   GET /api/paiements/facture?abonne_id=1&periode=2026-08
========================================================= */
async function getPaiementsFacture(req, res) {
  const abonneId = Number(req.query.abonne_id);
  const periode = String(req.query.periode || '').trim();

  if (!Number.isInteger(abonneId) || abonneId <= 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Identifiant d’abonné invalide.',
    });
  }

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periode)) {
    return res.status(400).json({
      status: 'error',
      message: 'Période invalide : le format attendu est AAAA-MM.',
    });
  }

  try {
    const result = await pool.query(
      `SELECT
         COALESCE(SUM(p.montant), 0)::numeric(12, 2) AS montant_paye,
         COUNT(p.id)::int                             AS nombre_paiements
       FROM paiements p
       WHERE p.abonne_id = $1
         AND p.periode   = $2`,
      [abonneId, periode]
    );

    const ligne = result.rows[0] || {};

    return res.status(200).json({
      status: 'success',
      abonne_id: abonneId,
      periode,
      // La base confirme l'absence de paiement : la somme vaut 0.
      montant_paye: Number(ligne.montant_paye || 0),
      nombre_paiements: Number(ligne.nombre_paiements || 0),
    });
  } catch (error) {
    console.error('Erreur getPaiementsFacture :', error);

    return res.status(500).json({
      status: 'error',
      message: 'Impossible de récupérer les paiements de la facture.',
    });
  }
}

/* =========================================================
   LECTURE — détail des paiements d'une facture
   GET /api/paiements?abonne_id=1&periode=2026-08
========================================================= */
async function getPaiements(req, res) {
  const abonneId = Number(req.query.abonne_id);
  const periode = String(req.query.periode || '').trim();

  if (!Number.isInteger(abonneId) || abonneId <= 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Identifiant d’abonné invalide.',
    });
  }

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periode)) {
    return res.status(400).json({
      status: 'error',
      message: 'Période invalide : le format attendu est AAAA-MM.',
    });
  }

  try {
    const result = await pool.query(
      `SELECT
         p.id,
         p.abonne_id,
         p.periode,
         p.montant::numeric(12, 2) AS montant,
         p.mode,
         p.reference,
         p.date_paiement,
         p.created_at
       FROM paiements p
       WHERE p.abonne_id = $1
         AND p.periode   = $2
       ORDER BY p.date_paiement ASC, p.id ASC`,
      [abonneId, periode]
    );

    return res.status(200).json({
      status: 'success',
      paiements: result.rows,
    });
  } catch (error) {
    console.error('Erreur getPaiements :', error);

    return res.status(500).json({
      status: 'error',
      message: 'Impossible de récupérer les paiements.',
    });
  }
}

/* =========================================================
   CRÉATION — enregistrer un versement
   POST /api/paiements
========================================================= */
async function createPaiement(req, res) {
  const abonneId = Number(req.body.abonne_id);
  const periode = String(req.body.periode || '').trim();
  const montant = montantNumerique(req.body.montant);
  const mode = req.body.mode ? String(req.body.mode).trim() : null;
  const reference = req.body.reference ? String(req.body.reference).trim() : null;
  const datePaiement = req.body.date_paiement
    ? String(req.body.date_paiement).slice(0, 10)
    : null;

  if (!Number.isInteger(abonneId) || abonneId <= 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Identifiant d’abonné invalide.',
    });
  }

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periode)) {
    return res.status(400).json({
      status: 'error',
      message: 'Période invalide : le format attendu est AAAA-MM.',
    });
  }

  if (montant === null || Number(montant) <= 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Montant invalide : un versement doit être supérieur à zéro.',
    });
  }

  try {
    // Vérifier que l'abonné existe bien (relation réelle, jamais déduite
    // d'un rapprochement de numéros de compteur).
    const abonne = await pool.query(
      'SELECT id FROM abonnes WHERE id = $1',
      [abonneId]
    );

    if (abonne.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Abonné introuvable.',
      });
    }

    const result = await pool.query(
      `INSERT INTO paiements
         (abonne_id, periode, montant, mode, reference, date_paiement, created_by)
       VALUES ($1, $2, $3::numeric, $4, $5, COALESCE($6::date, CURRENT_DATE), $7)
       RETURNING
         id,
         abonne_id,
         periode,
         montant::numeric(12, 2) AS montant,
         mode,
         reference,
         date_paiement,
         created_at`,
      [
        abonneId,
        periode,
        montant,
        mode,
        reference,
        datePaiement,
        req.user?.id ?? null,
      ]
    );

    return res.status(201).json({
      status: 'success',
      message: 'Paiement enregistré.',
      paiement: result.rows[0],
    });
  } catch (error) {
    // Violation de l'unicité de la référence : même paiement soumis deux fois.
    if (error.code === '23505') {
      return res.status(409).json({
        status: 'error',
        message: 'Un paiement portant cette référence existe déjà.',
      });
    }

    console.error('Erreur createPaiement :', error);

    return res.status(500).json({
      status: 'error',
      message: 'Impossible d’enregistrer le paiement.',
    });
  }
}

/* =========================================================
   SUPPRESSION — annuler un versement enregistré
   DELETE /api/paiements/:id
========================================================= */
async function deletePaiement(req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Identifiant de paiement invalide.',
    });
  }

  try {
    const result = await pool.query(
      `DELETE FROM paiements
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Paiement introuvable.',
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Paiement supprimé.',
    });
  } catch (error) {
    console.error('Erreur deletePaiement :', error);

    return res.status(500).json({
      status: 'error',
      message: 'Impossible de supprimer le paiement.',
    });
  }
}

module.exports = {
  getPaiementsFacture,
  getPaiements,
  createPaiement,
  deletePaiement,
};
