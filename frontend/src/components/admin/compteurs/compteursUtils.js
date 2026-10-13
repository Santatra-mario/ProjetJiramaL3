/* =========================================================
   OUTILS DE LA PAGE COMPTEURS
   Constantes, dates, filtrage, tri et exports (CSV / PDF).
========================================================= */

export const TYPES = [
  { valeur: 'EAU', libelle: 'Eau' },
  { valeur: 'ELECTRICITE', libelle: 'Électricité' },
];

export const STATUTS = [
  { valeur: 'ACTIF', libelle: 'Actif' },
  { valeur: 'INACTIF', libelle: 'Inactif' },
  { valeur: 'A_VERIFIER', libelle: 'À vérifier' },
];

export const LIBELLE_TYPE = { EAU: 'Eau', ELECTRICITE: 'Électricité' };
export const LIBELLE_STATUT = {
  ACTIF: 'Actif',
  INACTIF: 'Inactif',
  A_VERIFIER: 'À vérifier',
};

export const TAILLES_PAGE = [10, 25, 50];
export const COLONNES_TRI = ['numero', 'abonne', 'date', 'statut'];

const ORDRE_STATUT = { ACTIF: 0, A_VERIFIER: 1, INACTIF: 2 };

export const formatNombre = (n) => Number(n || 0).toLocaleString('fr-FR');

export const pourcent = (partie, total) =>
  total ? Math.round((partie / total) * 100) : 0;

// « Jean Rakoto » (prénom puis nom, comme dans la version d'origine)
export const nomAbonne = (c) =>
  [c.abonne_prenom, c.abonne_nom].filter(Boolean).join(' ').trim();

const nomTri = (c) =>
  [c.abonne_nom, c.abonne_prenom].filter(Boolean).join(' ').trim();

/* ---------------------------------------------------------
   DATES
   Accepte « 2024-03-01 » ou un ISO complet. On travaille en
   heure locale pour éviter qu'un décalage UTC n'affiche la
   veille.
--------------------------------------------------------- */
export function versDate(valeur) {
  if (!valeur) return null;

  const simple = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(valeur));
  const date = simple
    ? new Date(Number(simple[1]), Number(simple[2]) - 1, Number(simple[3]))
    : new Date(valeur);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(valeur) {
  const date = versDate(valeur);
  return date ? date.toLocaleDateString('fr-FR') : '';
}

// Valeur pour <input type="date"> : AAAA-MM-JJ
export function versChampDate(valeur) {
  const date = versDate(valeur);
  if (!date) return '';

  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const jj = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${jj}`;
}

export function anciennete(valeur) {
  const date = versDate(valeur);
  if (!date) return '';

  const aujourdhui = new Date();
  const debutJour = (d) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const jours = Math.round(
    (debutJour(aujourdhui) - debutJour(date)) / 86400000
  );

  if (jours < 0) return 'installation prévue';
  if (jours === 0) return 'installé aujourd’hui';
  if (jours < 31) return `il y a ${jours} jour${jours > 1 ? 's' : ''}`;

  let mois =
    (aujourdhui.getFullYear() - date.getFullYear()) * 12 +
    (aujourdhui.getMonth() - date.getMonth());
  if (aujourdhui.getDate() < date.getDate()) mois -= 1;
  mois = Math.max(mois, 1);

  if (mois < 12) return `il y a ${mois} mois`;

  const ans = Math.floor(mois / 12);
  return `il y a ${ans} an${ans > 1 ? 's' : ''}`;
}

/* ---------------------------------------------------------
   FILTRAGE
--------------------------------------------------------- */
export function filtrer(liste, { q = '', type = '', statut = '', abonne = '' }) {
  const requete = q.trim().toLowerCase();

  return liste.filter((c) => {
    if (type && c.type !== type) return false;
    if (statut && c.statut !== statut) return false;
    if (abonne && String(c.abonne_id) !== String(abonne)) return false;
    if (!requete) return true;

    return [
      c.numero_compteur,
      c.type,
      LIBELLE_TYPE[c.type],
      c.numero_abonne,
      nomAbonne(c),
    ].some((valeur) => String(valeur || '').toLowerCase().includes(requete));
  });
}

/* ---------------------------------------------------------
   TRI (sans tri : ordre du serveur, le plus récent d'abord)
--------------------------------------------------------- */
const collator = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });

export function trier(liste, tri, dir) {
  if (!tri) return liste;

  const sens = dir === 'desc' ? -1 : 1;

  const comparateurs = {
    numero: (a, b) =>
      sens * collator.compare(a.numero_compteur || '', b.numero_compteur || ''),
    abonne: (a, b) => sens * collator.compare(nomTri(a), nomTri(b)),
    statut: (a, b) =>
      sens * ((ORDRE_STATUT[a.statut] ?? 9) - (ORDRE_STATUT[b.statut] ?? 9)),
    date: (a, b) => {
      const ta = versDate(a.date_installation)?.getTime();
      const tb = versDate(b.date_installation)?.getTime();

      // Les dates manquantes restent à la fin, quel que soit le sens
      if (ta == null && tb == null) return 0;
      if (ta == null) return 1;
      if (tb == null) return -1;
      return sens * (ta - tb);
    },
  };

  const comparer = comparateurs[tri];
  if (!comparer) return liste;

  return [...liste].sort((a, b) => comparer(a, b) || b.id - a.id);
}

/* ---------------------------------------------------------
   EXPORTS
--------------------------------------------------------- */
const aujourdhuiTexte = () => new Date().toISOString().slice(0, 10);

const lignesExport = (liste) =>
  liste.map((c) => [
    c.id,
    c.numero_compteur,
    LIBELLE_TYPE[c.type] || c.type,
    c.numero_abonne,
    nomAbonne(c),
    formatDate(c.date_installation),
    LIBELLE_STATUT[c.statut] || c.statut,
  ]);

const ENTETES_EXPORT = [
  'ID',
  'Compteur',
  'Type',
  'N° abonné',
  'Abonné',
  'Installation',
  'Statut',
];

function telecharger(blob, nomFichier) {
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const echapperCsv = (valeur) => {
  const texte = String(valeur ?? '');
  return /[";\r\n]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte;
};

// Séparateur « ; » + BOM : s'ouvre correctement dans Excel en français
export function exporterCsv(liste) {
  const contenu =
    '\ufeff' +
    [ENTETES_EXPORT, ...lignesExport(liste)]
      .map((ligne) => ligne.map(echapperCsv).join(';'))
      .join('\r\n');

  telecharger(
    new Blob([contenu], { type: 'text/csv;charset=utf-8;' }),
    `compteurs_${aujourdhuiTexte()}.csv`
  );
}

// jsPDF est chargé à la demande pour ne pas alourdir la page
export async function exporterPdf(liste) {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new JsPDF({ orientation: 'landscape' });

  doc.setFontSize(16);
  doc.text('JIRAMA - Liste des compteurs', 14, 16);

  doc.setFontSize(10);
  doc.text(
    `${liste.length} compteur(s) - édité le ${new Date().toLocaleDateString('fr-FR')}`,
    14,
    23
  );

  autoTable(doc, {
    startY: 28,
    head: [ENTETES_EXPORT],
    body: lignesExport(liste),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [15, 95, 168] },
    margin: { left: 14, right: 14 },
  });

  doc.save(`compteurs_${aujourdhuiTexte()}.pdf`);
}
