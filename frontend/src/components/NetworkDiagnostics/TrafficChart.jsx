import { Clock3 } from 'lucide-react';
import styles from '../../styles/NetworkDiagnostics.module.css';
import {
  formatDateTime,
  formatMbps,
} from './formatters';

const PERIOD_OPTIONS = [
  { value: '5m', label: '5 min' },
  { value: '15m', label: '15 min' },
  { value: '30m', label: '30 min' },
  { value: '1h', label: '1 hora' },
];

const buildPolyline = (points, width, height, maxValue, key) => {
  if (!points.length || maxValue <= 0) return '';

  return points.map((point, index) => {
    const x = points.length === 1 ? width : (index / (points.length - 1)) * width;
    const y = height - (Number(point[key] || 0) / maxValue) * height;
    return `${x.toFixed(2)},${Math.max(0, Math.min(height, y)).toFixed(2)}`;
  }).join(' ');
};

export default function TrafficChart({
  points,
  period,
  onPeriodChange,
  paused,
  availability,
}) {
  const width = 760;
  const height = 240;
  const validPoints = points.filter((point) => (
    Number.isFinite(Number(point.downloadMbps)) ||
    Number.isFinite(Number(point.uploadMbps))
  ));
  const maxValue = Math.max(
    1,
    ...validPoints.flatMap((point) => [
      Number(point.downloadMbps || 0),
      Number(point.uploadMbps || 0),
    ])
  );
  const downloadLine = buildPolyline(validPoints, width, height, maxValue, 'downloadMbps');
  const uploadLine = buildPolyline(validPoints, width, height, maxValue, 'uploadMbps');
  const latest = validPoints.at(-1);

  return (
    <section className={styles.panel} aria-labelledby="traffic-chart-title">
      <div className={styles.panelHeader}>
        <div>
          <span className={styles.kicker}>Gráfico de tráfego</span>
          <h2 id="traffic-chart-title">Download e upload</h2>
        </div>
        <div className={styles.segmentedControl} role="tablist" aria-label="Período do gráfico">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={period === option.value ? styles.segmentedActive : ''}
              onClick={() => onPeriodChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {!availability?.available && (
        <div className={styles.infoBanner}>
          {availability?.message || 'Integração de tráfego ainda não configurada.'}
        </div>
      )}

      <div className={styles.chartWrap}>
        <svg className={styles.chart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Tráfego atual do cliente">
          <defs>
            <linearGradient id="downloadGradient" x1="0" x2="1">
              <stop offset="0%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
            <linearGradient id="uploadGradient" x1="0" x2="1">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <line
              key={ratio}
              x1="0"
              x2={width}
              y1={height * ratio}
              y2={height * ratio}
              className={styles.chartGridLine}
            />
          ))}
          {downloadLine && <polyline points={downloadLine} className={styles.downloadLine} />}
          {uploadLine && <polyline points={uploadLine} className={styles.uploadLine} />}
          {!validPoints.length && (
            <text x={width / 2} y={height / 2} textAnchor="middle" className={styles.chartEmptyText}>
              Sem amostras de tráfego
            </text>
          )}
        </svg>

        <div className={styles.chartLegend}>
          <span className={styles.downloadLegend}>Download</span>
          <span className={styles.uploadLegend}>Upload</span>
          <span><Clock3 size={14} /> {paused ? 'Atualização pausada' : 'Atualização ativa'}</span>
        </div>

        {latest && (
          <div className={styles.chartTooltip}>
            <strong>{formatDateTime(latest.at)}</strong>
            <span>Download {formatMbps(latest.downloadMbps)}</span>
            <span>Upload {formatMbps(latest.uploadMbps)}</span>
          </div>
        )}
      </div>
    </section>
  );
}
