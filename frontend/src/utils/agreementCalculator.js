export const AGREEMENT_DISCOUNT_RULES = [
  {
    id: 'menos-90',
    inactivityLabel: 'Menos de 3 meses',
    rangeLabel: '0 a 89 dias',
    minDays: 0,
    maxDays: 89,
    cashDiscount: 0,
    installmentDiscount: 0,
  },
  {
    id: '90-110',
    inactivityLabel: '3 meses',
    rangeLabel: '90 a 110 dias',
    minDays: 90,
    maxDays: 110,
    cashDiscount: 0.1,
    installmentDiscount: 0.03,
  },
  {
    id: '111-179',
    inactivityLabel: '4 a 5 meses',
    rangeLabel: '111 a 179 dias',
    minDays: 111,
    maxDays: 179,
    cashDiscount: 0.12,
    installmentDiscount: 0.03,
  },
  {
    id: '180-220',
    inactivityLabel: '6 a 7 meses',
    rangeLabel: '180 a 220 dias',
    minDays: 180,
    maxDays: 220,
    cashDiscount: 0.13,
    installmentDiscount: 0.05,
  },
  {
    id: '221-260',
    inactivityLabel: '7 a 8 meses',
    rangeLabel: '221 a 260 dias',
    minDays: 221,
    maxDays: 260,
    cashDiscount: 0.14,
    installmentDiscount: 0.05,
  },
  {
    id: '261-300',
    inactivityLabel: '9 a 10 meses',
    rangeLabel: '261 a 300 dias',
    minDays: 261,
    maxDays: 300,
    cashDiscount: 0.15,
    installmentDiscount: 0.08,
  },
  {
    id: '301-365',
    inactivityLabel: '10 a 12 meses',
    rangeLabel: '301 a 365 dias',
    minDays: 301,
    maxDays: 365,
    cashDiscount: 0.18,
    installmentDiscount: 0.08,
  },
  {
    id: '366-730',
    inactivityLabel: '1 a 2 anos',
    rangeLabel: '366 a 730 dias',
    minDays: 366,
    maxDays: 730,
    cashDiscount: 0.2,
    installmentDiscount: 0.12,
  },
  {
    id: '731-1094',
    inactivityLabel: '2 a 3 anos',
    rangeLabel: '731 a 1094 dias',
    minDays: 731,
    maxDays: 1094,
    cashDiscount: 0.3,
    installmentDiscount: 0.15,
  },
  {
    id: '1095-1459',
    inactivityLabel: '3 a 4 anos',
    rangeLabel: '1095 a 1459 dias',
    minDays: 1095,
    maxDays: 1459,
    cashDiscount: 0.5,
    installmentDiscount: 0.15,
  },
  {
    id: '1460-1824',
    inactivityLabel: '4 a 5 anos',
    rangeLabel: '1460 a 1824 dias',
    minDays: 1460,
    maxDays: 1824,
    cashDiscount: 0.5,
    installmentDiscount: 0.2,
  },
  {
    id: '1825-mais',
    inactivityLabel: '5 anos ou mais',
    rangeLabel: '1825 dias ou mais',
    minDays: 1825,
    maxDays: Infinity,
    cashDiscount: 0.5,
    installmentDiscount: 0.25,
  },
];

export const INSTALLMENT_COUNTS = Array.from({ length: 11 }, (_, index) => index + 2);

export const INSTALLMENT_ENTRY_OPTIONS = [
  { label: 'Entrada 50%', entryPercent: 0.5 },
  { label: 'Entrada 40%', entryPercent: 0.4 },
  { label: 'Entrada 30%', entryPercent: 0.3 },
  { label: 'Entrada 20%', entryPercent: 0.2 },
  { label: 'Sem entrada', entryPercent: 0 },
];

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
});

const roundCurrency = (value) => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) return 0;

  return Math.round((numericValue + Number.EPSILON) * 100) / 100;
};

