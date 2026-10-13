import { useEffect, useMemo, useRef, useState } from 'react';
import { Droplets, TriangleAlert, Zap } from 'lucide-react';

import { formatNombre, pourcent } from './compteursUtils.js';

/* =========================================================
   NOMBRE ANIMÉ
   Compte progressivement jusqu'à la valeur (~600 ms).
   Aucune animation si l'utilisateur préfère réduire les
   mouvements.
========================================================= */
function useCompteProgressif(cible, duree = 600) {
  const [valeur, setValeur] = useState(0);
  const depart = useRef(0);

  useEffect(() => {
    const reduit =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduit) {
      depart.current = cible;
      setValeur(cible);
      return undefined;
    }

    const de = depart.current;
    const debut = performance.now();
    let image;

    const pas = (maintenant) => {
      const avancement = Math.min((maintenant - debut) / duree, 1);
      const adouci = 1 - (1 - avancement) ** 3;
      const courant = Math.round(de + (cible - de) * adouci);

      depart.current = courant;
      setValeur(courant);

      if (avancement < 1) image = requestAnimationFrame(pas);
    };

    image = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(image);
  }, [cible, duree]);

  return valeur;
}

function Nombre({ valeur, chargement, className }) {
  const anime = useCompteProgressif(valeur);

  if (chargement) {
    return (
      <span
        aria-hidden="true"
        className={`jr-shimmer mt-1 block h-8 w-16 rounded ${className || ''}`}
      />
    );
  }

  return (
    <>
      <span aria-hidden="true" className={className}>
        {formatNombre(anime)}
      </span>
      <span className="sr-only">{formatNombre(valeur)}</span>
    </>
  );
}

const anneauActif = { boxShadow: '0 0 0 2px var(--jr-focus)' };

