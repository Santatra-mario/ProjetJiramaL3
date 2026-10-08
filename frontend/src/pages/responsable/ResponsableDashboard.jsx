import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ClipboardList,
  Droplets,
  Gauge,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import ResponsableLayout from '../../components/admin/responsable/ResponsableLayout';

const JIRAMA = {
  blue: '#0054A6',
  darkBlue: '#003B73',
  red: '#E30613',
  yellow: '#F7C600',
};

function number(value, digits = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('fr-FR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR');
}

function niveauClass(niveau) {
  const classes = {
    CRITIQUE: 'border-red-200 bg-red-50 text-red-700',
    SUSPECTE: 'border-orange-200 bg-orange-50 text-orange-700',
    ATTENTION: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  };
  return classes[niveau] || 'border-slate-200 bg-slate-50 text-slate-600';
}

function StatCard({ title, value, subtitle, icon: Icon, tone = 'blue', onClick, index = 0 }) {
  const tones = {
    blue: { icon: 'bg-blue-50 text-[#0054A6]', accent: 'bg-[#0054A6]' },
    cyan: { icon: 'bg-cyan-50 text-cyan-700', accent: 'bg-cyan-500' },
    amber: { icon: 'bg-yellow-50 text-yellow-700', accent: 'bg-[#F7C600]' },
    red: { icon: 'bg-red-50 text-[#E30613]', accent: 'bg-[#E30613]' },
    emerald: { icon: 'bg-emerald-50 text-emerald-700', accent: 'bg-emerald-500' },
    violet: { icon: 'bg-indigo-50 text-indigo-700', accent: 'bg-indigo-500' },
  };
  const current = tones[tone] || tones.blue;
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      style={{ animationDelay: `${index * 70}ms` }}
      className="group relative w-full overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-100 hover:shadow-xl hover:shadow-blue-950/5 animate-[fadeUp_.45s_ease-out_both]"
    >
      <div className={`absolute inset-x-0 bottom-0 h-1 ${current.accent} opacity-80`} />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">{title}</p>
          <p className="mt-3 truncate text-2xl font-black tracking-tight text-[#003B73] sm:text-[27px]">{value}</p>
          <p className="mt-1.5 text-xs font-medium text-slate-400">{subtitle}</p>
        </div>
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${current.icon} transition duration-300 group-hover:scale-110 group-hover:rotate-2`}>
          <Icon size={21} strokeWidth={2.4} />
        </div>
      </div>
    </Component>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="h-36 animate-pulse rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex justify-between">
            <div className="space-y-3">
              <div className="h-3 w-24 rounded bg-slate-200" />
              <div className="h-7 w-32 rounded bg-slate-200" />
              <div className="h-3 w-20 rounded bg-slate-100" />
            </div>
            <div className="h-12 w-12 rounded-2xl bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ResponsableDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState({
    stats: {},
    evolution: [],
    anomaliesParNiveau: [],
    anomaliesRecentes: [],
    notificationsRecentes: [],
    user: {},
  });

  async function loadDashboard(refresh = false) {
    try {
      setError('');
      if (refresh) setRefreshing(true);
      else setLoading(true);

      const response = await axiosClient.get('/responsable/dashboard');

      if (response.data?.status !== 'success') {
        throw new Error(response.data?.message || 'Impossible de charger le dashboard Responsable.');
      }

      setData({
        stats: response.data.stats || {},
        evolution: response.data.evolution || [],
        anomaliesParNiveau: response.data.anomaliesParNiveau || [],
        anomaliesRecentes: response.data.anomaliesRecentes || [],
        notificationsRecentes: response.data.notificationsRecentes || [],
        user: response.data.user || {},
      });
    } catch (requestError) {
      console.error('Erreur dashboard Responsable :', requestError);

      if ([401, 403].includes(requestError.response?.status)) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/', { replace: true });
        return;
      }

      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          'Erreur lors du chargement du dashboard.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const totalAnomalies = useMemo(
    () => data.anomaliesParNiveau.reduce((sum, item) => sum + Number(item.total || 0), 0),
    [data.anomaliesParNiveau]
  );

  const anomalyChart = useMemo(
    () =>
      ['CRITIQUE', 'SUSPECTE', 'ATTENTION'].map((niveau) => ({
        niveau,
        total: data.anomaliesParNiveau.find((item) => item.niveau === niveau)?.total || 0,
      })),
    [data.anomaliesParNiveau]
  );

  const stats = data.stats || {};
  const firstName = data.user?.prenom || 'Responsable';

  return (
    <ResponsableLayout title="Tableau de bord">
      <div className="space-y-6 pb-6">
        <style>{`
          @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes softPulse { 0%, 100% { opacity: 1; } 50% { opacity: .72; } }
        `}</style>

        <section className="relative isolate overflow-hidden rounded-[30px] bg-[#003B73] p-6 text-white shadow-xl shadow-blue-950/10 sm:p-8">
          <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[#0054A6] opacity-70 blur-3xl" />
          <div className="absolute -bottom-24 right-24 h-52 w-52 rounded-full bg-[#F7C600] opacity-20 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-[#0054A6] via-[#F7C600] to-[#E30613]" />

          <div className="relative flex flex-col justify-between gap-7 lg:flex-row lg:items-center">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-blue-100 backdrop-blur">
                <span className="h-2 w-2 animate-[softPulse_2s_ease-in-out_infinite] rounded-full bg-[#F7C600]" />
                Supervision JIRAMA
              </div>
              <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Bonjour {firstName}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">
                Voici un aperçu de l’activité, des consommations, des relevés et des alertes pour faciliter votre supervision.
              </p>
            </div>

            <button
              type="button"
              onClick={() => loadDashboard(true)}
              disabled={refreshing}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-black text-[#003B73] shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Actualisation...' : 'Actualiser'}
            </button>
          </div>
        </section>

        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 shadow-sm">
            <AlertTriangle className="mt-0.5 shrink-0" size={18} />
            <div className="flex-1">{error}</div>
            <button type="button" onClick={() => loadDashboard(true)} className="font-black underline underline-offset-2">Réessayer</button>
          </div>
        )}

        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
            <section>
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0054A6]">Indicateurs clés</p>
                  <h3 className="mt-1 text-xl font-black text-[#003B73]">Activité du mois</h3>
                </div>
                <span className="hidden rounded-full bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 shadow-sm sm:inline-flex">Données en temps réel</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard index={0} title="Relevés du mois" value={number(stats.relevesMois)} subtitle="Saisies enregistrées" icon={ClipboardList} tone="blue" onClick={() => navigate('/dashboard/admin/releves')} />
                <StatCard index={1} title="Consommation eau" value={`${number(stats.consommationEauMois, 2)} m³`} subtitle="Mois en cours" icon={Droplets} tone="cyan" />
                <StatCard index={2} title="Consommation électricité" value={`${number(stats.consommationElectriciteMois, 2)} kWh`} subtitle="Mois en cours" icon={Zap} tone="amber" />
                <StatCard index={3} title="Anomalies actives" value={number(stats.anomaliesActives)} subtitle={`${number(totalAnomalies)} suivies actuellement`} icon={ShieldAlert} tone="red" onClick={() => navigate('/dashboard/responsable/anomalies')} />
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard index={4} title="Abonnés" value={number(stats.abonnes)} subtitle="Base totale" icon={Users} tone="violet" />
              <StatCard index={5} title="Compteurs actifs" value={`${number(stats.compteursActifs)} / ${number(stats.compteurs)}`} subtitle="Compteurs en service" icon={Gauge} tone="emerald" />
              <StatCard index={6} title="Agents actifs" value={number(stats.agentsActifs)} subtitle="Équipe opérationnelle" icon={Users} tone="blue" />
              <StatCard index={7} title="Notifications non lues" value={number(stats.notificationsNonLues)} subtitle="Pour votre compte" icon={Bell} tone="red" onClick={() => navigate('/dashboard/responsable/notifications')} />
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
              <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0054A6]">Analyse</p>
                    <h3 className="mt-1 text-lg font-black text-[#003B73]">Évolution de la consommation</h3>
                    <p className="mt-1 text-sm text-slate-500">Les douze derniers mois.</p>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-black">
                    <span className="rounded-full bg-cyan-50 px-3 py-1.5 text-cyan-700">Eau</span>
                    <span className="rounded-full bg-yellow-50 px-3 py-1.5 text-yellow-700">Électricité</span>
                  </div>
                </div>

                <div className="mt-5 h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.evolution} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="eauFillJirama" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00A6D6" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="#00A6D6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="elecFillJirama" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={JIRAMA.yellow} stopOpacity={0.28} />
                          <stop offset="95%" stopColor={JIRAMA.yellow} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#E8EEF5" strokeDasharray="4 4" vertical={false} />
                      <XAxis dataKey="mois" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                      <Tooltip contentStyle={{ borderRadius: 16, border: '1px solid #E2E8F0', boxShadow: '0 12px 30px rgba(15,23,42,.10)' }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Area type="monotone" dataKey="eau" name="Eau (m³)" stroke="#00A6D6" strokeWidth={3} fill="url(#eauFillJirama)" activeDot={{ r: 5 }} />
                      <Area type="monotone" dataKey="electricite" name="Électricité (kWh)" stroke={JIRAMA.yellow} strokeWidth={3} fill="url(#elecFillJirama)" activeDot={{ r: 5 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#E30613]">Surveillance</p>
                  <h3 className="mt-1 text-lg font-black text-[#003B73]">Anomalies par niveau</h3>
                  <p className="mt-1 text-sm text-slate-500">Les anomalies actives à surveiller.</p>
                </div>
                <div className="mt-5 h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={anomalyChart} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke="#E8EEF5" strokeDasharray="4 4" vertical={false} />
                      <XAxis dataKey="niveau" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                      <Tooltip contentStyle={{ borderRadius: 16, border: '1px solid #E2E8F0', boxShadow: '0 12px 30px rgba(15,23,42,.10)' }} />
                      <Bar dataKey="total" name="Anomalies" fill={JIRAMA.red} radius={[10, 10, 0, 0]} maxBarSize={52} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
              <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#E30613]">À surveiller</p>
                    <h3 className="mt-1 text-lg font-black text-[#003B73]">Dernières anomalies</h3>
                    <p className="mt-1 text-sm text-slate-500">Les cas qui nécessitent une supervision.</p>
                  </div>
                  <button type="button" onClick={() => navigate('/dashboard/responsable/anomalies')} className="rounded-xl bg-[#003B73] px-3.5 py-2.5 text-xs font-black text-white transition hover:bg-[#0054A6]">Tout voir</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                      <tr>
                        <th className="px-5 py-3.5 font-black">Compteur</th>
                        <th className="px-5 py-3.5 font-black">Anomalie</th>
                        <th className="px-5 py-3.5 font-black">Variation</th>
                        <th className="px-5 py-3.5 font-black">Niveau</th>
                        <th className="px-5 py-3.5 font-black">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.anomaliesRecentes.map((item) => (
                        <tr key={item.id} className="transition hover:bg-blue-50/40">
                          <td className="px-5 py-4 font-black text-slate-800">
                            {item.numero_compteur || '—'}
                            <div className="mt-1 text-xs font-medium text-slate-400">{item.numero_abonne || item.abonne_nom || 'Abonné —'}</div>
                          </td>
                          <td className="px-5 py-4 text-slate-600">{item.type_anomalie || '—'}</td>
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center gap-1 font-black text-slate-700">
                              {Number(item.variation) >= 0 ? <TrendingUp size={15} className="text-[#E30613]" /> : <TrendingDown size={15} className="text-emerald-600" />}
                              {number(Math.abs(item.variation), 2)} %
                            </span>
                          </td>
                          <td className="px-5 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black ${niveauClass(item.niveau)}`}>{item.niveau || '—'}</span></td>
                          <td className="px-5 py-4 text-slate-500">{formatDate(item.date_detection)}</td>
                        </tr>
                      ))}
                      {data.anomaliesRecentes.length === 0 && (
                        <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-400"><CheckCircle2 className="mx-auto mb-2 text-emerald-500" size={28} />Aucune anomalie active.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0054A6]">Communication</p>
                      <h3 className="mt-1 text-lg font-black text-[#003B73]">Notifications récentes</h3>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#0054A6]"><Bell size={19} /></div>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {data.notificationsRecentes.map((notification) => (
                    <button key={notification.id} type="button" onClick={() => navigate('/dashboard/responsable/notifications')} className="group w-full p-5 text-left transition hover:bg-blue-50/40">
                      <div className="flex gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-[#E30613] transition group-hover:scale-105"><AlertTriangle size={17} /></div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-black text-slate-800">{notification.sujet || 'Alerte'}</p>
                          <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-500">{notification.message || 'Notification de supervision.'}</p>
                          <span className={`mt-2 inline-flex rounded-full border px-2 py-1 text-[10px] font-black ${notification.statut === 'EN_ATTENTE' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{notification.statut === 'EN_ATTENTE' ? 'Non lue' : 'Lue'}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                  {data.notificationsRecentes.length === 0 && <div className="p-10 text-center text-sm text-slate-400">Aucune notification récente.</div>}
                </div>

                <div className="border-t border-slate-100 p-4">
                  <button type="button" onClick={() => navigate('/dashboard/responsable/notifications')} className="w-full rounded-2xl bg-[#0054A6] px-4 py-3.5 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#003B73] hover:shadow-lg">Ouvrir toutes les notifications</button>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </ResponsableLayout>
  );
}
