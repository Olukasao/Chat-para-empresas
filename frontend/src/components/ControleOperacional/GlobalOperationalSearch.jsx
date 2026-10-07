import { Loader2, Search } from "lucide-react";
import { formatarDataHora, rotuloAcao } from "./auditFormatters";
import styles from "../../styles/ControleOperacional.module.css";

export default function GlobalOperationalSearch({
  value,
  onChange,
  loading,
  results,
  onSelectEvent,
  onOpenEntity,
}) {
  const temResultados = Boolean(
    results?.audit_logs?.length
    || results?.mensagens?.length
    || results?.usuarios?.length
  );

  return (
    <section className={styles.globalSearch} aria-label="Pesquisa global operacional">
      <label>
        <Search size={20} />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Buscar chamado, instalação, técnico, usuário ou mensagem..."
        />
        {loading && <Loader2 className={styles.spin} size={18} />}
      </label>

      {value.trim().length >= 2 && (
        <div className={styles.searchResults}>
          {loading ? (
            <span>Pesquisando...</span>
          ) : temResultados ? (
            <>
              {results.audit_logs?.length > 0 && (
                <div className={styles.searchGroup}>
                  <strong>Eventos</strong>
                  {results.audit_logs.slice(0, 6).map((evento) => (
                    <button type="button" key={evento.id} onClick={() => onSelectEvent(evento)}>
                      <span>{rotuloAcao(evento.acao)} {evento.entidade_id ? `#${evento.entidade_id}` : ""}</span>
                      <small>{evento.usuario_nome || evento.origem} · {formatarDataHora(evento.created_at)}</small>
                    </button>
                  ))}
                </div>
              )}

              {results.mensagens?.length > 0 && (
                <div className={styles.searchGroup}>
                  <strong>Mensagens</strong>
                  {results.mensagens.slice(0, 5).map((mensagem) => (
                    <button type="button" key={mensagem.id} onClick={() => onOpenEntity("mensagem", mensagem.id)}>
                      <span>{mensagem.previa}</span>
                      <small>{mensagem.remetente_nome} · {mensagem.grupo_nome || "Direta"}</small>
                    </button>
                  ))}
                </div>
              )}

              {results.usuarios?.length > 0 && (
                <div className={styles.searchGroup}>
                  <strong>Usuários</strong>
                  {results.usuarios.slice(0, 5).map((usuario) => (
                    <button type="button" key={usuario.id} onClick={() => onOpenEntity("usuario", usuario.id)}>
                      <span>{usuario.nome}</span>
                      <small>{usuario.email} · {usuario.perfil}</small>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <span>Nenhum resultado encontrado.</span>
          )}
        </div>
      )}
    </section>
  );
}
