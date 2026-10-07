const BILLING_DAYS_BASE = 30;
const NEW_PLAN_DAYS_DISCOUNT = 1;
const DATE_BR_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
});

const normalizeCurrencyOutput = (value) => value.replace(/[\u00a0\u202f]/g, ' ');

const pad2 = (value) => String(value).padStart(2, '0');

export const isLeapYear = (year) => (
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
);

export const getDaysInMonth = (year, month) => {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
};

export const parseDateBR = (value) => {
  const match = String(value || '').trim().match(DATE_BR_PATTERN);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return null;
  }

  if (year < 1000 || month < 1 || month > 12) return null;
  if (day < 1 || day > getDaysInMonth(year, month)) return null;

  return { day, month, year };
};

export const formatDateBR = (date) => {
  if (!date) return '';
  return `${pad2(date.day)}/${pad2(date.month)}/${date.year}`;
};

export const formatDateISO = (date) => {
  if (!date) return '';
  return `${date.year}-${pad2(date.month)}-${pad2(date.day)}`;
};

export const parseDateISO = (value) => {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  return parseDateBR(`${match[3]}/${match[2]}/${match[1]}`);
};

export const dateBRToISO = (value) => {
  const parsedDate = parseDateBR(value);
  return parsedDate ? formatDateISO(parsedDate) : '';
};

export const dateISOToBR = (value) => {
  const parsedDate = parseDateISO(value);
  return parsedDate ? formatDateBR(parsedDate) : '';
};

