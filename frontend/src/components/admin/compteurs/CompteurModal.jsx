import { useMemo, useRef, useState } from 'react';
import { Check, Droplets, RefreshCw, Save, Search, X, Zap } from 'lucide-react';

import useModalA11y from './useModalA11y.js';
import { STATUTS, TYPES, versChampDate } from './compteursUtils.js';

const LIBELLE_ABONNE = (a) =>
  `${a.numero_abonne} - ${a.prenom ? `${a.prenom} ${a.nom}` : a.nom}`;

/* =========================================================
   MODAL D'AJOUT / MODIFICATION D'UN COMPTEUR
   - focus piégé, Échap, clic sur le fond (sauf pendant
     l'enregistrement)
   - validation en direct, doublon de numéro détecté
   - type en grandes cartes, abonné avec recherche
   Le composant est monté à l'ouverture (key = id ou « new »),
   son état est donc réinitialisé à chaque ouverture.
========================================================= */
function CompteurModal({
  compteur,
  compteurs,
  abonnes,
  chargementAbonnes,
  erreurAbonnes,
  onRelancerAbonnes,
  enregistrement,
  erreurServeur,
  cleErreur,
  onFermer,
  onEnregistrer,
}) {
  const edition = Boolean(compteur);

  const [form, setForm] = useState(() => ({
    numero_compteur: compteur?.numero_compteur || '',
    type: compteur?.type || 'ELECTRICITE',
    date_installation: versChampDate(compteur?.date_installation),
    statut: compteur?.statut || 'ACTIF',
    abonne_id: compteur?.abonne_id ? String(compteur.abonne_id) : '',
  }));
  const [touched, setTouched] = useState({});
  const [rechercheAbonne, setRechercheAbonne] = useState('');

  const listeRef = useRef(null);

  const fermer = () => {
    if (!enregistrement) onFermer();
  };

  const refModale = useModalA11y(true, fermer);

  /* ---------- Abonnés : seuls les actifs peuvent recevoir un compteur ---------- */
  const abonnesActifs = useMemo(
    () => abonnes.filter((a) => a.statut === 'actif'),
    [abonnes]
  );

  const abonnesAffiches = useMemo(() => {
    const requete = rechercheAbonne.trim().toLowerCase();
    if (!requete) return abonnesActifs;

    return abonnesActifs.filter((a) =>
      [a.numero_abonne, a.prenom, a.nom, `${a.prenom || ''} ${a.nom || ''}`].some(
        (valeur) => String(valeur || '').toLowerCase().includes(requete)
      )
    );
  }, [abonnesActifs, rechercheAbonne]);

  const abonneChoisi = abonnes.find((a) => String(a.id) === form.abonne_id);
  const abonneInactif = Boolean(abonneChoisi) && abonneChoisi.statut !== 'actif';

  // Libellé affiché même si la liste des abonnés n'est pas (encore) chargée
  const libelleChoisi = abonneChoisi
    ? LIBELLE_ABONNE(abonneChoisi)
    : compteur && String(compteur.abonne_id) === form.abonne_id
      ? `${compteur.numero_abonne} - ${
          compteur.abonne_prenom
            ? `${compteur.abonne_prenom} ${compteur.abonne_nom}`
            : compteur.abonne_nom
        }`
      : '';

  /* ---------- Validation ---------- */
  const numeroNettoye = form.numero_compteur.trim();

  const doublon =
    Boolean(numeroNettoye) &&
    compteurs.some(
      (c) =>
        c.id !== compteur?.id &&
        String(c.numero_compteur).trim().toLowerCase() ===
          numeroNettoye.toLowerCase()
    );

  const erreurs = {
    numero_compteur: !numeroNettoye
      ? 'Le numéro du compteur est obligatoire.'
      : doublon
        ? 'Ce numéro de compteur existe déjà.'
        : '',
    abonne_id: !form.abonne_id
      ? 'Veuillez sélectionner un abonné.'
      : abonneInactif
        ? 'Cet abonné est inactif : choisissez un abonné actif.'
        : '',
  };

  const valide = !erreurs.numero_compteur && !erreurs.abonne_id;

  const etatChamp = (nom) => {
    if (!touched[nom]) return '';
    return erreurs[nom] ? 'jr-field--err' : 'jr-field--ok';
  };

  /* ---------- Saisie ---------- */
  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((precedent) => ({ ...precedent, [name]: value }));
  };

  const handleBlur = (event) => {
    const { name } = event.target;
    setTouched((precedent) => ({ ...precedent, [name]: true }));
  };

  const choisirAbonne = (id) => {
    setForm((precedent) => ({ ...precedent, abonne_id: String(id) }));
    setTouched((precedent) => ({ ...precedent, abonne_id: true }));
  };

  const deplacerDansListe = (e, depuisChamp = false) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;

    const options = Array.from(listeRef.current?.querySelectorAll('button') || []);
    if (!options.length) return;

    e.preventDefault();

    if (depuisChamp) {
      options[e.key === 'ArrowDown' ? 0 : options.length - 1].focus();
      return;
    }

    const index = options.indexOf(document.activeElement);
    const pas = e.key === 'ArrowDown' ? 1 : -1;
    options[(index + pas + options.length) % options.length]?.focus();
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    setTouched({ numero_compteur: true, abonne_id: true });

    if (!valide || enregistrement) return;

    // Même charge utile que la version d'origine
    onEnregistrer({
      numero_compteur: numeroNettoye,
      type: form.type,
      date_installation: form.date_installation || null,
      statut: form.statut,
      abonne_id: Number(form.abonne_id),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--jr-fond) 70%, transparent)',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) fermer();
      }}
    >
      <div
        ref={refModale}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-modale-compteur"
        className="jr-verre-fort jr-pop max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-jr-bordure shadow-2xl"
      >
        {/* En-tête */}
        <div className="flex items-start justify-between gap-4 border-b border-jr-bordure px-6 py-5">
          <div>
            <h2
              id="titre-modale-compteur"
              className="text-xl font-semibold text-jr-titre"
            >
              {edition ? 'Modifier le compteur' : 'Ajouter un compteur'}
            </h2>

            <p className="mt-1 text-sm text-jr-doux">
              Le numéro et l’abonné sont obligatoires.
            </p>
          </div>

          <button
            type="button"
            onClick={fermer}
            aria-label="Fermer"
            className="rounded-md p-2 text-jr-faible transition-colors hover:bg-[var(--jr-eau-pale)] hover:text-jr-texte motion-reduce:transition-none"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Numéro */}
            <div className="sm:col-span-2">
              <label
                htmlFor="champ-numero-compteur"
                className="mb-1.5 block text-sm font-medium text-jr-doux"
              >
                Numéro du compteur
              </label>

              <input
                id="champ-numero-compteur"
                type="text"
                name="numero_compteur"
                value={form.numero_compteur}
                onChange={handleChange}
                onBlur={handleBlur}
                required
                placeholder="Ex. ELEC-0001"
                aria-invalid={Boolean(touched.numero_compteur && erreurs.numero_compteur)}
                aria-describedby="aide-numero-compteur"
                className={`jr-field w-full rounded-md border px-3 py-2.5 font-mono text-sm ${etatChamp('numero_compteur')}`}
              />

              <p
                id="aide-numero-compteur"
                className="mt-1 min-h-[1rem] text-xs"
                style={{
                  color:
                    touched.numero_compteur && erreurs.numero_compteur
                      ? 'var(--jr-err)'
                      : 'var(--jr-texte-faible)',
                }}
              >
                {touched.numero_compteur && erreurs.numero_compteur
                  ? erreurs.numero_compteur
                  : 'Identifiant unique du compteur.'}
              </p>
            </div>

            {/* Type : deux grandes cartes */}
            <fieldset className="sm:col-span-2">
              <legend className="mb-1.5 text-sm font-medium text-jr-doux">
                Type de compteur
              </legend>

              <div className="grid grid-cols-2 gap-3">
                {TYPES.map((type) => {
                  const eau = type.valeur === 'EAU';
                  const choisi = form.type === type.valeur;
                  const Icone = eau ? Droplets : Zap;

                  return (
                    <label key={type.valeur} className="relative cursor-pointer">
                      <input
                        type="radio"
                        name="type"
                        value={type.valeur}
                        checked={choisi}
                        onChange={handleChange}
                        className="peer sr-only"
                      />

                      <span
                        className="flex items-center gap-3 rounded-lg border-2 px-4 py-3 transition-colors peer-focus-visible:ring-4 peer-focus-visible:ring-jr-focus-anneau motion-reduce:transition-none"
                        style={
                          choisi
                            ? {
                                borderColor: eau
                                  ? 'var(--jr-eau-clair)'
                                  : 'var(--jr-elec)',
                                backgroundColor: eau
                                  ? 'var(--jr-eau-pale)'
                                  : 'var(--jr-elec-pale)',
                              }
                            : { borderColor: 'var(--jr-bordure-forte)' }
                        }
                      >
                        <span
                          aria-hidden="true"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
                          style={{
                            backgroundColor: eau
                              ? 'var(--jr-eau-pale)'
                              : 'var(--jr-elec-pale)',
                            color: eau ? 'var(--jr-lien)' : 'var(--jr-attention)',
                          }}
                        >
                          <Icone size={20} />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-jr-texte">
                            {type.libelle}
                          </span>
                          <span className="block text-xs text-jr-faible">
                            {eau ? 'Compteur d’eau' : 'Compteur électrique'}
                          </span>
                        </span>

                        {choisi && (
                          <Check size={18} aria-hidden="true" className="text-jr-lien" />
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {/* Date */}
            <div>
              <label
                htmlFor="champ-date-installation"
                className="mb-1.5 block text-sm font-medium text-jr-doux"
              >
                Date d’installation <span className="text-jr-faible">(facultatif)</span>
              </label>

              <input
                id="champ-date-installation"
                type="date"
                name="date_installation"
                value={form.date_installation}
                onChange={handleChange}
                className="jr-field w-full rounded-md border px-3 py-2.5 text-sm"
              />
            </div>

            {/* Statut */}
            <div>
              <label
                htmlFor="champ-statut"
                className="mb-1.5 block text-sm font-medium text-jr-doux"
              >
                Statut
              </label>

              <select
                id="champ-statut"
                name="statut"
                value={form.statut}
                onChange={handleChange}
                required
                className="jr-field w-full rounded-md border px-3 py-2.5 text-sm"
              >
                {STATUTS.map((statut) => (
                  <option key={statut.valeur} value={statut.valeur}>
                    {statut.libelle}
                  </option>
                ))}
              </select>
            </div>

            {/* Abonné : recherche + liste */}
            <div className="sm:col-span-2">
              <label
                htmlFor="champ-recherche-abonne"
                className="mb-1.5 block text-sm font-medium text-jr-doux"
              >
                Abonné
              </label>

              <div className="relative">
                <Search
                  size={16}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-jr-faible"
                />

                <input
                  id="champ-recherche-abonne"
                  type="text"
                  value={rechercheAbonne}
                  onChange={(e) => setRechercheAbonne(e.target.value)}
                  onKeyDown={(e) => deplacerDansListe(e, true)}
                  disabled={chargementAbonnes}
                  placeholder={
                    chargementAbonnes
                      ? 'Chargement des abonnés...'
                      : 'Rechercher par numéro ou nom'
                  }
                  className="jr-field w-full rounded-md border py-2.5 pl-9 pr-3 text-sm"
                />
              </div>

              <p
                aria-live="polite"
                className="mt-1.5 min-h-[1.25rem] text-xs"
                style={{
                  color:
                    touched.abonne_id && erreurs.abonne_id
                      ? 'var(--jr-err)'
                      : 'var(--jr-texte-faible)',
                }}
              >
                {touched.abonne_id && erreurs.abonne_id
                  ? erreurs.abonne_id
                  : libelleChoisi
                    ? `Abonné choisi : ${libelleChoisi}`
                    : 'Seuls les abonnés actifs peuvent recevoir un compteur.'}
              </p>

              {chargementAbonnes ? (
                <div className="space-y-2 rounded-md border border-jr-bordure p-3" aria-busy="true">
                  <span className="jr-shimmer block h-3 w-2/3 rounded" />
                  <span className="jr-shimmer block h-3 w-1/2 rounded" />
                </div>
              ) : erreurAbonnes ? (
                <div
                  role="alert"
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-sm"
                  style={{
                    borderColor: 'var(--jr-err-bordure)',
                    backgroundColor: 'var(--jr-err-pale)',
                    color: 'var(--jr-err)',
                  }}
                >
                  <span>{erreurAbonnes}</span>
                  <button
                    type="button"
                    onClick={onRelancerAbonnes}
                    className="shrink-0 font-semibold underline"
                  >
                    Réessayer
                  </button>
                </div>
              ) : abonnesAffiches.length === 0 ? (
                <p className="rounded-md border border-jr-bordure px-3 py-3 text-sm text-jr-faible">
                  Aucun abonné actif ne correspond.
                </p>
              ) : (
                <ul
                  ref={listeRef}
                  role="listbox"
                  aria-label="Abonnés actifs"
                  onKeyDown={deplacerDansListe}
                  className="max-h-44 divide-y divide-jr-bordure overflow-y-auto rounded-md border border-jr-bordure"
                >
                  {abonnesAffiches.map((abonne) => {
                    const choisi = String(abonne.id) === form.abonne_id;

                    return (
                      <li key={abonne.id} role="presentation">
                        <button
                          type="button"
                          role="option"
                          aria-selected={choisi}
                          onClick={() => choisirAbonne(abonne.id)}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-jr-texte transition-colors hover:bg-[var(--jr-eau-pale)] focus:bg-[var(--jr-eau-pale)] focus:outline-none motion-reduce:transition-none"
                          style={
                            choisi
                              ? { backgroundColor: 'var(--jr-eau-pale)' }
                              : undefined
                          }
                        >
                          <span className="font-mono text-xs text-jr-faible">
                            {abonne.numero_abonne}
                          </span>
                          <span className="flex-1 truncate">
                            {abonne.prenom
                              ? `${abonne.prenom} ${abonne.nom}`
                              : abonne.nom}
                          </span>
                          {choisi && (
                            <Check size={16} aria-hidden="true" className="text-jr-lien" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Erreur renvoyée par le serveur (secousse à chaque nouvelle erreur) */}
          {erreurServeur && (
            <div
              key={cleErreur}
              role="alert"
              className="jr-secousse rounded-md border px-4 py-3 text-sm"
              style={{
                borderColor: 'var(--jr-err-bordure)',
                backgroundColor: 'var(--jr-err-pale)',
                color: 'var(--jr-err)',
              }}
            >
              {erreurServeur}
            </div>
          )}

          {/* Boutons */}
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-jr-bordure pt-5">
            {!valide && (
              <p className="mr-auto text-xs text-jr-faible">
                Complétez les champs obligatoires pour enregistrer.
              </p>
            )}

            <button
              type="button"
              onClick={fermer}
              disabled={enregistrement}
              className="rounded-md border border-jr-bordure-forte px-4 py-2.5 text-sm font-medium text-jr-doux transition-colors hover:bg-[var(--jr-eau-pale)] hover:text-jr-texte disabled:opacity-50 motion-reduce:transition-none"
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={enregistrement || chargementAbonnes || !valide}
              className="jr-btn jr-btn-elec inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {enregistrement ? (
                <RefreshCw
                  size={17}
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : (
                <Save size={17} aria-hidden="true" />
              )}

              {enregistrement
                ? 'Enregistrement...'
                : edition
                  ? 'Enregistrer'
                  : 'Créer le compteur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CompteurModal;
