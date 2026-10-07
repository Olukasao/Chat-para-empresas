export const CONTRACT_MONTHS = [12, 24, 36, 48, 60, 72];

export const dedicatedPricing = {
  12: [
    { mbps: 100, min: 11.8, max: 15.8 },
    { mbps: 200, min: 10.62, max: 14.22 },
    { mbps: 300, min: 9.558, max: 12.798 },
    { mbps: 400, min: 8.6022, max: 11.5182 },
    { mbps: 500, min: 7.74198, max: 10.36638 },
    { mbps: 600, min: 6.967782, max: 9.329742 },
    { mbps: 700, min: 6.2710038, max: 8.3967678 },
    { mbps: 800, min: 5.64390342, max: 7.55709102 },
    { mbps: 900, min: 5.079513078, max: 6.801381918 },
    { mbps: 1000, min: 4.5715617702, max: 6.1212437262 },
  ],
  24: [
    { mbps: 100, min: 10.8, max: 14.8 },
    { mbps: 200, min: 9.72, max: 13.32 },
    { mbps: 300, min: 8.748, max: 11.988 },
    { mbps: 400, min: 7.8732, max: 10.7892 },
    { mbps: 500, min: 7.08588, max: 9.71028 },
    { mbps: 600, min: 6.377292, max: 8.739252 },
    { mbps: 700, min: 5.7395628, max: 7.8653268 },
    { mbps: 800, min: 5.16560652, max: 7.07879412 },
    { mbps: 900, min: 4.649045868, max: 6.370914708 },
    { mbps: 1000, min: 4.1841412812, max: 5.7338232372 },
  ],
  36: [
    { mbps: 100, min: 9.8, max: 13.8 },
    { mbps: 200, min: 8.82, max: 12.42 },
    { mbps: 300, min: 7.938, max: 11.178 },
    { mbps: 400, min: 7.1442, max: 10.0602 },
    { mbps: 500, min: 6.42978, max: 9.05418 },
    { mbps: 600, min: 5.786802, max: 8.148762 },
    { mbps: 700, min: 5.2081218, max: 7.3338858 },
    { mbps: 800, min: 4.68730962, max: 6.60049722 },
    { mbps: 900, min: 4.218578658, max: 5.940447498 },
    { mbps: 1000, min: 3.7967207922, max: 5.3464027482 },
  ],
  48: [
    { mbps: 100, min: 8.8, max: 12.8 },
    { mbps: 200, min: 7.92, max: 11.52 },
    { mbps: 300, min: 7.128, max: 10.368 },
    { mbps: 400, min: 6.4152, max: 9.3312 },
    { mbps: 500, min: 5.77368, max: 8.39808 },
    { mbps: 600, min: 5.196312, max: 7.558272 },
    { mbps: 700, min: 4.6766808, max: 6.8024448 },
    { mbps: 800, min: 4.20901272, max: 6.12220032 },
    { mbps: 900, min: 3.788111448, max: 5.509980288 },
    { mbps: 1000, min: 3.4093003032, max: 4.9589822592 },
  ],
  60: [
    { mbps: 100, min: 7.8, max: 11.8 },
    { mbps: 200, min: 7.02, max: 10.62 },
    { mbps: 300, min: 6.318, max: 9.558 },
    { mbps: 400, min: 5.6862, max: 8.6022 },
    { mbps: 500, min: 5.11758, max: 7.74198 },
    { mbps: 600, min: 4.605822, max: 6.967782 },
    { mbps: 700, min: 4.1452398, max: 6.2710038 },
    { mbps: 800, min: 3.73071582, max: 5.64390342 },
    { mbps: 900, min: 3.357644238, max: 5.079513078 },
    { mbps: 1000, min: 3.0218798142, max: 4.5715617702 },
  ],
  72: [
    { mbps: 100, min: 5.8, max: 10.8 },
    { mbps: 200, min: 5.22, max: 9.72 },
    { mbps: 300, min: 4.698, max: 8.748 },
    { mbps: 400, min: 4.2282, max: 7.8732 },
    { mbps: 500, min: 3.80538, max: 7.08588 },
    { mbps: 600, min: 3.424842, max: 6.377292 },
    { mbps: 700, min: 3.0823578, max: 5.7395628 },
    { mbps: 800, min: 2.77412202, max: 5.16560652 },
    { mbps: 900, min: 2.496709818, max: 4.649045868 },
    { mbps: 1000, min: 2.2470388362, max: 4.1841412812 },
  ],
};

export const formatCurrency = (value) => (
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0)
);

export const findClosestBand = (pricingTable, mbps) => {
  const bands = [...(pricingTable || [])].sort((a, b) => a.mbps - b.mbps);
  const numericMbps = Number(mbps);

  if (!bands.length || !Number.isFinite(numericMbps)) return null;

  return bands.reduce((closest, current) => (
    current.mbps <= numericMbps ? current : closest
  ), bands[0]);
};

export const calculatePrice = (mbps, contractMonths) => {
  const numericMbps = Number(mbps);
  const months = Number(contractMonths);
  const pricingTable = dedicatedPricing[months] || dedicatedPricing[24];

  if (!Number.isFinite(numericMbps) || numericMbps <= 0) {
    return {
      error: 'Informe a quantidade de megas para calcular.',
    };
  }

  if (numericMbps < 100) {
    return {
      error: 'A banda mínima para cálculo é 100 Mbps.',
    };
  }

  const selectedBand = findClosestBand(pricingTable, Math.min(numericMbps, 1000));

  if (!selectedBand) {
    return {
      error: 'Não foi possível encontrar uma faixa de preço para este contrato.',
    };
  }

  const minValue = numericMbps * selectedBand.min;
  const maxValue = numericMbps * selectedBand.max;
  const averageValue = (minValue + maxValue) / 2;
  const warnings = [];

  if (numericMbps > 1000) {
    warnings.push('Para bandas acima de 1Gbps, consulte o setor comercial para análise personalizada.');
    warnings.push(`Valor calculado com base na faixa de ${selectedBand.mbps} Mbps.`);
  } else if (selectedBand.mbps !== numericMbps) {
    warnings.push(`Valor calculado com base na faixa de ${selectedBand.mbps} Mbps.`);
  }

  return {
    requestedMbps: numericMbps,
    selectedBandMbps: selectedBand.mbps,
    contractMonths: months,
    minValue,
    averageValue,
    maxValue,
    warnings,
    summary: `Proposta calculada para Link Dedicado de ${numericMbps} Mbps, com contrato de ${months} meses, SLA8, IP/30 e ONU Bridge.`,
  };
};
