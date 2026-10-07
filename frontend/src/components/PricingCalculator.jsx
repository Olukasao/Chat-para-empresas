import { useMemo, useState } from 'react';
import { Calculator, Clock3, Gauge, Info, ShieldCheck, Wifi } from 'lucide-react';
import {
  CONTRACT_MONTHS,
  calculatePrice,
  formatCurrency,
} from '../utils/pricingCalculator';
import styles from '../styles/PricingCalculator.module.css';

const resultCards = [
  { key: 'minValue', label: 'Valor mínimo' },
  { key: 'averageValue', label: 'Valor médio' },
  { key: 'maxValue', label: 'Valor máximo' },
];

export default function PricingCalculator() {
  const [mbps, setMbps] = useState('100');
  const [contractMonths, setContractMonths] = useState(24);

  const result = useMemo(
    () => calculatePrice(Number(mbps), Number(contractMonths)),
    [contractMonths, mbps]
  );

  const hasResult = !result.error;

  return (
    <section className={styles.calculator} aria-labelledby="pricing-calculator-title">
      <div className={styles.header}>
        <span className={styles.headerIcon}>
          <Calculator size={22} />
        </span>
        <div>
          <h2 id="pricing-calculator-title">Calculadora de Link Dedicado</h2>
          <p>Precificação com SLA8, IP/30 e ONU Bridge</p>
        </div>
      </div>

      <form className={styles.form} onSubmit={(event) => event.preventDefault()}>
        <label className={styles.field}>
          <span>Banda em Mbps</span>
          <div className={styles.inputWithSuffix}>
            <input
              type="number"
              min="1"
              inputMode="numeric"
              value={mbps}
              onChange={(event) => setMbps(event.target.value)}
              placeholder="100"
            />
            <strong>Mbps</strong>
          </div>
        </label>

        <label className={styles.field}>
          <span>Prazo de contrato</span>
          <select
            value={contractMonths}
            onChange={(event) => setContractMonths(Number(event.target.value))}
          >
            {CONTRACT_MONTHS.map((months) => (
              <option key={months} value={months}>
                {months} meses
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className={styles.calculateButton}>
          <Calculator size={18} />
          Calcular
        </button>
      </form>

      {result.error ? (
        <div className={styles.error} role="alert">
          <Info size={18} />
          {result.error}
        </div>
      ) : (
        <>
          {result.warnings?.length > 0 && (
            <div className={styles.warning} role="status">
              <Info size={18} />
              <div>
                {result.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            </div>
          )}

          <div className={styles.resultGrid}>
            {resultCards.map((card) => (
              <article key={card.key} className={styles.resultCard}>
                <span>{card.label}</span>
                <strong>{formatCurrency(result[card.key])}</strong>
                <small>Mensal estimado</small>
              </article>
            ))}
          </div>

          <div className={styles.summary}>
            <strong>{result.summary}</strong>
            <div className={styles.summaryDetails}>
              <span>
                <Wifi size={15} />
                Link Dedicado
              </span>
              <span>
                <Gauge size={15} />
                {result.requestedMbps} Mbps
              </span>
              <span>
                <Clock3 size={15} />
                {result.contractMonths} meses
              </span>
              <span>
                <ShieldCheck size={15} />
                SLA8, IP/30 e ONU Bridge
              </span>
            </div>
            {hasResult && result.selectedBandMbps !== result.requestedMbps && (
              <small>Faixa de referência: {result.selectedBandMbps} Mbps</small>
            )}
          </div>
        </>
      )}
    </section>
  );
}
