import { useMemo, useState } from 'react';
import { ArrowLeft, BadgePercent, Calculator, Clock3, RotateCcw } from 'lucide-react';
import { useInternalBack } from '../utils/internalNavigation';
import {
  AGREEMENT_DISCOUNT_RULES,
  INSTALLMENT_COUNTS,
  calculateAgreement,
  formatCurrencyBR,
  formatPercentBR,
  parseCurrencyBR,
} from '../utils/agreementCalculator';
import styles from '../styles/AgreementCalculatorPage.module.css';

const sanitizeCurrencyInput = (value) => (
  String(value || '')
    .replace(/-/g, '')
    .replace(/[^\d.,]/g, '')
    .slice(0, 18)
);

const sanitizeDelayInput = (value) => (
  String(value || '')
    .replace(/\D/g, '')
    .slice(0, 6)
);

const formatInputCurrency = (value) => (
  formatCurrencyBR(value).replace(/^R\$\s?/, '')
);

export default function AgreementCalculatorPage() {
  const voltarPaginaInterna = useInternalBack('/chat');
  const [amountInput, setAmountInput] = useState('');
  const [delayInput, setDelayInput] = useState('');

  const amount = useMemo(() => parseCurrencyBR(amountInput), [amountInput]);
  const delayDays = delayInput ? Number(delayInput) : 0;
  const result = useMemo(
    () => calculateAgreement({ amount, delayDays }),
    [amount, delayDays]
  );
  const activeRuleId = useMemo(() => {
    const activeRule = AGREEMENT_DISCOUNT_RULES.find((rule) => (
      result.delayDays >= rule.minDays && result.delayDays <= rule.maxDays
    ));

    return activeRule?.id || AGREEMENT_DISCOUNT_RULES[0].id;
  }, [result.delayDays]);

  const handleAmountChange = (event) => {
    setAmountInput(sanitizeCurrencyInput(event.target.value));
  };

  const handleAmountBlur = () => {
    if (!amountInput.trim()) return;
    setAmountInput(formatInputCurrency(amount));
  };

  const clearFields = () => {
    setAmountInput('');
    setDelayInput('');
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <button type="button" className={styles.backButton} onClick={voltarPaginaInterna}>
          <ArrowLeft size={18} />
          Voltar
        </button>

        <header className={styles.header}>
          <span className={styles.headerIcon}>
            <Calculator size={26} />
          </span>
          <div>
            <h1>Calculadora de Acordo</h1>
            <p>Simule descontos e parcelamentos com base no tempo de inatividade do cliente.</p>
          </div>
        </header>

        <div className={styles.topGrid}>
          <section className={styles.card} aria-labelledby="agreement-input-title">
            <div className={styles.cardTitle}>
              <Clock3 size={19} />
              <h2 id="agreement-input-title">Dados da cobrança</h2>
            </div>

            <form className={styles.form} onSubmit={(event) => event.preventDefault()}>
              <label className={styles.field}>
                <span>Valor da cobrança</span>
                <div className={styles.currencyInput}>
                  <strong>R$</strong>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amountInput}
                    onChange={handleAmountChange}
                    onBlur={handleAmountBlur}
                    placeholder="1.200,50"
                  />
                </div>
              </label>

              <label className={styles.field}>
                <span>Dias de atraso</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={delayInput}
                  onChange={(event) => setDelayInput(sanitizeDelayInput(event.target.value))}
                  placeholder="90"
                />
              </label>

              <button type="button" className={styles.clearButton} onClick={clearFields}>
                <RotateCcw size={17} />
                Limpar
              </button>
            </form>
          </section>

          <section className={`${styles.card} ${styles.resultCard}`} aria-labelledby="agreement-result-title">
            <div className={styles.cardTitle}>
              <BadgePercent size={19} />
              <h2 id="agreement-result-title">Resultado principal</h2>
            </div>

            <div className={styles.resultList}>
              <div className={styles.resultLine}>
                <span>Desconto à vista</span>
                <strong>{formatPercentBR(result.cashDiscount)}</strong>
              </div>
              <div className={`${styles.resultLine} ${styles.resultLineHighlight}`}>
                <span>Valor final à vista</span>
                <strong>{formatCurrencyBR(result.finalCashAmount)}</strong>
              </div>
              <div className={styles.resultLine}>
                <span>Desconto a prazo</span>
                <strong>{formatPercentBR(result.installmentDiscount)}</strong>
              </div>
              <div className={`${styles.resultLine} ${styles.resultLineHighlight}`}>
                <span>Valor final a prazo</span>
                <strong>{formatCurrencyBR(result.finalInstallmentAmount)}</strong>
              </div>
            </div>
          </section>
        </div>

        <section className={styles.card} aria-labelledby="agreement-rules-title">
          <div className={styles.cardTitle}>
            <BadgePercent size={19} />
            <h2 id="agreement-rules-title">Regras de desconto</h2>
          </div>

          <div className={styles.tableScroll}>
            <table className={styles.rulesTable}>
              <thead>
                <tr>
                  <th>Tempo de inatividade</th>
                  <th>Faixa de dias</th>
                  <th>Desconto à vista</th>
                  <th>Desconto a prazo</th>
                </tr>
              </thead>
              <tbody>
                {AGREEMENT_DISCOUNT_RULES.map((rule) => (
                  <tr key={rule.id} className={rule.id === activeRuleId ? styles.activeRule : ''}>
                    <td>{rule.inactivityLabel}</td>
                    <td>{rule.rangeLabel}</td>
                    <td>{formatPercentBR(rule.cashDiscount)}</td>
                    <td>{formatPercentBR(rule.installmentDiscount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.card} aria-labelledby="agreement-installments-title">
          <div className={styles.cardTitle}>
            <Calculator size={19} />
            <h2 id="agreement-installments-title">Tabela de parcelamento</h2>
          </div>

          <div className={styles.tableScroll}>
            <table className={styles.installmentTable}>
              <thead>
                <tr>
                  <th>Tipo de entrada</th>
                  <th>Valor da entrada</th>
                  {INSTALLMENT_COUNTS.map((count) => (
                    <th key={count}>{count}x</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.installmentOptions.map((option) => (
                  <tr key={option.label}>
                    <td>{option.label}</td>
                    <td>{formatCurrencyBR(option.entryAmount)}</td>
                    {INSTALLMENT_COUNTS.map((count) => (
                      <td key={count}>{formatCurrencyBR(option.installments[count])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
