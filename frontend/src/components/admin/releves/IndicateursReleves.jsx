import { CalendarDays, ClipboardList, Droplets, Zap } from 'lucide-react';

/* =========================================================
   CARTES STATISTIQUES
   Calculées uniquement à partir des relevés réellement chargés :
   total, relevés du mois, consommation eau, consommation électricité.
   (Un relevé n'a pas de statut « validé / en attente » dans la base :
   ces cartes-là ne sont donc pas affichées.)
========================================================= */
const nombre = (n) => Number(n || 0).toLocaleString('fr-FR');

const conso = (n) =>
  Number(n || 0).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function Carte({ icone: Icone, libelle, valeur, unite, detail, ton, chargement }) {
  const tons = {
    bleu: { liseré: 'var(--jr-eau)', fond: 'var(--jr-eau-pale)', icone: 'var(--jr-lien)' },
    fonce: { liseré: 'var(--jr-eau-fonce)', fond: 'var(--jr-eau-pale)', icone: 'var(--jr-eau-fonce)' },
    jaune: { liseré: 'var(--jr-elec)', fond: 'var(--jr-elec-pale)', icone: 'var(--jr-attention)' },
  };

  const style = tons[ton] || tons.bleu;

  return (
    <div
      className="jr-entree relative overflow-hidden rounded-lg border border-jr-bordure bg-jr-surface p-5 shadow-sm transition-shadow hover:shadow-md motion-reduce:transition-none"
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: style.liseré }}
      />

      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-jr-doux">{libelle}</p>

        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: style.fond, color: style.icone }}
        >
          <Icone size={18} strokeWidth={1.9} aria-hidden="true" />
        </span>
      </div>

      {chargement ? (
        <div
          aria-hidden="true"
          className="mt-3 h-8 w-28 animate-pulse rounded bg-jr-bordure motion-reduce:animate-none"
        />
      ) : (
        <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-jr-titre">
          {valeur}
          {unite && (
            <span className="ml-1.5 text-base font-semibold text-jr-doux">
              {unite}
            </span>
          )}
        </p>
      )}

      <p className="mt-1.5 text-xs text-jr-faible">{detail}</p>
    </div>
  );
}

function IndicateursReleves({ indicateurs, duMois = 0, chargement = false }) {
  const { total = 0, eau = { n: 0, conso: 0 }, elec = { n: 0, conso: 0 } } =
    indicateurs || {};

  const sansDonnees = chargement && total === 0;

  return (
    <section
      aria-label="Synthèse des relevés"
      className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      <Carte
        icone={ClipboardList}
        libelle="Relevés enregistrés"
        valeur={nombre(total)}
        detail="Tous compteurs confondus"
        ton="bleu"
        chargement={sansDonnees}
      />

      <Carte
        icone={CalendarDays}
        libelle="Relevés du mois"
        valeur={nombre(duMois)}
        detail="Saisis ce mois-ci"
        ton="fonce"
        chargement={sansDonnees}
      />

      <Carte
        icone={Droplets}
        libelle="Eau consommée"
        valeur={conso(eau.conso)}
        unite="m³"
        detail={`${nombre(eau.n)} relevé${eau.n > 1 ? 's' : ''}`}
        ton="bleu"
        chargement={sansDonnees}
      />

      <Carte
        icone={Zap}
        libelle="Électricité consommée"
        valeur={conso(elec.conso)}
        unite="kWh"
        detail={`${nombre(elec.n)} relevé${elec.n > 1 ? 's' : ''}`}
        ton="jaune"
        chargement={sansDonnees}
      />
    </section>
  );
}

export default IndicateursReleves;
