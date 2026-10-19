import { useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axiosClient from "../../api/axiosClient";
import ResponsableLayout from "../../components/admin/responsable/ResponsableLayout";

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR');
}

function formatNumber(value) {
  const n = Number(value);
  return Number.isFinite(n)
    ? n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0,00';
}

function levelClass(value) {
  const style = {
    CRITIQUE: 'border-red-200 bg-red-50 text-red-700',
    SUSPECTE: 'border-orange-200 bg-orange-50 text-orange-700',
    ATTENTION: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  };
  return style[value] || 'border-slate-200 bg-slate-50 text-slate-600';
}

function normalizeStatus(value) {
  return String(value ?? '').trim().toUpperCase();
}

function statusLabel(value) {
  const labels = {
    NOUVELLE: 'NOUVELLE',
    EN_COURS: 'EN COURS',
    VERIFIEE: 'VÉRIFIÉE',
    // RESOLUE est conservé comme ancien statut de traitement.
    RESOLUE: 'Déjà traité par l’Administrateur',
    TRAITEE: 'Déjà traité par l’Administrateur',
    REFUSEE: 'Refusé par l’Administrateur',
  };
  const status = normalizeStatus(value);
  return labels[status] || value || '—';
}

function statusClass(value) {
  const styles = {
    NOUVELLE: 'border-red-200 bg-red-50 text-red-700',
    EN_COURS: 'border-blue-200 bg-blue-50 text-blue-700',
    VERIFIEE: 'border-slate-200 bg-slate-50 text-slate-700',
    RESOLUE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    TRAITEE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    REFUSEE: 'border-red-200 bg-red-50 text-red-700',
  };
  const status = normalizeStatus(value);
  return styles[status] || 'border-slate-200 bg-slate-50 text-slate-600';
}

export default function ResponsableAnomaliesPage() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [search, setSearch] = useState('');
  const [niveau, setNiveau] = useState('');
  const [statut, setStatut] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    try {
      setLoading(true);
      setError('');
      const response = await axiosClient.get('/responsable/anomalies');
      if (response.data?.status !== 'success') {
        throw new Error(response.data?.message || 'Impossible de charger les anomalies.');
      }
      setData(response.data?.data || []);
    } catch (requestError) {
      console.error('Erreur anomalies Responsable :', requestError);
      if ([401, 403].includes(requestError.response?.status)) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/', { replace: true });
        return;
      }
      setError(requestError.response?.data?.message || requestError.message || 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((item) => {
      const matchesSearch = !q || [
        item.numero_compteur,
        item.numero_abonne,
        item.abonne_nom,
        item.abonne_prenom,
        item.type_anomalie,
      ].some((value) => String(value || '').toLowerCase().includes(q));

      const matchesNiveau = !niveau || item.niveau === niveau;
      const matchesStatut = !statut || item.statut === statut;
      return matchesSearch && matchesNiveau && matchesStatut;
    });
  }, [data, search, niveau, statut]);

  return (
    <ResponsableLayout title="Suivi des anomalies">
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-900">Anomalies de consommation</h2>
              <p className="mt-1 text-sm text-slate-500">Consultez les anomalies détectées et leur niveau de criticité.</p>
            </div>
            <button type="button" onClick={load} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800">
              <RefreshCw size={17} /> Actualiser
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_180px_180px]">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher compteur, abonné, type..."
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <select value={niveau} onChange={(event) => setNiveau(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:border-blue-500">
              <option value="">Tous les niveaux</option>
              <option value="CRITIQUE">Critique</option>
              <option value="SUSPECTE">Suspecte</option>
              <option value="ATTENTION">Attention</option>
            </select>
            <select value={statut} onChange={(event) => setStatut(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:border-blue-500">
              <option value="">Tous les statuts</option>
              <option value="NOUVELLE">Nouvelle</option>
              <option value="EN_COURS">En cours</option>
              <option value="VERIFIEE">Vérifiée</option>
              <option value="RESOLUE">Résolue</option>
              <option value="TRAITEE">Déjà traité par l’Administrateur</option>
              <option value="REFUSEE">Refusé par l’Administrateur</option>
            </select>
          </div>
        </section>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-slate-500">Chargement...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <AlertTriangle size={38} className="mx-auto text-slate-300" />
              <p className="mt-4 font-bold text-slate-700">Aucune anomalie trouvée.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Compteur</th>
                    <th className="px-5 py-3">Abonné</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Valeur</th>
                    <th className="px-5 py-3">Référence</th>
                    <th className="px-5 py-3">Variation</th>
                    <th className="px-5 py-3">Niveau</th>
                    <th className="px-5 py-3">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4 text-slate-500">{formatDate(item.date_detection)}</td>
                      <td className="px-5 py-4 font-bold text-slate-800">{item.numero_compteur || '—'}</td>
                      <td className="px-5 py-4 text-slate-600">
                        {[item.abonne_prenom, item.abonne_nom].filter(Boolean).join(' ') || item.numero_abonne || '—'}
                      </td>
                      <td className="px-5 py-4 text-slate-600">{item.type_anomalie || '—'}</td>
                      <td className="px-5 py-4 font-semibold">{formatNumber(item.valeur)} {item.unite}</td>
                      <td className="px-5 py-4 text-slate-600">{formatNumber(item.valeur_reference)} {item.unite}</td>
                      <td className="px-5 py-4 font-bold">{formatNumber(Math.abs(item.variation))} %</td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${levelClass(item.niveau)}`}>{item.niveau || '—'}</span>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        <div className="flex min-w-[170px] flex-col items-start gap-2">
                          <span className={`inline-flex max-w-[280px] whitespace-normal rounded-full border px-2.5 py-1 text-[11px] font-bold leading-tight ${statusClass(item.statut)}`}>
                            {statusLabel(item.statut)}
                          </span>
                          {(item.commentaire?.trim() || ['TRAITEE', 'REFUSEE', 'RESOLUE'].includes(normalizeStatus(item.statut))) ? (
                            <div className={`max-w-sm rounded-xl border px-3 py-2 text-xs ${normalizeStatus(item.statut) === 'REFUSEE' ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
                              <p className="mb-1 font-bold">Message de l’Administrateur</p>
                              {item.commentaire?.trim() ? (
                                <p className="whitespace-pre-wrap break-words">« {item.commentaire.trim()} »</p>
                              ) : (
                                <p className="whitespace-pre-wrap break-words">Aucun motif enregistré par l’Administrateur.</p>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </ResponsableLayout>
  );
}
