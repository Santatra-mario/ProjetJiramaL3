import { useEffect, useState } from 'react';

import { RefreshCw, TrendingUp } from 'lucide-react';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import axiosClient from '../../../api/axiosClient.js';

import {
  formatMonthLabel,
  formatNumber,
  getToday,
  toNumber,
} from './analysisUtils.js';

/* ---------------------------------------------------------
   Liste de tous les mois entre deux dates (AAAA-MM)
   -> un mois sans relevé apparaît à 0 au lieu d'être sauté
--------------------------------------------------------- */

function listMonths(startDate, endDate) {
  const months = [];

  const current = new Date(`${startDate.slice(0, 7)}-01T00:00:00`);
  const last = new Date(`${endDate.slice(0, 7)}-01T00:00:00`);

  while (current <= last) {
    const month = String(current.getMonth() + 1).padStart(2, '0');
    months.push(`${current.getFullYear()}-${month}`);
    current.setMonth(current.getMonth() + 1);
  }

  return months;
}

/* ---------------------------------------------------------
   GRAPHIQUE EN LIGNES : Eau + Électricité depuis une date
   Props : startDate (AAAA-MM-JJ), défaut = 1er janvier 2026
--------------------------------------------------------- */

function EvolutionLineChart({ startDate = '2026-01-01' }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    try {
      setError('');
      setLoading(true);

      const endDate = getToday();

      const response = await axiosClient.get('/statistiques', {
        params: {
          dateDebut: startDate,
          dateFin: endDate,
          type: 'TOUS',
        },
      });

      if (response.data?.status !== 'success') {
        throw new Error(response.data?.message || 'Données indisponibles.');
      }

      const byMonth = new Map(
        (response.data.evolution || []).map((item) => [
          String(item.mois).slice(0, 7),
          item,
        ])
      );

      setRows(
        listMonths(startDate, endDate).map((month) => ({
          mois: formatMonthLabel(month),
          eau: toNumber(byMonth.get(month)?.eau),
          electricite: toNumber(byMonth.get(month)?.electricite),
        }))
      );
    } catch (requestError) {
      console.error('Erreur graphique en lignes :', requestError);

      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          'Impossible de charger le graphique.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate]);

  const startLabel = formatMonthLabel(startDate.slice(0, 7));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Évolution mensuelle — Eau et Électricité
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Courbes mensuelles depuis {startLabel} (échelle de gauche : m³,
            échelle de droite : kWh).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            title="Actualiser"
            className="rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          <div className="rounded-xl bg-blue-50 p-2.5">
            <TrendingUp size={20} className="text-blue-600" />
          </div>
        </div>
      </div>

      {error ? (
        <div className="flex h-[320px] items-center justify-center rounded-xl bg-red-50 px-4 text-center text-sm text-red-700">
          {error}
        </div>
      ) : loading && rows.length === 0 ? (
        <div className="flex h-[320px] items-center justify-center text-sm text-slate-400">
          Chargement du graphique...
        </div>
      ) : (
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={rows}
              margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

              <XAxis
                dataKey="mois"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
              />

              <YAxis
                yAxisId="eau"
                orientation="left"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#0891b2', fontSize: 12 }}
                label={{
                  value: 'm³',
                  angle: -90,
                  position: 'insideLeft',
                  fill: '#0891b2',
                  fontSize: 12,
                }}
              />

              <YAxis
                yAxisId="electricite"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#d97706', fontSize: 12 }}
                label={{
                  value: 'kWh',
                  angle: 90,
                  position: 'insideRight',
                  fill: '#d97706',
                  fontSize: 12,
                }}
              />

              <Tooltip
                formatter={(value, name) => [
                  `${formatNumber(value)} ${name === 'Eau' ? 'm³' : 'kWh'}`,
                  name,
                ]}
              />

              <Legend />

              <Line
                yAxisId="eau"
                type="monotone"
                dataKey="eau"
                name="Eau"
                stroke="#0891b2"
                strokeWidth={3}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />

              <Line
                yAxisId="electricite"
                type="monotone"
                dataKey="electricite"
                name="Électricité"
                stroke="#f59e0b"
                strokeWidth={3}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

export default EvolutionLineChart;
