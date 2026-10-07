import { AlertTriangle, CheckCircle2, Info, ZapOff } from 'lucide-react';
import styles from '../../styles/NetworkDiagnostics.module.css';

const RESULT_ICON = {
  normal: CheckCircle2,
  partial: Info,
  no_traffic: Info,
  high_usage: AlertTriangle,
  packet_loss: AlertTriangle,
  latency: AlertTriangle,
  jitter: AlertTriangle,
  optical_signal: AlertTriangle,
  offline: ZapOff,
};

export default function DiagnosticResult({ diagnostic }) {
  const conclusion = diagnostic?.conclusion;
  const status = conclusion?.status || 'partial';
  const Icon = RESULT_ICON[status] || Info;

  if (!conclusion) return null;

  return (
    <section className={`${styles.panel} ${styles.resultPanel}`} aria-labelledby="diagnostic-result-title">
      <div className={styles.resultHeader}>
        <span className={`${styles.resultIcon} ${styles[`result-${status}`] || styles.resultPartial}`}>
          <Icon size={22} />
        </span>
        <div>
          <span className={styles.kicker}>Resultado</span>
          <h2 id="diagnostic-result-title">{conclusion.title || 'Diagnóstico parcial'}</h2>
          <p>{conclusion.message || 'Execute o diagnóstico para obter a conclusão.'}</p>
        </div>
      </div>
    </section>
  );
}
