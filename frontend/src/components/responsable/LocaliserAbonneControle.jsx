import { useEffect, useState } from 'react';

import {
  CheckCircle2,
  Eraser,
  Loader2,
  LocateFixed,
  MapPin,
  Search,
  X,
} from 'lucide-react';

import axiosClient from '../../api/axiosClient.js';
import CarteLeaflet from '../map/CarteLeaflet.jsx';

/* =========================================================
   DÉFINIR LA POSITION GPS D'UN ABONNÉ DEPUIS LE PLANNING
   ---------------------------------------------------------
   L'abonné existe déjà (adresse textuelle enregistrée par
   l'Administrateur) mais aucune coordonnée n'est stockée :
   aucun marqueur ne peut donc être affiché.

   Ce dialogue permet de choisir la position réelle :
     - recherche d'adresse via le proxy serveur Nominatim
       (une requête par clic, pas de frappe par frappe) ;
     - clic sur la carte ou déplacement du marqueur ;
     - enregistrement de latitude/longitude en PostgreSQL.

   Aucune coordonnée n'est déduite du texte de l'adresse :
   tant que l'utilisateur ne choisit pas un point, rien n'est
   enregistré.
========================================================= */

const CHAMPS_CONTEXTE = ['quartier', 'fokontany', 'commune', 'region'];

