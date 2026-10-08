import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Droplets,
  Gauge,
  RefreshCw,
  TriangleAlert,
  UserRound,
  Zap,
  TrendingUp,
  ChevronRight,
  Filter,
  Sparkles
} from 'lucide-react';

import Sidebar from '../../components/admin/Sidebar.jsx';
import Header from '../../components/admin/Header.jsx';
import StatCard from '../../components/admin/StatCard.jsx';
import RecentReadings from '../../components/admin/RecentReadings.jsx';

import StatistiquesSection from '../../components/admin/dashboard/StatistiquesSection.jsx';
import GraphiquesSection from '../../components/admin/dashboard/GraphiquesSection.jsx';
import MonthlyLineChart from '../../components/admin/dashboard/MonthlyLineChart.jsx';
import AdminShell from '../../components/admin/AdminShell.jsx';
import {
  formatMonthLabel,
  formatNumber,
  getMonthsAgo,
  getToday,
} from '../../components/admin/dashboard/analysisUtils.js';

import axiosClient from '../../api/axiosClient.js';

/* =========================================================
   UTILITAIRES & CONSTANTES
========================================================= */

function formatCurrentMonth() {
  const value = new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return value.charAt(0).toUpperCase() + value.slice(1);
}

const LINE_CHART_START = '2026-01-01';

function buildMonthKeys() {
  const keys = [];
  const now = new Date();
  const cursor = new Date(2026, 0, 1);

  while (
    cursor.getFullYear() < now.getFullYear() ||
    (cursor.getFullYear() === now.getFullYear() &&
      cursor.getMonth() <= now.getMonth())
  ) {
    keys.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
    );
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return keys;
}

const DEFAULT_FILTERS = () => ({
  dateDebut: getMonthsAgo(12),
  dateFin: getToday(),
  type: 'TOUS',
});

const ANOMALY_STATUS = {
  NOUVELLE: {
    label: 'Nouvelle',
    className: 'bg-red-500/10 text-red-600 border border-red-200/60 shadow-sm',
    icon: AlertTriangle,
  },
  EN_COURS: {
    label: 'En cours',
    className: 'bg-amber-500/10 text-amber-700 border border-amber-200/60 shadow-sm',
    icon: Clock3,
  },
  VERIFIEE: {
    label: 'Vérifiée',
    className: 'bg-sky-500/10 text-sky-700 border border-sky-200/60 shadow-sm',
    icon: CheckCircle2,
  },
  RESOLUE: {
    label: 'Résolue',
    className: 'bg-emerald-500/10 text-emerald-700 border border-emerald-200/60 shadow-sm',
    icon: CheckCircle2,
  },
};

