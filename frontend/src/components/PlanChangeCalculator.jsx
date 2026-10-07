import { useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  Calculator,
  Copy,
  Info,
  ReceiptText,
  RotateCcw,
} from 'lucide-react';
import {
  buildPlanChangeCopyText,
  calculatePlanChange,
  dateBRToISO,
  dateISOToBR,
  formatCurrencyFromCents,
  formatDateBR,
  getNextDueDateBR,
  getTodayDateBR,
  maskDateBR,
  parseCurrencyBRLToCents,
  parseDateBR,
  sanitizeCurrencyInput,
} from '../utils/planChangeCalculator';
import styles from '../styles/PlanChangeCalculator.module.css';

const createInitialForm = () => ({
  contactDate: getTodayDateBR(),
  currentDueDate: '',
  nextDueDate: '',
  previousPlanValue: '',
  newPlanValue: '',
});

const allFieldsTouched = {
  contactDate: true,
  currentDueDate: true,
  nextDueDate: true,
  previousPlanValue: true,
  newPlanValue: true,
};

const copyText = async (text) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
};

const formatDayLabel = (days) => `${days} ${days === 1 ? 'dia' : 'dias'}`;

function DateField({
  label,
  value,
  placeholder,
  invalid,
  error,
  onTextChange,
  onTextBlur,
  onPickerChange,
}) {
  const datePickerRef = useRef(null);

  const openDatePicker = () => {
    const datePicker = datePickerRef.current;
    if (!datePicker) return;

    if (typeof datePicker.showPicker === 'function') {
      datePicker.showPicker();
      return;
    }

    datePicker.click();
  };

  return (
    <label className={styles.field}>
      <span>{label}</span>
      <div className={styles.inputWithIcon}>
        <button
          type="button"
          className={styles.calendarButton}
          onClick={openDatePicker}
          title={`Selecionar ${label.toLowerCase()}`}
          aria-label={`Selecionar ${label.toLowerCase()}`}
        >
          <CalendarDays size={17} />
        </button>
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(event) => onTextChange(event.target.value)}
          onBlur={onTextBlur}
          placeholder={placeholder}
          aria-invalid={invalid}
        />
        <input
          ref={datePickerRef}
          type="date"
          className={styles.nativeDatePicker}
          value={dateBRToISO(value)}
          onChange={(event) => onPickerChange(event.target.value)}
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
      {error}
    </label>
  );
}

