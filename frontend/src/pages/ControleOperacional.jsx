import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../services/api";
import AuditDetails from "../components/ControleOperacional/AuditDetails";
import AuditFilters from "../components/ControleOperacional/AuditFilters";
import ActivityFeed from "../components/ControleOperacional/ActivityFeed";
import GlobalOperationalSearch from "../components/ControleOperacional/GlobalOperationalSearch";
import OperationalStats from "../components/ControleOperacional/OperationalStats";
import styles from "../styles/ControleOperacional.module.css";

const filtrosIniciais = {
  periodo: "hoje",
  tipo: "",
  usuario: "",
  tecnico: "",
  acao: "",
  nivel: "",
  search: "",
};

const menu = [
  "Visão Geral",
  "Atividade",
  "Chamados",
  "Instalações",
  "Técnicos",
  "Alterações da Agenda",
  "Comunicação",
  "Ausências",
  "Usuários",
  "Auditoria",
  "Eventos Críticos",
];

export default function ControleOperacional() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = useMemo(() => localStorage.getItem("token"), []);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const buscaUrl = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return (params.get("search") || params.get("q") || "").trim();
  }, [location.search]);
  const [filtros, setFiltros] = useState(() => ({
    ...filtrosIniciais,
    search: buscaUrl,
  }));
  const [resumo, setResumo] = useState(null);
  const [eventos, setEventos] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState("");
  const [eventoSelecionado, setEventoSelecionado] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [busca, setBusca] = useState(buscaUrl);
  const [buscaLoading, setBuscaLoading] = useState(false);
  const [resultadosBusca, setResultadosBusca] = useState({ audit_logs: [], mensagens: [], usuarios: [] });

  const carregarDados = useCallback(async (page = 1, silent = false) => {
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    try {
      setErro("");
      if (silent) setRefreshing(true);
      else setLoading(true);

      const params = { page, limit: 25 };
      Object.entries(filtros).forEach(([key, value]) => {
        if (value) params[key] = value;
      });

      const [resumoRes, feedRes] = await Promise.all([
        api.get("/controle-operacional/resumo", {
          headers,
          params: { periodo: filtros.periodo },
        }),
        api.get("/controle-operacional/feed", {
          headers,
          params,
        }),
      ]);

      setResumo(resumoRes.data);
      setEventos(feedRes.data.data || []);
      setPagination(feedRes.data.pagination || { page, limit: 25, total: 0, total_pages: 1 });
    } catch (err) {
      console.error("Erro ao carregar controle operacional:", err);
      if (err.response?.status === 401) {
        navigate("/login", { replace: true });
        return;
      }
      setErro(err.response?.status === 403
        ? "Seu usuário não tem permissão para acessar a Central de Controle."
        : "Não foi possível carregar a Central de Controle.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filtros, headers, navigate, token]);

  useEffect(() => {
    carregarDados(1);
  }, [carregarDados]);

  useEffect(() => {
    setBusca(buscaUrl);
    setFiltros((atuais) => {
      if (atuais.search === buscaUrl) return atuais;
      return { ...atuais, search: buscaUrl };
    });
  }, [buscaUrl]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      carregarDados(pagination.page || 1, true);
    }, 30000);

    return () => window.clearInterval(timer);
  }, [carregarDados, pagination.page]);

  useEffect(() => {
    const termo = busca.trim();
    if (termo.length < 2) {
      setResultadosBusca({ audit_logs: [], mensagens: [], usuarios: [] });
      setBuscaLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setBuscaLoading(true);
        const { data } = await api.get("/controle-operacional/search", {
          headers,
          params: { q: termo },
          signal: controller.signal,
        });
        setResultadosBusca(data);
      } catch (err) {
        if (err.code !== "ERR_CANCELED") {
          console.error("Erro na busca operacional:", err);
        }
      } finally {
        setBuscaLoading(false);
      }
    }, 420);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [busca, headers]);

  const selecionarEvento = (evento) => {
    setEventoSelecionado(evento);
    setTimeline(null);
  };

  const abrirHistoricoEntidade = async (entidade, id) => {
    if (!entidade || !id) return;

    try {
      const endpoint = entidade === "usuario"
        ? `/controle-operacional/usuario/${encodeURIComponent(id)}`
        : entidade === "instalacao"
          ? `/controle-operacional/instalacao/${encodeURIComponent(id)}`
          : entidade === "chamado"
            ? `/controle-operacional/chamado/${encodeURIComponent(id)}`
            : `/audit/entity/${encodeURIComponent(entidade)}/${encodeURIComponent(id)}`;

      const { data } = await api.get(endpoint, { headers });
      setTimeline({ ...data, entidade, id });
    } catch (err) {
      console.error("Erro ao abrir histórico da entidade:", err);
      setErro("Não foi possível carregar o histórico relacionado.");
    }
  };

  const limparFiltros = () => {
    setFiltros(filtrosIniciais);
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.backButton} onClick={() => navigate("/chat")}>
          <ArrowLeft size={18} />
          Voltar
        </button>
        <div>
          <span className={styles.eyebrow}>
            <ShieldCheck size={16} />
            Central administrativa
          </span>
          <h1>Central de Controle e Auditoria Operacional</h1>
          <p>Rastreamento de ações críticas, agenda, chat, usuários e alterações operacionais.</p>
        </div>
      </header>

      {erro && <div className={styles.errorBanner}>{erro}</div>}

      <GlobalOperationalSearch
        value={busca}
        onChange={setBusca}
        loading={buscaLoading}
        results={resultadosBusca}
        onSelectEvent={selecionarEvento}
        onOpenEntity={abrirHistoricoEntidade}
      />

      <nav className={styles.controlMenu} aria-label="Menu da Central">
        {menu.map((item) => (
          <button
            type="button"
            key={item}
            onClick={() => {
              if (item === "Eventos Críticos") setFiltros((atuais) => ({ ...atuais, nivel: "critical" }));
              if (item === "Comunicação") setFiltros((atuais) => ({ ...atuais, tipo: "chat" }));
              if (item === "Ausências") setFiltros((atuais) => ({ ...atuais, tipo: "ausencias" }));
              if (item === "Instalações") setFiltros((atuais) => ({ ...atuais, tipo: "instalacao" }));
              if (item === "Alterações da Agenda") setFiltros((atuais) => ({ ...atuais, tipo: "agenda" }));
            }}
          >
            {item}
          </button>
        ))}
      </nav>

      <OperationalStats resumo={resumo} loading={loading && !resumo} />

      <AuditFilters
        filtros={filtros}
        onChange={setFiltros}
        onRefresh={() => carregarDados(pagination.page || 1, true)}
        onClear={limparFiltros}
        refreshing={refreshing}
      />

      <div className={styles.contentGrid}>
        <ActivityFeed
          eventos={eventos}
          loading={loading}
          selectedId={eventoSelecionado?.id}
          pagination={pagination}
          onSelect={selecionarEvento}
          onOpenEntity={abrirHistoricoEntidade}
          onPage={(page) => carregarDados(page)}
        />
        <AuditDetails
          evento={eventoSelecionado}
          timeline={timeline}
          onClose={() => {
            setEventoSelecionado(null);
            setTimeline(null);
          }}
        />
      </div>
    </main>
  );
}