function AnomalyStatusBadge({ status }) {
  const current = ANOMALY_STATUS[status] || ANOMALY_STATUS.NOUVELLE;
  const Icon = current.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-md transition-all duration-300 ${current.className}`}
    >
      <Icon size={13} className="animate-pulse" />
      {current.label}
    </span>
  );
}

/* =========================================================
   COMPOSANT SKELETON (LOADER ELEGANT)
========================================================= */

function DashboardSkeleton() {
  return (
    <AdminShell>
      <div className="animate-pulse space-y-6 p-6 lg:pl-80 motion-reduce:animate-none">
        <div className="h-20 w-full rounded-2xl bg-slate-200/70"></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-slate-200/60"></div>
          ))}
        </div>
        <div className="h-48 rounded-2xl bg-slate-200/60"></div>
        <div className="h-80 rounded-2xl bg-slate-200/60"></div>
      </div>
    </AdminShell>
  );
}

/* =========================================================
   DASHBOARD ADMIN JIRAMA
========================================================= */

function AdminDashboard() {
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);

  /* Etats Données */
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notificationCount, setNotificationCount] = useState(0);

  /* Graphiques & Analyses */
  const [lineData, setLineData] = useState([]);
  const [lineError, setLineError] = useState('');

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [activeTab, setActiveTab] = useState('statistiques');
  const [statsData, setStatsData] = useState(null);
  const [chartsData, setChartsData] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [analysisError, setAnalysisError] = useState('');

  /* Auth / Logout */
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/', { replace: true });
  }, [navigate]);

  const isAuthError = (requestError) => {
    const status = requestError?.response?.status;
    return status === 401 || status === 403;
  };

  /* Verification Session Utilisateur */
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (!token || !storedUser) {
      navigate('/', { replace: true });
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      const role = String(parsedUser?.role || '').trim().toUpperCase();

      if (role !== 'ADMINISTRATEUR') {
        navigate('/', { replace: true });
        return;
      }

      setUser(parsedUser);
    } catch (parseError) {
      console.error('Erreur lecture utilisateur :', parseError);
      logout();
    }
  }, [navigate, logout]);

  /* Chargements des données */
  const loadDashboard = useCallback(
    async (isRefresh = false) => {
      try {
        setError('');
        isRefresh ? setRefreshing(true) : setLoading(true);

        const response = await axiosClient.get('/dashboard');

        if (response.data?.status !== 'success') {
          throw new Error(
            response.data?.message || 'Impossible de charger le tableau de bord.'
          );
        }

        setDashboard(response.data);
      } catch (requestError) {
        console.error('Erreur chargement dashboard :', requestError);
        if (isAuthError(requestError)) {
          logout();
          return;
        }
        setError(
          requestError.response?.data?.message ||
            requestError.message ||
            'Une erreur est survenue lors du chargement.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [logout]
  );

  const loadAnalysis = useCallback(
    async (customFilters) => {
      const current = customFilters || filters;

      if (
        current.dateDebut &&
        current.dateFin &&
        current.dateDebut > current.dateFin
      ) {
        setAnalysisError(
          'La date de début doit être antérieure ou égale à la date de fin.'
        );
        return;
      }

      try {
        setAnalysisError('');
        setAnalysisLoading(true);

        const [statsResult, chartsResult] = await Promise.allSettled([
          axiosClient.get('/statistiques', { params: current }),
          axiosClient.get('/graphiques', { params: current }),
        ]);

        const failures = [statsResult, chartsResult].filter(
          (res) => res.status === 'rejected'
        );

        if (failures.some((res) => isAuthError(res.reason))) {
          logout();
          return;
        }

        const messages = [];

        if (
          statsResult.status === 'fulfilled' &&
          statsResult.value.data?.status === 'success'
        ) {
          setStatsData(statsResult.value.data);
        } else {
          messages.push('statistiques');
        }

        if (
          chartsResult.status === 'fulfilled' &&
          chartsResult.value.data?.status === 'success'
        ) {
          setChartsData(chartsResult.value.data);
        } else {
          messages.push('graphiques');
        }

        if (messages.length > 0) {
          setAnalysisError(`Impossible de charger : ${messages.join(' et ')}.`);
        }
      } finally {
        setAnalysisLoading(false);
      }
    },
    [filters, logout]
  );

  const loadLineChart = useCallback(async () => {
    try {
      setLineError('');

      const response = await axiosClient.get('/statistiques', {
        params: {
          dateDebut: LINE_CHART_START,
          dateFin: getToday(),
          type: 'TOUS',
        },
      });

      if (response.data?.status !== 'success') {
        throw new Error(
          response.data?.message || 'Impossible de charger la courbe.'
        );
      }

      const byMonth = new Map(
        (response.data.evolution || []).map((item) => [
          String(item.mois).slice(0, 7),
          item,
        ])
      );

      setLineData(
        buildMonthKeys().map((key) => ({
          mois: formatMonthLabel(key),
          eau: Number(byMonth.get(key)?.eau || 0),
          electricite: Number(byMonth.get(key)?.electricite || 0),
        }))
      );
    } catch (requestError) {
      console.error('Erreur courbe :', requestError);
      if (isAuthError(requestError)) {
        logout();
        return;
      }
      setLineError(
        requestError.response?.data?.message || 'Impossible de charger la courbe.'
      );
    }
  }, [logout]);

  const loadNotificationCount = useCallback(async () => {
    try {
      try {
        const response = await axiosClient.get('/notifications/count');
        if (response.data?.status === 'success') {
          setNotificationCount(Number(response.data?.data?.total || 0));
          return;
        }
      } catch (countError) {
        if (countError.response?.status !== 404) throw countError;
      }

      const response = await axiosClient.get('/notifications');
      const notifications = Array.isArray(response.data?.data)
        ? response.data.data
        : [];

      setNotificationCount(
        notifications.filter((item) => item.statut === 'EN_ATTENTE').length
      );
    } catch (requestError) {
      if (isAuthError(requestError)) {
        logout();
        return;
      }
      setNotificationCount(0);
    }
  }, [logout]);

  useEffect(() => {
    if (!user) return;
    loadDashboard();
    loadNotificationCount();
    loadAnalysis();
    loadLineChart();
  }, [user, loadDashboard, loadNotificationCount, loadAnalysis, loadLineChart]);

  const updateFilter = (key, value) =>
    setFilters((previous) => ({ ...previous, [key]: value }));

  const handleReset = () => {
    const defaults = DEFAULT_FILTERS();
    setFilters(defaults);
    loadAnalysis(defaults);
  };

  const handleRefreshAll = () => {
    loadDashboard(true);
    loadNotificationCount();
    loadAnalysis();
    loadLineChart();
  };

  if (!user || loading) {
    return <DashboardSkeleton />;
  }

  const stats = dashboard?.stats || {
    abonnes: 0,
    abonnesActifs: 0,
    compteurs: 0,
    compteursActifs: 0,
    releves: 0,
    relevesMois: 0,
    anomalies: 0,
    anomaliesNouvelles: 0,
    consommationEauMois: 0,
    consommationElectriciteMois: 0,
  };

  const derniersReleves = dashboard?.derniersReleves || [];
  const anomaliesRecentes = dashboard?.anomaliesRecentes || [];

  const tabs = [
    { id: 'statistiques', label: 'Statistiques Détaillées', icon: BarChart3 },
    { id: 'graphiques', label: 'Analyse Visuelle', icon: Activity },
  ];

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm font-medium text-slate-700 outline-none transition duration-200 focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-500/10 hover:border-slate-300';

  return (
       <AdminShell className="text-slate-800 selection:bg-amber-500 selection:text-white">
      {/* SIDEBAR & HEADER */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activePath="/dashboard/admin"
        onNavigate={navigate}
        onLogout={logout}
        user={user}
      />

      <div className="lg:pl-72 transition-all duration-300">
        <Header
          onOpenSidebar={() => setSidebarOpen(true)}
          onProfile={() => {}}
          onNotifications={() => navigate('/dashboard/admin/notifications')}
          notificationCount={notificationCount}
          user={user}
        />

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
          
          {/* ENTÊTE AVEC ACCENT JIRAMA */}
          <motion.div 
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden"
          >
            {/* Ligne aux couleurs JIRAMA en haut */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-sky-500 to-blue-700" />

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-700 uppercase tracking-wider">
                                    <Zap size={12} className="text-amber-500" />
                  Espace Admin JIRAMA
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Pilotage des Consommations
              </h1>
              <p className="text-sm text-slate-500">
                Suivi en temps réel de la distribution et des relevés d'Eau et d'Électricité.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-2.5 text-sm font-medium text-slate-700 backdrop-blur-sm">
                <CalendarDays size={18} className="text-amber-500" />
                <span>{formatCurrentMonth()}</span>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={handleRefreshAll}
                disabled={refreshing || analysisLoading}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300 disabled:opacity-60"
              >
                <RefreshCw
                  size={16}
                  className={`text-sky-600 ${refreshing || analysisLoading ? 'animate-spin' : ''}`}
                />
                Actualiser
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => navigate('/dashboard/admin/notifications')}
                className="relative inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-700 to-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-sky-500/20 hover:shadow-lg transition-all"
              >
                <Bell size={16} />
                Notifications
                {notificationCount > 0 && (
                  <span className="flex min-w-[20px] h-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[11px] font-black text-slate-900 shadow-sm">
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </span>
                )}
              </motion.button>
            </div>
          </motion.div>

          {/* ERREURS SYSTEME */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className="text-red-500 shrink-0" size={20} />
                  <span>{error}</span>
                </div>
                <button
                  type="button"
                  onClick={() => loadDashboard()}
                  className="font-bold underline underline-offset-2 hover:text-red-800"
                >
                  Réessayer
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* KPI (INDICATEURS CLES) */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4"
          >
            <StatCard
              title="Abonnés"
              value={formatNumber(stats.abonnes)}
              subtitle={`${formatNumber(stats.abonnesActifs)} actifs`}
              icon={UserRound}
              iconBg="bg-sky-50"
              iconColor="text-sky-600"
              trend="info"
            />

            <StatCard
              title="Compteurs Registrés"
              value={formatNumber(stats.compteurs)}
              subtitle={`${formatNumber(stats.compteursActifs)} en service`}
              icon={Gauge}
              iconBg="bg-amber-50"
              iconColor="text-amber-600"
              trend="info"
            />

            <StatCard
              title="Relevés Global"
              value={formatNumber(stats.releves)}
              subtitle={`+${formatNumber(stats.relevesMois)} ce mois`}
              icon={ClipboardList}
              iconBg="bg-emerald-50"
              iconColor="text-emerald-600"
              trend="up"
            />

            <StatCard
              title="Anomalies Détectées"
              value={formatNumber(stats.anomalies)}
              subtitle={`${formatNumber(stats.anomaliesNouvelles)} non traitées`}
              icon={TriangleAlert}
              iconBg="bg-red-50"
              iconColor="text-red-600"
              trend="alert"
            />
          </motion.div>

          {/* CONSOMMATION DU MOIS : EAU (BLEU) vs ÉLECTRICITÉ (JAUNE JIRAMA) */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            
            {/* CARTE EAU */}
            <motion.div 
              whileHover={{ y: -3 }}
              transition={{ duration: 0.2 }}
                            className="jr-carte-eau relative overflow-hidden rounded-3xl p-6 shadow-sm hover:shadow-md"
            >
              <div className="absolute -right-6 -bottom-6 text-sky-500/5">
                <Droplets size={160} />
              </div>
              <div className="flex items-center justify-between gap-4 relative z-10">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-sky-500"></span>
                    <p className="text-xs font-bold uppercase tracking-wider text-sky-700">
                      Consommation Eau — Ce mois
                    </p>
                  </div>
                  <p className="mt-3 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                    {formatNumber(stats.consommationEauMois)}
                    <span className="ml-2 text-base font-semibold text-sky-600">
                      m³
                    </span>
                  </p>
                </div>

                <div className="rounded-2xl bg-sky-500/10 p-4 border border-sky-200/50 text-sky-600 shadow-inner">
                  <Droplets size={32} />
                </div>
              </div>
            </motion.div>

            {/* CARTE ÉLECTRICITÉ (JAUNE/AMBRE JIRAMA) */}
            <motion.div 
              whileHover={{ y: -3 }}
              transition={{ duration: 0.2 }}
                            className="jr-carte-elec relative overflow-hidden rounded-3xl p-6 shadow-sm hover:shadow-md"
            >
              <div className="absolute -right-6 -bottom-6 text-amber-500/5">
                <Zap size={160} />
              </div>
              <div className="flex items-center justify-between gap-4 relative z-10">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
                      Consommation Électricité — Ce mois
                    </p>
                  </div>
                  <p className="mt-3 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                    {formatNumber(stats.consommationElectriciteMois)}
                    <span className="ml-2 text-base font-semibold text-amber-600">
                      kWh
                    </span>
                  </p>
                </div>

                <div className="rounded-2xl bg-amber-500/10 p-4 border border-amber-300/50 text-amber-600 shadow-inner">
                  <Zap size={32} />
                </div>
              </div>
            </motion.div>

          </div>

          {/* COURBE EVOLUTION DYNAMIQUE */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm"
          >
            {lineError && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {lineError}
              </div>
            )}

            <MonthlyLineChart
              data={lineData}
              title="Évolution comparative des consommations"
              description="Suivi mensuel synchronisé Eau (m³) et Électricité (kWh) depuis Janvier 2026."
            />
          </motion.div>

          {/* SECTION ANALYSE : FILTRES ET TABS */}
          <motion.section 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200/80 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <TrendingUp className="text-amber-500" size={22} />
                  Analyse Approfondie
                </h2>
                <p className="text-sm text-slate-500">
                  Exploration synthétique et représentations graphiques selon vos critères.
                </p>
              </div>

              {/* TABS DE NAVIGATION */}
              <div className="inline-flex rounded-2xl bg-slate-200/60 p-1 backdrop-blur-md">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`relative inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all duration-300 ${
                        isActive
                          ? 'bg-white text-slate-900 shadow-md'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Icon size={16} className={isActive ? 'text-amber-500' : ''} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* BLOC FILTRES PENSÉ POUR L'ADMIN */}
            <div className="rounded-3xl border border-slate-100 bg-white p-5 sm:p-6 shadow-sm space-y-5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400 tracking-wider">
                <Filter size={14} /> Filtres d'Analyse
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <label className="space-y-1.5">
                  <span className="block text-xs font-semibold text-slate-600">
                    Date de Début
                  </span>
                  <input
                    type="date"
                    value={filters.dateDebut}
                    max={filters.dateFin || getToday()}
                    onChange={(e) => updateFilter('dateDebut', e.target.value)}
                    className={inputClass}
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="block text-xs font-semibold text-slate-600">
                    Date de Fin
                  </span>
                  <input
                    type="date"
                    value={filters.dateFin}
                    min={filters.dateDebut || undefined}
                    max={getToday()}
                    onChange={(e) => updateFilter('dateFin', e.target.value)}
                    className={inputClass}
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="block text-xs font-semibold text-slate-600">
                    Flux d'Énergie / Ressource
                  </span>
                  <select
                    value={filters.type}
                    onChange={(e) => updateFilter('type', e.target.value)}
                    className={inputClass}
                  >
                    <option value="TOUS">Eau & Électricité Combined</option>
                    <option value="EAU">Eau Seulement (m³)</option>
                    <option value="ELECTRICITE">Électricité Seulement (kWh)</option>
                  </select>
                </label>
              </div>

              <div className="flex flex-col justify-end gap-3 border-t border-slate-100 pt-4 sm:flex-row">
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
                >
                  Réinitialiser
                </button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => loadAnalysis()}
                  disabled={analysisLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60 shadow-md"
                >
                  {analysisLoading && <RefreshCw size={14} className="animate-spin" />}
                  Appliquer les Filtres
                </motion.button>
              </div>
            </div>

            {/* ERREUR FILTRES */}
            {analysisError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {analysisError}
              </div>
            )}

            {/* AFFICHAGE STATS / GRAPHES */}
            {analysisLoading && !statsData && !chartsData ? (
              <div className="rounded-3xl border border-slate-100 bg-white p-12 text-center text-sm font-medium text-slate-400">
                Calcul des analyses en cours...
              </div>
            ) : (
              <div className={analysisLoading ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
                {activeTab === 'statistiques' ? (
                  <StatistiquesSection data={statsData} type={filters.type} />
                ) : (
                  <GraphiquesSection data={chartsData} type={filters.type} />
                )}
              </div>
            )}
          </motion.section>

          {/* ANOMALIES RÉCENTES */}
          <motion.section 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-slate-100 p-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <AlertTriangle className="text-red-500" size={20} />
                  Anomalies Critiques Récentes
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Dérivations & écarts détectés par rapport aux moyennes historiques.
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate('/dashboard/admin/anomalies')}
                className="inline-flex items-center gap-1 text-sm font-bold text-sky-600 hover:text-sky-700 transition"
              >
                Tout voir <ChevronRight size={16} />
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {anomaliesRecentes.length > 0 ? (
                anomaliesRecentes.map((anomalie) => (
                  <div
                    key={anomalie.id}
                    className="flex flex-col gap-4 p-5 transition hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="rounded-2xl bg-red-500/10 p-3 text-red-600 border border-red-100">
                        <AlertTriangle size={20} />
                      </div>

                      <div>
                        <p className="font-bold text-slate-900">
                          Compteur #{anomalie.compteur}
                        </p>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Type : {anomalie.type}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-6 text-sm">
                      <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Valeur Relevée</p>
                        <p className="font-extrabold text-red-600">
                          {formatNumber(anomalie.valeur)} {anomalie.unite}
                        </p>
                      </div>

                      <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Référence Attendu</p>
                        <p className="font-bold text-slate-600">
                          {formatNumber(anomalie.reference)} {anomalie.unite}
                        </p>
                      </div>

                      <AnomalyStatusBadge status={anomalie.statut} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-10 text-center text-sm font-medium text-slate-400">
                  Aucune anomalie à signaler actuellement.
                </div>
              )}
            </div>
          </motion.section>

          {/* TABLEAU DES DERNIERS RELEVÉS */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
          >
            <RecentReadings
              readings={derniersReleves}
              onViewAll={() => navigate('/dashboard/admin/releves')}
            />
          </motion.div>

             </main>
      </div>
    </AdminShell>
  );
}

export default AdminDashboard;