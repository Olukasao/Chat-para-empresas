export const META_COMERCIAL_TOTAL_VENDAS = 250;
export const META_COMERCIAL_DASHBOARD_KEY = 'ATIVAÇÃO DE CONTRATO - COMUM';
export const META_COMERCIAL_DASHBOARD_SOCKET_URL =
  import.meta.env.VITE_NOC_DASHBOARD_SOCKET_URL || 'http://192.168.1.133:5000';

export const calcularProgressoMetaComercial = (totalVendas = 0) => {
  const vendas = Number(totalVendas);

  if (!Number.isFinite(vendas) || vendas <= 0) {
    return 0;
  }

  const percentual = (vendas / META_COMERCIAL_TOTAL_VENDAS) * 100;

  return Math.min(100, Math.round(percentual * 10) / 10);
};

export const formatarPercentualMetaComercial = (percentual = 0) => {
  const valor = Number(percentual);
  const valorSeguro = Number.isFinite(valor) ? valor : 0;

  return `${new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(valorSeguro)}%`;
};