export default function PlanChangeCalculator() {
  const [form, setForm] = useState(createInitialForm);
  const [touched, setTouched] = useState({});
  const [copied, setCopied] = useState(false);

  const calculation = useMemo(() => calculatePlanChange(form), [form]);
  const result = calculation.isValid ? calculation : null;
  const hasManualInput = Boolean(
    form.currentDueDate ||
    form.nextDueDate ||
    form.previousPlanValue ||
    form.newPlanValue
  );

  const showFieldError = (field) => (
    Boolean(calculation.errors?.[field]) &&
    (touched[field] || Boolean(String(form[field] || '').trim()))
  );

  const visibleErrors = Object.entries(calculation.errors || {})
    .filter(([field]) => showFieldError(field))
    .map(([, message]) => message);

  const markFieldTouched = (field) => {
    setTouched((current) => ({ ...current, [field]: true }));
  };

  const updateDateField = (field, value) => {
    const maskedValue = maskDateBR(value);

    setCopied(false);
    setForm((current) => {
      const updated = {
        ...current,
        [field]: maskedValue,
      };

      if (field === 'currentDueDate') {
        updated.nextDueDate = getNextDueDateBR(maskedValue);
      }

      return updated;
    });
  };

  const updateDateFieldFromPicker = (field, value) => {
    const dateValue = dateISOToBR(value);
    if (!dateValue) return;

    markFieldTouched(field);
    setCopied(false);
    setForm((current) => {
      const updated = {
        ...current,
        [field]: dateValue,
      };

      if (field === 'currentDueDate') {
        updated.nextDueDate = getNextDueDateBR(dateValue);
      }

      return updated;
    });
  };

  const formatDateField = (field) => {
    markFieldTouched(field);

    const parsedDate = parseDateBR(form[field]);
    if (!parsedDate) return;

    setForm((current) => ({
      ...current,
      [field]: formatDateBR(parsedDate),
    }));
  };

  const updateCurrencyField = (field, value) => {
    setCopied(false);
    setForm((current) => ({
      ...current,
      [field]: sanitizeCurrencyInput(value),
    }));
  };

  const formatCurrencyField = (field) => {
    markFieldTouched(field);

    const parsedCurrency = parseCurrencyBRLToCents(form[field]);
    if (parsedCurrency.reason) return;

    setForm((current) => ({
      ...current,
      [field]: formatCurrencyFromCents(parsedCurrency.cents),
    }));
  };

  const clearForm = () => {
    setForm(createInitialForm());
    setTouched({});
    setCopied(false);
  };

  const copyCalculation = async () => {
    if (!result) {
      setTouched(allFieldsTouched);
      return;
    }

    await copyText(buildPlanChangeCopyText(result));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  };

  const renderFieldError = (field) => (
    showFieldError(field) ? (
      <small className={styles.fieldError}>{calculation.errors[field]}</small>
    ) : null
  );

  return (
    <section className={styles.calculator} aria-labelledby="plan-change-calculator-title">
      <div className={styles.header}>
        <span className={styles.headerIcon}>
          <Calculator size={22} />
        </span>
        <div>
          <h2 id="plan-change-calculator-title">Calculadora de Troca de Plano</h2>
          <p>Estimativa proporcional da próxima fatura</p>
        </div>
      </div>

      <form className={styles.form} onSubmit={(event) => event.preventDefault()}>
        <DateField
          label="Data do contato"
          value={form.contactDate}
          placeholder="DD/MM/AAAA"
          invalid={showFieldError('contactDate')}
          error={renderFieldError('contactDate')}
          onTextChange={(value) => updateDateField('contactDate', value)}
          onTextBlur={() => formatDateField('contactDate')}
          onPickerChange={(value) => updateDateFieldFromPicker('contactDate', value)}
        />

        <DateField
          label="Data de vencimento atual"
          value={form.currentDueDate}
          placeholder="10/08/2026"
          invalid={showFieldError('currentDueDate')}
          error={renderFieldError('currentDueDate')}
          onTextChange={(value) => updateDateField('currentDueDate', value)}
          onTextBlur={() => formatDateField('currentDueDate')}
          onPickerChange={(value) => updateDateFieldFromPicker('currentDueDate', value)}
        />

        <DateField
          label="Data do próximo vencimento"
          value={form.nextDueDate}
          placeholder="10/09/2026"
          invalid={showFieldError('nextDueDate')}
          error={renderFieldError('nextDueDate')}
          onTextChange={(value) => updateDateField('nextDueDate', value)}
          onTextBlur={() => formatDateField('nextDueDate')}
          onPickerChange={(value) => updateDateFieldFromPicker('nextDueDate', value)}
        />

        <label className={styles.field}>
          <span>Valor do plano anterior</span>
          <div className={styles.currencyInput}>
            <strong>R$</strong>
            <input
              type="text"
              inputMode="decimal"
              value={form.previousPlanValue}
              onChange={(event) => updateCurrencyField('previousPlanValue', event.target.value)}
              onBlur={() => formatCurrencyField('previousPlanValue')}
              placeholder="109,99"
              aria-invalid={showFieldError('previousPlanValue')}
            />
          </div>
          {renderFieldError('previousPlanValue')}
        </label>

        <label className={styles.field}>
          <span>Valor do novo plano</span>
          <div className={styles.currencyInput}>
            <strong>R$</strong>
            <input
              type="text"
              inputMode="decimal"
              value={form.newPlanValue}
              onChange={(event) => updateCurrencyField('newPlanValue', event.target.value)}
              onBlur={() => formatCurrencyField('newPlanValue')}
              placeholder="114,99"
              aria-invalid={showFieldError('newPlanValue')}
            />
          </div>
          {renderFieldError('newPlanValue')}
        </label>

        <div className={styles.actions}>
          <button type="button" className={styles.secondaryButton} onClick={clearForm}>
            <RotateCcw size={17} />
            Limpar
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={copyCalculation}
            disabled={!result}
          >
            <Copy size={17} />
            {copied ? 'Cálculo copiado!' : 'Copiar cálculo'}
          </button>
        </div>
      </form>

      {visibleErrors.length > 0 && (
        <div className={styles.validationMessage} role="alert">
          <Info size={18} />
          <span>{visibleErrors[0]}</span>
        </div>
      )}

      {result ? (
        <section className={styles.resultPanel} aria-labelledby="plan-change-summary-title">
          <div className={styles.resultHeader}>
            <ReceiptText size={19} />
            <h3 id="plan-change-summary-title">Resumo da troca</h3>
          </div>

          <div className={styles.planGrid}>
            <article className={styles.planCard}>
              <span>Plano anterior</span>
              <strong>{formatCurrencyFromCents(result.previousPlanValueCents)}</strong>
              <p>{formatDayLabel(result.daysPreviousPlan)} utilizados</p>
              <small>Valor diário: {formatCurrencyFromCents(result.dailyPreviousPlan)}</small>
              <div className={styles.proportionalLine}>
                <span>Proporcional</span>
                <strong>{formatCurrencyFromCents(result.previousPlanProrata)}</strong>
              </div>
            </article>

            <article className={styles.planCard}>
              <span>Novo plano</span>
              <strong>{formatCurrencyFromCents(result.newPlanValueCents)}</strong>
              <p>{formatDayLabel(result.daysNewPlan)} utilizados</p>
              <small>Valor diário: {formatCurrencyFromCents(result.dailyNewPlan)}</small>
              <div className={styles.proportionalLine}>
                <span>Proporcional</span>
                <strong>{formatCurrencyFromCents(result.newPlanProrata)}</strong>
              </div>
            </article>
          </div>

          <div className={styles.invoiceHighlight}>
            <span>Próxima fatura estimada</span>
            <strong>{formatCurrencyFromCents(result.estimatedInvoice)}</strong>
          </div>
        </section>
      ) : (
        <div className={styles.emptyState}>
          <ReceiptText size={18} />
          <span>{hasManualInput ? 'Revise os dados informados.' : 'Aguardando dados obrigatórios.'}</span>
        </div>
      )}
    </section>
  );
}