/* =========================================================
   CARTES DE STATISTIQUES
   Calculées côté client sur TOUS les compteurs ; les cartes
   Eau / Électricité / statuts sont cliquables (filtre).
========================================================= */
function CompteursStats({
  compteurs,
  chargement,
  type,
  statut,
  onFiltreType,
  onFiltreStatut,
}) {
  const stats = useMemo(() => {
    const compte = (cle, valeur) =>
      compteurs.filter((c) => c[cle] === valeur).length;

    return {
      total: compteurs.length,
      eau: compte('type', 'EAU'),
      elec: compte('type', 'ELECTRICITE'),
      actifs: compte('statut', 'ACTIF'),
      inactifs: compte('statut', 'INACTIF'),
      averifier: compte('statut', 'A_VERIFIER'),
    };
  }, [compteurs]);

  const cartesStatut = [
    {
      valeur: 'ACTIF',
      libelle: 'Actifs',
      nombre: stats.actifs,
      point: 'var(--jr-ok)',
    },
    {
      valeur: 'INACTIF',
      libelle: 'Inactifs',
      nombre: stats.inactifs,
      point: 'var(--jr-desactive-texte)',
    },
    {
      valeur: 'A_VERIFIER',
      libelle: 'À vérifier',
      nombre: stats.averifier,
      point: 'var(--jr-elec)',
      alerte: stats.averifier > 0,
    },
  ];

  return (
    <section aria-label="Statistiques des compteurs" className="mb-6 space-y-3">
      {/* Total + Eau + Électricité */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.35fr_1fr_1fr]">
        <div className="jr-verre rounded-lg border border-jr-bordure p-5 shadow-sm">
          <p className="text-sm text-jr-doux">Compteurs enregistrés</p>

          <Nombre
            valeur={stats.total}
            chargement={chargement}
            className="mt-1 block text-4xl font-semibold tabular-nums tracking-tight text-jr-texte"
          />

          <div
            aria-hidden="true"
            className="mt-4 flex h-1.5 overflow-hidden rounded-full"
            style={{ backgroundColor: 'var(--jr-desactive-fond)' }}
          >
            <span
              className="h-full transition-[width] duration-500 motion-reduce:transition-none"
              style={{
                width: `${pourcent(stats.eau, stats.total)}%`,
                backgroundColor: 'var(--jr-eau-clair)',
              }}
            />
            <span
              className="h-full transition-[width] duration-500 motion-reduce:transition-none"
              style={{
                width: `${pourcent(stats.elec, stats.total)}%`,
                backgroundColor: 'var(--jr-elec)',
              }}
            />
          </div>

          <p className="mt-2 text-xs text-jr-faible">
            {pourcent(stats.eau, stats.total)} % eau ·{' '}
            {pourcent(stats.elec, stats.total)} % électricité
          </p>
        </div>

        <button
          type="button"
          aria-pressed={type === 'EAU'}
          aria-label={`Compteurs d’eau : ${stats.eau}. Filtrer la liste`}
          onClick={() => onFiltreType('EAU')}
          className="jr-carte-eau rounded-lg p-5 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          style={type === 'EAU' ? anneauActif : undefined}
        >
          <span className="flex items-start justify-between">
            <span className="text-sm text-jr-doux">Compteurs d’eau</span>
            <Droplets size={20} aria-hidden="true" className="text-jr-lien" />
          </span>

          <Nombre
            valeur={stats.eau}
            chargement={chargement}
            className="mt-1 block text-3xl font-semibold tabular-nums tracking-tight text-jr-texte"
          />

          <span className="mt-2 block text-xs text-jr-lien">
            {pourcent(stats.eau, stats.total)} % du parc
          </span>
        </button>

        <button
          type="button"
          aria-pressed={type === 'ELECTRICITE'}
          aria-label={`Compteurs d’électricité : ${stats.elec}. Filtrer la liste`}
          onClick={() => onFiltreType('ELECTRICITE')}
          className="jr-carte-elec rounded-lg p-5 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          style={type === 'ELECTRICITE' ? anneauActif : undefined}
        >
          <span className="flex items-start justify-between">
            <span className="text-sm text-jr-doux">Compteurs d’électricité</span>
            <Zap
              size={20}
              aria-hidden="true"
              style={{ color: 'var(--jr-attention)' }}
            />
          </span>

          <Nombre
            valeur={stats.elec}
            chargement={chargement}
            className="mt-1 block text-3xl font-semibold tabular-nums tracking-tight text-jr-texte"
          />

          <span
            className="mt-2 block text-xs"
            style={{ color: 'var(--jr-attention)' }}
          >
            {pourcent(stats.elec, stats.total)} % du parc
          </span>
        </button>
      </div>

      {/* Statuts (cliquables) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cartesStatut.map((carte) => {
          const actif = statut === carte.valeur;

          return (
            <button
              key={carte.valeur}
              type="button"
              aria-pressed={actif}
              aria-label={`${carte.libelle} : ${carte.nombre}. Filtrer la liste`}
              onClick={() => onFiltreStatut(carte.valeur)}
              className="jr-verre flex items-center justify-between gap-3 rounded-lg border border-jr-bordure p-4 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-jr-bordure-forte hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              style={
                actif
                  ? anneauActif
                  : carte.alerte
                    ? { borderColor: 'var(--jr-elec)' }
                    : undefined
              }
            >
              <span>
                <span className="flex items-center gap-2 text-sm text-jr-doux">
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: carte.point }}
                  />
                  {carte.libelle}
                </span>

                <Nombre
                  valeur={carte.nombre}
                  chargement={chargement}
                  className="mt-1 block text-2xl font-semibold tabular-nums tracking-tight text-jr-texte"
                />
              </span>

              {carte.alerte && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: 'var(--jr-elec-pale)',
                    color: 'var(--jr-attention)',
                  }}
                >
                  <TriangleAlert
                    size={14}
                    aria-hidden="true"
                    className="animate-pulse motion-reduce:animate-none"
                  />
                  À traiter
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default CompteursStats;
