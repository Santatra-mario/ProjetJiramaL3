import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Droplets, Search, TriangleAlert, X, Zap } from 'lucide-react';

import axiosClient from '../../api/axiosClient';
import AgentLayout from '../../components/admin/agent/AgentLayout';

const CARD = 'rounded-2xl border border-slate-200 bg-white shadow-sm';
const FIELD =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none transition-colors focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-200';
const SUB = 'text-xs text-slate-500';
const MICRO = 'text-xs font-semibold uppercase tracking-wide text-slate-500';

const LEVELS = {
  CRITIQUE: { label: 'Critique', badge: 'border-red-200 bg-red-50 text-red-700', icon: 'text-red-600' },
  SUSPECTE: { label: 'Suspecte', badge: 'border-orange-200 bg-orange-50 text-orange-700', icon: 'text-orange-600' },
  ATTENTION: { label: 'Attention', badge: 'border-yellow-300 bg-yellow-50 text-yellow-800', icon: 'text-yellow-600' },
};

// RESOLUE est conservé comme ancien statut de traitement.
const STATUSES = {
  NOUVELLE: { label: 'Nouvelle', badge: 'border-red-200 bg-red-50 text-red-700' },
  EN_COURS: { label: 'En cours', badge: 'border-blue-200 bg-blue-50 text-blue-700' },
  VERIFIEE: { label: 'Vérifiée', badge: 'border-slate-200 bg-slate-50 text-slate-700' },
  RESOLUE: { label: 'Déjà traité par l’Administrateur', badge: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  TRAITEE: { label: 'Déjà traité par l’Administrateur', badge: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  REFUSEE: { label: 'Refusé par l’Administrateur', badge: 'border-red-200 bg-red-50 text-red-700' },
};

const COLUMNS = ['Compteur', 'Abonné', 'Anomalie', 'Consommation', 'Variation', 'Date', 'Statut'];
const FALLBACK_BADGE = 'border-slate-200 bg-slate-50 text-slate-600';

const normalize = (value) => String(value ?? '').trim().toUpperCase();
const isEau = (item) => normalize(item.type_compteur) === 'EAU';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR');
}

// Number(null) vaut 0 : une valeur absente doit rester « — », pas « 0,00 ».
function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—';
}

