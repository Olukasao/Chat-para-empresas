import { AlertTriangle, ChevronRight, MessageSquare, ShieldAlert } from "lucide-react";
import {
  descreverEvento,
  extrairMudancas,
  formatarHora,
  rotuloAcao,
  rotuloNivel,
  rotuloTipo,
  valorCurto,
} from "./auditFormatters";
import styles from "../../styles/ControleOperacional.module.css";

export default function ActivityItem({ evento, selected, onSelect, onOpenEntity }) {
  const mudancas = extrairMudancas(evento);
  const critico = evento.nivel === "critical";

  return (
    <article className={`${styles.activityItem} ${selected ? styles.activitySelected : ""}`}>
      <button type="button" className={styles.activityMain} onClick={() => onSelect(evento)}>
        <time>{formatarHora(evento.created_at)}</time>
        <span className={`${styles.activityDot} ${styles[`level_${evento.nivel}`] || ""}`} />
        <span className={styles.activityContent}>
          <span className={styles.activityTopline}>
            <strong>{evento.usuario_nome || evento.origem || "Sistema"}</strong>
            <em>{rotuloTipo(evento.tipo)}</em>
            <em className={styles[`badge_${evento.nivel}`]}>
              {critico ? <ShieldAlert size={13} /> : null}
              {rotuloNivel(evento.nivel)}
            </em>
          </span>
          <span className={styles.activityText}>{descreverEvento(evento)}</span>
          {mudancas.length > 0 && (
            <span className={styles.changeList}>
              {mudancas.slice(0, 3).map((mudanca) => (
                <span key={mudanca.campo}>
                  {mudanca.campo}: {valorCurto(mudanca.anterior)} → {valorCurto(mudanca.novo)}
                </span>
              ))}
            </span>
          )}
        </span>
        <ChevronRight size={18} />
      </button>

      <div className={styles.activityFooter}>
        <span>{rotuloAcao(evento.acao)}</span>
        <span>{evento.entidade}{evento.entidade_id ? ` #${evento.entidade_id}` : ""}</span>
        {evento.entidade === "mensagem" && <MessageSquare size={14} />}
        {critico && <AlertTriangle size={14} />}
        {["chamado", "instalacao"].includes(evento.entidade) && evento.entidade_id && (
          <button type="button" onClick={() => onOpenEntity(evento.entidade, evento.entidade_id)}>
            Ver histórico
          </button>
        )}
      </div>
    </article>
  );
}
