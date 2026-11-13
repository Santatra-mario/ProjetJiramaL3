import { AlertCircle, Bell, CheckCircle2, Clock3 } from 'lucide-react';

/**
 * Cartes de statistiques de la page notifications.
 * Présentation pure : les compteurs sont calculés par le hook.
 */
export default function NotificationsKpis({ total, enAttente, traitees, alertes }) {
  return (
    <div className="jn-metrics mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="jn-metric jn-metric--total rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{total}</p>
            <p className="mt-1 text-xs text-slate-500">Notifications enregistrées</p>
          </div>

          <div className="jn-metric-icon jn-metric-icon--total rounded-xl bg-blue-50 p-3 text-blue-600">
            <Bell size={20} />
          </div>
        </div>
      </div>

      <div className="jn-metric jn-metric--pending rounded-2xl border border-[var(--jr-elec-anneau)] bg-[var(--jr-elec-pale)] p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">
              En attente
            </p>
            <p className="mt-2 text-3xl font-bold text-amber-800">{enAttente}</p>
            <p className="mt-1 text-xs text-amber-700">À traiter</p>
          </div>

          <div className="jn-metric-icon jn-metric-icon--pending rounded-xl bg-white p-3 text-amber-600 shadow-sm">
            <Clock3 size={20} />
          </div>
        </div>
      </div>

      <div className="jn-metric jn-metric--treated rounded-2xl border border-[var(--jr-ok-anneau)] bg-[var(--jr-ok-pale)] p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
              Traitées
            </p>
            <p className="mt-2 text-3xl font-bold text-emerald-800">{traitees}</p>
            <p className="mt-1 text-xs text-emerald-700">Notifications terminées</p>
          </div>

          <div className="jn-metric-icon jn-metric-icon--treated rounded-xl bg-white p-3 text-emerald-600 shadow-sm">
            <CheckCircle2 size={20} />
          </div>
        </div>
      </div>

      <div className="jn-metric jn-metric--alerts rounded-2xl border border-[var(--jr-err-bordure)] bg-[var(--jr-err-pale)] p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-red-600">
              Alertes anomalie
            </p>
            <p className="mt-2 text-3xl font-bold text-red-800">{alertes}</p>
            <p className="mt-1 text-xs text-red-700">Issues du suivi des consommations</p>
          </div>

          <div className="jn-metric-icon jn-metric-icon--alerts rounded-xl bg-white p-3 text-red-600 shadow-sm">
            <AlertCircle size={20} />
          </div>
        </div>
      </div>
    </div>
  );
}