export const maskDateBR = (value) => {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

export const getTodayDateBR = () => {
  const today = new Date();

  return formatDateBR({
    day: today.getDate(),
    month: today.getMonth() + 1,
    year: today.getFullYear(),
  });
};

export const addMonthsToDate = (date, months = 1) => {
  if (!date) return null;

  const monthIndex = date.month - 1 + months;
  const year = date.year + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12 + 1;
  const day = Math.min(date.day, getDaysInMonth(year, month));

  return { day, month, year };
};

export const getNextDueDateBR = (currentDueDate) => {
  const parsedDate = typeof currentDueDate === 'string'
    ? parseDateBR(currentDueDate)
    : currentDueDate;

  return parsedDate ? formatDateBR(addMonthsToDate(parsedDate, 1)) : '';
};

const daysFromCivil = (date) => {
  let year = date.year;
  const month = date.month;
  const day = date.day;

  year -= month <= 2 ? 1 : 0;

  const era = Math.floor(year / 400);
  const yearOfEra = year - era * 400;
  const monthForFormula = month + (month > 2 ? -3 : 9);
  const dayOfYear = Math.floor((153 * monthForFormula + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365
    + Math.floor(yearOfEra / 4)
    - Math.floor(yearOfEra / 100)
    + dayOfYear;

  return era * 146097 + dayOfEra;
};

export const calculateDaysBetween = (startDate, endDate) => {
  const start = typeof startDate === 'string' ? parseDateBR(startDate) : startDate;
  const end = typeof endDate === 'string' ? parseDateBR(endDate) : endDate;

  if (!start || !end) return null;

  return daysFromCivil(end) - daysFromCivil(start);
};

export const sanitizeCurrencyInput = (value) => (
  String(value || '')
    .replace(/[^\d.,Rr$\s-]/g, '')
    .slice(0, 24)
);

const invalidCurrency = (reason) => ({ cents: null, reason });

const normalizeIntegerPart = (value, thousandsSeparator = '') => {
  if (!value) return null;

  if (thousandsSeparator && value.includes(thousandsSeparator)) {
    const groups = value.split(thousandsSeparator);
    const validGroups = groups.length > 1
      && /^\d{1,3}$/.test(groups[0])
      && groups.slice(1).every((group) => /^\d{3}$/.test(group));

    return validGroups ? groups.join('') : null;
  }

  return /^\d+$/.test(value) ? value : null;
};

export const parseCurrencyBRLToCents = (value) => {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return invalidCurrency('invalid');
    if (value < 0) return invalidCurrency('negative');
    if (value === 0) return invalidCurrency('zero');

    const cents = Math.round(value * 100);
    return Number.isSafeInteger(cents) && cents > 0
      ? { cents, reason: null }
      : invalidCurrency('invalid');
  }

  const rawValue = String(value ?? '').trim();

  if (!rawValue) return invalidCurrency('empty');
  if (rawValue.includes('-')) return invalidCurrency('negative');
  if (!/^[\sRr$.,\d]+$/.test(rawValue)) return invalidCurrency('invalid');

  const cleanedValue = rawValue
    .replace(/\s/g, '')
    .replace(/[Rr$]/g, '');

  if (!/\d/.test(cleanedValue)) return invalidCurrency('empty');

  const commaCount = (cleanedValue.match(/,/g) || []).length;
  const dotCount = (cleanedValue.match(/\./g) || []).length;
  let integerDigits = '';
  let decimalDigits = '';

  if (commaCount > 0 && dotCount > 0) {
    const commaIndex = cleanedValue.lastIndexOf(',');
    const dotIndex = cleanedValue.lastIndexOf('.');
    const decimalSeparator = commaIndex > dotIndex ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
    const separatorIndex = cleanedValue.lastIndexOf(decimalSeparator);
    const integerPart = cleanedValue.slice(0, separatorIndex);
    const decimalPart = cleanedValue.slice(separatorIndex + 1);

    if (!/^\d{1,2}$/.test(decimalPart)) return invalidCurrency('invalid');

    integerDigits = normalizeIntegerPart(integerPart, thousandsSeparator);
    decimalDigits = decimalPart;
  } else if (commaCount > 0) {
    if (commaCount > 1) return invalidCurrency('invalid');

    const [integerPart, decimalPart = ''] = cleanedValue.split(',');

    if (decimalPart.length > 2 || !/^\d*$/.test(decimalPart)) {
      return invalidCurrency('invalid');
    }

    integerDigits = normalizeIntegerPart(integerPart);
    decimalDigits = decimalPart;
  } else if (dotCount > 0) {
    if (dotCount > 1) {
      integerDigits = normalizeIntegerPart(cleanedValue, '.');
      decimalDigits = '';
    } else {
      const [integerPart, decimalPart = ''] = cleanedValue.split('.');

      if (decimalPart.length === 3 && integerPart.length <= 3) {
        integerDigits = normalizeIntegerPart(cleanedValue, '.');
        decimalDigits = '';
      } else if (decimalPart.length <= 2 && /^\d*$/.test(decimalPart)) {
        integerDigits = normalizeIntegerPart(integerPart);
        decimalDigits = decimalPart;
      } else {
        return invalidCurrency('invalid');
      }
    }
  } else {
    integerDigits = normalizeIntegerPart(cleanedValue);
    decimalDigits = '';
  }

  if (!integerDigits) return invalidCurrency('invalid');

  const centsText = `${integerDigits}${decimalDigits.padEnd(2, '0')}`;
  const cents = Number(centsText);

  if (!Number.isSafeInteger(cents)) return invalidCurrency('invalid');
  if (cents <= 0) return invalidCurrency('zero');

  return { cents, reason: null };
};

const greatestCommonDivisor = (firstValue, secondValue) => {
  let first = Math.abs(firstValue);
  let second = Math.abs(secondValue);

  while (second) {
    const rest = first % second;
    first = second;
    second = rest;
  }

  return first || 1;
};

const simplifyMoneyFraction = (fraction) => {
  const divisor = greatestCommonDivisor(fraction.numeratorCents, fraction.denominator);

  return {
    numeratorCents: fraction.numeratorCents / divisor,
    denominator: fraction.denominator / divisor,
  };
};

export const createMoneyFraction = (numeratorCents, denominator = 1) => {
  const safeNumerator = Number(numeratorCents);
  const safeDenominator = Number(denominator);

  if (
    !Number.isFinite(safeNumerator) ||
    !Number.isFinite(safeDenominator) ||
    safeDenominator <= 0
  ) {
    return { numeratorCents: 0, denominator: 1 };
  }

  return simplifyMoneyFraction({
    numeratorCents: safeNumerator,
    denominator: safeDenominator,
  });
};

export const addMoneyFractions = (...fractions) => {
  const validFractions = fractions.filter(Boolean);

  if (!validFractions.length) return createMoneyFraction(0);

  const denominator = validFractions.reduce(
    (currentDenominator, fraction) => {
      const divisor = greatestCommonDivisor(currentDenominator, fraction.denominator);
      return (currentDenominator / divisor) * fraction.denominator;
    },
    1
  );
  const numeratorCents = validFractions.reduce(
    (total, fraction) => total + fraction.numeratorCents * (denominator / fraction.denominator),
    0
  );

  return createMoneyFraction(numeratorCents, denominator);
};

export const roundMoneyFractionToCents = (value) => {
  if (value && typeof value === 'object') {
    return Math.round(value.numeratorCents / value.denominator);
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.round(numericValue) : 0;
};

export const formatCurrencyFromCents = (value) => {
  const cents = roundMoneyFractionToCents(value);
  return normalizeCurrencyOutput(currencyFormatter.format(cents / 100));
};

export const formatCurrencyBRL = (value) => {
  const numericValue = Number(value);
  return normalizeCurrencyOutput(
    currencyFormatter.format(Number.isFinite(numericValue) ? numericValue : 0)
  );
};

export const calculateDailyValue = (planValueCents) => (
  createMoneyFraction(planValueCents, BILLING_DAYS_BASE)
);

export const calculatePreviousPlanProrata = (days, planValueCents) => (
  createMoneyFraction(planValueCents * days, BILLING_DAYS_BASE)
);

export const calculateNewPlanProrata = (days, planValueCents) => (
  createMoneyFraction(planValueCents * days, BILLING_DAYS_BASE)
);

export const calculateEstimatedInvoice = (previousPlanProrata, newPlanProrata) => (
  addMoneyFractions(previousPlanProrata, newPlanProrata)
);

const currencyMessages = {
  previousPlanValue: {
    empty: 'Informe o valor do plano atual.',
    negative: 'O valor do plano atual deve ser maior que zero.',
    zero: 'O valor do plano atual deve ser maior que zero.',
    invalid: 'Informe um valor válido para o plano atual.',
  },
  newPlanValue: {
    empty: 'Informe o valor do novo plano.',
    negative: 'O valor do novo plano deve ser maior que zero.',
    zero: 'O valor do novo plano deve ser maior que zero.',
    invalid: 'Informe um valor válido para o novo plano.',
  },
};

const validateCurrencyField = (field, value) => {
  const result = parseCurrencyBRLToCents(value);

  if (!result.reason) return result;

  return {
    ...result,
    message: currencyMessages[field][result.reason] || currencyMessages[field].invalid,
  };
};

export const calculatePlanChange = ({
  contactDate,
  currentDueDate,
  nextDueDate,
  previousPlanValue,
  newPlanValue,
} = {}) => {
  const errors = {};
  const contact = parseDateBR(contactDate);
  const currentDue = parseDateBR(currentDueDate);
  const nextDue = parseDateBR(nextDueDate);
  const previousPlan = validateCurrencyField('previousPlanValue', previousPlanValue);
  const newPlan = validateCurrencyField('newPlanValue', newPlanValue);

  if (!String(contactDate || '').trim()) {
    errors.contactDate = 'Informe a data do contato.';
  } else if (!contact) {
    errors.contactDate = 'A data do contato é inválida.';
  }

  if (!String(currentDueDate || '').trim()) {
    errors.currentDueDate = 'Informe a data de vencimento atual.';
  } else if (!currentDue) {
    errors.currentDueDate = 'A data de vencimento atual é inválida.';
  }

  if (!String(nextDueDate || '').trim()) {
    errors.nextDueDate = 'Informe a data do próximo vencimento.';
  } else if (!nextDue) {
    errors.nextDueDate = 'A data do próximo vencimento é inválida.';
  }

  if (previousPlan.reason) {
    errors.previousPlanValue = previousPlan.message;
  }

  if (newPlan.reason) {
    errors.newPlanValue = newPlan.message;
  }

  let daysPreviousPlan = null;
  let daysNewPlan = null;

  if (contact && currentDue) {
    daysPreviousPlan = calculateDaysBetween(currentDue, contact);

    if (daysPreviousPlan < 0) {
      errors.currentDueDate = 'O vencimento atual não pode ser posterior à data do contato.';
    }
  }

  if (contact && nextDue) {
    const rawDaysNewPlan = calculateDaysBetween(contact, nextDue);
    daysNewPlan = Math.max(rawDaysNewPlan - NEW_PLAN_DAYS_DISCOUNT, 0);

    if (rawDaysNewPlan <= 0) {
      errors.nextDueDate = 'O próximo vencimento deve ser posterior à data do contato.';
    }
  }

  if (currentDue && nextDue && calculateDaysBetween(currentDue, nextDue) <= 0) {
    errors.nextDueDate = 'O próximo vencimento deve ser posterior ao vencimento atual.';
  }

  if (Object.keys(errors).length > 0) {
    return {
      isValid: false,
      errors,
    };
  }

  const dailyPreviousPlan = calculateDailyValue(previousPlan.cents);
  const dailyNewPlan = calculateDailyValue(newPlan.cents);
  const previousPlanProrata = calculatePreviousPlanProrata(daysPreviousPlan, previousPlan.cents);
  const newPlanProrata = calculateNewPlanProrata(daysNewPlan, newPlan.cents);
  const estimatedInvoice = calculateEstimatedInvoice(previousPlanProrata, newPlanProrata);

  return {
    isValid: true,
    errors: {},
    contactDate: contact,
    currentDueDate: currentDue,
    nextDueDate: nextDue,
    previousPlanValueCents: previousPlan.cents,
    newPlanValueCents: newPlan.cents,
    daysPreviousPlan,
    daysNewPlan,
    dailyPreviousPlan,
    dailyNewPlan,
    previousPlanProrata,
    newPlanProrata,
    estimatedInvoice,
  };
};

export const buildPlanChangeCopyText = (calculation) => {
  if (!calculation?.isValid) return '';

  return [
    'Troca de plano',
    '',
    `Plano anterior: ${formatCurrencyFromCents(calculation.previousPlanValueCents)}`,
    `Novo plano: ${formatCurrencyFromCents(calculation.newPlanValueCents)}`,
    '',
    `Período plano anterior: ${calculation.daysPreviousPlan} dias`,
    `Proporcional anterior: ${formatCurrencyFromCents(calculation.previousPlanProrata)}`,
    '',
    `Período novo plano: ${calculation.daysNewPlan} dias`,
    `Proporcional novo: ${formatCurrencyFromCents(calculation.newPlanProrata)}`,
    '',
    `Próxima fatura estimada: ${formatCurrencyFromCents(calculation.estimatedInvoice)}`,
  ].join('\n');
};
