import { Archive, Bell, Filter, Search } from 'lucide-react';

/**
 * Panneau de filtres : vue (actives / archives), recherche et listes statut + type.
 * Tous les contrôles sont pilotés par le hook useNotifications.
 */
export default function NotificationsFiltres({
  search,
  setSearch,
  statutFilter,
  setStatutFilter,
  typeFilter,
  setTypeFilter,
  archiveView,
  setArchiveView,
  onShowArchives,
}) {
  return (
    <div className="jn-filter-panel mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="jn-filter-title mb-4 flex items-center gap-2">
        <Filter size={17} className="text-slate-500" />
        <h3 className="text-sm font-bold text-slate-800">Filtres</h3>
      </div>

      <div
        className="mb-4 flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Vue des notifications"
      >
        <button
          type="button"
          onClick={() => {
            setArchiveView('actives');
            setStatutFilter('TOUS');
          }}
          aria-pressed={archiveView === 'actives'}
          className={`jn-view-tab inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
            archiveView === 'actives'
              ? 'border-blue-700 bg-blue-700 text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Bell size={15} /> Notifications actives
        </button>

        <button
          type="button"
          onClick={onShowArchives}
          aria-pressed={archiveView === 'archivees'}
          className={`jn-view-tab inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
            archiveView === 'archivees'
              ? 'border-blue-700 bg-blue-700 text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Archive size={15} /> Archives
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
        <div className="relative">
          <Search
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            type="text"
            aria-label="Rechercher dans les notifications"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher par sujet, compteur, abonné, destinataire..."
            className="jn-field w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <select
          aria-label="Filtrer par statut"
          value={statutFilter}
          onChange={(event) => setStatutFilter(event.target.value)}
          className="jn-field rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
        >
          <option value="TOUS">Tous les statuts</option>
          <option value="EN_ATTENTE">En attente</option>
          <option value="ENVOYE">Traitées</option>
        </select>

        <select
          aria-label="Filtrer par type de notification"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          className="jn-field rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
        >
          <option value="TOUS">Tous les types</option>
          <option value="ALERTE_ANOMALIE">Alerte anomalie</option>
          <option value="DECISION_ANOMALIE">Décision sur anomalie</option>
          <option value="INFO_CONSOMMATION_NORMALE">Consommation normale</option>
          <option value="ALERTE_SURCONSOMMATION">Surconsommation</option>
          <option value="ALERTE_SOUS_CONSOMMATION">Sous-consommation</option>
          <option value="ALERTE_CONSOMMATION_CRITIQUE">Consommation critique</option>
          <option value="INFO_HISTORIQUE_INSUFFISANT">Historique insuffisant</option>
          <option value="INFO_RELEVE_A_VERIFIER">Relevé à vérifier</option>
          <option value="MISSION_CONTROLE">Suivi de mission de contrôle</option>
        </select>
      </div>
    </div>
  );
}