function LevelBadge({ value }) {
  const level = LEVELS[normalize(value)];
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${
        level?.badge || FALLBACK_BADGE
      }`}
    >
      {level?.label || value || '—'}
    </span>
  );
}

function StatusBadge({ value }) {
  const status = STATUSES[normalize(value)];
  return (
    <span
      className={`inline-flex max-w-[260px] whitespace-normal rounded-full border px-2.5 py-1 text-xs font-bold leading-tight ${
        status?.badge || FALLBACK_BADGE
      }`}
    >
      {status?.label || value || '—'}
    </span>
  );
}

function AdminMessage({ item }) {
  const status = normalize(item.statut);
  const comment = item.commentaire?.trim();
  if (!comment && !['TRAITEE', 'REFUSEE', 'RESOLUE'].includes(status)) return null;

  const refused = status === 'REFUSEE';
  return (
    <div
      className={`max-w-xs rounded-xl border px-3 py-2 text-xs ${
        refused
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-emerald-200 bg-emerald-50 text-emerald-800'
      }`}
    >
      <p className="mb-1 font-bold">Message de l’Administrateur</p>
      <p className="whitespace-pre-wrap break-words">
        {comment ? `« ${comment} »` : 'Aucun motif enregistré par l’Administrateur.'}
      </p>
    </div>
  );
}

function MeterCell({ item }) {
  const eau = isEau(item);
  return (
    <div className="flex items-center gap-3">
      <div
        className={`rounded-xl p-2.5 ${
          eau ? 'bg-cyan-50 text-cyan-700' : 'bg-amber-50 text-amber-700'
        }`}
      >
        {eau ? <Droplets size={18} aria-hidden="true" /> : <Zap size={18} aria-hidden="true" />}
      </div>
      <div className="min-w-0">
        <p className="font-bold text-slate-800">{item.numero_compteur}</p>
        <p className={SUB}>{eau ? 'Eau' : 'Électricité'}</p>
      </div>
    </div>
  );
}

function SubscriberCell({ item }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-semibold text-slate-700">{item.abonne_nom_complet || '—'}</p>
      <p className={SUB}>{item.numero_abonne || '—'}</p>
    </div>
  );
}

// L'icône suit le niveau : le rouge n'est plus partout, il redevient un signal.
function AnomalyCell({ item }) {
  const level = LEVELS[normalize(item.niveau)];
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <TriangleAlert
          size={16}
          aria-hidden="true"
          className={`shrink-0 ${level?.icon || 'text-slate-500'}`}
        />
        <span className="text-sm font-bold text-slate-800">{item.type_anomalie || '—'}</span>
      </div>
      <LevelBadge value={item.niveau} />
    </div>
  );
}

function ConsumptionCell({ item }) {
  const unite = item.unite || '';
  return (
    <div>
      <p className="text-sm font-black tabular-nums text-slate-800">
        {formatNumber(item.valeur)} {unite}
      </p>
      <p className={`mt-1 tabular-nums ${SUB}`}>
        Référence : {formatNumber(item.valeur_reference)} {unite}
      </p>
    </div>
  );
}

function VariationCell({ item }) {
  const known = item.variation !== null && item.variation !== undefined && item.variation !== '';
  const number = Number(item.variation);
  const up = number >= 0;
  return (
    <div>
      <p
        className={`text-sm font-black tabular-nums ${
          !known ? 'text-slate-500' : up ? 'text-red-600' : 'text-blue-600'
        }`}
      >
        {known ? `${up ? '+' : ''}${formatNumber(number)}\u202f%` : '—'}
      </p>
      <p className={`mt-1 ${SUB}`}>{item.direction || '—'}</p>
    </div>
  );
}

function DateCell({ item }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-600">
      <CalendarDays size={15} aria-hidden="true" className="text-slate-500" />
      {formatDate(item.date_detection || item.date_releve)}
    </div>
  );
}

function FilterSelect({ id, label, value, onChange, children }) {
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={FIELD}>
        {children}
      </select>
    </div>
  );
}

function AgentAnomaliesPage() {
  const navigate = useNavigate();

  const [anomalies, setAnomalies] = useState([]);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [niveau, setNiveau] = useState('');
  const [statut, setStatut] = useState('');
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  const firstRun = useRef(true);
  const requestId = useRef(0);

  async function loadAnomalies() {
    const id = ++requestId.current;

    try {
      setLoading(true);
      setError('');

      const response = await axiosClient.get('/agent/anomalies', {
        params: {
          recherche: search || undefined,
          type: type || undefined,
          niveau: niveau || undefined,
          statut: statut || undefined,
        },
      });

      if (response.data?.status !== 'success') {
        throw new Error(response.data?.message || 'Impossible de charger les anomalies.');
      }

      // Une réponse plus ancienne ne doit jamais écraser une plus récente.
      if (id !== requestId.current) return;
      setAnomalies(response.data?.data || []);
      setLoaded(true);
    } catch (requestError) {
      console.error('Erreur anomalies Agent :', requestError);
      if (id !== requestId.current) return;

      if (requestError.response?.status === 401 || requestError.response?.status === 403) {
        navigate('/', { replace: true });
        return;
      }

      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          'Erreur lors du chargement des anomalies.'
      );
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }

  useEffect(() => {
    // Premier chargement immédiat ; anti-rebond de 250 ms ensuite.
    const delay = firstRun.current ? 0 : 250;
    firstRun.current = false;
    const timer = setTimeout(loadAnomalies, delay);
    return () => clearTimeout(timer);
  }, [search, type, niveau, statut]);

  const totalNouvelles = useMemo(
    () => anomalies.filter((item) => normalize(item.statut) === 'NOUVELLE').length,
    [anomalies]
  );

  const hasFilters = Boolean(search || type || niveau || statut);
  const nouvellesOnly = statut === 'NOUVELLE';

  function resetFilters() {
    setSearch('');
    setType('');
    setNiveau('');
    setStatut('');
  }

  let emptyMessage = '';
  if (anomalies.length === 0) {
    if (!loaded && loading) emptyMessage = 'Chargement…';
    else if (!loaded) emptyMessage = 'Anomalies indisponibles pour le moment.';
    else emptyMessage = hasFilters ? 'Aucune anomalie correspondant aux filtres.' : 'Aucune anomalie.';
  }

  return (
    <AgentLayout title="Anomalies">
      <div className="space-y-6">
        {/* FILTRES */}
        <section className={`${CARD} p-5 sm:p-6`} aria-label="Filtres des anomalies">
          <p className="text-sm text-slate-500">
            Consultez les consommations détectées comme inhabituelles.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <label htmlFor="anomalies-search" className="sr-only">
                Rechercher par compteur, abonné ou type
              </label>
              <Search
                size={18}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                id="anomalies-search"
                type="search"
                autoComplete="off"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Compteur, abonné, type…"
                className={`${FIELD} pl-10`}
              />
            </div>

            <FilterSelect id="anomalies-type" label="Type de compteur" value={type} onChange={setType}>
              <option value="">Tous les types</option>
              <option value="EAU">Eau</option>
              <option value="ELECTRICITE">Électricité</option>
            </FilterSelect>

            <FilterSelect id="anomalies-niveau" label="Niveau" value={niveau} onChange={setNiveau}>
              <option value="">Tous les niveaux</option>
              <option value="ATTENTION">Attention</option>
              <option value="SUSPECTE">Suspecte</option>
              <option value="CRITIQUE">Critique</option>
            </FilterSelect>

            <FilterSelect id="anomalies-statut" label="Statut" value={statut} onChange={setStatut}>
              <option value="">Tous les statuts</option>
              <option value="NOUVELLE">Nouvelle</option>
              <option value="EN_COURS">En cours</option>
              <option value="VERIFIEE">Vérifiée</option>
              <option value="RESOLUE">Résolue</option>
              <option value="TRAITEE">Déjà traité par l’Administrateur</option>
              <option value="REFUSEE">Refusé par l’Administrateur</option>
            </FilterSelect>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3" aria-live="polite">
            <button
              type="button"
              aria-pressed={nouvellesOnly}
              onClick={() => setStatut(nouvellesOnly ? '' : 'NOUVELLE')}
              className={`inline-flex min-h-[44px] items-center rounded-xl px-3 text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:ring-red-300 ${
                nouvellesOnly
                  ? 'bg-red-600 text-white'
                  : 'bg-red-50 text-red-700 hover:bg-red-100'
              }`}
            >
              {totalNouvelles} nouvelle(s)
            </button>

            <span className="inline-flex min-h-[44px] items-center rounded-xl bg-slate-100 px-3 text-xs font-bold text-slate-600">
              {anomalies.length} résultat(s)
            </span>

            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-slate-600 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-200"
              >
                <X size={14} aria-hidden="true" />
                Réinitialiser les filtres
              </button>
            )}
          </div>
        </section>

        {error && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={loadAnomalies}
              className="min-h-[44px] rounded-xl border border-red-300 bg-white px-4 text-sm font-bold text-red-700 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-300"
            >
              Réessayer
            </button>
          </div>
        )}

        {/* RÉSULTATS : cartes sous 1280 px, tableau au-delà */}
        <section className={`${CARD} overflow-hidden`} aria-busy={loading}>
          {anomalies.length === 0 ? (
            <p className="px-5 py-14 text-center text-sm text-slate-500">{emptyMessage}</p>
          ) : (
            <div className={`transition-opacity duration-200 ${loaded && loading ? 'opacity-60' : ''}`}>
              <div className="hidden overflow-x-auto xl:block">
                <table className="w-full min-w-[980px] text-left">
                  <caption className="sr-only">Liste des anomalies de consommation</caption>
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-100">
                      {COLUMNS.map((column) => (
                        <th
                          key={column}
                          scope="col"
                          className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500"
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {anomalies.map((item) => (
                      <tr key={item.id} className="align-top hover:bg-slate-50">
                        <td className="px-5 py-4">
                          <MeterCell item={item} />
                        </td>
                        <td className="px-5 py-4">
                          <SubscriberCell item={item} />
                        </td>
                        <td className="px-5 py-4">
                          <AnomalyCell item={item} />
                        </td>
                        <td className="px-5 py-4">
                          <ConsumptionCell item={item} />
                        </td>
                        <td className="px-5 py-4">
                          <VariationCell item={item} />
                        </td>
                        <td className="px-5 py-4">
                          <DateCell item={item} />
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col items-start gap-2">
                            <StatusBadge value={item.statut} />
                            <AdminMessage item={item} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="divide-y divide-slate-100 xl:hidden">
                {anomalies.map((item) => (
                  <li key={item.id} className="space-y-4 p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <MeterCell item={item} />
                      <StatusBadge value={item.statut} />
                    </div>

                    <AnomalyCell item={item} />

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className={`mb-1 ${MICRO}`}>Consommation</p>
                        <ConsumptionCell item={item} />
                      </div>
                      <div>
                        <p className={`mb-1 ${MICRO}`}>Variation</p>
                        <VariationCell item={item} />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <SubscriberCell item={item} />
                      <DateCell item={item} />
                    </div>

                    <AdminMessage item={item} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </AgentLayout>
  );
}

export default AgentAnomaliesPage;
