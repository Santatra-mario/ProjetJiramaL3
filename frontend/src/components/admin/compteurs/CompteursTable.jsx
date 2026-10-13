import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Pencil,
  Plus,
  RefreshCw,
  UserRound,
  Zap,
} from 'lucide-react';

import MenuStatut from './MenuStatut.jsx';
import StatusBadge from './StatusBadge.jsx';
import {
  anciennete,
  formatDate,
  formatNombre,
  LIBELLE_TYPE,
  nomAbonne,
  TAILLES_PAGE,
} from './compteursUtils.js';

const STYLE_TYPE = {
  EAU: { backgroundColor: 'var(--jr-eau-pale)', color: 'var(--jr-lien)' },
  ELECTRICITE: {
    backgroundColor: 'var(--jr-elec-pale)',
    color: 'var(--jr-attention)',
  },
};

const OPTIONS_TRI_MOBILE = [
  { valeur: '', libelle: 'Plus récents' },
  { valeur: 'numero:asc', libelle: 'Numéro A → Z' },
  { valeur: 'numero:desc', libelle: 'Numéro Z → A' },
  { valeur: 'abonne:asc', libelle: 'Abonné A → Z' },
  { valeur: 'date:desc', libelle: 'Installation récente' },
  { valeur: 'date:asc', libelle: 'Installation ancienne' },
  { valeur: 'statut:asc', libelle: 'Statut' },
];

/* ---------------------------------------------------------
   PASTILLE TYPE (icône colorée eau / électricité)
--------------------------------------------------------- */
function IconeType({ type }) {
  const Icone = type === 'EAU' ? Droplets : Zap;

  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
      style={STYLE_TYPE[type] || STYLE_TYPE.ELECTRICITE}
    >
      <Icone size={18} />
    </span>
  );
}

