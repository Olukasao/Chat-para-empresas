import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import AvisosInternosContent from "../components/AvisosInternosContent";
import logoAcessa from "../assets/logo.png";
import api from "../services/api";
import { markAvisosInternosAsSeen, normalizeAvisosContent } from "../utils/avisosInternos";
import { useInternalBack } from "../utils/internalNavigation";
import {
  META_COMERCIAL_DASHBOARD_KEY,
  META_COMERCIAL_DASHBOARD_SOCKET_URL,
  calcularProgressoMetaComercial,
} from "../utils/metaComercial";
import { podeEditarAvisosInternos } from "../utils/perfis";
import "../styles/AvisosInternos.css";

const META_COMERCIAL_REFRESH_INTERVAL_MS = 3 * 60 * 1000;

export default function AvisosInternos() {
  const navigate = useNavigate();
  const voltarPaginaInterna = useInternalBack("/chat");
  const [conteudo, setConteudo] = useState(() => normalizeAvisosContent());
  const [totalVendasMetaComercial, setTotalVendasMetaComercial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resetandoMeta, setResetandoMeta] = useState(false);
  const [erro, setErro] = useState("");
  const [feedback, setFeedback] = useState("");

  const token = useMemo(() => localStorage.getItem("token"), []);
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);

  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
  }), [token]);
  const podeEditar = podeEditarAvisosInternos(user);

  useEffect(() => {
    if (!token) return undefined;

    let ativo = true;

    api.get("/me", { headers })
      .then(({ data }) => {
        if (!ativo) return;
        setUser(data);
        localStorage.setItem("user", JSON.stringify(data));
      })
      .catch((err) => {
        console.error("Erro ao atualizar perfil atual:", err);
      });

    return () => {
      ativo = false;
    };
  }, [headers, token]);

  const carregarAvisos = useCallback(async () => {
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    try {
      setErro("");
      setFeedback("");
      setLoading(true);
      const { data } = await api.get("/avisos-internos", { headers });
      setConteudo(normalizeAvisosContent(data));
      markAvisosInternosAsSeen(user, data.atualizado_em);
    } catch (err) {
      console.error("Erro ao carregar avisos internos:", err);
      setErro("Não foi possível carregar os avisos salvos. Exibindo o conteúdo padrão.");
      setConteudo(normalizeAvisosContent());
    } finally {
      setLoading(false);
    }
  }, [headers, navigate, token, user]);

  useEffect(() => {
    carregarAvisos();
  }, [carregarAvisos]);

  useEffect(() => {
    const dashboardSocket = io(META_COMERCIAL_DASHBOARD_SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      timeout: 5000,
      autoConnect: false,
    });

    const atualizarMetaComercial = (data = {}) => {
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
    dashboardSocket.on("update", atualizarMetaComercial);
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

  const conteudoComMetaAtualizada = useMemo(() => {
    if (totalVendasMetaComercial === null) {
      return conteudo;
    }

    const vendasBaseReset = Number(conteudo.meta?.vendas_reset_base || 0);
    const vendasAposReset = Math.max(0, totalVendasMetaComercial - vendasBaseReset);

    return {
      ...conteudo,
      meta: {
        ...conteudo.meta,
        progresso: calcularProgressoMetaComercial(vendasAposReset),
      },
    };
  }, [conteudo, totalVendasMetaComercial]);

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
      setFeedback("Meta comercial resetada. As próximas vendas passam a contar a partir de 0%.");
    } catch (err) {
      console.error("Erro ao resetar meta comercial:", err);
      setErro(err.response?.data?.error || "Não foi possível resetar a meta comercial.");
    } finally {
      setResetandoMeta(false);
    }
  };

  return (
    <>
      <AvisosInternosContent
        conteudo={conteudoComMetaAtualizada}
        logoSrc={logoAcessa}
        mostrarAcoes
        onBack={voltarPaginaInterna}
        onEdit={podeEditar ? () => navigate("/admin/avisos-internos") : null}
        onResetMeta={podeEditar ? resetarMetaComercial : null}
        resetMetaLoading={resetandoMeta}
      />

      {loading && <div className="avisos-floating-state">Carregando avisos internos...</div>}
      {!loading && feedback && <div className="avisos-floating-state avisos-floating-state-success">{feedback}</div>}
      {!loading && erro && <div className="avisos-floating-state avisos-floating-state-warning">{erro}</div>}
    </>
  );
}
