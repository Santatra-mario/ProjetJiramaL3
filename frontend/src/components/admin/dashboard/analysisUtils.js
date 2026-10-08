/* =========================================================
   UTILITAIRES COMMUNS — Statistiques & Graphiques
   (fusionnés ici pour ne plus être dupliqués)
========================================================= */

function pad(value) {
  return String(value).padStart(2, '0');
}

function toIsoDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function getToday() {
  return toIsoDate(new Date());
}

export function getMonthsAgo(months) {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return toIsoDate(date);
}

export function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function formatNumber(value) {
  if (value === '—') {
    return '—';
  }

  return toNumber(value).toLocaleString('fr-FR', {
    maximumFractionDigits: 2,
  });
}

export function formatDate(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);

  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('fr-FR');
}

export function formatMonthLabel(value) {
  if (!value) {
    return '';
  }

  const [year, month] = String(value).split('-');

  if (!year || !month) {
    return String(value);
  }

  const label = new Intl.DateTimeFormat('fr-FR', {
    month: 'short',
    year: 'numeric',
  }).format(new Date(Number(year), Number(month) - 1, 1));

  return label.charAt(0).toUpperCase() + label.slice(1);
}

export const DEFAULT_TYPE_STATS = {
  nombreReleves: 0,
  nombreCompteurs: 0,
  nombreAbonnes: 0,
  total: 0,
  moyenne: 0,
  maximum: 0,
  minimum: 0,
};
