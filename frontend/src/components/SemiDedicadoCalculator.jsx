import { useMemo, useState } from 'react';
import { Calculator, Clock3, Copy, Gauge, Info, ShieldCheck, Wifi } from 'lucide-react';
import {
  SEMI_DEDICADO_BANDS,
  SEMI_DEDICADO_CONTRACT_MONTHS,
  calculateSemiDedicadoPrice,
} from '../data/semiDedicadoPricing';
import { formatCurrency } from '../utils/pricingCalculator';
import styles from '../styles/PricingCalculator.module.css';

const resultCards = [
  { key: 'minValue', label: 'Valor mínimo' },
  { key: 'averageValue', label: 'Valor médio/sugerido' },
  { key: 'maxValue', label: 'Valor máximo' },
];

const statusConfig = {
  abaixo: {
    className: styles.statusBelow,
    message: 'Valor abaixo do mínimo permitido',
  },
  dentro: {
    className: styles.statusInside,
    message: 'Valor dentro da faixa comercial',
  },
  acima: {
    className: styles.statusAbove,
    message: 'Valor acima da faixa máxima',
  },
};

const copiarTexto = async (texto) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(texto);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = texto;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
};

const parseCurrencyInput = (value) => {
  const rawValue = String(value || '').trim();
  if (!rawValue) return null;

  const cleaned = rawValue.replace(/[^\d,.-]/g, '');
  if (!cleaned) return null;

  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned;
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
};

const montarResumo = (result) => [
  'Semi Dedicado Comercial',
  `Banda: ${result.banda}`,
  `Contrato: ${result.contractMonths}`,
  `Valor mínimo: ${formatCurrency(result.minValue)}`,
  `Valor sugerido: ${formatCurrency(result.averageValue)}`,
  `Valor máximo: ${formatCurrency(result.maxValue)}`,
].join('\n');

export default function SemiDedicadoCalculator() {
  const [banda, setBanda] = useState(SEMI_DEDICADO_BANDS[0]);
  const [contractMonths, setContractMonths] = useState(24);
  const [valorNegociado, setValorNegociado] = useState('');
  const [resumoCopiado, setResumoCopiado] = useState(false);

  const valorNegociadoNumero = useMemo(
    () => parseCurrencyInput(valorNegociado),
    [valorNegociado]
  );

  const result = useMemo(
    () => calculateSemiDedicadoPrice(banda, Number(contractMonths), valorNegociadoNumero),
    [banda, contractMonths, valorNegociadoNumero]
  );

  const hasValorNegociado = valorNegociado.trim().length > 0;
  const valorNegociadoInvalido = hasValorNegociado && valorNegociadoNumero === null;
  const status = result.negotiatedStatus ? statusConfig[result.negotiatedStatus] : null;

  const copiarResumo = async () => {
    if (result.error) return;

    await copiarTexto(montarResumo(result));
    setResumoCopiado(true);
    window.setTimeout(() => setResumoCopiado(false), 2200);
  };

  const formatarValorNegociado = () => {
    if (valorNegociadoNumero === null) return;
    setValorNegociado(formatCurrency(valorNegociadoNumero));
  };

  return (
    <section className={styles.calculator} aria-labelledby="semi-dedicado-calculator-title">
      <div className={styles.header}>
        <span className={styles.headerIcon}>
          <Calculator size={22} />
        </span>
        <div>
          <h2 id="semi-dedicado-calculator-title">Calculadora Semi Dedicado</h2>
          <p>Precificação comercial por banda e prazo de contrato</p>
        </div>
      </div>

      <form
        className={`${styles.form} ${styles.formCommercial}`}
        onSubmit={(event) => event.preventDefault()}
      >
        <label className={styles.field}>
          <span>Banda</span>
          <select value={banda} onChange={(event) => setBanda(event.target.value)}>
            {SEMI_DEDICADO_BANDS.map((bandOption) => (
              <option key={bandOption} value={bandOption}>
                {bandOption}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>Prazo de contrato</span>
          <select
            value={contractMonths}
            onChange={(event) => setContractMonths(Number(event.target.value))}
          >
            {SEMI_DEDICADO_CONTRACT_MONTHS.map((months) => (
              <option key={months} value={months}>
                {months} meses
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>Valor negociado (opcional)</span>
          <div className={styles.inputWithPrefix}>
            <strong>R$</strong>
            <input
              type="text"
              inputMode="decimal"
              value={valorNegociado}
              onChange={(event) => setValorNegociado(event.target.value)}
              onBlur={formatarValorNegociado}
              placeholder="677,40"
            />
          </div>
        </label>

        <button type="button" className={styles.calculateButton} onClick={copiarResumo}>
          <Copy size={18} />
          {resumoCopiado ? 'Resumo copiado' : 'Copiar resumo'}
        </button>
      </form>

      {result.error ? (
        <div className={styles.error} role="alert">
          <Info size={18} />
          {result.error}
        </div>
      ) : (
        <>
          <div className={styles.resultGrid}>
            {resultCards.map((card) => (
              <article key={card.key} className={styles.resultCard}>
                <span>{card.label}</span>
                <strong>{formatCurrency(result[card.key])}</strong>
                <small>Mensal comercial</small>
              </article>
            ))}
          </div>

          {valorNegociadoInvalido && (
            <div className={styles.warning} role="alert">
              <Info size={18} />
              Informe um valor negociado válido em Real brasileiro.
            </div>
          )}

          {status && !valorNegociadoInvalido && (
            <div className={`${styles.valueStatus} ${status.className}`} role="status">
              <Info size={18} />
              <div>
                <strong>{status.message}</strong>
                <span>Valor informado: {formatCurrency(valorNegociadoNumero)}</span>
              </div>
            </div>
          )}

          <div className={styles.summary}>
            <strong>{result.productName}</strong>
            <div className={styles.summaryDetails}>
              <span>
                <Wifi size={15} />
                Semi Dedicado Comercial
              </span>
              <span>
                <Gauge size={15} />
                {result.banda}
              </span>
              <span>
                <Clock3 size={15} />
                {result.contractMonths} meses
              </span>
              <span>
                <ShieldCheck size={15} />
                SLA24, PPPOE-IPV e RTW6
              </span>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
