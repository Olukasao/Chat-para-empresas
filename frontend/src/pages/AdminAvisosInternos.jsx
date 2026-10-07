import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Eye, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import AvisosInternosContent from "../components/AvisosInternosContent";
import logoAcessa from "../assets/logo.png";
import api from "../services/api";
import {
  DEFAULT_AVISOS_CONTENT,
  createAvisosId,
  normalizeAvisosContent,
} from "../utils/avisosInternos";
import {
  META_COMERCIAL_DASHBOARD_KEY,
  META_COMERCIAL_DASHBOARD_SOCKET_URL,
  calcularProgressoMetaComercial,
  formatarPercentualMetaComercial,
} from "../utils/metaComercial";
import adminStyles from "../styles/Admin.module.css";
import "../styles/AvisosInternos.css";
import "../styles/AdminAvisosInternos.css";

const META_COMERCIAL_REFRESH_INTERVAL_MS = 3 * 60 * 1000;

const novoResumo = () => ({
  id: createAvisosId("resumo"),
  icone: "✨",
  valor: "Novo",
  rotulo: "Descrição do card",
});

const novoComunicado = () => ({
  id: createAvisosId("comunicado"),
  icone: "📢",
  tipo: "Aviso",
  data: "Hoje",
  titulo: "Novo comunicado",
  descricao: "Escreva aqui a mensagem para a equipe.",
  status: "Ativo",
});

const novoTutorial = () => ({
  id: createAvisosId("tutorial"),
  icone: "📚",
  titulo: "Novo tutorial",
  descricao: "Resumo rápido do conteúdo.",
  categoria: "Treinamento",
});

