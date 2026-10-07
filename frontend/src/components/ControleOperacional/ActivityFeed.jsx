import { Inbox, Loader2 } from "lucide-react";
import ActivityItem from "./ActivityItem";
import styles from "../../styles/ControleOperacional.module.css";

export default function ActivityFeed({
  eventos,
  loading,
  selectedId,
  pagination,
  onSelect,
  onOpenEntity,
  onPage,
}) {
  if (loading && eventos.length === 0) {
    return (
      <section className={styles.feedState}>
        <Loader2 className={styles.spin} size={26} />
        <strong>Carregando atividade operacional...</strong>
      </section>
    );
  }

  if (!loading && eventos.length === 0) {
    return (
      <section className={styles.feedState}>
        <Inbox size={30} />
        <strong>Nenhuma alteração encontrada neste período.</strong>
        <span>A auditoria começa a aparecer conforme ações auditadas forem realizadas.</span>
      </section>
    );
  }

  return (
    <section className={styles.feedSection} aria-label="Feed de atividade">
      <div className={styles.feedHeader}>
        <div>
          <h2>Atividade</h2>
          <p>{pagination.total || eventos.length} eventos encontrados</p>
        </div>
        {loading && <Loader2 className={styles.spin} size={18} />}
      </div>

      <div className={styles.feedList}>
        {eventos.map((evento) => (
          <ActivityItem
            key={evento.id}
            evento={evento}
            selected={Number(selectedId) === Number(evento.id)}
            onSelect={onSelect}
            onOpenEntity={onOpenEntity}
          />
        ))}
      </div>

      <div className={styles.pagination}>
        <button
          type="button"
          disabled={pagination.page <= 1 || loading}
          onClick={() => onPage(pagination.page - 1)}
        >
          Anterior
        </button>
        <span>Página {pagination.page} de {pagination.total_pages}</span>
        <button
          type="button"
          disabled={pagination.page >= pagination.total_pages || loading}
          onClick={() => onPage(pagination.page + 1)}
        >
          Próxima
        </button>
      </div>
    </section>
  );
}
