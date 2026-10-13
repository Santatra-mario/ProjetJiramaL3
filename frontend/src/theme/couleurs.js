/* =========================================================
   COULEURS JIRAMA
   Ce fichier ne contient AUCUNE valeur de couleur : seulement
   des références aux variables CSS définies dans index.css
   (jeu clair dans :root, jeu sombre dans .dark).
   Pour changer une couleur, modifiez-la dans index.css.
========================================================= */
export const COULEURS = {
  // Bleu = eau
  eauFonce: 'var(--jr-eau-fonce)',
  eau: 'var(--jr-eau)',
  eauClair: 'var(--jr-eau-clair)',
  eauPale: 'var(--jr-eau-pale)',

  // Orange = électricité
  elec: 'var(--jr-elec)',
  elecFonce: 'var(--jr-elec-fonce)',
  elecPale: 'var(--jr-elec-pale)',

  // Texte lisible sur fond orange (identique dans les deux modes)
  surElec: 'var(--jr-sur-elec)',

  // Texte et liens (s'éclaircissent en mode sombre)
  texte: 'var(--jr-texte)',
  texteDoux: 'var(--jr-texte-doux)',
  texteFaible: 'var(--jr-texte-faible)',
  titre: 'var(--jr-titre)',
  lien: 'var(--jr-lien)',
  attention: 'var(--jr-attention)',

  // Surfaces et bordures
  surface: 'var(--jr-surface)',
  bordure: 'var(--jr-bordure)',

  // Rouge = erreur / anomalie, vert = succès
  err: 'var(--jr-err)',
  ok: 'var(--jr-ok)',
};