export default function AdminAvisosInternos() {
  const navigate = useNavigate();
  const [conteudo, setConteudo] = useState(() => normalizeAvisosContent());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [feedback, setFeedback] = useState("");
  const [showPreview, setShowPreview] = useState(true);
  const [atualizadoEm, setAtualizadoEm] = useState(null);
  const [totalVendasMetaComercial, setTotalVendasMetaComercial] = useState(null);
  const [resetandoMeta, setResetandoMeta] = useState(false);

  const token = useMemo(() => localStorage.getItem("token"), []);
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);

  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
  }), [token]);

  const previewConteudo = useMemo(() => {
    const data = normalizeAvisosContent(conteudo);

    if (totalVendasMetaComercial === null) {
      return data;
    }

    const vendasBaseReset = Number(data.meta?.vendas_reset_base || 0);
    const vendasAposReset = Math.max(0, totalVendasMetaComercial - vendasBaseReset);

    return normalizeAvisosContent({
      ...data,
      meta: {
        ...data.meta,
        progresso: calcularProgressoMetaComercial(vendasAposReset),
      },
    });
  }, [conteudo, totalVendasMetaComercial]);

  const atualizarConteudo = (updater) => {
    setFeedback("");
    setConteudo((atual) => updater(normalizeAvisosContent(atual)));
  };

  const carregarConteudo = useCallback(async () => {
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    try {
      setErro("");
      setLoading(true);
      const { data } = await api.get("/admin/avisos-internos", { headers });
      setConteudo(normalizeAvisosContent(data));
      setAtualizadoEm(data.atualizado_em || null);
    } catch (err) {
      console.error("Erro ao carregar editor de avisos:", err);
      if (err.response?.status === 403) {
        setErro("Seu usuário não tem permissão de administrador.");
      } else {
        setErro("Não foi possível carregar o painel de avisos internos.");
      }
    } finally {
      setLoading(false);
    }
  }, [headers, navigate, token]);

  useEffect(() => {
    carregarConteudo();
  }, [carregarConteudo]);

  useEffect(() => {
    const dashboardSocket = io(META_COMERCIAL_DASHBOARD_SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      timeout: 5000,
      autoConnect: false,
    });

    const atualizarTotalVendas = (data = {}) => {
      const gruposDashboard = data.grupos || {};
      const totalVendas = Number(gruposDashboard[META_COMERCIAL_DASHBOARD_KEY] || 0);

      setTotalVendasMetaComercial(Number.isFinite(totalVendas) ? totalVendas : 0);
    };

    const solicitarAtualizacao = () => {
      if (dashboardSocket.connected) {
        dashboardSocket.emit("request_update");
        return;
      }

      dashboardSocket.connect();
    };

    dashboardSocket.on("connect", solicitarAtualizacao);
    dashboardSocket.on("update", atualizarTotalVendas);
    dashboardSocket.connect();

    const refreshInterval = window.setInterval(
      solicitarAtualizacao,
      META_COMERCIAL_REFRESH_INTERVAL_MS
    );

    return () => {
      window.clearInterval(refreshInterval);
      dashboardSocket.disconnect();
    };
  }, []);

  const alterarCampo = (campo, valor) => {
    atualizarConteudo((atual) => ({
      ...atual,
      [campo]: valor,
    }));
  };

  const alterarSecaoComunicados = (campo, valor) => {
    atualizarConteudo((atual) => ({
      ...atual,
      secao_comunicados: {
        ...atual.secao_comunicados,
        [campo]: valor,
      },
    }));
  };

  const alterarMeta = (campo, valor) => {
    atualizarConteudo((atual) => ({
      ...atual,
      meta: {
        ...atual.meta,
        [campo]: campo === "progresso" ? Number(valor) : valor,
      },
    }));
  };

  const alterarWiki = (campo, valor) => {
    atualizarConteudo((atual) => ({
      ...atual,
      wiki: {
        ...atual.wiki,
        [campo]: valor,
      },
    }));
  };

  const alterarItemLista = (lista, index, campo, valor) => {
    atualizarConteudo((atual) => ({
      ...atual,
      [lista]: atual[lista].map((item, itemIndex) => (
        itemIndex === index ? { ...item, [campo]: valor } : item
      )),
    }));
  };

  const removerItemLista = (lista, index) => {
    atualizarConteudo((atual) => ({
      ...atual,
      [lista]: atual[lista].filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const adicionarItemLista = (lista, novoItem) => {
    atualizarConteudo((atual) => ({
      ...atual,
      [lista]: [...atual[lista], novoItem],
    }));
  };

  const alterarTutorial = (index, campo, valor) => {
    atualizarConteudo((atual) => ({
      ...atual,
      wiki: {
        ...atual.wiki,
        itens: atual.wiki.itens.map((item, itemIndex) => (
          itemIndex === index ? { ...item, [campo]: valor } : item
        )),
      },
    }));
  };

  const adicionarTutorial = () => {
    atualizarConteudo((atual) => ({
      ...atual,
      wiki: {
        ...atual.wiki,
        itens: [...atual.wiki.itens, novoTutorial()],
      },
    }));
  };

  const removerTutorial = (index) => {
    atualizarConteudo((atual) => ({
      ...atual,
      wiki: {
        ...atual.wiki,
        itens: atual.wiki.itens.filter((_, itemIndex) => itemIndex !== index),
      },
    }));
  };

  const salvarConteudo = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setErro("");
      setFeedback("");

      const payload = normalizeAvisosContent(conteudo);
      const { data } = await api.put("/admin/avisos-internos", payload, { headers });

      setConteudo(normalizeAvisosContent(data));
      setAtualizadoEm(data.atualizado_em || new Date().toISOString());
      setFeedback("Avisos internos atualizados com sucesso.");
    } catch (err) {
      console.error("Erro ao salvar avisos internos:", err);
      setErro(err.response?.data?.error || "Não foi possível salvar os avisos internos.");
    } finally {
      setSaving(false);
    }
  };

  const resetarMetaComercial = async () => {
    if (totalVendasMetaComercial === null) {
      setErro("Ainda não foi possível ler o total de vendas do dashboard. Tente novamente em alguns segundos.");
      return;
    }

    const ok = window.confirm(
      "Resetar a meta comercial? O progresso ficará em 0% e passará a contar apenas as próximas vendas."
    );

    if (!ok) return;

    try {
      setResetandoMeta(true);
      setSaving(true);
      setErro("");
      setFeedback("");

      const payload = normalizeAvisosContent({
        ...conteudo,
        meta: {
          ...conteudo.meta,
          progresso: 0,
          vendas_reset_base: totalVendasMetaComercial,
        },
      });
      const { data } = await api.put("/admin/avisos-internos", payload, { headers });
      const conteudoResetado = normalizeAvisosContent({
        ...data,
        meta: {
          ...data.meta,
          progresso: 0,
          vendas_reset_base: totalVendasMetaComercial,
        },
      });

      setConteudo(conteudoResetado);
      setAtualizadoEm(data.atualizado_em || new Date().toISOString());
      setFeedback("Meta comercial resetada. A partir de agora, as próximas vendas sobem a meta em 0,4% cada.");
    } catch (err) {
      console.error("Erro ao resetar meta comercial:", err);
      setErro(err.response?.data?.error || "Não foi possível resetar a meta comercial.");
    } finally {
      setResetandoMeta(false);
      setSaving(false);
    }
  };

  const restaurarModelo = () => {
    const ok = window.confirm("Restaurar o modelo padrão? As alterações não salvas serão perdidas.");
    if (!ok) return;

    setConteudo(normalizeAvisosContent(DEFAULT_AVISOS_CONTENT));
    setFeedback("Modelo padrão carregado. Clique em salvar para publicar.");
  };

  const formatarData = (data) => {
    if (!data) return "Ainda não salvo";

    return new Date(data).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const vendasBaseMetaComercial = Number(conteudo.meta?.vendas_reset_base || 0);
  const vendasAposResetMetaComercial = totalVendasMetaComercial === null
    ? null
    : Math.max(0, totalVendasMetaComercial - vendasBaseMetaComercial);
  const progressoAtualMetaComercial = vendasAposResetMetaComercial === null
    ? conteudo.meta.progresso
    : calcularProgressoMetaComercial(vendasAposResetMetaComercial);

  if (loading) {
    return (
      <div className={adminStyles.page}>
        <div className={adminStyles.loading}>Carregando editor de avisos internos...</div>
      </div>
    );
  }

  return (
    <div className={adminStyles.page}>
      <header className={adminStyles.header}>
        <div>
          <p className={adminStyles.eyebrow}>Painel administrativo</p>
          <h1>Editar avisos internos</h1>
          <p className={adminStyles.subtitle}>
            {user.empresa_nome || "Empresa"} · Última atualização: {formatarData(atualizadoEm)}
          </p>
        </div>

        <div className={adminStyles.headerActions}>
          <button type="button" className={adminStyles.secondaryButton} onClick={() => navigate("/admin")}>
            <ArrowLeft size={16} />
            Admin
          </button>
          <button type="button" className={adminStyles.secondaryButton} onClick={() => navigate("/avisos-internos")}>
            <Eye size={16} />
            Ver página
          </button>
        </div>
      </header>

      {erro && <div className={adminStyles.errorBox}>{erro}</div>}
      {feedback && <div className="admin-avisos-success">{feedback}</div>}

      {!erro && (
        <form className="admin-avisos-layout" onSubmit={salvarConteudo}>
          <section className={adminStyles.section}>
            <div className={adminStyles.sectionHeader}>
              <div>
                <h2>Conteúdo da página</h2>
                <p>Preencha os campos. O sistema monta a página automaticamente.</p>
              </div>
              <div className={adminStyles.actionGroup}>
                <button type="button" className={adminStyles.secondaryButton} onClick={() => setShowPreview((value) => !value)}>
                  <Eye size={16} />
                  {showPreview ? "Ocultar preview" : "Mostrar preview"}
                </button>
                <button type="button" className={adminStyles.secondaryButton} onClick={restaurarModelo}>
                  <RotateCcw size={16} />
                  Modelo
                </button>
                <button type="submit" className={adminStyles.primaryButton} disabled={saving}>
                  <Save size={16} />
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>

            <div className="admin-avisos-fields">
              <section className="admin-avisos-form-block">
                <div className="admin-avisos-block-header">
                  <div>
                    <h3>Cabeçalho</h3>
                    <p>Texto principal que aparece no topo da página.</p>
                  </div>
                </div>

                <div className="admin-avisos-form-grid">
                  <label>
                    Chamada pequena
                    <input
                      type="text"
                      value={conteudo.kicker}
                      onChange={(event) => alterarCampo("kicker", event.target.value)}
                      maxLength="80"
                    />
                  </label>

                  <label>
                    Título
                    <input
                      type="text"
                      value={conteudo.titulo}
                      onChange={(event) => alterarCampo("titulo", event.target.value)}
                      maxLength="140"
                      required
                    />
                  </label>

                  <label className="admin-avisos-field-wide">
                    Subtítulo
                    <textarea
                      value={conteudo.subtitulo}
                      onChange={(event) => alterarCampo("subtitulo", event.target.value)}
                      maxLength="320"
                      rows="3"
                      required
                    />
                  </label>
                </div>
              </section>

              <section className="admin-avisos-form-block">
                <div className="admin-avisos-block-header">
                  <div>
                    <h3>Cards do topo</h3>
                    <p>Indicadores rápidos que aparecem abaixo do cabeçalho.</p>
                  </div>
                  <button
                    type="button"
                    className={adminStyles.smallSecondaryButton}
                    onClick={() => adicionarItemLista("resumo", novoResumo())}
                  >
                    <Plus size={15} />
                    Adicionar
                  </button>
                </div>

                <div className="admin-avisos-item-list">
                  {conteudo.resumo.map((item, index) => (
                    <article key={item.id} className="admin-avisos-item-card">
                      <div className="admin-avisos-item-header">
                        <strong>Card {index + 1}</strong>
                        <button
                          type="button"
                          className={adminStyles.smallDangerButton}
                          onClick={() => removerItemLista("resumo", index)}
                        >
                          <Trash2 size={14} />
                          Remover
                        </button>
                      </div>

                      <div className="admin-avisos-form-grid admin-avisos-form-grid-compact">
                        <label>
                          Ícone
                          <input
                            type="text"
                            value={item.icone}
                            onChange={(event) => alterarItemLista("resumo", index, "icone", event.target.value)}
                            maxLength="12"
                          />
                        </label>
                        <label>
                          Destaque
                          <input
                            type="text"
                            value={item.valor}
                            onChange={(event) => alterarItemLista("resumo", index, "valor", event.target.value)}
                            maxLength="80"
                          />
                        </label>
                        <label>
                          Legenda
                          <input
                            type="text"
                            value={item.rotulo}
                            onChange={(event) => alterarItemLista("resumo", index, "rotulo", event.target.value)}
                            maxLength="120"
                          />
                        </label>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="admin-avisos-form-block">
                <div className="admin-avisos-block-header">
                  <div>
                    <h3>Comunicados</h3>
                    <p>Avisos, demandas e metas exibidos na coluna principal.</p>
                  </div>
                  <button
                    type="button"
                    className={adminStyles.smallSecondaryButton}
                    onClick={() => adicionarItemLista("comunicados", novoComunicado())}
                  >
                    <Plus size={15} />
                    Adicionar
                  </button>
                </div>

                <div className="admin-avisos-form-grid">
                  <label>
                    Título da seção
                    <input
                      type="text"
                      value={conteudo.secao_comunicados.titulo}
                      onChange={(event) => alterarSecaoComunicados("titulo", event.target.value)}
                      maxLength="120"
                    />
                  </label>
                  <label>
                    Subtítulo da seção
                    <input
                      type="text"
                      value={conteudo.secao_comunicados.subtitulo}
                      onChange={(event) => alterarSecaoComunicados("subtitulo", event.target.value)}
                      maxLength="220"
                    />
                  </label>
                </div>

                <div className="admin-avisos-item-list">
                  {conteudo.comunicados.map((item, index) => (
                    <article key={item.id} className="admin-avisos-item-card">
                      <div className="admin-avisos-item-header">
                        <strong>Comunicado {index + 1}</strong>
                        <button
                          type="button"
                          className={adminStyles.smallDangerButton}
                          onClick={() => removerItemLista("comunicados", index)}
                        >
                          <Trash2 size={14} />
                          Remover
                        </button>
                      </div>

                      <div className="admin-avisos-form-grid">
                        <label>
                          Ícone
                          <input
                            type="text"
                            value={item.icone}
                            onChange={(event) => alterarItemLista("comunicados", index, "icone", event.target.value)}
                            maxLength="12"
                          />
                        </label>
                        <label>
                          Tipo
                          <input
                            type="text"
                            value={item.tipo}
                            onChange={(event) => alterarItemLista("comunicados", index, "tipo", event.target.value)}
                            maxLength="80"
                          />
                        </label>
                        <label>
                          Data
                          <input
                            type="text"
                            value={item.data}
                            onChange={(event) => alterarItemLista("comunicados", index, "data", event.target.value)}
                            maxLength="80"
                          />
                        </label>
                        <label>
                          Status
                          <input
                            type="text"
                            value={item.status}
                            onChange={(event) => alterarItemLista("comunicados", index, "status", event.target.value)}
                            maxLength="80"
                          />
                        </label>
                        <label className="admin-avisos-field-wide">
                          Título
                          <input
                            type="text"
                            value={item.titulo}
                            onChange={(event) => alterarItemLista("comunicados", index, "titulo", event.target.value)}
                            maxLength="160"
                          />
                        </label>
                        <label className="admin-avisos-field-wide">
                          Mensagem
                          <textarea
                            value={item.descricao}
                            onChange={(event) => alterarItemLista("comunicados", index, "descricao", event.target.value)}
                            maxLength="500"
                            rows="3"
                          />
                        </label>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="admin-avisos-form-block">
                <div className="admin-avisos-block-header">
                  <div>
                    <h3>Meta comercial</h3>
                    <p>Card de destaque lateral com progresso.</p>
                  </div>
                </div>

                <div className="admin-avisos-goal-reset-card">
                  <div className="admin-avisos-goal-reset-info">
                    <span>Meta automática</span>
                    <strong>{formatarPercentualMetaComercial(progressoAtualMetaComercial)}</strong>
                    <p>
                      {totalVendasMetaComercial === null
                        ? "Aguardando total de vendas do dashboard."
                        : `${vendasAposResetMetaComercial} venda(s) contando para a meta. Total atual: ${totalVendasMetaComercial}.`}
                    </p>
                    <small>250 vendas = 100%. Cada venda sobe 0,4%.</small>
                  </div>
                  <button
                    type="button"
                    className={adminStyles.smallDangerButton}
                    onClick={resetarMetaComercial}
                    disabled={saving || resetandoMeta || totalVendasMetaComercial === null}
                  >
                    <RotateCcw size={14} />
                    {resetandoMeta ? "Resetando..." : "Resetar meta"}
                  </button>
                </div>

                <div className="admin-avisos-form-grid">
                  <label>
                    Selo
                    <input
                      type="text"
                      value={conteudo.meta.selo}
                      onChange={(event) => alterarMeta("selo", event.target.value)}
                      maxLength="80"
                    />
                  </label>
                  <label>
                    Título
                    <input
                      type="text"
                      value={conteudo.meta.titulo}
                      onChange={(event) => alterarMeta("titulo", event.target.value)}
                      maxLength="140"
                    />
                  </label>
                  <label>
                    Nome do progresso
                    <input
                      type="text"
                      value={conteudo.meta.progresso_label}
                      onChange={(event) => alterarMeta("progresso_label", event.target.value)}
                      maxLength="100"
                    />
                  </label>
                  <label>
                    Progresso (%)
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={conteudo.meta.progresso}
                      onChange={(event) => alterarMeta("progresso", event.target.value)}
                    />
                  </label>
                  <label className="admin-avisos-field-wide">
                    Texto
                    <textarea
                      value={conteudo.meta.texto}
                      onChange={(event) => alterarMeta("texto", event.target.value)}
                      maxLength="500"
                      rows="3"
                    />
                  </label>
                </div>
              </section>

              <section className="admin-avisos-form-block">
                <div className="admin-avisos-block-header">
                  <div>
                    <h3>Wiki e tutoriais</h3>
                    <p>Links ou orientações rápidas exibidas no card lateral.</p>
                  </div>
                  <button type="button" className={adminStyles.smallSecondaryButton} onClick={adicionarTutorial}>
                    <Plus size={15} />
                    Adicionar
                  </button>
                </div>

                <div className="admin-avisos-form-grid">
                  <label>
                    Título do card
                    <input
                      type="text"
                      value={conteudo.wiki.titulo}
                      onChange={(event) => alterarWiki("titulo", event.target.value)}
                      maxLength="120"
                    />
                  </label>
                  <label>
                    Subtítulo do card
                    <input
                      type="text"
                      value={conteudo.wiki.subtitulo}
                      onChange={(event) => alterarWiki("subtitulo", event.target.value)}
                      maxLength="220"
                    />
                  </label>
                </div>

                <div className="admin-avisos-item-list">
                  {conteudo.wiki.itens.map((item, index) => (
                    <article key={item.id} className="admin-avisos-item-card">
                      <div className="admin-avisos-item-header">
                        <strong>Tutorial {index + 1}</strong>
                        <button
                          type="button"
                          className={adminStyles.smallDangerButton}
                          onClick={() => removerTutorial(index)}
                        >
                          <Trash2 size={14} />
                          Remover
                        </button>
                      </div>

                      <div className="admin-avisos-form-grid">
                        <label>
                          Ícone
                          <input
                            type="text"
                            value={item.icone}
                            onChange={(event) => alterarTutorial(index, "icone", event.target.value)}
                            maxLength="12"
                          />
                        </label>
                        <label>
                          Categoria
                          <input
                            type="text"
                            value={item.categoria}
                            onChange={(event) => alterarTutorial(index, "categoria", event.target.value)}
                            maxLength="80"
                          />
                        </label>
                        <label className="admin-avisos-field-wide">
                          Título
                          <input
                            type="text"
                            value={item.titulo}
                            onChange={(event) => alterarTutorial(index, "titulo", event.target.value)}
                            maxLength="160"
                          />
                        </label>
                        <label className="admin-avisos-field-wide">
                          Descrição
                          <textarea
                            value={item.descricao}
                            onChange={(event) => alterarTutorial(index, "descricao", event.target.value)}
                            maxLength="400"
                            rows="3"
                          />
                        </label>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </section>

          {showPreview && (
            <aside className="admin-avisos-preview-panel">
              <div className="admin-avisos-preview-header">
                <strong>Preview</strong>
                <span>Visualização antes de publicar</span>
              </div>

              <AvisosInternosContent conteudo={previewConteudo} logoSrc={logoAcessa} preview />
            </aside>
          )}
        </form>
      )}
    </div>
  );
}
