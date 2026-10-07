import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';
import styles from '../../styles/NetworkDiagnostics.module.css';
import { formatDateTime } from './formatters';

const getIcon = (entry, activeRunStatus) => {
  if (entry.step === 'completed') return CheckCircle2;
  if (activeRunStatus === 'failed' || activeRunStatus === 'cancelled') return XCircle;
  if (entry.active) return Loader2;
  return Circle;
};

export default function DiagnosticProgress({ progress, activeRunStatus }) {
  if (!progress.length) {
    return null;
  }

  return (
    <section className={styles.panel} aria-labelledby="diagnostic-progress-title">
      <div className={styles.panelHeader}>
        <div>
          <span className={styles.kicker}>Execução</span>
          <h2 id="diagnostic-progress-title">Progresso do diagnóstico</h2>
        </div>
      </div>

      <ol className={styles.progressList}>
        {progress.map((entry, index) => {
          const Icon = getIcon(entry, activeRunStatus);
          const isActive = index === progress.length - 1 && activeRunStatus === 'running';

          return (
            <li key={`${entry.step}-${entry.at}-${index}`} className={isActive ? styles.progressActive : ''}>
              <Icon size={17} className={isActive ? styles.spin : ''} />
              <span>{entry.message}</span>
              <time>{formatDateTime(entry.at)}</time>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
