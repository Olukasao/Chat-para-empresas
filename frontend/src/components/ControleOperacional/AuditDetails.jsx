import { X } from "lucide-react";
import {
  extrairMudancas,
  formatarDataHora,
  rotuloAcao,
  rotuloNivel,
  rotuloTipo,
  valorCurto,
} from "./auditFormatters";
import styles from "../../styles/ControleOperacional.module.css";

const JsonBlock = ({ title, value }) => {
  if (!value) return null;

  return (
    <div className={styles.jsonBlock}>
      <strong>{title}</strong>
      <pre>{typeof value === "string" ? value : JSON.stringify(value, null, 2)}</pre>
    </div>
  );
};

export default function AuditDetails({ evento, timeline, onClose }) {
  if (!evento && !timeline) {
    return (
      <aside className={styles.detailPanel}>
        <div className={styles.detailEmpty}>
          <strong>Selecione um evento</strong>
          <span>Os detalhes de auditoria aparecem aqui.</span>
        </div>
      </aside>
    );
  }

  const mudancas = evento ? extrairMudancas(evento) : [];

  return (
    <aside className={styles.detailPanel}>
      <header className={styles.detailHeader}>
        <div>
          <span>Detalhes</span>
          <h2>{timeline ? `${timeline.entidade || "Histórico"} #${timeline.id}` : rotuloAcao(evento.acao)}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar detalhes">
          <X size={18} />
        </button>
      </header>

      {evento && (
        <div className={styles.detailBody}>
          <dl className={styles.detailGrid}>
            <div>
              <dt>Quando</dt>
              <dd>{formatarDataHora(evento.created_at)}</dd>
            </div>
            <div>
              <dt>Usuário</dt>
              <dd>{evento.usuario_nome || evento.origem || "-"}</dd>
            </div>
            <div>
              <dt>Tipo</dt>
              <dd>{rotuloTipo(evento.tipo)}</dd>
            </div>
            <div>
              <dt>Nível</dt>
              <dd>{rotuloNivel(evento.nivel)}</dd>
            </div>
            <div>
              <dt>Entidade</dt>
              <dd>{evento.entidade}{evento.entidade_id ? ` #${evento.entidade_id}` : ""}</dd>
            </div>
            <div>
              <dt>Event ID</dt>
              <dd>{evento.event_id}</dd>
            </div>
          </dl>

          {mudancas.length > 0 && (
            <div className={styles.diffBlock}>
              <strong>Mudanças detectadas</strong>
              {mudancas.map((mudanca) => (
                <div key={mudanca.campo}>
                  <span>{mudanca.campo}</span>
                  <code>{valorCurto(mudanca.anterior)}</code>
                  <em>→</em>
                  <code>{valorCurto(mudanca.novo)}</code>
                </div>
              ))}
            </div>
          )}

          <JsonBlock title="Valor anterior" value={evento.valor_anterior} />
          <JsonBlock title="Valor novo" value={evento.valor_novo} />
          <JsonBlock title="Metadata" value={evento.metadata} />
        </div>
      )}

      {timeline && (
        <div className={styles.entityTimeline}>
          <strong>Timeline relacionada</strong>
          {(timeline.timeline || timeline.data || []).length > 0 ? (
            (timeline.timeline || timeline.data || []).map((item) => (
              <button type="button" key={item.id}>
                <span>{formatarDataHora(item.created_at)}</span>
                <strong>{rotuloAcao(item.acao)}</strong>
                <small>{item.usuario_nome || item.origem}</small>
              </button>
            ))
          ) : (
            <p>Histórico disponível a partir de 12/08/2026.</p>
          )}

          {timeline.mensagens?.length > 0 && (
            <div className={styles.relatedMessages}>
              <strong>Mensagens relacionadas</strong>
              {timeline.mensagens.map((mensagem) => (
                <span key={mensagem.id}>
                  {mensagem.remetente_nome} · {mensagem.previa}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
