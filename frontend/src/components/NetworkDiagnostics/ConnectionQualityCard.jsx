import { Activity, RadioTower, Signal, TimerReset } from 'lucide-react';
import styles from '../../styles/NetworkDiagnostics.module.css';
import {
  formatDbm,
  formatMs,
  formatPercent,
} from './formatters';

export default function ConnectionQualityCard({ diagnostic }) {
  const quality = diagnostic?.quality || {};
  const customer = diagnostic?.customer || {};

  return (
    <section className={styles.panel} aria-labelledby="quality-title">
      <div className={styles.panelHeader}>
        <div>
          <span className={styles.kicker}>Qualidade</span>
          <h2 id="quality-title">Latência e sinal</h2>
        </div>
      </div>

      <div className={styles.metricGrid}>
        <div className={styles.metricCard}>
          <span><Activity size={16} /> Ping</span>
          <strong>{formatMs(quality.pingMs)}</strong>
        </div>
        <div className={styles.metricCard}>
          <span><TimerReset size={16} /> Jitter</span>
          <strong>{formatMs(quality.jitterMs)}</strong>
        </div>
        <div className={styles.metricCard}>
          <span><RadioTower size={16} /> Perda</span>
          <strong>{formatPercent(quality.packetLossPercent)}</strong>
        </div>
        <div className={styles.metricCard}>
          <span><Signal size={16} /> Sinal óptico</span>
          <strong>{formatDbm(customer.opticalSignalDbm)}</strong>
        </div>
      </div>
    </section>
  );
}