const normalizeDelayDays = (days) => {
  const numericDays = Number(days);

  if (!Number.isFinite(numericDays) || numericDays <= 0) return 0;

  return Math.floor(numericDays);
};

export const parseCurrencyBR = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  const rawValue = String(value ?? '').trim();

  if (!rawValue || rawValue.includes('-')) return 0;

  const cleanedValue = rawValue.replace(/[^\d.,]/g, '');

  if (!/\d/.test(cleanedValue)) return 0;

  const commaIndex = cleanedValue.lastIndexOf(',');
  const dotIndex = cleanedValue.lastIndexOf('.');
  let normalizedValue = cleanedValue;

  if (commaIndex >= 0 && dotIndex >= 0) {
    const commaIsDecimal = commaIndex > dotIndex;
    normalizedValue = commaIsDecimal
      ? cleanedValue.replace(/\./g, '').replace(',', '.')
      : cleanedValue.replace(/,/g, '');
  } else if (commaIndex >= 0) {
    normalizedValue = cleanedValue.replace(/\./g, '').replace(',', '.');
  } else if (dotIndex >= 0) {
    const dotCount = (cleanedValue.match(/\./g) || []).length;

    if (dotCount > 1) {
      const parts = cleanedValue.split('.');
      const decimalPart = parts.pop() || '';
      normalizedValue = decimalPart.length === 2
        ? `${parts.join('')}.${decimalPart}`
        : `${parts.join('')}${decimalPart}`;
    } else {
      const [integerPart, decimalPart = ''] = cleanedValue.split('.');
      normalizedValue = decimalPart.length === 3 && integerPart.length <= 3
        ? `${integerPart}${decimalPart}`
        : cleanedValue;
    }
  }

  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0;
};

export const formatCurrencyBR = (value) => (
  currencyFormatter.format(roundCurrency(value))
);

export const formatPercentBR = (value) => {
  const numericValue = Number(value);
  const safeValue = Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;

  return `${Math.round(safeValue * 100)}%`;
};

export const getDiscountByDelay = (days) => {
  const delayDays = normalizeDelayDays(days);
  const rule = AGREEMENT_DISCOUNT_RULES.find((item) => (
    delayDays >= item.minDays && delayDays <= item.maxDays
  )) || AGREEMENT_DISCOUNT_RULES[0];

  return {
    cashDiscount: rule.cashDiscount,
    installmentDiscount: rule.installmentDiscount,
  };
};

export const generateInstallmentOptions = (finalInstallmentAmount) => {
  const baseAmount = roundCurrency(finalInstallmentAmount);

  return INSTALLMENT_ENTRY_OPTIONS.map((option) => {
    const entryAmount = roundCurrency(baseAmount * option.entryPercent);
    const balanceAmount = roundCurrency(baseAmount - entryAmount);
    const installments = INSTALLMENT_COUNTS.reduce((accumulator, count) => ({
      ...accumulator,
      [count]: roundCurrency(balanceAmount / count),
    }), {});

    return {
      label: option.label,
      entryPercent: option.entryPercent,
      entryAmount,
      installments,
    };
  });
};

export const calculateAgreement = ({ amount, delayDays } = {}) => {
  const parsedAmount = roundCurrency(
    typeof amount === 'string' ? parseCurrencyBR(amount) : amount
  );
  const parsedDelayDays = normalizeDelayDays(delayDays);
  const { cashDiscount, installmentDiscount } = getDiscountByDelay(parsedDelayDays);
  const finalCashAmount = roundCurrency(parsedAmount * (1 - cashDiscount));
  const finalInstallmentAmount = roundCurrency(parsedAmount * (1 - installmentDiscount));

  return {
    amount: parsedAmount,
    delayDays: parsedDelayDays,
    cashDiscount,
    installmentDiscount,
    finalCashAmount,
    finalInstallmentAmount,
    installmentOptions: generateInstallmentOptions(finalInstallmentAmount),
  };
};
