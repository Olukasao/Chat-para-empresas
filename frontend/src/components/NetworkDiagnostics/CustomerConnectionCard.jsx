import { Network, Router, UserRound } from 'lucide-react';
import styles from '../../styles/NetworkDiagnostics.module.css';
import {
  formatDurationSeconds,
  getStatusLabel,
} from './formatters';
import StatusBadge from './StatusBadge';

export default function CustomerConnectionCard({ diagnostic }) {
  const customer = diagnostic?.customer || {};
  const connection = diagnostic?.connection || {};
  const status = connection.status || customer.status || 'unknown';

  return (
    <section className={styles.panel} aria-labelledby="connection-card-title">
      <div className={styles.customerHero}>
        <div className={styles.customerAvatar} aria-hidden="true">
          <UserRound size={24} />
        </div>
        <div>
          <span className={styles.kicker}>Cliente</span>
          <h2 id="connection-card-title">{customer.name || 'Selecione um cliente'}</h2>
          <StatusBadge status={status} label={getStatusLabel(status)} />
        </div>
      </div>

      <dl className={styles.definitionGrid}>
        <div>
          <dt>Contrato</dt>
          <dd>{customer.contractId || '-'}</dd>
        </div>
        <div>
          <dt>Plano</dt>
          <dd>{customer.planName || '-'}</dd>
        </div>
        <div>
          <dt>Login PPPoE</dt>
          <dd>{connection.pppoeUsername || customer.pppoeUsername || '-'}</dd>
        </div>
        <div>
          <dt>IP atual</dt>
          <dd>{connection.ip || customer.ip || '-'}</dd>
        </div>
        <div>
          <dt>POP</dt>
          <dd>{connection.popName || customer.popName || '-'}</dd>
        </div>
        <div>
          <dt>Conectado há</dt>
          <dd>{formatDurationSeconds(connection.sessionUptimeSeconds || customer.sessionUptimeSeconds)}</dd>
        </div>
      </dl>

      <div className={styles.equipmentLine}>
        <span><Network size={15} /> {connection.interface || 'Concentrador não informado'}</span>
        <span><Router size={15} /> {customer.onuIdentifier || customer.macOnu || 'ONU/roteador sem informação'}</span>
      </div>
    </section>
  );
}
