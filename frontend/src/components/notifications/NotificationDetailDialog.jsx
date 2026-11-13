import { AlertCircle, Bell, Check, ClipboardList, Loader2, Trash2, X } from 'lucide-react';

import {
  formatDate,
  formatNumber,
  getDecisionLabel,
  getStatusClasses,
  getStatusLabel,
  getTypeLabel,
} from './notificationsFormat.js';

const MISSION_STATUTS = {
  PLANIFIEE: 'Planifiée',
  EN_COURS: 'En cours',
  TERMINEE: 'Réalisée et transmise',
  A_REPROGRAMMER: 'Non réalisée — nouvelle visite nécessaire',
  ANNULEE: 'Annulée',
};

const MISSION_RESULTATS = {
  RELEVE_ENREGISTRE: 'Relevé enregistré et transmis',
  ABONNE_ABSENT: 'Abonné absent',
  COMPTEUR_INACCESSIBLE: 'Compteur inaccessible',
  INDEX_ILLISIBLE: 'Index illisible',
  COMPTEUR_A_INTERVENIR: 'Intervention technique nécessaire',
  AUTRE: 'Situation signalée par l’Agent',
};

function missionStatutLabel(value) {
  const key = String(value || '').trim().toUpperCase();
  return MISSION_STATUTS[key] || value || '—';
}

function missionResultatLabel(value, mission = {}) {
  const key = String(value || '').trim().toUpperCase();
  if (MISSION_RESULTATS[key]) return MISSION_RESULTATS[key];
  if (value) return value;

  // Missions terminées avant l’enregistrement du résultat de visite :
  // le relevé rattaché prouve l’intervention, on ne laisse pas « — ».
  const statut = String(mission.mission_statut || '').trim().toUpperCase();
  if (statut === 'TERMINEE') {
    return mission.mission_type_releve
      ? 'Relevé enregistré et transmis'
      : 'Intervention terminée';
  }
  if (statut === 'EN_COURS') return 'En cours — résultat non transmis';
  if (statut === 'PLANIFIEE') return 'En attente de visite';
  return '—';
}

function missionUnite(typeCompteur) {
  return String(typeCompteur || '').trim().toUpperCase() === 'EAU' ? 'm³' : 'kWh';
}

/**
 * Dialog de détail d'une notification (role="dialog", fermeture Échap gérée
 * par le hook useNotifications). Affiche le message, la décision administrateur
 * et l'anomalie associée lorsque le backend en fournit une.
 */
