import {
  Archive,
  ArchiveRestore,
  Bell,
  Check,
  Eye,
  Loader2,
  Trash2,
} from 'lucide-react';

import SuiviConsommationIndication from './SuiviConsommationIndication.jsx';
import {
  formatDate,
  formatNumber,
  getMissionJourLabel,
  getMissionStatutLabel,
  getStatusClasses,
  getStatusLabel,
  getSubscriberName,
  getTypeClasses,
  getTypeIcon,
  getTypeLabel,
} from './notificationsFormat.js';

/**
 * Tableau des notifications : chargement, état vide, lignes et actions.
 * Rendu dans un conteneur scrollable pour conserver l'en-tête visible.
 */
export default function NotificationsTable({
  loading,
  notificationsFiltrees,
  notificationsTotal,
  archiveView,
  actionLoading,
  onOpen,
  onTreat,
  onArchive,
  onRestore,
  onDelete,
  /* L'espace Administrateur consulte les notifications sans les traiter :
     l'action reste disponible pour les espaces Responsable et Agent. */
  masquerTraitement = false,
}) {
  return (
    <div className="jn-table-panel overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="jn-table-heading border-b border-slate-100 px-5 py-4 sm:px-6">
        <h3 className="text-lg font-bold text-slate-900">Liste des notifications</h3>
        <p className="mt-1 text-xs text-slate-400">
          {notificationsFiltrees.length} résultat(s) affiché(s)
        </p>
      </div>

      {loading ? (
        <div className="flex min-h-80 items-center justify-center">
          <div
            className="flex flex-col items-center gap-3 text-slate-500"
            role="status"
            aria-live="polite"
          >
            <Loader2 size={30} className="animate-spin text-blue-600" />
            <p className="text-sm">Chargement des notifications...</p>
          </div>
        </div>
      ) : notificationsFiltrees.length === 0 ? (
        <div className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <Bell size={24} />
          </div>

          <h4 className="mt-4 text-base font-bold text-slate-800">Aucune notification</h4>

          <p className="mt-1 max-w-md text-sm text-slate-400">
            {notificationsTotal === 0
              ? 'Aucune notification n’est enregistrée pour le moment.'
              : 'Aucun résultat ne correspond à votre recherche ou aux filtres sélectionnés.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="jn-table min-w-[1000px] w-full">
            <caption className="jn-sr-only">
              Notifications administrateur : sujet, abonné, anomalie, date, statut et
              actions
            </caption>
            <thead>
              <tr className="jn-table-head border-b border-slate-100 bg-slate-50/70 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                <th className="px-5 py-4">Notification</th>
                <th className="px-5 py-4">Référence client / Abonné</th>
                <th className="px-5 py-4">Anomalie</th>
                <th className="px-5 py-4">Date</th>
                <th className="px-5 py-4">Statut</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {notificationsFiltrees.map((notification) => {
                const Icon = getTypeIcon(notification);
                const estArchive = archiveView === 'archivees';

                return (
                  <tr
                    key={notification.id}
                    className={`jn-table-row group border-b border-slate-100 dark:border-slate-700/70 transition-colors duration-200 ease-out hover:bg-blue-50/80 dark:hover:bg-blue-900/30 hover:[box-shadow:inset_3px_0_0_#29b6f6] ${
                      notification.statut === 'EN_ATTENTE'
                        ? 'jn-table-row--pending bg-[color:color-mix(in_srgb,var(--jr-elec-pale)_22%,transparent)]'
                        : 'jn-table-row--treated bg-white'
                    }`}
                  >
                    <td className="px-5 py-5 align-top">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-sky-300 transition-colors duration-200 group-hover:bg-blue-100 dark:group-hover:bg-blue-800/60">
                          <Icon size={19} className="transition-colors duration-200" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="max-w-md truncate text-sm font-bold text-slate-800">
                              {notification.sujet || 'Notification'}
                            </p>

                            <span
                              className={`jn-type-badge rounded-full border px-2.5 py-1 text-[10px] font-bold ${getTypeClasses(
                                notification.type
                              )}`}
                            >
                              {getTypeLabel(notification.type)}
                            </span>
                          </div>

                          <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">
                            <span className="whitespace-pre-line">
                              {notification.message || 'Aucun message.'}
                            </span>
                          </p>

                          <SuiviConsommationIndication notification={notification} />
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-5 align-top">
                      <p className="text-sm font-bold text-slate-800">
                        {notification.numero_compteur
                          || notification.mission_numero_compteur
                          || '—'}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {getSubscriberName(notification)}
                      </p>
                      {notification.mission_numero_abonne && (
                        <p className="mt-1 text-xs text-slate-400">
                          Réf. abonné : {notification.mission_numero_abonne}
                        </p>
                      )}
                    </td>

                    <td className="px-5 py-5 align-top">
                      {notification.mission_id ? (
                        <div>
                          <p className="text-sm font-bold text-slate-800">
                            {getMissionJourLabel(notification.mission_jour)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {getMissionStatutLabel(notification.mission_statut)}
                          </p>
                          {notification.mission_agent && (
                            <p className="mt-1 text-xs text-slate-500">
                              Agent : {notification.mission_agent}
                            </p>
                          )}
                        </div>
                      ) : notification.anomalie_id || notification.releve_id ? (
                        <div>
                          <p className="text-sm font-bold text-slate-800">
                            {notification.valeur_detectee != null
                              ? `${formatNumber(notification.valeur_detectee)} ${
                                  String(notification.type_compteur || '').toUpperCase() ===
                                  'EAU'
                                    ? 'm³'
                                    : 'kWh'
                                }`
                              : '—'}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Référence :{' '}
                            {notification.valeur_reference != null
                              ? `${formatNumber(notification.valeur_reference)} ${
                                  String(notification.type_compteur || '').toUpperCase() ===
                                  'EAU'
                                    ? 'm³'
                                    : 'kWh'
                                }`
                              : '—'}
                          </p>

                          <p
                            className={`mt-1 text-xs font-semibold ${
                              Number(notification.variation) >= 0
                                ? 'text-amber-700'
                                : 'text-orange-700'
                            }`}
                          >
                            Variation :{' '}
                            {notification.variation != null
                              ? `${Number(notification.variation) > 0 ? '+' : ''}${formatNumber(
                                  notification.variation
                                )} %`
                              : '—'}
                          </p>

                          {notification.seuil != null && (
                            <p className="mt-1 text-xs text-slate-500">
                              Seuil de détection : {formatNumber(notification.seuil)} %
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">
                          Notification de suivi
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-5 align-top">
                      <p className="text-sm font-semibold text-slate-700">
                        {formatDate(notification.created_at, true)}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {notification.mission_id && notification.statut === 'EN_ATTENTE'
                          ? `Transmise le ${formatDate(notification.date_envoi, true)}`
                          : notification.date_envoi
                            ? `Traitée le ${formatDate(notification.date_envoi, true)}`
                            : 'En attente de traitement'}
                      </p>
                    </td>

                    <td className="px-5 py-5 align-top">
                      <span
                        className={`jn-status-badge inline-flex rounded-full border px-3 py-1.5 text-xs font-bold ${getStatusClasses(
                          notification.statut
                        )}`}
                      >
                        {getStatusLabel(notification.statut)}
                      </span>
                    </td>

                    <td className="px-5 py-5 align-top">
                      <div className="jn-row-actions flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onOpen(notification)}
                          className="jn-row-action jn-row-action--details inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition-colors duration-200 hover:bg-blue-50 dark:hover:bg-blue-900/40"
                        >
                          <Eye size={15} />
                          Détail
                        </button>

                        {!masquerTraitement && notification.statut === 'EN_ATTENTE' && !estArchive && (
                          <button
                            type="button"
                            onClick={() => onTreat(notification.id)}
                            disabled={actionLoading}
                            className="jn-row-action jn-row-action--treat inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                          >
                            <Check size={15} />
                            Traiter
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            estArchive ? onRestore(notification) : onArchive(notification)
                          }
                          disabled={actionLoading}
                          className="jn-row-action jn-row-action--archive inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                          aria-label={
                            estArchive ? 'Restaurer la notification' : 'Archiver la notification'
                          }
                          title={estArchive ? 'Restaurer' : 'Archiver'}
                        >
                          {estArchive ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                        </button>

                        <button
                          type="button"
                          onClick={() => onDelete(notification.id)}
                          disabled={actionLoading}
                          className="jn-row-action jn-row-action--delete inline-flex items-center justify-center rounded-lg border border-[var(--jr-err-bordure)] bg-red-50 p-2 text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                          aria-label="Supprimer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