function positionDe(mission) {
  if (!mission) return null;
  /* Number(null) vaut 0 : sans ce garde-fou, un abonné non géolocalisé
     serait placé au large du golfe de Guinée (0,0) et pourrait être
     enregistré à cette position inventée. */
  if (
    mission.latitude === null || mission.latitude === undefined || String(mission.latitude).trim() === '' ||
    mission.longitude === null || mission.longitude === undefined || String(mission.longitude).trim() === ''
  ) return null;
  const latitude = Number(mission.latitude);
  const longitude = Number(mission.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function libelleAbonne(mission) {
  return [mission?.abonne_prenom, mission?.abonne_nom].filter(Boolean).join(' ').trim() || 'Abonné';
}

function adresseLisible(mission) {
  return [
    mission?.adresse,
    mission?.quartier,
    mission?.fokontany ? `Fokontany ${mission.fokontany}` : null,
    mission?.commune,
    mission?.region,
  ].filter(Boolean).join(' · ') || 'Adresse non renseignée';
}

export default function LocaliserAbonneControle({ mission, onClose, onSaved }) {
  const initiale = positionDe(mission);
  const [position, setPosition] = useState(initiale);
  const [recherche, setRecherche] = useState(() => (
    [mission?.quartier, mission?.fokontany, mission?.commune].filter(Boolean).join(' ')
  ));
  const [resultats, setResultats] = useState([]);
  const [rechercheEnCours, setRechercheEnCours] = useState(false);
  const [rechercheErreur, setRechercheErreur] = useState('');
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    const gererClavier = (event) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', gererClavier);
    return () => window.removeEventListener('keydown', gererClavier);
  }, [onClose, saving]);

  const rechercher = async (event) => {
    event?.preventDefault?.();
    const saisie = String(recherche || '').trim();
    const contexte = CHAMPS_CONTEXTE
      .map((champ) => String(mission?.[champ] || '').trim())
      .filter(Boolean);

    const parties = [];
    const vus = new Set();
    for (const partie of [saisie, ...contexte]) {
      const cle = partie.toLowerCase();
      if (!partie || vus.has(cle)) continue;
      vus.add(cle);
      parties.push(partie);
    }
    const requete = parties.join(', ');

    if (requete.length < 3) {
      setRechercheErreur('Saisissez une adresse ou un lieu (au moins 3 caractères).');
      return;
    }

    setRechercheEnCours(true);
    setRechercheErreur('');
    setResultats([]);
    try {
      const response = await axiosClient.get('/geocodage/recherche', { params: { q: requete } });
      const data = Array.isArray(response.data?.data) ? response.data.data : [];
      setResultats(data);
      if (!data.length) {
        setRechercheErreur(
          'Aucun lieu trouvé. Précisez le quartier ou la commune, ou placez le marqueur manuellement sur la carte.'
        );
      }
    } catch (error) {
      setRechercheErreur(
        error.response?.data?.message
          || 'La recherche d’adresse est momentanément indisponible. Placez le marqueur manuellement sur la carte.'
      );
    } finally {
      setRechercheEnCours(false);
    }
  };

  const choisirResultat = (resultat) => {
    setPosition({
      latitude: Number(Number(resultat.latitude).toFixed(6)),
      longitude: Number(Number(resultat.longitude).toFixed(6)),
    });
    setResultats([]);
    setRechercheErreur('');
  };

  /* « valeurs » vaut null lorsqu'on efface une position déjà enregistrée :
     le backend conserve alors l'abonné sans coordonnées (jamais 0, 0). */
  const enregistrer = async (valeurs = position) => {
    if (!valeurs && !initiale) {
      setErreur('Choisissez d’abord la position exacte sur la carte ou dans les résultats de recherche.');
      return;
    }
    setSaving(true);
    setErreur('');
    try {
      const response = await axiosClient.patch(
        `/responsable/controles/abonnes/${mission.abonne_id}/localisation`,
        { latitude: valeurs?.latitude ?? null, longitude: valeurs?.longitude ?? null }
      );
      onSaved?.(response.data?.data, response.data?.message);
    } catch (error) {
      setErreur(
        error.response?.data?.message
          || 'Impossible d’enregistrer la position GPS. Vérifiez la connexion et réessayez.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (!mission) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[1250] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-localiser-abonne"
        className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-jr-bordure bg-jr-surface p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-jr-faible">
              {initiale ? 'Modifier la position GPS' : 'Définir la position GPS'}
            </p>
            <h3 id="titre-localiser-abonne" className="mt-0.5 truncate text-base font-bold text-jr-titre">
              {libelleAbonne(mission)}
            </h3>
            <p className="mt-0.5 text-xs text-jr-doux">
              Référence {mission.numero_abonne || '—'} · Compteur {mission.numero_compteur || '—'}
            </p>
            <p className="mt-1 text-xs text-jr-faible">{adresseLisible(mission)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Fermer la fenêtre de localisation"
            className="rounded-md p-1.5 text-jr-faible transition-colors hover:bg-jr-eau-pale hover:text-jr-texte disabled:opacity-50"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {!initiale && (
          <p className="mt-3 rounded-md border border-jr-attention/40 bg-jr-attention/10 px-3 py-2 text-xs font-medium text-jr-attention">
            Aucune coordonnée GPS n’est enregistrée pour cet abonné : c’est la raison pour laquelle il n’apparaît pas sur la carte du planning.
          </p>
        )}

        <div className="mt-4 space-y-2">
          <label htmlFor="localiser-recherche" className="block text-xs font-medium text-jr-doux">
            Rechercher l’adresse sur OpenStreetMap
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-3 text-jr-faible" aria-hidden="true" />
              <input
                id="localiser-recherche"
                value={recherche}
                onChange={(event) => setRecherche(event.target.value)}
                disabled={rechercheEnCours || saving}
                placeholder="Ex. Mahafaly Vatofotsy Antsirabe, ou un repère connu"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    if (!rechercheEnCours && !saving) rechercher();
                  }
                }}
                className="jr-field w-full rounded-md border py-2.5 pl-9 pr-3 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={rechercher}
              disabled={rechercheEnCours || saving}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-jr-bordure-forte bg-jr-surface px-4 py-2.5 text-sm font-semibold text-jr-doux transition-colors hover:bg-jr-eau-pale disabled:cursor-not-allowed disabled:opacity-50"
            >
              {rechercheEnCours ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}
              Rechercher
            </button>
          </div>
          <p className="text-[11px] text-jr-faible">
            Une seule requête est envoyée par recherche. Recherche et fond de carte : OpenStreetMap / Nominatim.
          </p>
        </div>

        {rechercheErreur && (
          <p role="status" className="mt-2 rounded-md border border-jr-attention/40 bg-jr-attention/10 px-3 py-2 text-xs font-medium text-jr-attention">
            {rechercheErreur}
          </p>
        )}

        {resultats.length > 0 && (
          <ul className="mt-2 max-h-48 divide-y divide-jr-bordure overflow-y-auto rounded-md border border-jr-bordure bg-jr-surface">
            {resultats.map((resultat, index) => (
              <li key={`${resultat.latitude}-${resultat.longitude}-${index}`}>
                <button
                  type="button"
                  onClick={() => choisirResultat(resultat)}
                  className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-xs text-jr-doux transition-colors hover:bg-jr-eau-pale"
                >
                  <MapPin size={14} className="mt-0.5 shrink-0 text-jr-lien" aria-hidden="true" />
                  <span>
                    <span className="block font-semibold text-jr-texte">{resultat.label || 'Lieu sans nom'}</span>
                    <span className="tabular-nums text-jr-faible">
                      {Number(resultat.latitude).toFixed(6)}, {Number(resultat.longitude).toFixed(6)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 overflow-hidden rounded-lg border border-jr-bordure">
          <CarteLeaflet
            pick={position}
            onPick={(latitude, longitude) => setPosition({ latitude, longitude })}
            height={300}
            center={position ? [position.latitude, position.longitude] : undefined}
            zoom={position ? 16 : 12}
            emptyMessage="Cliquez sur la carte pour placer le domicile de l’abonné"
          />
        </div>

        <p className="mt-2 text-xs text-jr-doux">
          {position ? (
            <>
              Position sélectionnée :{' '}
              <span className="font-semibold tabular-nums text-jr-texte">
                {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}
              </span>
              {' '}· déplacez le marqueur pour corriger.
            </>
          ) : initiale ? (
            'Position effacée : enregistrez pour retirer les coordonnées GPS de cet abonné.'
          ) : (
            'Aucune position sélectionnée : recherchez l’adresse ou cliquez sur la carte.'
          )}
        </p>

        {erreur && (
          <p role="alert" className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800">
            {erreur}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-jr-bordure pt-3">
          <button
            type="button"
            onClick={() => enregistrer()}
            disabled={saving || (!position && !initiale)}
            className="inline-flex items-center gap-2 rounded-md bg-jr-eau px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-jr-eau-fonce disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
            Enregistrer la position
          </button>
          <button
            type="button"
            onClick={() => (initiale ? enregistrer(null) : setPosition(null))}
            disabled={saving || (!position && !initiale)}
            className="inline-flex items-center gap-2 rounded-md border border-jr-bordure-forte px-3 py-2.5 text-sm font-semibold text-jr-doux transition-colors hover:bg-jr-eau-pale disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Eraser size={16} aria-hidden="true" />
            {initiale ? 'Effacer la position' : 'Effacer la sélection'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="ml-auto inline-flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-semibold text-jr-doux transition-colors hover:bg-jr-eau-pale disabled:opacity-50"
          >
            Annuler
          </button>
        </div>

        <p className="mt-3 flex items-start gap-1.5 text-[11px] text-jr-faible">
          <LocateFixed size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          La position enregistrée sera utilisée immédiatement par la carte du planning et par les missions de l’Agent.
        </p>
      </div>
    </div>
  );
}
