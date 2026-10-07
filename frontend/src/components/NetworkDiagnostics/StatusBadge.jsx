import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Loader2,
  WifiOff,
} from 'lucide-react';
import styles from '../../styles/NetworkDiagnostics.module.css';
import { getStatusLabel } from './formatters';

const STATUS_META = {
  online: { className: 'statusOnline', icon: CheckCircle2 },
  offline: { className: 'statusOffline', icon: WifiOff },
  unstable: { className: 'statusUnstable', icon: AlertTriangle },
  running: { className: 'statusRunning', icon: Loader2 },
  queued: { className: 'statusRunning', icon: Activity },
  unknown: { className: 'statusUnknown', icon: CircleHelp },
  partial: { className: 'statusUnknown', icon: AlertTriangle },
};

export default function StatusBadge({ status, label }) {
  const meta = STATUS_META[status] || STATUS_META.unknown;
  const Icon = meta.icon;

  return (
    <span className={`${styles.statusBadge} ${styles[meta.className]}`}>
      <Icon size={15} className={status === 'running' ? styles.spin : ''} />
      {label || getStatusLabel(status)}
    </span>
  );
}
