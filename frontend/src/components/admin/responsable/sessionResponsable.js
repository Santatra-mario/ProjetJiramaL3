/* =========================================================
   SESSION RESPONSABLE
   Gestion commune des erreurs 401 / 403 :
   toast explicite, puis déconnexion et retour à l'accueil.
========================================================= */

let sortieEnCours = false;

const DELAI_SORTIE = 1500;

export function estErreurSession(error) {
  return [401, 403].includes(error?.response?.status);
}

/*
  Retourne true si l'erreur est une erreur de session (déjà traitée),
  false sinon (l'appelant gère alors l'erreur normalement).
*/
export function traiterErreurSession(error, notify, navigate) {
  if (!estErreurSession(error)) {
    return false;
  }

  if (sortieEnCours) {
    return true;
  }

  sortieEnCours = true;

  const status = error.response.status;
  const texteServeur = String(
    error.response?.data?.message || ''
  ).toLowerCase();

  // Le backend renvoie parfois 403 pour un jeton expiré : on le détecte
  const sessionExpiree =
    status === 401 ||
    texteServeur.includes('expir') ||
    texteServeur.includes('invalide');

  notify({
    cle: 'session',
    genre: 'erreur',
    titre: sessionExpiree ? 'Session expirée' : 'Accès refusé',
    message: sessionExpiree
      ? 'Veuillez vous reconnecter.'
      : "Vous n'avez pas l'autorisation d'accéder à cette page.",
    duree: DELAI_SORTIE + 500,
  });

  window.setTimeout(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    sortieEnCours = false;

    navigate('/', { replace: true });
  }, DELAI_SORTIE);

  return true;
}