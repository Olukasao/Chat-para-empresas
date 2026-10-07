import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Search } from 'lucide-react';
import styles from '../../styles/NetworkDiagnostics.module.css';
import {
  formatDateTime,
  formatMbps,
  formatMs,
  formatPercent,
} from './formatters';
import StatusBadge from './StatusBadge';

export default function DiagnosticHistory({
  filters,
  onFiltersChange,
  rows,
  page,
  total,
  limit,
  loading,
  canHistory,
  onRefresh,
  onPageChange,
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (!canHistory) {
    return (
      <section className={styles.panel} aria-labelledby="history-title">
        <div className={styles.panelHeader}>
          <div>
            <span className={styles.kicker}>Histórico</span>
            <h2 id="history-title">Histórico de diagnósticos</h2>
          </div>
        </div>
        <div className={styles.infoBanner}>Você não possui permissão para consultar o histórico.</div>
      </section>
    );
  }

  return (
    <section className={styles.panel} aria-labelledby="history-title">
      <div className={styles.panelHeader}>
        <div>
          <span className={styles.kicker}>Histórico</span>
          <h2 id="history-title">Histórico de diagnósticos</h2>
        </div>
        <button type="button" className={styles.secondaryButton} onClick={onRefresh} disabled={loading}>
          {loading ? <Loader2 size={16} className={styles.spin} /> : <RefreshCw size={16} />}
          Atualizar
        </button>
      </div>

      <div className={styles.historyFilters}>
        <label>
          <Search size={15} />
          <input
            type="search"
            value={filters.customer}
            onChange={(event) => onFiltersChange({ ...filters, customer: event.target.value })}
            placeholder="Cliente, contrato ou PPPoE"
          />
        </label>
        <input
          type="text"
          value={filters.user}
          onChange={(event) => onFiltersChange({ ...filters, user: event.target.value })}
          placeholder="Usuário"
        />
        <input
          type="text"
          value={filters.pop}
          onChange={(event) => onFiltersChange({ ...filters, pop: event.target.value })}
          placeholder="POP"
        />
        <select
          value={filters.status}
          onChange={(event) => onFiltersChange({ ...filters, status: event.target.value })}
        >
          <option value="">Todos os status</option>
          <option value="completed">Concluído</option>
          <option value="failed">Falhou</option>
          <option value="cancelled">Cancelado</option>
          <option value="running">Em execução</option>
        </select>
        <input
          type="date"
          value={filters.date_from}
          onChange={(event) => onFiltersChange({ ...filters, date_from: event.target.value })}
        />
        <input
          type="date"
          value={filters.date_to}
          onChange={(event) => onFiltersChange({ ...filters, date_to: event.target.value })}
        />
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.historyTable}>
          <thead>
            <tr>
              <th>Data</th>
              <th>Cliente</th>
              <th>Usuário</th>
              <th>Resultado</th>
              <th>Qualidade</th>
              <th>Consumo observado</th>
              <th>Capacidade</th>
              <th>Fonte</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.runId}>
                <td>
                  <strong>{formatDateTime(row.createdAt)}</strong>
                  <small>{row.durationMs ? `${row.durationMs} ms` : '-'}</small>
                </td>
                <td>
                  <strong>{row.customerName || '-'}</strong>
                  <small>{row.contractId || row.customerId || '-'}</small>
                </td>
                <td>{row.requestedByUserName || '-'}</td>
                <td>
                  <StatusBadge status={row.status === 'completed' ? row.resultStatus || 'partial' : row.status} label={row.conclusionTitle || row.status} />
                  {row.errorMessage && <small className={styles.errorText}>{row.errorMessage}</small>}
                </td>
                <td>
                  <span>{formatMs(row.pingMs)}</span>
                  <small>Perda {formatPercent(row.packetLossPercent)}</small>
                </td>
                <td>
                  <span>{formatMbps(row.downloadCurrentMbps)}</span>
                  <small>Up {formatMbps(row.uploadCurrentMbps)}</small>
                </td>
                <td>
                  <span>{formatMbps(row.downloadTestMbps)}</span>
                  <small>Up {formatMbps(row.uploadTestMbps)}</small>
                </td>
                <td>{row.diagnosticSource || '-'}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan="8" className={styles.emptyTableCell}>
                  {loading ? 'Carregando histórico...' : 'Nenhum diagnóstico encontrado.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination}>
        <button type="button" className={styles.iconButton} onClick={() => onPageChange(page - 1)} disabled={page <= 1 || loading} title="Página anterior">
          <ChevronLeft size={18} />
        </button>
        <span>Página {page} de {totalPages}</span>
        <button type="button" className={styles.iconButton} onClick={() => onPageChange(page + 1)} disabled={page >= totalPages || loading} title="Próxima página">
          <ChevronRight size={18} />
        </button>
      </div>
    </section>
  );
}
