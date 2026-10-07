import { ArrowDown, ArrowUp, Clock3, Gauge } from 'lucide-react';
import styles from '../../styles/NetworkDiagnostics.module.css';
import {
  formatMbps,
  formatPercent,
  formatRelativeTime,
} from './formatters';

export default function CurrentTrafficCard({ diagnostic, latestTraffic }) {
  const customer = diagnostic?.customer || {};
  const traffic = latestTraffic?.traffic?.available ? latestTraffic.traffic : diagnostic?.traffic || {};
  const usagePercent = diagnostic?.conclusion?.usagePercent;
  const hasRelevantTraffic = Number(traffic.downloadMbps || 0) >= 0.1 || Number(traffic.uploadMbps || 0) >= 0.1;
  const online = (diagnostic?.connection?.status || customer.status) === 'online';

  return (
    <section className={styles.panel} aria-labelledby="current-traffic-title">
      <div className={styles.panelHeader}>
        <div>
          <span className={styles.kicker}>Consumo atual</span>
          <h2 id="current-traffic-title">Uso em tempo real</h2>
        </div>
        <span className={styles.updatePill}>
          <Clock3 size={14} />
          {formatRelativeTime(traffic.updatedAt)}
        </span>
      </div>

      {!traffic.available && (
        <div className={styles.infoBanner}>
          {traffic.message || 'Integração de tráfego ainda não configurada.'}
        </div>
      )}

      {traffic.available && online && !hasRelevantTraffic && (
        <div className={styles.infoBanner}>
          Cliente conectado, sem tráfego relevante no momento.
        </div>
      )}

      <div className={styles.metricGrid}>
        <div className={styles.metricCard}>
          <span><ArrowDown size={16} /> Download atual</span>
          <strong>{formatMbps(traffic.downloadMbps)}</strong>
        </div>
        <div className={styles.metricCard}>
          <span><ArrowUp size={16} /> Upload atual</span>
          <strong>{formatMbps(traffic.uploadMbps)}</strong>
        </div>
        <div className={styles.metricCard}>
          <span><ArrowDown size={16} /> Pico de download</span>
          <strong>{formatMbps(traffic.downloadPeakMbps)}</strong>
        </div>
        <div className={styles.metricCard}>
          <span><ArrowUp size={16} /> Pico de upload</span>
          <strong>{formatMbps(traffic.uploadPeakMbps)}</strong>
        </div>
        <div className={styles.metricCard}>
          <span><Gauge size={16} /> Uso atual do plano</span>
          <strong>{formatPercent(usagePercent)}</strong>
        </div>
      </div>
    </section>
  );
}
