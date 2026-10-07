import { Loader2, Search, UserRoundCheck } from 'lucide-react';
import styles from '../../styles/NetworkDiagnostics.module.css';
import StatusBadge from './StatusBadge';

export default function CustomerSearch({
  query,
  onQueryChange,
  customers,
  loading,
  error,
  selectedCustomerId,
  onSelect,
  integrationMessage,
}) {
  return (
    <section className={styles.panel} aria-labelledby="customer-search-title">
      <div className={styles.panelHeader}>
        <div>
          <span className={styles.kicker}>Pesquisa</span>
          <h2 id="customer-search-title">Cliente</h2>
        </div>
        {loading && (
          <span className={styles.inlineLoading}>
            <Loader2 size={16} className={styles.spin} />
            Pesquisando
          </span>
        )}
      </div>

      <label className={styles.searchField}>
        <Search size={18} />
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Nome, CPF/CNPJ, contrato, PPPoE, IP, MAC ou telefone"
          autoComplete="off"
        />
      </label>

      {error && <div className={styles.errorBanner}>{error}</div>}
      {!error && integrationMessage && <div className={styles.infoBanner}>{integrationMessage}</div>}

      <div className={styles.customerResults}>
        {customers.map((customer) => (
          <button
            type="button"
            key={customer.id}
            className={`${styles.customerResult} ${selectedCustomerId === customer.id ? styles.customerResultSelected : ''}`}
            onClick={() => onSelect(customer)}
          >
            <span className={styles.customerResultIcon}>
              <UserRoundCheck size={18} />
            </span>
            <span className={styles.customerResultCopy}>
              <strong>{customer.name}</strong>
              <small>
                Cliente {customer.customerId || '-'} · Contrato {customer.contractId || '-'} · {customer.city || '-'}
              </small>
              <em>{customer.planName || 'Plano não informado'} · PPPoE {customer.pppoeUsername || '-'}</em>
            </span>
            <StatusBadge status={customer.status || 'unknown'} />
          </button>
        ))}
      </div>
    </section>
  );
}