export default function NotificationDetailDialog({
  notification,
  actionLoading,
  onClose,
  onTreat,
  onDelete,
  /* L'espace Administrateur n'affiche pas l'action « Traiter »,
     y compris dans le détail d'une notification. */
  masquerTraitement = false,
}) {
  if (!notification) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="jn-modal-surface max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Bell size={20} />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                Détail de la notification
              </p>
              <h3
                id="notification-detail-title"
                className="mt-1 text-xl font-bold text-slate-900"
              >
                {notification.sujet || 'Notification'}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le détail"
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Type
              </p>
              <p className="mt-2 text-sm font-bold text-slate-800">
                {getTypeLabel(notification.type)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Statut
              </p>
              <div className="mt-2">
                <span
                  className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-bold ${getStatusClasses(
                    notification.statut
                  )}`}
                >
                  {getStatusLabel(notification.statut)}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Destinataire
              </p>
              <p className="mt-2 break-all text-sm font-bold text-slate-800">
                {notification.destinataire || '—'}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Date
              </p>
              <p className="mt-2 text-sm font-bold text-slate-800">
                {formatDate(notification.created_at, true)}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Message
            </p>
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">
              {notification.message || 'Aucun message.'}
            </p>
          </div>

          {notification.mission_id && (
            <div className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <ClipboardList size={18} className="text-indigo-700" />
                <h4 className="text-sm font-bold text-indigo-900">
                  Mission de contrôle #{notification.mission_id}
                </h4>
                {notification.mission_jour && (
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-indigo-700">
                    Jour {notification.mission_jour}
                    {Number(notification.mission_jour) === 2
                      ? ' — première descente'
                      : Number(notification.mission_jour) === 3
                        ? ' — deuxième descente'
                        : ''}
                  </span>
                )}
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-indigo-700">
                  {missionStatutLabel(notification.mission_statut)}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl bg-white p-3">
                  <p className="text-xs text-slate-400">Agent</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">
                    {notification.mission_agent || '—'}
                  </p>
                  {notification.mission_agent_identifiant && (
                    <p className="text-xs text-slate-500">
                      Identifiant : {notification.mission_agent_identifiant}
                    </p>
                  )}
                </div>

                <div className="rounded-xl bg-white p-3">
                  <p className="text-xs text-slate-400">Quartier</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">
                    {notification.mission_quartier || '—'}
                  </p>
                </div>

                <div className="rounded-xl bg-white p-3">
                  <p className="text-xs text-slate-400">Abonné</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">
                    {[notification.mission_prenom_abonne, notification.mission_nom_abonne]
                      .filter(Boolean)
                      .join(' ')
                      .trim() || '—'}
                  </p>
                  <p className="text-xs text-slate-500">
                    Référence : {notification.mission_numero_abonne || '—'}
                  </p>
                </div>

                <div className="rounded-xl bg-white p-3">
                  <p className="text-xs text-slate-400">Compteur</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">
                    {notification.mission_numero_compteur || '—'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {String(notification.mission_type_compteur || '').toUpperCase() === 'EAU'
                      ? 'Eau'
                      : 'Électricité'}
                  </p>
                </div>

                <div className="rounded-xl bg-white p-3">
                  <p className="text-xs text-slate-400">Date prévue</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">
                    {formatDate(notification.mission_date_prevue)}
                  </p>
                </div>

                <div className="rounded-xl bg-white p-3">
                  <p className="text-xs text-slate-400">Date réelle de visite</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">
                    {formatDate(notification.mission_date_reelle)}
                  </p>
                </div>
              </div>

              {(notification.mission_nouvel_index != null
                || notification.mission_index_precedent != null
                || notification.mission_consommation != null) && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xs text-slate-400">Index précédent</p>
                    <p className="mt-1 text-sm font-bold text-slate-800">
                      {notification.mission_index_precedent != null
                        ? formatNumber(notification.mission_index_precedent)
                        : 'Aucun (premier relevé)'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xs text-slate-400">Nouvel index</p>
                    <p className="mt-1 text-sm font-bold text-slate-800">
                      {notification.mission_nouvel_index != null
                        ? formatNumber(notification.mission_nouvel_index)
                        : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xs text-slate-400">Consommation</p>
                    <p className="mt-1 text-sm font-bold text-slate-800">
                      {notification.mission_consommation != null
                        ? `${formatNumber(notification.mission_consommation)} ${missionUnite(notification.mission_type_compteur)}`
                        : String(notification.mission_type_releve || '').toUpperCase() === 'INITIAL'
                          ? 'Premier relevé initial'
                          : '—'}
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-3 space-y-1 text-xs text-indigo-900">
                <p>
                  Résultat :{' '}
                  <span className="font-semibold">
                    {missionResultatLabel(notification.mission_resultat_visite, notification)}
                  </span>
                </p>
                {notification.mission_motif && (
                  <p>
                    Motif transmis :{' '}
                    <span className="font-semibold">{notification.mission_motif}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {notification.decision_admin && (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-blue-900">
                Décision de l’Administrateur : {getDecisionLabel(notification.decision_admin)}
              </p>
              {notification.motif_decision && (
                <p className="mt-1 whitespace-pre-line">
                  Motif : {notification.motif_decision}
                </p>
              )}
              {notification.date_decision && (
                <p className="mt-1 text-xs text-slate-500">
                  Décision enregistrée le {formatDate(notification.date_decision, true)}
                </p>
              )}
            </div>
          )}

          {notification.anomalie_id && (
            <div className="mt-5 rounded-2xl border border-[var(--jr-err-bordure)] bg-[var(--jr-err-pale)] p-5">
              <div className="flex items-center gap-2">
                <AlertCircle size={18} className="text-red-600" />
                <h4 className="text-sm font-bold text-red-800">Anomalie associée</h4>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl bg-white p-3">
                  <p className="text-xs text-slate-400">Référence client</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">
                    {notification.numero_compteur || '—'}
                  </p>
                </div>

                <div className="rounded-xl bg-white p-3">
                  <p className="text-xs text-slate-400">Consommation</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">
                    {notification.valeur_detectee != null
                      ? `${formatNumber(notification.valeur_detectee)} ${
                          String(notification.type_compteur || '').toUpperCase() === 'EAU'
                            ? 'm³'
                            : 'kWh'
                        }`
                      : '—'}
                  </p>
                </div>

                <div className="rounded-xl bg-white p-3">
                  <p className="text-xs text-slate-400">Référence</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">
                    {notification.valeur_reference != null
                      ? `${formatNumber(notification.valeur_reference)} ${
                          String(notification.type_compteur || '').toUpperCase() === 'EAU'
                            ? 'm³'
                            : 'kWh'
                        }`
                      : '—'}
                  </p>
                </div>

                <div className="rounded-xl bg-white p-3">
                  <p className="text-xs text-slate-400">Seuil</p>
                  <p className="mt-1 text-sm font-bold text-red-700">
                    {notification.seuil != null
                      ? `${formatNumber(notification.seuil)} %`
                      : '—'}
                  </p>
                </div>
              </div>

              <div className="mt-4 text-xs text-red-700">
                Date de détection :{' '}
                <span className="font-semibold">
                  {formatDate(notification.date_detection, true)}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Fermer
          </button>

          {!masquerTraitement && notification.statut === 'EN_ATTENTE' && (
            <button
              type="button"
              onClick={() => onTreat(notification.id)}
              disabled={actionLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionLoading ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Check size={17} />
              )}
              Marquer comme traitée
            </button>
          )}

          <button
            type="button"
            onClick={() => onDelete(notification.id)}
            disabled={actionLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--jr-err-bordure)] bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 size={17} />
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}
