/* =========================================================
   UTILITAIRES DE LA PAGE RELEVÉS
   Fonctions pures (filtre par période, pagination, date du jour).
   Elles travaillent uniquement sur les champs déjà renvoyés par
   GET /releves : aucune donnée n'est inventée.
========================================================= */

export const TAILLES_PAGE = [10, 15, 25, 50];

/* Date locale au format AAAA-MM-JJ */
export function dateIso(date = new Date()) {
  const annee = date.getFullYear();
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  const jour = String(date.getDate()).padStart(2, '0');

  return `${annee}-${mois}-${jour}`;
}

/* « Jeudi 8 octobre 2026 » */
export function dateLongue(date = new Date()) {
  const texte = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);

  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/* Jour d'un relevé (AAAA-MM-JJ), comme toInputDate de la page */
export function jourDe(valeur) {
  if (!valeur) return '';

  return String(valeur).slice(0, 10);
}

/* Périodes rapides : renvoie { debut, fin } ou null pour « tout » */
export function periodeDepuis(cle, aujourdhui = new Date()) {
  const debut = new Date(aujourdhui);

  switch (cle) {
    case '7j':
      debut.setDate(debut.getDate() - 7);
      break;
    case '30j':
      debut.setDate(debut.getDate() - 30);
      break;
    case '3m':
      debut.setMonth(debut.getMonth() - 3);
      break;
    default:
      return null;
  }

  return { debut: dateIso(debut), fin: dateIso(aujourdhui) };
}

/* Le relevé est-il dans la période ? (bornes incluses, vides ignorées) */
export function releveDansPeriode(releve, debut, fin) {
  if (!debut && !fin) return true;

  const jour = jourDe(releve?.date_releve);

  if (!jour) return false;
  if (debut && jour < debut) return false;
  if (fin && jour > fin) return false;

  return true;
}

/* Nombre de relevés du mois en cours */
export function compterDuMois(releves = [], aujourdhui = new Date()) {
  const prefixe = dateIso(aujourdhui).slice(0, 7);

  return releves.filter((releve) =>
    jourDe(releve?.date_releve).startsWith(prefixe)
  ).length;
}

/* Découpe une liste en pages (page toujours valide, même après une suppression) */
export function paginer(liste = [], page = 1, taille = 15) {
  const total = liste.length;
  const pages = Math.max(1, Math.ceil(total / taille));
  const courante = Math.min(Math.max(1, Number(page) || 1), pages);
  const debut = (courante - 1) * taille;

  return {
    elements: liste.slice(debut, debut + taille),
    page: courante,
    pages,
    total,
    premier: total === 0 ? 0 : debut + 1,
    dernier: Math.min(debut + taille, total),
  };
}

/* Numéros de pages à afficher : 1 … 4 5 6 … 20 */
export function fenetrePages(courante, pages, voisins = 1) {
  const visibles = new Set([1, pages]);

  for (let i = courante - voisins; i <= courante + voisins; i += 1) {
    if (i >= 1 && i <= pages) visibles.add(i);
  }

  const tries = [...visibles].sort((a, b) => a - b);
  const resultat = [];

  tries.forEach((numero, index) => {
    if (index > 0 && numero - tries[index - 1] > 1) {
      resultat.push('…');
    }

    resultat.push(numero);
  });

  return resultat;
}
