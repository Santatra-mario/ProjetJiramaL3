import { useEffect } from 'react';

import {
  CheckCircle2,
  ExternalLink,
  LocateFixed,
  MapPin,
  Navigation,
  X,
} from 'lucide-react';

/* =========================================================
   FICHE ABONNÉ D'UNE MISSION DE CONTRÔLE
   ---------------------------------------------------------
   Utilisée à deux endroits du Planning des contrôles :
     - panneau sous la carte pour la sélection courante ;
     - fenêtre modale « Voir les détails de l'abonné ».

   Toutes les valeurs proviennent de PostgreSQL (abonnes,
   compteurs, releves, missions_controle). Aucune coordonnée
   n'est calculée : si latitude/longitude sont absentes, la
   fiche affiche « Localisation GPS non renseignée ».
========================================================= */

const STATUTS = {
  EN_ATTENTE: 'En attente',
  PLANIFIEE: 'Planifiée',
  EN_COURS: 'En cours',
  TERMINEE: 'Réalisée',
  A_REPROGRAMMER: 'À reprogrammer',
  ANNULEE: 'Annulée',
};

function texte(value) {
  const propre = String(value ?? '').trim();
  return propre || null;
}

function coordonnees(mission) {
  if (mission?.latitude === null || mission?.latitude === undefined || mission?.latitude === '') return null;
  if (mission?.longitude === null || mission?.longitude === undefined || mission?.longitude === '') return null;
  const latitude = Number(mission.latitude);
  const longitude = Number(mission.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function nombre(value, decimales = 2) {
  const resultat = Number(value);
  if (!Number.isFinite(resultat)) return null;
  return resultat.toLocaleString('fr-FR', { maximumFractionDigits: decimales });
}

function dateLisible(value) {
  const brute = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(brute)) return null;
  const date = new Date(`${brute}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('fr-FR');
}

function nomAbonne(mission) {
  return [mission?.abonne_prenom, mission?.abonne_nom].filter(Boolean).join(' ').trim() || 'Abonné';
}

/* Un abonné peut posséder plusieurs compteurs actifs : le service affiché
   reprend donc l'ensemble eau / électricité réellement enregistré. */
function serviceLabel(mission) {
  const types = String(mission?.types_service || mission?.type_compteur || '')
    .toUpperCase()
    .split(/[|,]/)
    .map((type) => type.trim())
    .filter(Boolean);
  const eau = types.includes('EAU');
  const electricite = types.some((type) => type !== 'EAU');
  if (eau && electricite) return 'Eau et électricité';
  return eau ? 'Eau' : 'Électricité';
}

function unite(mission) {
  return String(mission?.type_compteur || '').toUpperCase() === 'EAU' ? 'm³' : 'kWh';
}

function Ligne({ label, value, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-jr-faible">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-jr-texte">{children || value || '—'}</dd>
    </div>
  );
}

export function FicheAbonneControle({ mission, onClose, onOuvrirFiche, onLocaliser, dialog = false }) {
  if (!mission) return null;

  const position = coordonnees(mission);
  const adresseComplete = [
    texte(mission.rue),
    texte(mission.adresse),
    texte(mission.repere) ? `Repère : ${texte(mission.repere)}` : null,
    texte(mission.quartier),
    texte(mission.fokontany) ? `Fokontany ${texte(mission.fokontany)}` : null,
    texte(mission.commune),
    texte(mission.region),
  ].filter(Boolean);

  const dernierIndex = mission.dernier_releve_index ?? mission.dernier_index;
  const dateDernierReleve = mission.dernier_releve_date ?? mission.dernier_releve;
  const consommationRecente = mission.derniere_consommation ?? mission.consommation_releve;
  const consommationPrecedente = mission.consommation_precedente;
  const statut = mission.isTarget ? 'À planifier' : (STATUTS[mission.statut] || mission.statut || '—');
  const agent = [mission.agent_prenom, mission.agent_nom].filter(Boolean).join(' ').trim();

  return (
    <div
      className={
        dialog
          ? 'max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-jr-bordure bg-jr-surface p-5 shadow-2xl'
          : 'rounded-lg border border-jr-bordure bg-jr-surface p-4 shadow-sm'
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-jr-faible">
            {mission.isTarget ? 'Abonné à planifier' : `Mission #${mission.mission_id}`}
          </p>
          <h4 className="mt-0.5 truncate text-base font-bold text-jr-titre">{nomAbonne(mission)}</h4>
          <p className="mt-0.5 text-xs text-jr-doux">
            Référence {texte(mission.numero_abonne) || '—'} · Compteur {texte(mission.numero_compteur) || '—'} · {serviceLabel(mission)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full border border-jr-bordure bg-jr-eau-pale px-2.5 py-1 text-[11px] font-semibold text-jr-texte">
            {statut}
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer la fiche abonné"
              className="rounded-md p-1.5 text-jr-faible transition-colors hover:bg-jr-eau-pale hover:text-jr-texte"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Ligne label="Téléphone" value={texte(mission.telephone) || 'Non renseigné'} />
        <Ligne label="Quartier">
          {texte(mission.quartier) || 'Quartier non renseigné'}
          {texte(mission.fokontany) ? ` · Fokontany ${texte(mission.fokontany)}` : ''}
        </Ligne>
        <Ligne label="Commune / région">
          {[texte(mission.commune), texte(mission.region)].filter(Boolean).join(' · ') || 'Non renseigné'}
        </Ligne>
        <Ligne label="Adresse complète">
          {adresseComplete.length ? adresseComplete.join(' · ') : 'Adresse non renseignée'}
        </Ligne>
        <Ligne label="Coordonnées GPS">
          {position ? (
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <MapPin size={13} className="text-jr-lien" aria-hidden="true" />
              {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-jr-attention">
              <MapPin size={13} aria-hidden="true" />
              Localisation GPS non renseignée
            </span>
          )}
        </Ligne>
        <Ligne label="Référence abonné" value={texte(mission.numero_abonne) || '—'} />
        <Ligne label="Compteur / service" value={`${texte(mission.numero_compteur) || '—'} · ${serviceLabel(mission)}`} />
        <Ligne label="Dernier index" value={nombre(dernierIndex) ?? 'Aucun relevé'} />
        <Ligne label="Date du dernier relevé" value={dateLisible(dateDernierReleve) || 'Aucun relevé'} />
        <Ligne
          label="Consommation récente"
          value={consommationRecente != null ? `${nombre(consommationRecente)} ${unite(mission)}` : 'Non disponible'}
        />
        <Ligne
          label="Consommation précédente"
          value={consommationPrecedente != null ? `${nombre(consommationPrecedente)} ${unite(mission)}` : 'Non disponible'}
        />
        <Ligne label="Date prévue du prochain contrôle" value={dateLisible(mission.date_prevue) || 'Non planifiée'} />
        <Ligne label="Agent affecté" value={agent || 'Agent non affecté'} />
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-jr-bordure pt-3">
        {onOuvrirFiche && (
          <button
            type="button"
            onClick={() => onOuvrirFiche(mission)}
            className="inline-flex items-center gap-2 rounded-md border border-jr-bordure bg-jr-surface px-3 py-2 text-sm font-semibold text-jr-doux transition-colors hover:bg-jr-eau-pale"
          >
            <ExternalLink size={15} aria-hidden="true" />
            Voir les détails de l’abonné
          </button>
        )}

        {position ? (
          <>
            <a
              href={`https://www.openstreetmap.org/directions?from=&to=${position.latitude}%2C${position.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-jr-eau px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-jr-eau-fonce"
            >
              <Navigation size={15} aria-hidden="true" />
              Ouvrir l’itinéraire
            </a>
            {onLocaliser && (
              <button
                type="button"
                onClick={() => onLocaliser(mission)}
                className="inline-flex items-center gap-2 rounded-md border border-jr-bordure bg-jr-surface px-3 py-2 text-sm font-semibold text-jr-doux transition-colors hover:bg-jr-eau-pale"
              >
                <LocateFixed size={15} aria-hidden="true" />
                Modifier la position GPS
              </button>
            )}
          </>
        ) : onLocaliser ? (
          <button
            type="button"
            onClick={() => onLocaliser(mission)}
            className="inline-flex items-center gap-2 rounded-md border border-jr-attention/50 bg-jr-attention/10 px-3 py-2 text-sm font-semibold text-jr-attention transition-colors hover:bg-jr-attention/20"
          >
            <LocateFixed size={15} aria-hidden="true" />
            Définir la position GPS
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-jr-bordure px-3 py-2 text-xs text-jr-faible">
            <CheckCircle2 size={14} aria-hidden="true" />
            Itinéraire indisponible sans coordonnées GPS
          </span>
        )}
      </div>
    </div>
  );
}

export function AbonneControleDialog({ mission, onClose, onLocaliser }) {
  useEffect(() => {
    if (!mission) return undefined;
    const gererClavier = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', gererClavier);
    return () => window.removeEventListener('keydown', gererClavier);
  }, [mission, onClose]);

  if (!mission) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={`Détails de l’abonné ${nomAbonne(mission)}`}>
        <FicheAbonneControle mission={mission} onClose={onClose} onLocaliser={onLocaliser} dialog />
      </div>
    </div>
  );
}
