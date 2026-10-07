import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import styles from "../styles/Admin.module.css";

const filtrosIniciais = {
  search: "",
  remetente_id: "",
  destinatario_id: "",
  grupo_id: "",
  tipo_conversa: "",
  status: "",
  data_inicio: "",
  data_fim: "",
  limit: "25",
};

export default function AdminChatHistorico() {
  const navigate = useNavigate();
  const [filtros, setFiltros] = useState(filtrosIniciais);
  const [mensagens, setMensagens] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    total_pages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [detalhe, setDetalhe] = useState(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);

  const token = useMemo(() => localStorage.getItem("token"), []);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const formatarData = (data) => {
    if (!data) return "-";
    return new Date(data).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const carregarMensagens = useCallback(async (page = 1) => {
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    try {
      setErro("");
      setLoading(true);

      const params = { page };
      Object.entries(filtros).forEach(([key, value]) => {
        if (value) params[key] = value;
      });

      const { data } = await api.get("/admin/chat/messages", {
        headers,
        params,
      });

      setMensagens(data.data || []);
      setPagination(data.pagination || {
        page,
        limit: Number(filtros.limit) || 25,
        total: 0,
        total_pages: 1,
      });
    } catch (err) {
      console.error("Erro ao carregar histórico de mensagens:", err);
      if (err.response?.status === 403) {
        setErro("Seu usuário não tem permissão para acessar este histórico.");
      } else {
        setErro("Não foi possível carregar o histórico de mensagens.");
      }
    } finally {
      setLoading(false);
    }
  }, [filtros, headers, navigate, token]);

  useEffect(() => {
    carregarMensagens(1);
  }, [carregarMensagens]);

  const alterarFiltro = (campo, valor) => {
    setFiltros((atuais) => ({
      ...atuais,
      [campo]: valor,
    }));
  };

  const limparFiltros = () => {
    setFiltros(filtrosIniciais);
  };

  const abrirDetalhe = async (mensagemId) => {
    try {
      setCarregandoDetalhe(true);
      const { data } = await api.get(`/admin/chat/messages/${mensagemId}`, {
        headers,
      });
      setDetalhe(data);
    } catch (err) {
      console.error("Erro ao carregar detalhe da mensagem:", err);
      alert("Não foi possível carregar os detalhes da mensagem.");
    } finally {
      setCarregandoDetalhe(false);
    }
  };

  const renderBadgeConversa = (tipo) => (
    <span className={tipo === "grupo" ? styles.groupTag : styles.directTag}>
      {tipo === "grupo" ? "Grupo" : "Direta"}
    </span>
  );

  const renderBadgeStatus = (status) => (
    <span className={`${styles.statusBadge} ${styles[`status_${status}`] || ""}`}>
      {status || "enviada"}
    </span>
  );

  const renderPreview = (mensagem) => {
    if (mensagem.tipo_mensagem === "imagem") return "[Imagem]";
    if (mensagem.tipo_mensagem === "audio") return "[Áudio]";
    if (mensagem.tipo_mensagem === "arquivo") return "[Arquivo]";
    return mensagem.previa || mensagem.mensagem || "";
  };

  const parseAuditValue = (value) => {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };

  const mensagemDetalhe = detalhe?.mensagem;
  const auditoria = detalhe?.auditoria || [];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Admin</p>
          <h1>Histórico de Mensagens</h1>
          <p className={styles.subtitle}>
            Auditoria completa das mensagens diretas e dos grupos do chat interno.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button type="button" className={styles.secondaryButton} disabled>
            Exportar CSV
          </button>
          <button type="button" className={styles.secondaryButton} onClick={() => navigate("/admin")}>
            Voltar ao painel
          </button>
        </div>
      </header>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Filtros</h2>
            <p>Pesquise por conteúdo, pessoas, grupos, período, tipo e status.</p>
          </div>
          <button type="button" className={styles.smallSecondaryButton} onClick={limparFiltros}>
            Limpar filtros
          </button>
        </div>

        <div className={styles.historyFilters}>
          <label>
            Busca
            <input
              value={filtros.search}
              onChange={(event) => alterarFiltro("search", event.target.value)}
              placeholder="Texto, remetente ou grupo"
            />
          </label>

          <label>
            Remetente ID
            <input
              type="number"
              min="1"
              value={filtros.remetente_id}
              onChange={(event) => alterarFiltro("remetente_id", event.target.value)}
            />
          </label>

          <label>
            Destinatário ID
            <input
              type="number"
              min="1"
              value={filtros.destinatario_id}
              onChange={(event) => alterarFiltro("destinatario_id", event.target.value)}
            />
          </label>

          <label>
            Grupo ID
            <input
              type="number"
              min="1"
              value={filtros.grupo_id}
              onChange={(event) => alterarFiltro("grupo_id", event.target.value)}
            />
          </label>

          <label>
            Tipo
            <select
              value={filtros.tipo_conversa}
              onChange={(event) => alterarFiltro("tipo_conversa", event.target.value)}
            >
              <option value="">Todos</option>
              <option value="direta">Direta</option>
              <option value="grupo">Grupo</option>
            </select>
          </label>

          <label>
            Status
            <select
              value={filtros.status}
              onChange={(event) => alterarFiltro("status", event.target.value)}
            >
              <option value="">Todos</option>
              <option value="enviada">Enviada</option>
              <option value="editada">Editada</option>
              <option value="apagada">Apagada</option>
              <option value="fixada">Fixada</option>
              <option value="favoritada">Favoritada</option>
            </select>
          </label>

          <label>
            Início
            <input
              type="datetime-local"
              value={filtros.data_inicio}
              onChange={(event) => alterarFiltro("data_inicio", event.target.value)}
            />
          </label>

          <label>
            Fim
            <input
              type="datetime-local"
              value={filtros.data_fim}
              onChange={(event) => alterarFiltro("data_fim", event.target.value)}
            />
          </label>

          <label>
            Por página
            <select
              value={filtros.limit}
              onChange={(event) => alterarFiltro("limit", event.target.value)}
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </label>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Mensagens</h2>
            <p>{pagination.total} registro(s) encontrado(s).</p>
          </div>
        </div>

        {erro ? (
          <div className={styles.errorBox}>{erro}</div>
        ) : loading ? (
          <div className={styles.loading}>Carregando histórico...</div>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Data/Hora</th>
                    <th>Tipo</th>
                    <th>Remetente</th>
                    <th>Destino</th>
                    <th>Prévia</th>
                    <th>Mensagem</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {mensagens.length === 0 ? (
                    <tr>
                      <td colSpan="8" className={styles.emptyCell}>
                        Nenhuma mensagem encontrada.
                      </td>
                    </tr>
                  ) : (
                    mensagens.map((mensagem) => (
                      <tr
                        key={`${mensagem.tipo_conversa}-${mensagem.id}`}
                        className={mensagem.status === "apagada" ? styles.deletedRow : ""}
                      >
                        <td>{formatarData(mensagem.criada_em)}</td>
                        <td>{renderBadgeConversa(mensagem.tipo_conversa)}</td>
                        <td>
                          <strong>{mensagem.remetente_nome}</strong>
                          <span>#{mensagem.remetente_id}</span>
                        </td>
                        <td>
                          {mensagem.tipo_conversa === "grupo" ? (
                            <>
                              <strong>{mensagem.grupo_nome}</strong>
                              <span>Grupo #{mensagem.grupo_id}</span>
                            </>
                          ) : (
                            <>
                              <strong>{mensagem.destinatario_nome}</strong>
                              <span>Usuário #{mensagem.destinatario_id}</span>
                            </>
                          )}
                        </td>
                        <td className={styles.messageCell}>{renderPreview(mensagem)}</td>
                        <td>{mensagem.tipo_mensagem || "texto"}</td>
                        <td>{renderBadgeStatus(mensagem.status)}</td>
                        <td>
                          <button
                            type="button"
                            className={styles.smallSecondaryButton}
                            onClick={() => abrirDetalhe(mensagem.id)}
                            disabled={carregandoDetalhe}
                          >
                            Detalhes
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className={styles.paginationBar}>
              <button
                type="button"
                className={styles.smallSecondaryButton}
                disabled={pagination.page <= 1}
                onClick={() => carregarMensagens(pagination.page - 1)}
              >
                Anterior
              </button>
              <span>
                Página {pagination.page} de {pagination.total_pages}
              </span>
              <button
                type="button"
                className={styles.smallSecondaryButton}
                disabled={pagination.page >= pagination.total_pages}
                onClick={() => carregarMensagens(pagination.page + 1)}
              >
                Próxima
              </button>
            </div>
          </>
        )}
      </section>

      {mensagemDetalhe && (
        <div className={styles.sidePanelOverlay} onClick={() => setDetalhe(null)}>
          <aside className={styles.sidePanel} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Mensagem #{mensagemDetalhe.id}</h2>
                <p>{renderBadgeConversa(mensagemDetalhe.tipo_conversa)} {renderBadgeStatus(mensagemDetalhe.status)}</p>
              </div>
              <button type="button" className={styles.modalClose} onClick={() => setDetalhe(null)}>
                ×
              </button>
            </div>

            <div className={styles.detailBody}>
              <div className={styles.detailBlock}>
                <h3>Conteúdo</h3>
                {mensagemDetalhe.tipo_mensagem === "imagem" ? (
                  <div className={styles.detailImage}>
                    <img src={mensagemDetalhe.mensagem} alt={mensagemDetalhe.anexo_nome || "Imagem enviada"} />
                    <span>{mensagemDetalhe.anexo_nome || "Imagem"}</span>
                  </div>
                ) : mensagemDetalhe.tipo_mensagem === "audio" ? (
                  <div className={styles.detailAudio}>
                    <audio controls src={mensagemDetalhe.mensagem} preload="metadata">
                      Seu navegador não suporta áudio.
                    </audio>
                    <span>{mensagemDetalhe.anexo_nome || "Áudio"}</span>
                  </div>
                ) : mensagemDetalhe.tipo_mensagem === "arquivo" ? (
                  <div className={styles.detailAudio}>
                    <a href={mensagemDetalhe.mensagem} download={mensagemDetalhe.anexo_nome || "arquivo"}>
                      {mensagemDetalhe.anexo_nome || "Arquivo anexado"}
                    </a>
                    <span>{mensagemDetalhe.anexo_mime || "Documento"}</span>
                  </div>
                ) : (
                  <p className={styles.fullMessage}>{mensagemDetalhe.mensagem}</p>
                )}
              </div>

              <div className={styles.detailGrid}>
                <div><span>Remetente</span><strong>{mensagemDetalhe.remetente_nome}</strong></div>
                <div><span>Destino</span><strong>{mensagemDetalhe.grupo_nome || mensagemDetalhe.destinatario_nome || "-"}</strong></div>
                <div><span>Enviada em</span><strong>{formatarData(mensagemDetalhe.criada_em)}</strong></div>
                <div><span>Editada em</span><strong>{formatarData(mensagemDetalhe.editada_em)}</strong></div>
                <div><span>Apagada em</span><strong>{formatarData(mensagemDetalhe.deletada_em)}</strong></div>
                <div><span>Apagada por</span><strong>{mensagemDetalhe.apagada_por_nome || "-"}</strong></div>
                <div><span>Tipo da mensagem</span><strong>{mensagemDetalhe.tipo_mensagem || "texto"}</strong></div>
                <div><span>Reações</span><strong>-</strong></div>
              </div>

              <div className={styles.detailBlock}>
                <h3>Histórico de alterações</h3>
                {auditoria.length === 0 ? (
                  <p className={styles.mutedText}>Sem registros de auditoria para esta mensagem.</p>
                ) : (
                  <div className={styles.auditList}>
                    {auditoria.map((item) => (
                      <div key={item.id} className={styles.auditItem}>
                        <strong>{item.acao}</strong>
                        <span>{formatarData(item.criada_em)} · {item.usuario_nome || "Sistema"}</span>
                        {(item.valor_antigo || item.valor_novo) && (
                          <pre>{JSON.stringify({
                            valor_antigo: parseAuditValue(item.valor_antigo),
                            valor_novo: parseAuditValue(item.valor_novo),
                          }, null, 2)}</pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
