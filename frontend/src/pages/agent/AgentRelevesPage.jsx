import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardList,
  Droplets,
  History,
  Info,
  Loader2,
  RefreshCw,
  Save,
  X,
  Zap,
} from 'lucide-react';

import axiosClient from '../../api/axiosClient';
import AgentLayout from '../../components/admin/agent/AgentLayout';

/* ------------------------------------------------------------------ */
/* Mouvement : un seul fil conducteur, « le relevé saisi passe du       */
/* formulaire à l'historique ». Tout est en CSS (transform/opacity/     */
/* couleur) et se réduit à des fondus de couleur si prefers-reduced-    */
/* motion est actif : le changement reste visible sans déplacement.     */
/* ------------------------------------------------------------------ */
const MOTION_CSS = `
.rv-row{display:grid;grid-template-rows:1fr}
.rv-row>div{min-height:0;overflow:hidden}
.rv-row-new{animation:rv-grow 420ms cubic-bezier(.25,1,.5,1) both}
.rv-hl{animation:rv-hl 3.2s ease-out 300ms both}
.rv-flash{animation:rv-flash 1.8s ease-out both}
.rv-pop{animation:rv-pop 260ms cubic-bezier(.25,1,.5,1) both}
@keyframes rv-grow{from{grid-template-rows:0fr;opacity:0}to{grid-template-rows:1fr;opacity:1}}
@keyframes rv-hl{from{background-color:#d1fae5}to{background-color:transparent}}
@keyframes rv-flash{0%{background-color:#d1fae5;border-color:#6ee7b7}100%{background-color:#f1f5f9;border-color:#e2e8f0}}
@keyframes rv-pop{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.rv-row-new,.rv-pop{animation:none}}
`;

const CARD = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6';
const LABEL = 'mb-1.5 block text-sm font-semibold text-slate-700';
const FIELD =
  'w-full rounded-xl border px-3.5 py-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-200';
const FIELD_EDIT = `${FIELD} border-slate-300 bg-white focus:border-blue-500`;
const FIELD_LOCKED = `${FIELD} cursor-not-allowed border-slate-200 bg-slate-100 text-slate-600`;
const SECTION_TITLE = 'text-xs font-bold uppercase tracking-wider text-slate-500';

const PREVIEW = {
  empty: {
    box: 'border-slate-200 bg-slate-50 text-slate-500',
    hint: 'Saisissez le nouvel index pour la calculer.',
  },
  ok: {
    box: 'border-blue-200 bg-blue-50 text-blue-800',
    hint: 'Différence entre le nouvel et l’ancien index.',
  },
  high: {
    box: 'border-amber-200 bg-amber-50 text-amber-800',
    hint: 'Bien supérieure au dernier relevé : vérifiez l’index.',
  },
  invalid: {
    box: 'border-red-200 bg-red-50 text-red-700',
    hint: 'Le nouvel index est inférieur à l’ancien.',
  },
};

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const isEau = (compteur) => String(compteur?.type || '').toUpperCase() === 'EAU';

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

const toInputDate = (value) => (value ? String(value).slice(0, 10) : '');

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR');
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—';
}

function sortDescending(data = []) {
  const time = (item) => new Date(`${toInputDate(item.date_releve)}T00:00:00`).getTime();
  return [...data].sort((a, b) => {
    if (time(a) !== time(b)) return time(b) - time(a);
    return Number(b.id || 0) - Number(a.id || 0);
  });
}

function AgentRelevesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const compteurQuery = searchParams.get('compteur') || '';

  const [compteurs, setCompteurs] = useState([]);
  const [historique, setHistorique] = useState([]);
  const [selectedCompteur, setSelectedCompteur] = useState(compteurQuery);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  // false tant que l'historique du compteur choisi n'est pas chargé : on ne
  // peut ni saisir ni confondre une erreur de chargement avec « premier relevé ».
  const [historyReady, setHistoryReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(null);
  const [justSaved, setJustSaved] = useState(false);
  const [newReleveId, setNewReleveId] = useState(null);
  const [rollKey, setRollKey] = useState(0);
  const [form, setForm] = useState({
    compteur_id: compteurQuery,
    date_ancien_releve: '',
    date_releve: getToday(),
    ancien_index: '',
    nouvel_index: '',
  });

  const historyRef = useRef(null);
  const historyCardRef = useRef(null);
  const historyReq = useRef(0);

  const currentCompteur = useMemo(
    () => compteurs.find((item) => String(item.id) === String(selectedCompteur)) || null,
    [compteurs, selectedCompteur]
  );

  const isEauCompteur = isEau(currentCompteur);
  const isFirstReleve = historyReady && historique.length === 0;
  const unite = historique[0]?.unite || (isEauCompteur ? 'm³' : 'kWh');

  // Aperçu de la consommation : l'erreur de saisie se voit avant l'enregistrement.
  const hasIndexes = form.ancien_index !== '' && form.nouvel_index !== '';
  const delta = hasIndexes
    ? Math.round((Number(form.nouvel_index) - Number(form.ancien_index)) * 100) / 100
    : null;
  const lastConso = Number(historique[0]?.consommation) || 0;
  let previewState = 'empty';
  if (delta !== null) {
    if (delta < 0) previewState = 'invalid';
    else if (lastConso > 0 && delta > lastConso * 3) previewState = 'high';
    else previewState = 'ok';
  }

  /* ---------------------------- chargement ---------------------------- */

  async function loadCompteurs() {
    try {
      setLoading(true);
      setError('');

      const response = await axiosClient.get('/agent/compteurs');
      if (response.data?.status !== 'success') {
        throw new Error(response.data?.message || 'Impossible de charger les compteurs.');
      }

      const data = response.data?.data || [];
      setCompteurs(data);

      if (selectedCompteur && data.some((item) => String(item.id) === String(selectedCompteur))) {
        return;
      }

      const first =
        data.find((item) => String(item.id) === String(compteurQuery)) || data[0];

      if (first) {
        setSelectedCompteur(String(first.id));
        setForm((previous) => ({ ...previous, compteur_id: String(first.id) }));
        setSearchParams({ compteur: String(first.id) });
      }
    } catch (requestError) {
      console.error('Erreur chargement compteurs Agent :', requestError);

      if (requestError.response?.status === 401 || requestError.response?.status === 403) {
        navigate('/', { replace: true });
        return;
      }

      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          'Erreur lors du chargement des compteurs.'
      );
    } finally {
      setLoading(false);
    }
  }

  // silent : recharge sans vider la liste (après un enregistrement).
  // knownIds : les ids déjà affichés, pour repérer le relevé qui vient d'arriver.
  async function loadHistory(compteurId, { silent = false, knownIds = null } = {}) {
    const requestId = ++historyReq.current;

    if (!compteurId) {
      setHistorique([]);
      setHistoryReady(false);
      setHistoryLoading(false);
      return [];
    }

    try {
      if (!silent) {
        setHistoryLoading(true);
        setHistoryReady(false);
        setError('');
      }

      const response = await axiosClient.get(`/agent/releves/compteur/${compteurId}`);
      if (response.data?.status !== 'success') {
        throw new Error(response.data?.message || 'Impossible de charger l’historique.');
      }

      const data = sortDescending(response.data?.data || []);
      if (requestId !== historyReq.current) return null; // réponse périmée

      // Même lot de mises à jour : la ligne apparaît déjà marquée « nouvelle »
      // et l'ancien index du formulaire avance au même instant.
      if (knownIds) {
        const fresh = data.find((item) => !knownIds.has(item.id));
        if (fresh) setNewReleveId(fresh.id);
        setRollKey((key) => key + 1);
      }

      const latest = data[0];
      setHistorique(data);
      setHistoryReady(true);
      setForm((previous) => ({
        ...previous,
        compteur_id: String(compteurId),
        date_ancien_releve: latest ? toInputDate(latest.date_releve) : '',
        ancien_index: latest?.nouvel_index ?? '',
        nouvel_index: '',
        date_releve: getToday(),
      }));

      return data;
    } catch (requestError) {
      console.error('Erreur historique Agent :', requestError);
      if (requestId !== historyReq.current) return null;

      if (!silent) setHistorique([]);
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          'Erreur lors du chargement de l’historique.'
      );
      return null;
    } finally {
      if (requestId === historyReq.current) setHistoryLoading(false);
    }
  }

  useEffect(() => {
    loadCompteurs();
  }, []);

  useEffect(() => {
    loadHistory(selectedCompteur);
  }, [selectedCompteur]);

  // Nouvelle ligne : remonter la liste, puis retirer le marquage après 5 s.
  useEffect(() => {
    if (newReleveId == null) return undefined;
    historyRef.current?.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    const timer = setTimeout(() => setNewReleveId(null), 5000);
    return () => clearTimeout(timer);
  }, [newReleveId]);

  useEffect(() => {
    if (!justSaved) return undefined;
    const timer = setTimeout(() => setJustSaved(false), 2200);
    return () => clearTimeout(timer);
  }, [justSaved]);

  /* ----------------------------- saisie ------------------------------- */

  function handleCompteurChange(event) {
    const value = event.target.value;

    setSelectedCompteur(value);
    setForm((previous) => ({ ...previous, compteur_id: value }));
    setSearchParams(value ? { compteur: value } : {});
    setError('');
    setSaved(null);
    setJustSaved(false);
    setNewReleveId(null);
    setRollKey(0);
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
    setError('');
    setSaved(null);
  }

  function validateForm() {
    if (!form.compteur_id) return 'Veuillez sélectionner un compteur.';
    if (!form.date_releve) return 'Veuillez saisir la date du relevé actuel.';

    if (isFirstReleve && !form.date_ancien_releve) {
      return 'Pour le premier relevé, la date du relevé précédent est obligatoire.';
    }
    if (isFirstReleve && form.ancien_index === '') {
      return 'Pour le premier relevé, l’ancien index est obligatoire.';
    }
    if (isFirstReleve && Number(form.ancien_index) < 0) {
      return 'L’ancien index doit être supérieur ou égal à zéro.';
    }
    if (form.nouvel_index === '') return 'Veuillez saisir le nouvel index.';
    if (Number(form.nouvel_index) < 0) {
      return 'Le nouvel index doit être supérieur ou égal à zéro.';
    }
    if (
      form.date_ancien_releve &&
      form.date_releve &&
      form.date_ancien_releve >= form.date_releve
    ) {
      return 'La date du relevé précédent doit être antérieure à la date du relevé actuel.';
    }
    if (form.ancien_index !== '' && Number(form.nouvel_index) < Number(form.ancien_index)) {
      return 'Le nouvel index doit être supérieur ou égal à l’ancien index.';
    }
    return '';
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSaved(null);

      const knownIds = new Set(historique.map((item) => item.id));

      const payload = {
        compteur_id: Number(form.compteur_id),
        date_ancien_releve: form.date_ancien_releve || null,
        date_releve: form.date_releve,
        ancien_index: form.ancien_index === '' ? null : Number(form.ancien_index),
        nouvel_index: Number(form.nouvel_index),
      };

      const response = await axiosClient.post('/agent/releves', payload);
      if (response.data?.status !== 'success') {
        throw new Error(response.data?.message || 'Impossible d’enregistrer le relevé.');
      }

      const data = await loadHistory(form.compteur_id, { silent: true, knownIds });
      const fresh = data?.find((item) => !knownIds.has(item.id));

      setSaved({
        consommation: fresh?.consommation ?? null,
        unite: fresh?.unite || unite,
      });
      setJustSaved(true);
    } catch (requestError) {
      console.error('Erreur création relevé Agent :', requestError);
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          'Impossible d’enregistrer le relevé.'
      );
    } finally {
      setSaving(false);
    }
  }

  function scrollToHistory() {
    historyCardRef.current?.scrollIntoView({
      behavior: reducedMotion() ? 'auto' : 'smooth',
      block: 'start',
    });
  }

  const flash = rollKey > 0 ? 'rv-flash' : '';

  /* ------------------------------ rendu ------------------------------- */

  return (
    <AgentLayout title="Saisie des relevés">
      <style>{MOTION_CSS}</style>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        {/* FORMULAIRE */}
        <section className={CARD} aria-labelledby="releve-form-title">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <ClipboardList size={21} />
            </div>
            <div>
              <h2 id="releve-form-title" className="font-bold text-slate-900">
                Nouveau relevé
              </h2>
              <p className="text-sm text-slate-500">Saisie sécurisée par le serveur.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            {/* Compteur */}
            <div className="space-y-3">
              <div>
                <label htmlFor="releve-compteur" className={LABEL}>
                  Compteur
                </label>
                <select
                  id="releve-compteur"
                  value={selectedCompteur}
                  onChange={handleCompteurChange}
                  disabled={loading || saving}
                  className={`${FIELD_EDIT} disabled:opacity-60`}
                >
                  <option value="">Sélectionner un compteur</option>
                  {compteurs.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.numero_compteur}
                      {' — '}
                      {isEau(item) ? 'Eau' : 'Électricité'}
                    </option>
                  ))}
                </select>
                {!loading && compteurs.length === 0 && (
                  <p className="mt-1.5 text-xs text-slate-500">Aucun compteur disponible.</p>
                )}
              </div>

              {currentCompteur && (
                <div className="flex items-center gap-3">
                  <div
                    className={`rounded-xl p-2.5 ${
                      isEauCompteur ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {isEauCompteur ? <Droplets size={18} /> : <Zap size={18} />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-800">
                      {currentCompteur.numero_compteur}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {`${currentCompteur.abonne_prenom || ''} ${
                        currentCompteur.abonne_nom || ''
                      }`.trim() || 'Abonné non renseigné'}
                      {' · '}
                      {currentCompteur.numero_abonne || '—'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Relevé précédent : verrouillé, repris de l'historique */}
            <section className="space-y-3 border-t border-slate-100 pt-5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className={SECTION_TITLE}>Relevé précédent</h3>
                <span className="text-xs text-slate-500">
                  {isFirstReleve ? 'Premier relevé : à renseigner' : 'Repris du dernier relevé'}
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="releve-ancien-index" className={LABEL}>
                    Ancien index
                  </label>
                  <input
                    key={`ancien-${rollKey}`}
                    id="releve-ancien-index"
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    name="ancien_index"
                    value={form.ancien_index}
                    onChange={handleChange}
                    readOnly={!isFirstReleve}
                    disabled={saving}
                    className={`${isFirstReleve ? FIELD_EDIT : FIELD_LOCKED} font-semibold tabular-nums ${flash}`}
                  />
                </div>

                <div>
                  <label htmlFor="releve-date-precedent" className={LABEL}>
                    Date du relevé précédent
                  </label>
                  <input
                    key={`date-${rollKey}`}
                    id="releve-date-precedent"
                    type="date"
                    name="date_ancien_releve"
                    value={form.date_ancien_releve}
                    onChange={handleChange}
                    readOnly={!isFirstReleve}
                    disabled={saving}
                    className={`${isFirstReleve ? FIELD_EDIT : FIELD_LOCKED} ${flash}`}
                  />
                </div>
              </div>
            </section>

            {/* Relevé actuel : la zone active */}
            <section className="space-y-3 border-t border-slate-100 pt-5">
              <h3 className={SECTION_TITLE}>Relevé actuel</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="releve-nouvel-index" className={LABEL}>
                    Nouvel index
                  </label>
                  <input
                    id="releve-nouvel-index"
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    name="nouvel_index"
                    value={form.nouvel_index}
                    onChange={handleChange}
                    disabled={saving || !historyReady}
                    placeholder="Ex. 1253"
                    aria-invalid={previewState === 'invalid'}
                    className={`${FIELD} bg-white py-3.5 text-lg font-bold tabular-nums text-slate-900 ${
                      previewState === 'invalid'
                        ? 'border-red-400 focus:border-red-500'
                        : 'border-blue-300 focus:border-blue-500'
                    } disabled:bg-slate-50 disabled:opacity-60`}
                  />
                </div>

                <div>
                  <label htmlFor="releve-date" className={LABEL}>
                    Date du relevé actuel
                  </label>
                  <input
                    id="releve-date"
                    type="date"
                    name="date_releve"
                    value={form.date_releve}
                    max={getToday()}
                    onChange={handleChange}
                    disabled={saving}
                    className={FIELD_EDIT}
                  />
                </div>
              </div>

              <div
                aria-live="polite"
                className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors duration-200 ${PREVIEW[previewState].box}`}
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider">Consommation</p>
                  <p className="mt-0.5 text-xs">{PREVIEW[previewState].hint}</p>
                </div>
                <p className="shrink-0 text-xl font-black tabular-nums">
                  {delta === null || delta < 0 ? '—' : `${formatNumber(delta)} ${unite}`}
                </p>
              </div>

              <p className="flex items-start gap-2 text-xs leading-5 text-slate-500">
                <Info size={14} className="mt-0.5 shrink-0 text-blue-600" />
                Le nouvel index doit être supérieur ou égal à l’ancien.
              </p>
            </section>

            {/* Retour d'état, à côté du bouton qui l'a déclenché */}
            {error && (
              <div
                role="alert"
                className="rv-pop flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                <X size={18} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {saved && (
              <div
                role="status"
                className="rv-pop flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              >
                <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Relevé enregistré avec succès.</p>
                  <p className="mt-0.5">
                    {saved.consommation != null
                      ? `Consommation calculée : ${formatNumber(saved.consommation)} ${saved.unite || ''}`
                      : 'La consommation a été calculée automatiquement.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={scrollToHistory}
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-bold underline xl:hidden"
                >
                  Voir l’historique
                  <ArrowDown size={14} />
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={saving || loading || !historyReady}
              className={`inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                justSaved ? 'bg-emerald-600' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {saving ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Enregistrement…
                </>
              ) : justSaved ? (
                <>
                  <Check size={18} />
                  Enregistré
                </>
              ) : (
                <>
                  <Save size={18} />
                  Enregistrer le relevé
                </>
              )}
            </button>
          </form>
        </section>

        {/* HISTORIQUE */}
        <section ref={historyCardRef} className={CARD} aria-labelledby="releve-history-title">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-100 p-3 text-slate-700">
              <History size={21} />
            </div>
            <div>
              <h2 id="releve-history-title" className="font-bold text-slate-900">
                Historique du compteur
              </h2>
              <p className="text-sm text-slate-500">
                {historyLoading ? 'Chargement…' : `${historique.length} relevé(s)`}
              </p>
            </div>

            <button
              type="button"
              onClick={() => loadHistory(selectedCompteur)}
              disabled={!selectedCompteur || historyLoading}
              aria-label="Actualiser l’historique"
              className="ml-auto inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-200 disabled:opacity-50"
            >
              <RefreshCw size={16} className={historyLoading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Actualiser</span>
            </button>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
            <div ref={historyRef} className="max-h-[620px] overflow-auto">
              {historyLoading ? (
                <p className="px-4 py-12 text-center text-sm text-slate-500">Chargement…</p>
              ) : !selectedCompteur ? (
                <p className="px-4 py-12 text-center text-sm text-slate-500">
                  Sélectionnez un compteur pour voir son historique.
                </p>
              ) : !historyReady ? (
                <p className="px-4 py-12 text-center text-sm text-slate-500">
                  Historique indisponible. Utilisez « Actualiser » pour réessayer.
                </p>
              ) : historique.length === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-slate-500">
                  Aucun relevé pour ce compteur. Il s’agit du premier relevé.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {historique.map((item) => {
                    const isNew = item.id === newReleveId;
                    return (
                      <li key={item.id} className={`rv-row ${isNew ? 'rv-row-new' : ''}`}>
                        <div>
                          <div
                            className={`flex items-start justify-between gap-4 p-4 ${
                              isNew ? 'rv-hl' : ''
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
                                {formatDate(item.date_releve)}
                                {isNew && (
                                  <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">
                                    Nouveau
                                  </span>
                                )}
                              </p>
                              <p className="mt-1 flex items-center gap-1.5 text-sm tabular-nums text-slate-600">
                                {formatNumber(item.ancien_index)}
                                <ArrowRight size={14} className="text-slate-400" />
                                <span className="font-bold text-slate-900">
                                  {formatNumber(item.nouvel_index)}
                                </span>
                              </p>
                              <p className="mt-1 text-xs text-slate-500">Relevé #{item.id}</p>
                            </div>

                            <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold tabular-nums text-blue-700">
                              {formatNumber(item.consommation)} {item.unite || ''}
                            </span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>
      </div>
    </AgentLayout>
  );
}

export default AgentRelevesPage;
