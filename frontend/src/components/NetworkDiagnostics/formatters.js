export const formatNumber = (value, options = {}) => {
  if (value === null || value === undefined || value === '') return '-';

  const number = Number(value);
  if (!Number.isFinite(number)) return '-';

  return number.toLocaleString('pt-BR', options);
};

export const formatMbps = (value) => (
  value === null || value === undefined
    ? '-'
    : `${formatNumber(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Mbps`
);

export const formatMs = (value) => (
  value === null || value === undefined
    ? '-'
    : `${formatNumber(value, { maximumFractionDigits: 2 })} ms`
);

export const formatPercent = (value) => (
  value === null || value === undefined
    ? '-'
    : `${formatNumber(value, { maximumFractionDigits: 1 })}%`
);

export const formatDbm = (value) => (
  value === null || value === undefined
    ? '-'
    : `${formatNumber(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} dBm`
);

export const formatDateTime = (value) => {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const formatRelativeTime = (value) => {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  const diffSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

  if (diffSeconds < 5) return 'agora';
  if (diffSeconds < 60) return `há ${diffSeconds} segundos`;

  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return `há ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;

  const days = Math.floor(hours / 24);
  return `há ${days} d`;
};

export const formatDurationSeconds = (seconds) => {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total <= 0) return '-';

  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (days > 0) return `${days} dias e ${hours} horas`;
  if (hours > 0) return `${hours} horas e ${minutes} min`;
  return `${minutes} min`;
};

export const getStatusLabel = (status) => ({
  online: 'Online',
  offline: 'Offline',
  unstable: 'Instabilidade',
  running: 'Teste em execução',
  queued: 'Na fila',
  unknown: 'Sem informação',
}[status] || status || 'Sem informação');
