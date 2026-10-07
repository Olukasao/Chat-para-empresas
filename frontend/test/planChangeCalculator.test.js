import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculatePlanChange,
  dateBRToISO,
  dateISOToBR,
  formatCurrencyFromCents,
  getNextDueDateBR,
  parseCurrencyBRLToCents,
  parseDateBR,
} from '../src/utils/planChangeCalculator.js';

const makeCalculation = (overrides = {}) => calculatePlanChange({
  contactDate: '13/08/2026',
  currentDueDate: '10/08/2026',
  nextDueDate: '10/09/2026',
  previousPlanValue: '109,99',
  newPlanValue: '114,99',
  ...overrides,
});

test('caso 1: calcula troca de plano com os valores do exemplo real', () => {
  const result = makeCalculation();

  assert.equal(result.isValid, true);
  assert.equal(result.daysPreviousPlan, 3);
  assert.equal(result.daysNewPlan, 27);
  assert.equal(formatCurrencyFromCents(result.previousPlanProrata), 'R$ 11,00');
  assert.equal(formatCurrencyFromCents(result.newPlanProrata), 'R$ 103,49');
  assert.equal(formatCurrencyFromCents(result.estimatedInvoice), 'R$ 114,49');
});

test('caso 2: calcula proporcionais com valores iguais', () => {
  const result = makeCalculation({
    previousPlanValue: '100',
    newPlanValue: '100',
  });

  assert.equal(result.isValid, true);
  assert.equal(formatCurrencyFromCents(result.previousPlanProrata), 'R$ 10,00');
  assert.equal(formatCurrencyFromCents(result.newPlanProrata), 'R$ 90,00');
  assert.equal(formatCurrencyFromCents(result.estimatedInvoice), 'R$ 100,00');
});

test('caso 3: calcula troca para plano novo mais barato', () => {
  const result = makeCalculation({
    previousPlanValue: '150',
    newPlanValue: '100',
  });

  assert.equal(result.isValid, true);
  assert.equal(formatCurrencyFromCents(result.previousPlanProrata), 'R$ 15,00');
  assert.equal(formatCurrencyFromCents(result.newPlanProrata), 'R$ 90,00');
  assert.equal(formatCurrencyFromCents(result.estimatedInvoice), 'R$ 105,00');
});

test('caso 4: calcula virada de mês', () => {
  const result = makeCalculation({
    contactDate: '31/08/2026',
    currentDueDate: '10/08/2026',
    nextDueDate: '10/09/2026',
    previousPlanValue: '100',
    newPlanValue: '100',
  });

  assert.equal(result.isValid, true);
  assert.equal(result.daysPreviousPlan, 21);
  assert.equal(result.daysNewPlan, 9);
  assert.equal(formatCurrencyFromCents(result.estimatedInvoice), 'R$ 100,00');
});

test('caso 5: calcula virada de ano', () => {
  const result = makeCalculation({
    contactDate: '28/12/2026',
    currentDueDate: '10/12/2026',
    nextDueDate: '10/01/2027',
    previousPlanValue: '100',
    newPlanValue: '100',
  });

  assert.equal(result.isValid, true);
  assert.equal(result.daysPreviousPlan, 18);
  assert.equal(result.daysNewPlan, 12);
  assert.equal(formatCurrencyFromCents(result.estimatedInvoice), 'R$ 100,00');
});

test('caso 6: valida ano bissexto', () => {
  const result = makeCalculation({
    contactDate: '29/02/2028',
    currentDueDate: '28/02/2028',
    nextDueDate: '10/03/2028',
    previousPlanValue: '100',
    newPlanValue: '100',
  });

  assert.equal(result.isValid, true);
  assert.equal(result.daysPreviousPlan, 1);
  assert.equal(result.daysNewPlan, 9);
  assert.deepEqual(parseDateBR('29/02/2026'), null);
});

test('caso 7: rejeita data inválida', () => {
  const result = makeCalculation({ currentDueDate: '31/02/2026' });

  assert.equal(result.isValid, false);
  assert.equal(result.errors.currentDueDate, 'A data de vencimento atual é inválida.');
});

test('caso 8: rejeita campos vazios', () => {
  const result = calculatePlanChange({});

  assert.equal(result.isValid, false);
  assert.equal(result.errors.currentDueDate, 'Informe a data de vencimento atual.');
  assert.equal(result.errors.nextDueDate, 'Informe a data do próximo vencimento.');
  assert.equal(result.errors.previousPlanValue, 'Informe o valor do plano atual.');
  assert.equal(result.errors.newPlanValue, 'Informe o valor do novo plano.');
});

test('caso 9: aceita valor com vírgula', () => {
  assert.deepEqual(parseCurrencyBRLToCents('109,99'), { cents: 10999, reason: null });
});

test('caso 10: aceita valor colado com R$', () => {
  assert.deepEqual(parseCurrencyBRLToCents('R$ 109,99'), { cents: 10999, reason: null });
});

test('preenche próximo vencimento preservando data comercial', () => {
  assert.equal(getNextDueDateBR('10/08/2026'), '10/09/2026');
  assert.equal(getNextDueDateBR('31/01/2027'), '28/02/2027');
  assert.equal(getNextDueDateBR('31/01/2028'), '29/02/2028');
});

test('converte datas do seletor nativo sem aplicar timezone', () => {
  assert.equal(dateBRToISO('13/08/2026'), '2026-08-13');
  assert.equal(dateISOToBR('2026-08-13'), '13/08/2026');
  assert.equal(dateISOToBR('2026-02-29'), '');
});

test('rejeita valores negativos, zero e caracteres inválidos', () => {
  assert.equal(parseCurrencyBRLToCents('-109,99').reason, 'negative');
  assert.equal(parseCurrencyBRLToCents('0').reason, 'zero');
  assert.equal(parseCurrencyBRLToCents('abc').reason, 'invalid');
});
