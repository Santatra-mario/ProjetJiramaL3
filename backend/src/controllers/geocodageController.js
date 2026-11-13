'use strict';

/* =========================================================
   GEOCODAGE D'ADRESSES — NOMINATIM / OPENSTREETMAP
   ---------------------------------------------------------
   Proxy serveur volontairement minimal, conforme aux
   conditions d'utilisation de Nominatim :
     - une seule requête réseau par recherche explicite de
       l'utilisateur (aucune frappe par frappe, aucun
       remplissage automatique) ;
     - identification de l'application par User-Agent ;
     - délai minimum entre deux appels amont (1,1 s) ;
     - cache mémoire de 24 h par requête normalisée ;
     - nombre de résultats limité (5).

   Le navigateur n'appelle jamais Nominatim directement :
   cela évite d'exposer l'application à un usage de masse et
   permet de respecter la politique d'usage du service.
========================================================= */

const NOMINATIM_URL = process.env.GEOCODAGE_URL || 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = process.env.GEOCODAGE_USER_AGENT
  || 'JIRAMA-Suivi-Consommations/1.0 (application locale de gestion des abonnés)';
const DELAI_MIN_MS = 1100;
const DUREE_CACHE_MS = 24 * 60 * 60 * 1000;
const MAX_RESULTATS = 5;

const cache = new Map();
let dernierAppel = 0;
let fileAttente = Promise.resolve();

function attendre(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

/* Sérialise les appels amont : garantit l'espacement minimal
   même si plusieurs utilisateurs cherchent en même temps. */
function prochainCreneau() {
  const creation = fileAttente.then(async () => {
    const maintenant = Date.now();
    const attente = Math.max(0, dernierAppel + DELAI_MIN_MS - maintenant);
    if (attente > 0) await attendre(attente);
    dernierAppel = Date.now();
  });
  fileAttente = creation.catch(() => {});
  return creation;
}

function nettoyerCache() {
  if (cache.size < 200) return;
  const maintenant = Date.now();
  for (const [cle, entree] of cache) {
    if (maintenant - entree.date > DUREE_CACHE_MS) cache.delete(cle);
  }
}

function simplifierResultat(result) {
  const latitude = Number(result?.lat);
  const longitude = Number(result?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    label: String(result.display_name || '').trim(),
    latitude,
    longitude,
    type: result.type || result.class || 'adresse',
    important: Boolean(result.important),
    boundingbox: Array.isArray(result.boundingbox)
      ? result.boundingbox.map((value) => Number(value))
      : null,
  };
}

async function rechercherAdresse(req, res) {
  const requete = String(req.query.q || '').trim();

  if (requete.length < 3) {
    return res.status(400).json({
      status: 'error',
      message: 'Saisissez au moins 3 caractères pour lancer la recherche.',
    });
  }

  const cle = requete.toLowerCase().replace(/\s+/g, ' ');
  const enCache = cache.get(cle);
  if (enCache && Date.now() - enCache.date < DUREE_CACHE_MS) {
    return res.status(200).json({
      status: 'success',
      source: 'cache',
      query: requete,
      data: enCache.data,
    });
  }

  try {
    await prochainCreneau();

    const parametres = new URLSearchParams({
      format: 'jsonv2',
      q: requete,
      limit: String(MAX_RESULTATS),
      countrycodes: 'mg',
      addressdetails: '1',
      'accept-language': 'fr',
    });
    if (process.env.GEOCODAGE_EMAIL) parametres.set('email', process.env.GEOCODAGE_EMAIL);

    const reponse = await fetch(`${NOMINATIM_URL}?${parametres.toString()}`, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!reponse.ok) {
      console.error('Géocodage Nominatim indisponible :', reponse.status);
      return res.status(502).json({
        status: 'error',
        message: 'Le service de recherche d’adresse est momentanément indisponible.',
      });
    }

    const brut = await reponse.json();
    const data = (Array.isArray(brut) ? brut : [])
      .map(simplifierResultat)
      .filter(Boolean);

    cache.set(cle, { date: Date.now(), data });
    nettoyerCache();

    return res.status(200).json({
      status: 'success',
      source: 'nominatim',
      query: requete,
      data,
    });
  } catch (error) {
    console.error('Erreur géocodage :', error.message || error);
    return res.status(502).json({
      status: 'error',
      message: 'Impossible de rechercher cette adresse pour le moment.',
    });
  }
}

module.exports = { rechercherAdresse };