/* ---------------------------------------------------------
   EN-TÊTE TRIABLE
--------------------------------------------------------- */
function EnTete({ colonne, libelle, tri, dir, onTrier }) {
  const actif = tri === colonne;
  const Fleche = !actif ? ArrowUpDown : dir === 'desc' ? ArrowDown : ArrowUp;

  return (
    <th
      scope="col"
      aria-sort={actif ? (dir === 'desc' ? 'descending' : 'ascending') : 'none'}
      className="px-5 py-3"
    >
      <button
        type="button"
        onClick={() => onTrier(colonne)}
        className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors motion-reduce:transition-none ${
          actif ? 'text-jr-lien' : 'text-jr-faible hover:text-jr-texte'
        }`}
      >
        {libelle}
        <Fleche
          size={13}
          aria-hidden="true"
          className={actif ? '' : 'opacity-50'}
        />
      </button>
    </th>
  );
}

/* ---------------------------------------------------------
   ACTIONS D'UNE LIGNE
--------------------------------------------------------- */
function Actions({ compteur, onModifier, onChangerStatut, avecTexte = false }) {
  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={() => onModifier(compteur)}
        title="Modifier le compteur"
        aria-label={`Modifier le compteur ${compteur.numero_compteur}`}
        className="inline-flex items-center gap-1.5 rounded-md p-2 text-sm font-medium text-jr-doux transition-colors hover:bg-[var(--jr-eau-pale)] hover:text-jr-lien motion-reduce:transition-none"
      >
        <Pencil size={17} aria-hidden="true" />
        {avecTexte && 'Modifier'}
      </button>

      <MenuStatut
        compteur={compteur}
        avecTexte={avecTexte}
        onChoisir={(statut) => onChangerStatut(compteur, statut)}
      />
    </div>
  );
}

/* ---------------------------------------------------------
   SQUELETTE, ÉTAT VIDE, ERREUR
--------------------------------------------------------- */
function Squelette() {
  return (
    <div aria-busy="true" aria-live="polite" className="divide-y divide-jr-bordure">
      <span className="sr-only">Chargement des compteurs</span>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4 sm:px-6">
          <span className="jr-shimmer h-9 w-9 shrink-0 rounded-md" />
          <span className="jr-shimmer h-3 w-28 rounded" />
          <span
            className="jr-shimmer h-3 flex-1 rounded"
            style={{ maxWidth: `${45 + ((i * 13) % 30)}%` }}
          />
          <span className="jr-shimmer hidden h-3 w-20 rounded sm:block" />
          <span className="jr-shimmer hidden h-6 w-16 rounded-full sm:block" />
        </div>
      ))}
    </div>
  );
}

function Illustration() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" aria-hidden="true">
      <path
        d="M40 12c-12 16-22 28-22 42a22 22 0 0 0 44 0c0-14-10-26-22-42Z"
        fill="var(--jr-eau-pale)"
        stroke="var(--jr-eau-clair)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M64 30 50 56h12l-6 22 20-30H64l8-18Z"
        fill="var(--jr-elec)"
        stroke="var(--jr-elec-fonce)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EtatVide({ listeVide, onAjouter, onReset }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <Illustration />

      <h3 className="mt-4 text-base font-semibold text-jr-titre">
        {listeVide ? 'Aucun compteur pour le moment' : 'Aucun compteur ne correspond'}
      </h3>

      <p className="mt-1 max-w-sm text-sm text-jr-doux">
        {listeVide
          ? 'Ajoutez le premier compteur et rattachez-le à un abonné actif.'
          : 'Essayez un autre numéro ou un autre nom, ou retirez un des filtres.'}
      </p>

      {listeVide ? (
        <button
          type="button"
          onClick={onAjouter}
          className="jr-btn jr-btn-elec mt-5 inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold"
        >
          <Plus size={18} aria-hidden="true" />
          Ajouter un compteur
        </button>
      ) : (
        <button
          type="button"
          onClick={onReset}
          className="mt-5 rounded-md border border-jr-bordure-forte px-4 py-2.5 text-sm font-medium text-jr-lien transition-colors hover:bg-[var(--jr-eau-pale)] motion-reduce:transition-none"
        >
          Réinitialiser les filtres
        </button>
      )}
    </div>
  );
}

function EtatErreur({ message, onRetry }) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-14 text-center">
      <Illustration />

      <h3 className="mt-4 text-base font-semibold text-jr-titre">
        Impossible d’afficher les compteurs
      </h3>

      <p className="mt-1 max-w-sm text-sm text-jr-doux">{message}</p>

      <button
        type="button"
        onClick={onRetry}
        className="jr-btn jr-btn-elec mt-5 inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold"
      >
        <RefreshCw size={17} aria-hidden="true" />
        Réessayer
      </button>
    </div>
  );
}

/* ---------------------------------------------------------
   PAGINATION
--------------------------------------------------------- */
function Pagination({
  debut,
  fin,
  total,
  page,
  nbPages,
  taillePage,
  onPage,
  onTaillePage,
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-jr-bordure px-5 py-3 text-sm text-jr-doux sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <p className="tabular-nums">
        Affichage de {formatNombre(debut + 1)} à {formatNombre(fin)} sur{' '}
        {formatNombre(total)}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span className="text-xs text-jr-faible">Lignes</span>
          <select
            value={taillePage}
            onChange={(e) => onTaillePage(Number(e.target.value))}
            className="jr-field rounded-md border px-2 py-1.5 text-sm"
          >
            {TAILLES_PAGE.map((taille) => (
              <option key={taille} value={taille}>
                {taille}
              </option>
            ))}
          </select>
        </label>

        <nav aria-label="Pagination" className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPage(page - 1)}
            disabled={page <= 1}
            aria-label="Page précédente"
            className="rounded-md p-2 transition-colors hover:bg-[var(--jr-eau-pale)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>

          <span className="px-2 tabular-nums" aria-current="page">
            Page {page} / {nbPages}
          </span>

          <button
            type="button"
            onClick={() => onPage(page + 1)}
            disabled={page >= nbPages}
            aria-label="Page suivante"
            className="rounded-md p-2 transition-colors hover:bg-[var(--jr-eau-pale)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </nav>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   DÉTAIL DE LIGNE (partagé entre tableau et cartes mobiles)
--------------------------------------------------------- */
function Installation({ compteur }) {
  const date = formatDate(compteur.date_installation);

  if (!date) {
    return <span className="text-sm text-jr-faible">Date non renseignée</span>;
  }

  return (
    <div>
      <p className="flex items-center gap-1.5 text-sm text-jr-texte">
        <CalendarDays size={14} aria-hidden="true" className="text-jr-faible" />
        {date}
      </p>
      <p className="mt-0.5 text-xs text-jr-faible">
        {anciennete(compteur.date_installation)}
      </p>
    </div>
  );
}

function Abonne({ compteur }) {
  return (
    <div className="flex items-center gap-2">
      <UserRound size={16} aria-hidden="true" className="shrink-0 text-jr-faible" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-jr-texte">
          {nomAbonne(compteur) || '—'}
        </p>
        <p className="font-mono text-xs text-jr-faible">{compteur.numero_abonne}</p>
      </div>
    </div>
  );
}

const styleSurligne = (actif) =>
  actif ? { backgroundColor: 'var(--jr-elec-pale)' } : undefined;

/* =========================================================
   TABLEAU (≥ 768 px) + CARTES (mobile)
========================================================= */
function CompteursTable({
  elements,
  totalFiltre,
  totalTous,
  premierChargement,
  erreurChargement,
  onRecharger,
  tri,
  dir,
  onTrier,
  onTriMobile,
  onModifier,
  onChangerStatut,
  surligneId,
  page,
  nbPages,
  taillePage,
  debut,
  onPage,
  onTaillePage,
  onAjouter,
  onReset,
}) {
  if (premierChargement) return <Squelette />;

  if (erreurChargement && totalTous === 0) {
    return <EtatErreur message={erreurChargement} onRetry={onRecharger} />;
  }

  if (totalFiltre === 0) {
    return (
      <EtatVide
        listeVide={totalTous === 0}
        onAjouter={onAjouter}
        onReset={onReset}
      />
    );
  }

  return (
    <>
      {/* TRI (mobile uniquement : sur grand écran, clic sur les en-têtes) */}
      <div className="flex items-center gap-2 border-b border-jr-bordure px-4 py-2.5 md:hidden">
        <label htmlFor="tri-mobile" className="text-xs text-jr-faible">
          Trier par
        </label>
        <select
          id="tri-mobile"
          value={tri ? `${tri}:${dir}` : ''}
          onChange={(e) => onTriMobile(e.target.value)}
          className="jr-field flex-1 rounded-md border px-2 py-1.5 text-sm"
        >
          {OPTIONS_TRI_MOBILE.map((option) => (
            <option key={option.valeur || 'defaut'} value={option.valeur}>
              {option.libelle}
            </option>
          ))}
        </select>
      </div>

      {/* TABLEAU */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left">
          <caption className="sr-only">Liste des compteurs</caption>

          <thead>
            <tr className="border-b border-jr-bordure">
              <EnTete colonne="numero" libelle="Compteur" tri={tri} dir={dir} onTrier={onTrier} />
              <EnTete colonne="abonne" libelle="Abonné" tri={tri} dir={dir} onTrier={onTrier} />
              <EnTete colonne="date" libelle="Installation" tri={tri} dir={dir} onTrier={onTrier} />
              <EnTete colonne="statut" libelle="Statut" tri={tri} dir={dir} onTrier={onTrier} />
              <th scope="col" className="px-5 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-jr-bordure">
            {elements.map((compteur, index) => (
              <tr
                key={compteur.id}
                className="jr-entree group transition-colors duration-700 hover:bg-[var(--jr-eau-pale)] focus-within:bg-[var(--jr-eau-pale)] motion-reduce:transition-none"
                style={{
                  animationDelay: `${Math.min(index, 8) * 30}ms`,
                  ...styleSurligne(surligneId === compteur.id),
                }}
              >
                <td className="relative px-5 py-3.5">
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 w-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none"
                    style={{ backgroundColor: 'var(--jr-elec)' }}
                  />

                  <div className="flex items-center gap-3">
                    <IconeType type={compteur.type} />
                    <div>
                      <p className="font-mono text-sm font-semibold tabular-nums text-jr-titre">
                        {compteur.numero_compteur}
                      </p>
                      <p className="text-xs text-jr-faible">
                        {LIBELLE_TYPE[compteur.type] || compteur.type} · ID #{compteur.id}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="max-w-[16rem] px-5 py-3.5">
                  <Abonne compteur={compteur} />
                </td>

                <td className="px-5 py-3.5">
                  <Installation compteur={compteur} />
                </td>

                <td className="px-5 py-3.5">
                  <StatusBadge status={compteur.statut} />
                </td>

                <td className="px-5 py-3.5">
                  <div className="flex justify-end">
                    <Actions
                      compteur={compteur}
                      onModifier={onModifier}
                      onChangerStatut={onChangerStatut}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CARTES (mobile) */}
      <ul className="divide-y divide-jr-bordure md:hidden">
        {elements.map((compteur, index) => (
          <li
            key={compteur.id}
            className="jr-entree p-4 transition-colors duration-700 motion-reduce:transition-none"
            style={{
              animationDelay: `${Math.min(index, 8) * 30}ms`,
              ...styleSurligne(surligneId === compteur.id),
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <IconeType type={compteur.type} />
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-semibold text-jr-titre">
                    {compteur.numero_compteur}
                  </p>
                  <p className="text-xs text-jr-faible">
                    {LIBELLE_TYPE[compteur.type] || compteur.type} · ID #{compteur.id}
                  </p>
                </div>
              </div>

              <StatusBadge status={compteur.statut} />
            </div>

            <div className="mt-3 space-y-2">
              <Abonne compteur={compteur} />
              <Installation compteur={compteur} />
            </div>

            <div className="mt-3">
              <Actions
                compteur={compteur}
                onModifier={onModifier}
                onChangerStatut={onChangerStatut}
                avecTexte
              />
            </div>
          </li>
        ))}
      </ul>

      <Pagination
        debut={debut}
        fin={debut + elements.length}
        total={totalFiltre}
        page={page}
        nbPages={nbPages}
        taillePage={taillePage}
        onPage={onPage}
        onTaillePage={onTaillePage}
      />
    </>
  );
}

export default CompteursTable;
