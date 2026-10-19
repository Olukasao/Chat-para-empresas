import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  BellRing,
  CheckCircle2,
  ChevronRight,
  Eye,
  Gift,
  History,
  Image as ImageIcon,
  Images,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Megaphone,
  MessageCircleQuestion,
  MessageSquareReply,
  MessageSquareWarning,
  PartyPopper,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  Upload,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import InternalNoticeModal from "../components/InternalNoticeModal";
import api from "../services/api";
import { disconnectSocket } from "../services/socket";
import { useInternalBack } from "../utils/internalNavigation";
import { getPerfilLabel, PERFIS_USUARIO } from "../utils/perfis";
import styles from "../styles/Admin.module.css";

const BOAS_PRATICAS_DUVIDAS_PAGINA = "/boas-praticas-duvidas";
const perfilOptions = PERFIS_USUARIO;
const cargoLabel = getPerfilLabel;
const feedbackTipoLabel = {
  bug: "Bug / Erro",
  sugestao: "Sugestão",
  pergunta: "Pergunta",
};
const feedbackPrioridadeLabel = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};
const feedbackStatusLabel = {
  aberto: "Aberto",
  em_analise: "Em análise",
  resolvido: "Resolvido",
  ignorado: "Ignorado",
};
const feedbackFiltros = [
  { id: "todos", label: "Todos" },
  { id: "bug", label: "Bugs" },
  { id: "sugestao", label: "Sugestões" },
  { id: "pergunta", label: "Perguntas" },
  { id: "aberto", label: "Abertos" },
  { id: "em_analise", label: "Em análise" },
  { id: "resolvido", label: "Resolvidos" },
];
const feedbackStatusOptions = ["aberto", "em_analise", "resolvido", "ignorado"];
const ADMIN_SECOES = [
  { id: "visao-geral", label: "Visão geral", Icone: LayoutDashboard },
  { id: "usuarios", label: "Usuários", Icone: Users },
  { id: "grupos", label: "Grupos", Icone: UsersRound },
  { id: "aviso-interno", label: "Aviso interno", Icone: Megaphone },
  { id: "duvidas", label: "Dúvidas", Icone: MessageCircleQuestion },
  { id: "feedbacks", label: "Feedbacks", Icone: MessageSquareWarning },
];
const ADMIN_FERRAMENTAS = [
  { id: "banner", label: "Banner da home", descricao: "Textos, indicadores e oferta do banner principal.", rota: "/admin/banner-home", Icone: LayoutTemplate },
  { id: "avisos", label: "Avisos internos", descricao: "Comunicados da página de avisos internos.", rota: "/admin/avisos-internos", Icone: BellRing },
  { id: "imagens", label: "Imagens", descricao: "Imagens usadas na intranet.", rota: "/imagens", Icone: Images },
  { id: "historico", label: "Histórico de mensagens", descricao: "Mensagens trocadas no chat.", rota: "/admin/chat-historico", Icone: History },
  { id: "compras", label: "Permissões de compras", descricao: "Acesso às solicitações de compra.", rota: "/admin/permissoes-compras", Icone: ShoppingCart },
  { id: "roleta", label: "Roleta de prêmios", descricao: "Prêmios da roleta.", rota: "/admin/roleta-premios", Icone: Gift },
];
const lerSecaoAdmin = () => {
  const secao = window.location.hash.replace("#", "");
  return ADMIN_SECOES.some(({ id }) => id === secao) ? secao : "visao-geral";
};
const ehDuvidaBoasPraticas = (feedback) => (
  feedback?.tipo === "pergunta"
  && feedback?.pagina === BOAS_PRATICAS_DUVIDAS_PAGINA
);
const SALES_TEST_DURATION_MS = 5200;
const SALES_TEST_CONFETTI_COUNT = 72;
const SALES_TEST_CONFETTI_COLORS = [
  "#22C55E",
  "#38BDF8",
  "#FACC15",
  "#F97316",
  "#EC4899",
  "#FFFFFF",
];
const SALES_TEST_FIREWORK_COUNT = 7;
const SALES_TEST_FIREWORK_SPARKS = 14;
const normalizarUsuariosAcesso = (usuarios = []) => usuarios.map((usuario) => ({
  ...usuario,
  membroOriginal: Boolean(usuario.membro),
}));
const grupoGerenciadoPorSetor = () => false;
const PRIORIDADES_AVISO_GERAL = [
  { valor: "baixa", label: "Baixa" },
  { valor: "media", label: "Média" },
  { valor: "alta", label: "Alta" },
  { valor: "critica", label: "Crítica" },
];
const TIPOS_AVISO_GERAL = ["Comunicado", "Atualização", "Manutenção", "Alerta", "Novidade"];
const CATEGORIAS_AVISO_GERAL = ["Geral", "Sistema", "Suporte", "NOC", "Comercial", "Financeiro", "RH"];
const AVISO_GERAL_IMAGE_MAX_SIZE_MB = 3;
const AVISO_GERAL_IMAGE_MAX_SIZE_BYTES = AVISO_GERAL_IMAGE_MAX_SIZE_MB * 1024 * 1024;
const AVISO_GERAL_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const AVISO_GERAL_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const ICONES_AVISO_GERAL = [
  { valor: "info", label: "Informação" },
  { valor: "check", label: "Check" },
  { valor: "alert", label: "Alerta" },
  { valor: "rocket", label: "Novidade" },
  { valor: "shield", label: "Segurança" },
  { valor: "calendar", label: "Agenda" },
];
const criarMudancaAvisoVazia = () => ({
  icon: "info",
  title: "",
  description: "",
});
const criarAvisoGeralFormPadrao = () => ({
  titulo: "Novo recurso nos grupos",
  mensagem: "Agora é possível ver visualizações de mensagem nos grupos. Use a setinha da mensagem e clique em “Visualizações” para acompanhar quem recebeu e quem leu.",
  ativo: true,
  tipo: "Comunicado",
  categoria: "Geral",
  prioridade: "media",
  detailEnabled: false,
  detailUrl: "",
  detailButtonText: "Ver detalhes",
  showNewBadge: true,
  requireConfirmation: true,
  allowClose: false,
  allowSnooze: true,
  changesEnabled: false,
  changes: [
    criarMudancaAvisoVazia(),
    criarMudancaAvisoVazia(),
    criarMudancaAvisoVazia(),
  ],
  importantInfoEnabled: false,
  importantInfo: "",
  actionRequiredEnabled: false,
  actionTitle: "",
  actionDescription: "",
  publishMode: "now",
  startsAt: "",
  endsAt: "",
  imageUrl: "",
  originalImageUrl: "",
  imageFile: null,
  imagePreviewUrl: "",
  removeImage: false,
});

const validarImagemAvisoGeral = (arquivo) => {
  if (!arquivo) return "";

  const nome = String(arquivo.name || "").toLowerCase();
  const extensao = nome.includes(".") ? nome.slice(nome.lastIndexOf(".")) : "";

  if (!AVISO_GERAL_IMAGE_TYPES.includes(arquivo.type) || !AVISO_GERAL_IMAGE_EXTENSIONS.includes(extensao)) {
    return "Envie uma imagem JPG, PNG ou WEBP.";
  }

  if (arquivo.size > AVISO_GERAL_IMAGE_MAX_SIZE_BYTES) {
    return `Imagem muito grande. Envie arquivos de até ${AVISO_GERAL_IMAGE_MAX_SIZE_MB} MB.`;
  }

  return "";
};

const parseJsonAvisoGeral = (valor, fallback) => {
  if (!valor) return fallback;
  if (typeof valor !== "string") return valor;

  try {
    return JSON.parse(valor);
  } catch {
    return fallback;
  }
};

const normalizarMudancasAvisoForm = (valor) => {
  const mudancas = Array.isArray(valor) ? valor : [];
  const normalizadas = mudancas.slice(0, 3).map((mudanca) => ({
    icon: mudanca?.icon || "info",
    title: mudanca?.title || "",
    description: mudanca?.description || "",
  }));

  while (normalizadas.length < 3) {
    normalizadas.push(criarMudancaAvisoVazia());
  }

  return normalizadas;
};

const formatarDataHoraInput = (valor) => {
  if (!valor) return "";

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "";

  const pad = (numero) => String(numero).padStart(2, "0");

  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}T${pad(data.getHours())}:${pad(data.getMinutes())}`;
};

const montarAvisoGeralForm = (aviso = {}) => {
  const importantInfo = parseJsonAvisoGeral(aviso.important_info_json, []);
  const actionRequired = parseJsonAvisoGeral(aviso.action_required_json, null);
  const changes = normalizarMudancasAvisoForm(parseJsonAvisoGeral(aviso.changes_json, []));
  const importantInfoText = Array.isArray(importantInfo)
    ? importantInfo.map((item) => String(item || "").trim()).filter(Boolean).join("\n")
    : "";

  return {
    ...criarAvisoGeralFormPadrao(),
    titulo: aviso.titulo || "",
    mensagem: aviso.mensagem || "",
    ativo: Boolean(aviso.ativo),
    tipo: aviso.tipo || "Comunicado",
    categoria: aviso.categoria || "Geral",
    prioridade: aviso.prioridade || "media",
    detailEnabled: Boolean(aviso.detail_url),
    detailUrl: aviso.detail_url || "",
    detailButtonText: aviso.detail_button_text || "Ver detalhes",
    showNewBadge: aviso.show_new_badge !== undefined ? Boolean(aviso.show_new_badge) : true,
    requireConfirmation: aviso.require_confirmation !== undefined ? Boolean(aviso.require_confirmation) : true,
    allowClose: Boolean(aviso.allow_close),
    allowSnooze: aviso.allow_snooze !== undefined ? Boolean(aviso.allow_snooze) : true,
    changesEnabled: changes.some((mudanca) => mudanca.title || mudanca.description),
    changes,
    importantInfoEnabled: Boolean(importantInfoText),
    importantInfo: importantInfoText,
    actionRequiredEnabled: Boolean(actionRequired?.title || actionRequired?.description),
    actionTitle: actionRequired?.title || "",
    actionDescription: actionRequired?.description || "",
    publishMode: aviso.starts_at ? "scheduled" : "now",
    startsAt: formatarDataHoraInput(aviso.starts_at),
    endsAt: formatarDataHoraInput(aviso.ends_at),
    imageUrl: aviso.image_url || aviso.imageUrl || "",
    originalImageUrl: aviso.image_url || aviso.imageUrl || "",
    imageFile: null,
    imagePreviewUrl: "",
    removeImage: false,
  };
};

const criarConfetesTesteVenda = () => (
  Array.from({ length: SALES_TEST_CONFETTI_COUNT }, (_, index) => {
    const tamanho = 6 + Math.random() * 9;
    const duracao = 2600 + Math.random() * 1900;

    return {
      id: `${Date.now()}-${index}`,
      cor: SALES_TEST_CONFETTI_COLORS[index % SALES_TEST_CONFETTI_COLORS.length],
      esquerda: `${Math.random() * 100}%`,
      atraso: `${Math.random() * 620}ms`,
      duracao: `${duracao}ms`,
      tamanho: `${tamanho}px`,
      deslocamento: `${(Math.random() - 0.5) * 280}px`,
      rotacao: `${Math.random() * 360}deg`,
      arredondado: index % 5 === 0,
    };
  })
);

const criarFogosTesteVenda = () => (
  Array.from({ length: SALES_TEST_FIREWORK_COUNT }, (_, index) => ({
    id: `${Date.now()}-fogo-${index}`,
    cor: SALES_TEST_CONFETTI_COLORS[index % SALES_TEST_CONFETTI_COLORS.length],
    esquerda: `${8 + Math.random() * 84}%`,
    atraso: `${index * 145 + Math.random() * 360}ms`,
    duracao: `${2100 + Math.random() * 900}ms`,
    subida: `-${42 + Math.random() * 38}vh`,
    deslocamento: `${(Math.random() - 0.5) * 210}px`,
    escala: `${0.78 + Math.random() * 0.48}`,
    sparks: Array.from({ length: SALES_TEST_FIREWORK_SPARKS }, (_, sparkIndex) => ({
      id: sparkIndex,
      angulo: `${(360 / SALES_TEST_FIREWORK_SPARKS) * sparkIndex}deg`,
      distancia: `${34 + Math.random() * 34}px`,
    })),
  }))
);

export default function Admin() {
  const navigate = useNavigate();
  const voltarPaginaInterna = useInternalBack("/chat");
  const [resumo, setResumo] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [setores, setSetores] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [secaoAdmin, setSecaoAdmin] = useState(lerSecaoAdmin);
  const [duvidasBoasPraticas, setDuvidasBoasPraticas] = useState([]);
  const [avisoGeral, setAvisoGeral] = useState(null);
  const [avisoGeralForm, setAvisoGeralForm] = useState(criarAvisoGeralFormPadrao);
  const [avisoGeralImageError, setAvisoGeralImageError] = useState("");
  const [mostrarPreviaAvisoGeral, setMostrarPreviaAvisoGeral] = useState(false);
  const [salvandoAvisoGeral, setSalvandoAvisoGeral] = useState(false);
  const [feedbackFiltro, setFeedbackFiltro] = useState("todos");
  const [salvandoFeedbackStatus, setSalvandoFeedbackStatus] = useState(null);
  const [excluindoFeedback, setExcluindoFeedback] = useState(null);
  const [grupoAcessos, setGrupoAcessos] = useState(null);
  const [grupoFixado, setGrupoFixado] = useState(null);
  const [fixadoForm, setFixadoForm] = useState({
    titulo: "Mensagem fixada",
    conteudo: "",
    ativo: false,
  });
  const [carregandoAcessos, setCarregandoAcessos] = useState(false);
  const [salvandoAcessos, setSalvandoAcessos] = useState(false);
  const [salvandoFixado, setSalvandoFixado] = useState(false);
  const [adicaoAcesso, setAdicaoAcesso] = useState({
    tipo: "usuario",
    usuario_id: "",
    setor_id: "",
    perfil: "usuario",
  });
  const [respostaModalAberto, setRespostaModalAberto] = useState(false);
  const [respostaModalFeedback, setRespostaModalFeedback] = useState(null);
  const [respostaModalTexto, setRespostaModalTexto] = useState('');
  const [respostaModalOrigem, setRespostaModalOrigem] = useState('feedback');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [mostrarCadastroUsuario, setMostrarCadastroUsuario] = useState(false);
  const [salvandoUsuario, setSalvandoUsuario] = useState(false);
  const [mostrarCadastroGrupo, setMostrarCadastroGrupo] = useState(false);
  const [salvandoGrupo, setSalvandoGrupo] = useState(false);
  const [novoUsuario, setNovoUsuario] = useState({
    nome: "",
    email: "",
    senha: "",
    setor_id: "",
    perfil: "usuario",
  });
  const [novoGrupo, setNovoGrupo] = useState({
    nome: "",
    descricao: "",
    acessoTodos: true,
  });
  const [usuarioSenha, setUsuarioSenha] = useState(null);
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [senhaAdmin, setSenhaAdmin] = useState({
    senha: "",
    confirmar: "",
  });
  const [celebracaoVendaTeste, setCelebracaoVendaTeste] = useState(null);
  const [confetesVendaTeste, setConfetesVendaTeste] = useState([]);
  const [fogosVendaTeste, setFogosVendaTeste] = useState([]);
  const [testandoEfeitoVenda, setTestandoEfeitoVenda] = useState(false);
  const audioContextRef = useRef(null);

  useEffect(() => {
    const sincronizarSecaoComHash = () => setSecaoAdmin(lerSecaoAdmin());
    window.addEventListener("hashchange", sincronizarSecaoComHash);
    return () => window.removeEventListener("hashchange", sincronizarSecaoComHash);
  }, []);
  const celebracaoVendaTimeoutRef = useRef(null);
  const confetesVendaTimeoutRef = useRef(null);
  const fogosVendaTimeoutRef = useRef(null);

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

  const carregarPainel = useCallback(async () => {
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    try {
      setErro("");
      setLoading(true);

      const [
        resumoRes,
        usuariosRes,
        gruposRes,
        setoresRes,
        feedbacksRes,
        avisoGeralRes,
        duvidasBoasPraticasRes,
      ] = await Promise.all([
        api.get("/admin/resumo", { headers }),
        api.get("/admin/usuarios", { headers }),
        api.get("/admin/grupos", { headers }),
        api.get("/admin/setores", { headers }),
        api.get("/feedbacks", { headers }),
        api.get("/admin/aviso-geral", { headers }),
        api.get("/admin/boas-praticas-duvidas/perguntas", { headers }),
      ]);

      setResumo(resumoRes.data);
      setUsuarios(usuariosRes.data);
      setGrupos(gruposRes.data);
      setSetores(setoresRes.data);
      setFeedbacks(feedbacksRes.data);
      setDuvidasBoasPraticas(duvidasBoasPraticasRes.data);
      setAvisoGeral(avisoGeralRes.data);
      if (avisoGeralRes.data) {
        setAvisoGeralForm(montarAvisoGeralForm(avisoGeralRes.data));
      }
    } catch (err) {
      console.error("Erro ao carregar painel admin:", err);
      if (err.response?.status === 403) {
        setErro("Seu usuário não tem permissão de administrador.");
      } else {
        setErro("Não foi possível carregar o painel administrativo.");
      }
    } finally {
      setLoading(false);
    }
  }, [headers, navigate, token]);

  useEffect(() => {
    carregarPainel();
  }, [carregarPainel]);

  useEffect(() => () => {
    window.clearTimeout(celebracaoVendaTimeoutRef.current);
    window.clearTimeout(confetesVendaTimeoutRef.current);
    window.clearTimeout(fogosVendaTimeoutRef.current);
  }, []);

  const obterAudioContext = () => {
    if (typeof window === "undefined") return null;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!audioContextRef.current) {
      audioContextRef.current = window.__chatAudioContext || new AudioContextClass();
      window.__chatAudioContext = audioContextRef.current;
    }

    return audioContextRef.current;
  };

  const tocarTomVenda = (context, inicio, frequencia, duracao, volume = 0.42) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(frequencia, inicio);
    oscillator.frequency.exponentialRampToValueAtTime(frequencia * 1.035, inicio + duracao);

    gain.gain.setValueAtTime(0.001, inicio);
    gain.gain.exponentialRampToValueAtTime(volume, inicio + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.001, inicio + duracao);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(inicio);
    oscillator.stop(inicio + duracao + 0.03);
  };

  const tocarSomVenda = () => {
    const context = obterAudioContext();
    if (!context) return;

    const tocar = () => {
      const inicio = context.currentTime + 0.015;
      tocarTomVenda(context, inicio, 523.25, 0.16, 0.28);
      tocarTomVenda(context, inicio + 0.1, 659.25, 0.18, 0.32);
      tocarTomVenda(context, inicio + 0.2, 783.99, 0.2, 0.36);
      tocarTomVenda(context, inicio + 0.32, 1046.5, 0.24, 0.38);
    };

    if (context.state === "suspended") {
      context.resume().then(tocar).catch(() => {});
      return;
    }

    tocar();
  };

  const testarEfeitoVenda = async () => {
    tocarSomVenda();

    setConfetesVendaTeste(criarConfetesTesteVenda());
    setFogosVendaTeste(criarFogosTesteVenda());
    setCelebracaoVendaTeste({
      id: Date.now(),
    });

    window.clearTimeout(celebracaoVendaTimeoutRef.current);
    window.clearTimeout(confetesVendaTimeoutRef.current);
    window.clearTimeout(fogosVendaTimeoutRef.current);

    celebracaoVendaTimeoutRef.current = window.setTimeout(() => {
      setCelebracaoVendaTeste(null);
    }, SALES_TEST_DURATION_MS);

    confetesVendaTimeoutRef.current = window.setTimeout(() => {
      setConfetesVendaTeste([]);
    }, SALES_TEST_DURATION_MS + 600);

    fogosVendaTimeoutRef.current = window.setTimeout(() => {
      setFogosVendaTeste([]);
    }, SALES_TEST_DURATION_MS + 600);

    try {
      setTestandoEfeitoVenda(true);
      await api.post("/admin/teste-venda", {}, { headers });
    } catch (err) {
      console.error("Erro ao testar efeito de venda:", err);
      alert(err.response?.data?.error || "Não foi possível disparar o teste para os usuários.");
    } finally {
      setTestandoEfeitoVenda(false);
    }
  };

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

  const atualizarUsuario = async (usuario, campo, valor) => {
    try {
      const valorNormalizado = campo === "setor_id" ? Number(valor) : valor;
      const { data } = await api.put(
        `/admin/usuarios/${usuario.id}`,
        { [campo]: valorNormalizado },
        { headers }
      );

      const setorSelecionado = campo === "setor_id"
        ? setores.find((setor) => Number(setor.id) === Number(valorNormalizado))
        : null;

      setUsuarios((atuais) =>
        atuais.map((item) =>
          item.id === usuario.id
            ? {
                ...item,
                [campo]: valorNormalizado,
                ...(campo === "setor_id"
                  ? {
                      setor_id: data.setor_id ?? valorNormalizado,
                      setor_nome: data.setor_nome || setorSelecionado?.nome || item.setor_nome,
                    }
                  : {}),
              }
            : item
        )
      );

      if (campo === "setor_id") {
        const gruposRes = await api.get("/admin/grupos", { headers });
        setGrupos(gruposRes.data);

        if (grupoAcessos?.grupo) {
          const acessosRes = await api.get(
            `/admin/grupos/${grupoAcessos.grupo.id}/membros`,
            { headers }
          );

          setGrupoAcessos({
            ...acessosRes.data,
            grupo: {
              ...grupoAcessos.grupo,
              ...acessosRes.data.grupo,
            },
            usuarios: acessosRes.data.usuarios.map((item) => ({
              ...item,
              membroOriginal: Boolean(item.membro),
            })),
          });
        }
      }
    } catch (err) {
      console.error("Erro ao atualizar usuario:", err);
      alert(err.response?.data?.error || "Nao foi possivel atualizar o usuario.");
      await carregarPainel();
    }
  };

  const excluirUsuario = async (usuario) => {
    if (usuario.id === user.id) {
      alert("Voce nao pode excluir seu proprio usuario.");
      return;
    }

    const ok = window.confirm(`Excluir o acesso de ${usuario.nome}? Ele nao conseguira mais entrar no chat.`);
    if (!ok) return;

    try {
      await api.delete(`/admin/usuarios/${usuario.id}`, { headers });
      setUsuarios((atuais) => atuais.filter((item) => item.id !== usuario.id));
      setResumo((atual) => {
        const base = atual || {};
        const statusBase = base.status || {};
        const statusAtual = usuario.status || "offline";
        return {
          ...base,
          total_usuarios: Math.max((base.total_usuarios || 1) - 1, 0),
          status: {
            online: statusBase.online || 0,
            away: statusBase.away || 0,
            offline: statusBase.offline || 0,
            [statusAtual]: Math.max((statusBase[statusAtual] || 1) - 1, 0),
          },
        };
      });
    } catch (err) {
      console.error("Erro ao excluir usuario:", err);
      alert(err.response?.data?.error || "Nao foi possivel excluir o usuario.");
      await carregarPainel();
    }
  };

  const abrirTrocaSenha = (usuario) => {
    setUsuarioSenha(usuario);
    setSenhaAdmin({
      senha: "",
      confirmar: "",
    });
  };

  const verHistoricoUsuario = (usuarioId) => {
    navigate(`/admin/usuarios/${usuarioId}/mensagens`);
  };

  const trocarSenhaUsuario = async (event) => {
    event.preventDefault();

    if (!usuarioSenha) return;

    if (senhaAdmin.senha !== senhaAdmin.confirmar) {
      alert("A confirmacao da senha nao confere.");
      return;
    }

    try {
      setSalvandoSenha(true);
      await api.put(`/admin/usuarios/${usuarioSenha.id}`, {
        senha: senhaAdmin.senha,
      }, { headers });

      setUsuarioSenha(null);
      setSenhaAdmin({
        senha: "",
        confirmar: "",
      });
      alert(`Senha de ${usuarioSenha.nome} atualizada.`);
    } catch (err) {
      console.error("Erro ao trocar senha do usuario:", err);
      alert(err.response?.data?.error || "Nao foi possivel trocar a senha.");
    } finally {
      setSalvandoSenha(false);
    }
  };

  const abrirCadastroUsuario = () => {
    setNovoUsuario((atual) => ({
      ...atual,
      setor_id: atual.setor_id || setores[0]?.id || "",
    }));
    setMostrarCadastroUsuario((atual) => !atual);
  };

  const alterarNovoUsuario = (campo, valor) => {
    setNovoUsuario((atual) => ({
      ...atual,
      [campo]: valor,
    }));
  };

  const criarUsuario = async (event) => {
    event.preventDefault();

    try {
      setSalvandoUsuario(true);

      const { data } = await api.post("/admin/usuarios", {
        ...novoUsuario,
        setor_id: Number(novoUsuario.setor_id),
      }, { headers });

      setUsuarios((atuais) => [...atuais, data].sort((a, b) => a.nome.localeCompare(b.nome)));
      setResumo((atual) => ({
        ...atual,
        total_usuarios: (atual?.total_usuarios || 0) + 1,
        status: {
          online: atual?.status?.online || 0,
          away: atual?.status?.away || 0,
          offline: (atual?.status?.offline || 0) + 1,
        },
      }));
      setNovoUsuario({
        nome: "",
        email: "",
        senha: "",
        setor_id: setores[0]?.id || "",
        perfil: "usuario",
      });
      setMostrarCadastroUsuario(false);
    } catch (err) {
      console.error("Erro ao criar usuario:", err);
      alert(err.response?.data?.error || "Nao foi possivel criar o usuario.");
    } finally {
      setSalvandoUsuario(false);
    }
  };

  const abrirCadastroGrupo = () => {
    setMostrarCadastroGrupo((atual) => !atual);
  };

  const alterarNovoGrupo = (campo, valor) => {
    setNovoGrupo((atual) => ({
      ...atual,
      [campo]: valor,
    }));
  };

  const criarGrupo = async (event) => {
    event.preventDefault();

    try {
      setSalvandoGrupo(true);

      const usuarioIds = novoGrupo.acessoTodos
        ? usuarios.map((usuario) => usuario.id)
        : [user.id].filter(Boolean);

      await api.post("/admin/grupos", {
        nome: novoGrupo.nome,
        descricao: novoGrupo.descricao,
        usuario_ids: usuarioIds,
      }, { headers });

      const [gruposRes, setoresRes] = await Promise.all([
        api.get("/admin/grupos", { headers }),
        api.get("/admin/setores", { headers }),
      ]);

      setGrupos(gruposRes.data);
      setSetores(setoresRes.data);
      setResumo((atual) => ({
        ...(atual || {}),
        total_grupos: (atual?.total_grupos || 0) + 1,
      }));
      setNovoGrupo({
        nome: "",
        descricao: "",
        acessoTodos: true,
      });
      setMostrarCadastroGrupo(false);
    } catch (err) {
      console.error("Erro ao criar grupo:", err);
      alert(err.response?.data?.error || "Nao foi possivel criar o grupo.");
    } finally {
      setSalvandoGrupo(false);
    }
  };

  const excluirGrupo = async (grupo) => {
    const ok = window.confirm(`Excluir o grupo ${grupo.nome}? Ele deixara de aparecer no chat dos usuarios, mas o historico administrativo continua disponivel.`);
    if (!ok) return;

    try {
      await api.delete(`/admin/grupos/${grupo.id}`, { headers });
      setGrupos((atuais) => atuais.filter((item) => item.id !== grupo.id));
      setResumo((atual) => ({
        ...(atual || {}),
        total_grupos: Math.max((atual?.total_grupos || 1) - 1, 0),
      }));
      setGrupoAcessos((atual) => (
        atual?.grupo?.id === grupo.id ? null : atual
      ));
    } catch (err) {
      console.error("Erro ao excluir grupo:", err);
      alert(err.response?.data?.error || "Nao foi possivel excluir o grupo.");
      await carregarPainel();
    }
  };

  const abrirAcessosGrupo = async (grupo) => {
    try {
      setCarregandoAcessos(true);
      setGrupoAcessos({
        grupo,
        usuarios: [],
      });

      const { data } = await api.get(`/admin/grupos/${grupo.id}/membros`, { headers });
      setGrupoAcessos({
        ...data,
        grupo: {
          ...grupo,
          ...data.grupo,
        },
        usuarios: normalizarUsuariosAcesso(data.usuarios),
      });
      setAdicaoAcesso((atual) => ({
        ...atual,
        usuario_id: data.usuarios.find((usuario) => !usuario.membro)?.id || "",
        setor_id: data.grupo.setor_id || setores[0]?.id || "",
      }));
    } catch (err) {
      console.error("Erro ao carregar acessos do grupo:", err);
      alert(err.response?.data?.error || "Nao foi possivel carregar os acessos do grupo.");
      setGrupoAcessos(null);
    } finally {
      setCarregandoAcessos(false);
    }
  };

  const fecharAcessosGrupo = () => {
    setGrupoAcessos(null);
  };

  const abrirFixadoGrupo = (grupo) => {
    setGrupoFixado(grupo);
    setFixadoForm({
      titulo: grupo.mensagem_fixada_titulo || "Mensagem fixada",
      conteudo: grupo.mensagem_fixada_conteudo || "",
      ativo: Boolean(grupo.mensagem_fixada_ativo),
    });
  };

  const fecharFixadoGrupo = () => {
    if (salvandoFixado) return;
    setGrupoFixado(null);
  };

  const alterarFixadoForm = (campo, valor) => {
    setFixadoForm((atual) => ({
      ...atual,
      [campo]: valor,
    }));
  };

  const salvarFixadoGrupo = async (event) => {
    event.preventDefault();

    if (!grupoFixado?.id) return;

    if (fixadoForm.ativo && !fixadoForm.conteudo.trim()) {
      alert("Informe o conteúdo da mensagem fixada.");
      return;
    }

    try {
      setSalvandoFixado(true);

      const { data } = await api.put(`/admin/grupos/${grupoFixado.id}/fixado`, {
        titulo: fixadoForm.titulo,
        conteudo: fixadoForm.conteudo,
        ativo: fixadoForm.ativo,
      }, { headers });

      setGrupos((atuais) =>
        atuais.map((grupo) =>
          grupo.id === grupoFixado.id
            ? {
                ...grupo,
                mensagem_fixada_titulo: data.mensagem_fixada_titulo,
                mensagem_fixada_conteudo: data.mensagem_fixada_conteudo,
                mensagem_fixada_ativo: data.mensagem_fixada_ativo,
                mensagem_fixada_atualizada_em: data.mensagem_fixada_atualizada_em,
                mensagem_fixada_atualizada_por: data.mensagem_fixada_atualizada_por,
                atualizado_em: data.atualizado_em || grupo.atualizado_em,
              }
            : grupo
        )
      );

      setGrupoFixado(null);
    } catch (err) {
      console.error("Erro ao salvar mensagem fixada:", err);
      alert(err.response?.data?.error || "Não foi possível salvar a mensagem fixada.");
    } finally {
      setSalvandoFixado(false);
    }
  };

  const alterarAdicaoAcesso = (campo, valor) => {
    setAdicaoAcesso((atual) => ({
      ...atual,
      [campo]: valor,
    }));
  };

  const recarregarAcessosGrupo = async (grupoBase) => {
    if (!grupoBase?.id) return;

    const [usuariosRes, gruposRes, acessosRes] = await Promise.all([
      api.get("/admin/usuarios", { headers }),
      api.get("/admin/grupos", { headers }),
      api.get(`/admin/grupos/${grupoBase.id}/membros`, { headers }),
    ]);

    setUsuarios(usuariosRes.data);
    setGrupos(gruposRes.data);
    setGrupoAcessos({
      ...acessosRes.data,
      grupo: {
        ...grupoBase,
        ...acessosRes.data.grupo,
      },
      usuarios: normalizarUsuariosAcesso(acessosRes.data.usuarios),
    });
    setAdicaoAcesso((atual) => ({
      ...atual,
      usuario_id: acessosRes.data.usuarios.find((usuario) => !usuario.membro)?.id || "",
      setor_id: atual.setor_id || acessosRes.data.grupo.setor_id || setores[0]?.id || "",
    }));
  };

  const alternarAcessoGrupo = (usuarioId) => {
    setGrupoAcessos((atual) => {
      if (!atual) return atual;

      return {
        ...atual,
        usuarios: atual.usuarios.map((usuario) =>
          usuario.id === usuarioId &&
          (!grupoGerenciadoPorSetor(atual.grupo) || usuario.membroOriginal)
            ? { ...usuario, membro: !usuario.membro }
            : usuario
        ),
      };
    });
  };

  const adicionarAcessoGrupo = async (event) => {
    event.preventDefault();

    if (!grupoAcessos?.grupo?.id) return;

    const payload = { tipo: adicaoAcesso.tipo };

    if (adicaoAcesso.tipo === "usuario") {
      if (!adicaoAcesso.usuario_id) {
        alert("Selecione um membro para adicionar.");
        return;
      }

      payload.usuario_id = Number(adicaoAcesso.usuario_id);
    }

    if (adicaoAcesso.tipo === "setor") {
      if (!adicaoAcesso.setor_id) {
        alert("Selecione um setor para adicionar.");
        return;
      }

      payload.setor_id = Number(adicaoAcesso.setor_id);
    }

    if (adicaoAcesso.tipo === "cargo") {
      payload.perfil = adicaoAcesso.perfil;
    }

    try {
      setSalvandoAcessos(true);
      setCarregandoAcessos(true);

      const { data } = await api.post(
        `/admin/grupos/${grupoAcessos.grupo.id}/adicionar-acessos`,
        payload,
        { headers }
      );

      await recarregarAcessosGrupo(grupoAcessos.grupo);

      if (data.message) {
        alert(data.message);
      }
    } catch (err) {
      console.error("Erro ao adicionar acesso ao grupo:", err);
      alert(err.response?.data?.error || "Nao foi possivel adicionar acesso ao grupo.");
    } finally {
      setCarregandoAcessos(false);
      setSalvandoAcessos(false);
    }
  };

  const salvarAcessosGrupo = async () => {
    if (!grupoAcessos) return;

    try {
      setSalvandoAcessos(true);
      const usuarioIds = grupoAcessos.usuarios
        .filter((usuario) => usuario.membro)
        .map((usuario) => usuario.id);

      const { data } = await api.put(`/admin/grupos/${grupoAcessos.grupo.id}/membros`, {
        usuario_ids: usuarioIds,
      }, { headers });

      setGrupos((atuais) =>
        atuais.map((grupo) =>
          grupo.id === grupoAcessos.grupo.id
            ? { ...grupo, total_membros: data.total_membros }
            : grupo
        )
      );

      if (data.usuarios_removidos?.length) {
        setUsuarios((atuais) => atuais.map((usuario) =>
          data.usuarios_removidos.includes(usuario.id)
            ? { ...usuario, setor_id: null, setor_nome: null }
            : usuario
        ));
      }

      if (data.message) {
        alert(data.message);
      }

      await recarregarAcessosGrupo(grupoAcessos.grupo);
    } catch (err) {
      console.error("Erro ao salvar acessos do grupo:", err);
      alert(err.response?.data?.error || "Nao foi possivel salvar os acessos do grupo.");
    } finally {
      setSalvandoAcessos(false);
    }
  };

  const atualizarStatusFeedback = async (feedbackId, status, responsavelId) => {
    try {
      setSalvandoFeedbackStatus(feedbackId);

      const feedbackAtual = feedbacks.find((feedback) => feedback.id === feedbackId);
      const payload = { status };

      if (status === "resolvido") {
        const responsavelSelecionado = responsavelId
          || feedbackAtual?.resolvido_por
          || user?.id
          || "";

        if (responsavelSelecionado) {
          payload.resolvido_por = Number(responsavelSelecionado);
        }
      }

      const { data } = await api.patch(
        `/feedbacks/${feedbackId}/status`,
        payload,
        { headers }
      );

      setFeedbacks((atuais) =>
        atuais.map((feedback) => (
          feedback.id === feedbackId ? { ...feedback, ...data } : feedback
        ))
      );
    } catch (err) {
      console.error("Erro ao atualizar status do feedback:", err);
      alert(err.response?.data?.error || "Nao foi possivel atualizar o status.");
    } finally {
      setSalvandoFeedbackStatus(null);
    }
  };

  const abrirRespostaModal = (feedback, origem = ehDuvidaBoasPraticas(feedback) ? 'duvida' : 'feedback') => {
    setRespostaModalFeedback(feedback);
    setRespostaModalTexto(feedback.resposta || '');
    setRespostaModalOrigem(origem);
    setRespostaModalAberto(true);
  };

  const fecharRespostaModal = () => {
    setRespostaModalAberto(false);
    setRespostaModalFeedback(null);
    setRespostaModalTexto('');
    setRespostaModalOrigem('feedback');
  };

  const salvarRespostaFeedback = async (event) => {
    event.preventDefault();
    if (!respostaModalFeedback) return;

    try {
      setSalvandoFeedbackStatus(respostaModalFeedback.id);

      const resposta = respostaModalTexto.trim();
      const { data } = respostaModalOrigem === 'duvida'
        ? await api.patch(
          `/admin/boas-praticas-duvidas/perguntas/${respostaModalFeedback.id}/resposta`,
          { resposta },
          { headers }
        )
        : await api.patch(
          `/feedbacks/${respostaModalFeedback.id}/status`,
          {
            status: 'resolvido',
            resposta,
            resolvido_por: user?.id,
          },
          { headers }
        );

      setFeedbacks((atuais) => (
        atuais.map((feedback) => (
          feedback.id === respostaModalFeedback.id ? { ...feedback, ...data } : feedback
        ))
      ));
      setDuvidasBoasPraticas((atuais) => (
        atuais.map((feedback) => (
          feedback.id === respostaModalFeedback.id ? { ...feedback, ...data } : feedback
        ))
      ));

      fecharRespostaModal();
    } catch (err) {
      console.error('Erro ao salvar resposta do feedback:', err);
      alert(err.response?.data?.error || 'Não foi possível salvar a resposta.');
    } finally {
      setSalvandoFeedbackStatus(null);
    }
  };

  const excluirFeedback = async (feedback) => {
    const itemLabel = ehDuvidaBoasPraticas(feedback) ? "esta dúvida" : "este feedback";
    const confirmado = window.confirm(
      `Excluir ${itemLabel} de ${feedback.nome}? Esta ação não pode ser desfeita.`
    );

    if (!confirmado) return;

    try {
      setExcluindoFeedback(feedback.id);

      await api.delete(`/feedbacks/${feedback.id}`, { headers });

      setFeedbacks((atuais) => (
        atuais.filter((item) => item.id !== feedback.id)
      ));
      setDuvidasBoasPraticas((atuais) => (
        atuais.filter((item) => item.id !== feedback.id)
      ));
    } catch (err) {
      console.error("Erro ao excluir feedback:", err);
      alert(err.response?.data?.error || "Não foi possível excluir o feedback.");
    } finally {
      setExcluindoFeedback(null);
    }
  };

  const alterarAvisoGeralForm = (campo, valor) => {
    setAvisoGeralForm((atual) => ({
      ...atual,
      [campo]: valor,
      ...((campo === "prioridade" && valor === "critica") ? {
        allowClose: false,
        allowSnooze: false,
        requireConfirmation: true,
      } : {}),
      ...((campo === "requireConfirmation" && valor === false) ? {
        allowClose: true,
      } : {}),
    }));
  };

  const selecionarImagemAvisoGeral = (event) => {
    const arquivo = event.target.files?.[0];
    event.target.value = "";
    setAvisoGeralImageError("");

    if (!arquivo) return;

    const erroImagem = validarImagemAvisoGeral(arquivo);
    if (erroImagem) {
      setAvisoGeralImageError(erroImagem);
      return;
    }

    setAvisoGeralForm((atual) => ({
      ...atual,
      imageFile: arquivo,
      imagePreviewUrl: "",
      removeImage: false,
    }));

    const reader = new FileReader();
    reader.onload = () => {
      setAvisoGeralForm((atual) => (
        atual.imageFile === arquivo
          ? {
            ...atual,
            imagePreviewUrl: typeof reader.result === "string" ? reader.result : "",
          }
          : atual
      ));
    };
    reader.readAsDataURL(arquivo);
  };

  const removerImagemAvisoGeral = () => {
    setAvisoGeralImageError("");
    setAvisoGeralForm((atual) => ({
      ...atual,
      imageFile: null,
      imagePreviewUrl: "",
      imageUrl: "",
      removeImage: Boolean(atual.originalImageUrl || atual.imageUrl || atual.imagePreviewUrl || atual.imageFile),
    }));
  };

  const abrirPreviaAvisoGeral = () => {
    if (avisoGeralImageError) {
      alert(avisoGeralImageError);
      return;
    }

    setMostrarPreviaAvisoGeral(true);
  };

  const alterarMudancaAvisoGeral = (indice, campo, valor) => {
    setAvisoGeralForm((atual) => ({
      ...atual,
      changes: atual.changes.map((mudanca, mudancaIndice) => (
        mudancaIndice === indice
          ? { ...mudanca, [campo]: valor }
          : mudanca
      )),
    }));
  };

  const salvarAvisoGeral = async (event) => {
    event.preventDefault();

    const titulo = avisoGeralForm.titulo.trim();
    const mensagem = avisoGeralForm.mensagem.trim();
    const prioridade = avisoGeralForm.prioridade === "critica"
      ? "critica"
      : avisoGeralForm.prioridade;
    const changes = avisoGeralForm.changesEnabled
      ? avisoGeralForm.changes
        .map((mudanca) => ({
          icon: mudanca.icon || "info",
          title: mudanca.title.trim(),
          description: mudanca.description.trim(),
        }))
        .filter((mudanca) => mudanca.title || mudanca.description)
      : [];
    const importantInfo = avisoGeralForm.importantInfoEnabled
      ? avisoGeralForm.importantInfo
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean)
      : [];
    const actionTitle = avisoGeralForm.actionTitle.trim();
    const actionDescription = avisoGeralForm.actionDescription.trim();
    const actionRequired = avisoGeralForm.actionRequiredEnabled && (actionTitle || actionDescription)
      ? {
        title: actionTitle || "Ação necessária",
        description: actionDescription,
      }
      : null;
    const detailUrl = avisoGeralForm.detailEnabled ? avisoGeralForm.detailUrl.trim() : "";
    const startsAt = avisoGeralForm.publishMode === "scheduled"
      ? avisoGeralForm.startsAt
      : "";
    const endsAt = avisoGeralForm.endsAt.trim();
    const requireConfirmation = prioridade === "critica" || avisoGeralForm.requireConfirmation;

    if (!titulo || !mensagem) {
      alert("Preencha o título e a mensagem do aviso.");
      return;
    }

    if (avisoGeralImageError) {
      alert(avisoGeralImageError);
      return;
    }

    if (avisoGeralForm.imageFile) {
      const erroImagem = validarImagemAvisoGeral(avisoGeralForm.imageFile);
      if (erroImagem) {
        setAvisoGeralImageError(erroImagem);
        alert(erroImagem);
        return;
      }
    }

    try {
      setSalvandoAvisoGeral(true);
      const payload = new FormData();
      payload.append("titulo", titulo);
      payload.append("mensagem", mensagem);
      payload.append("type", avisoGeralForm.tipo.trim() || "Comunicado");
      payload.append("category", avisoGeralForm.categoria.trim() || "Geral");
      payload.append("priority", prioridade);
      payload.append("detailUrl", detailUrl);
      payload.append("detailButtonText", avisoGeralForm.detailButtonText.trim() || "Ver detalhes");
      payload.append("showNewBadge", avisoGeralForm.showNewBadge ? "1" : "0");
      payload.append("requireConfirmation", requireConfirmation ? "1" : "0");
      payload.append("allowClose", prioridade !== "critica" && avisoGeralForm.allowClose ? "1" : "0");
      payload.append("allowSnooze", prioridade !== "critica" && avisoGeralForm.allowSnooze ? "1" : "0");
      payload.append("startsAt", startsAt);
      payload.append("endsAt", endsAt);
      payload.append("ativo", avisoGeralForm.ativo ? "1" : "0");
      payload.append("remove_image", avisoGeralForm.removeImage ? "1" : "0");
      payload.append("sections", JSON.stringify({
        changes,
        importantInfo,
        actionRequired,
      }));

      if (avisoGeralForm.imageFile) {
        payload.append("imagem", avisoGeralForm.imageFile);
      }

      const { data } = await api.put("/admin/aviso-geral", payload, {
        headers: { ...headers, "Content-Type": "multipart/form-data" },
      });

      setAvisoGeral(data);
      setAvisoGeralForm(montarAvisoGeralForm(data));
      setAvisoGeralImageError("");

      alert(data.ativo
        ? "Aviso publicado. Todos os usuários precisarão confirmar para fechar."
        : "Aviso salvo como inativo.");
    } catch (err) {
      console.error("Erro ao salvar aviso geral:", err);
      alert(err.response?.data?.error || "Não foi possível salvar o aviso geral.");
    } finally {
      setSalvandoAvisoGeral(false);
    }
  };

  const logout = () => {
    disconnectSocket();
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  const grupoAcessosGerenciadoPorSetor = grupoGerenciadoPorSetor(grupoAcessos?.grupo);
  const grupoAcessosTemAlteracoes = Boolean(grupoAcessos?.usuarios?.some((usuario) => (
    Boolean(usuario.membro) !== Boolean(usuario.membroOriginal)
  )));
  const usuariosResponsaveisFeedback = useMemo(() => (
    usuarios.filter((usuario) => Boolean(usuario?.id) && usuario.perfil === "admin")
  ), [usuarios]);
  const feedbacksGerais = useMemo(() => (
    feedbacks.filter((feedback) => !ehDuvidaBoasPraticas(feedback))
  ), [feedbacks]);
  const feedbacksFiltrados = useMemo(() => {
    if (feedbackFiltro === "todos") return feedbacksGerais;
    if (feedbackFiltro === "bug" || feedbackFiltro === "sugestao" || feedbackFiltro === "pergunta") {
      return feedbacksGerais.filter((feedback) => feedback.tipo === feedbackFiltro);
    }

    return feedbacksGerais.filter((feedback) => feedback.status === feedbackFiltro);
  }, [feedbackFiltro, feedbacksGerais]);
  const duvidasPendentes = useMemo(() => (
    duvidasBoasPraticas.filter((duvida) => duvida.status !== 'resolvido')
  ), [duvidasBoasPraticas]);
  const feedbacksAbertos = useMemo(() => (
    feedbacksGerais.filter((feedback) => (feedback.status || "aberto") === "aberto").length
  ), [feedbacksGerais]);
  const duvidasRespondidas = useMemo(() => (
    duvidasBoasPraticas.filter((duvida) => duvida.status === 'resolvido' && duvida.resposta)
  ), [duvidasBoasPraticas]);
  const avisoGeralPreview = useMemo(() => {
    const changes = avisoGeralForm.changesEnabled
      ? avisoGeralForm.changes
        .map((mudanca) => ({
          icon: mudanca.icon,
          title: mudanca.title.trim(),
          description: mudanca.description.trim(),
        }))
        .filter((mudanca) => mudanca.title || mudanca.description)
      : [];
    const importantInfo = avisoGeralForm.importantInfoEnabled
      ? avisoGeralForm.importantInfo
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean)
      : [];
    const actionTitle = avisoGeralForm.actionTitle.trim();
    const actionDescription = avisoGeralForm.actionDescription.trim();

    return {
      titulo: avisoGeralForm.titulo.trim() || "Título do aviso",
      mensagem: avisoGeralForm.mensagem.trim() || "Mensagem principal do aviso.",
      tipo: avisoGeralForm.tipo,
      categoria: avisoGeralForm.categoria,
      prioridade: avisoGeralForm.prioridade,
      showNewBadge: avisoGeralForm.showNewBadge,
      detailUrl: avisoGeralForm.detailEnabled ? avisoGeralForm.detailUrl.trim() : "",
      detailButtonText: avisoGeralForm.detailButtonText.trim() || "Ver detalhes",
      allowSnooze: avisoGeralForm.prioridade !== "critica" && avisoGeralForm.allowSnooze,
      requireConfirmation: avisoGeralForm.prioridade === "critica" || avisoGeralForm.requireConfirmation,
      imageUrl: avisoGeralForm.removeImage
        ? ""
        : avisoGeralForm.imagePreviewUrl || avisoGeralForm.imageUrl,
      changes,
      importantInfo,
      actionRequired: avisoGeralForm.actionRequiredEnabled && (actionTitle || actionDescription)
        ? {
          title: actionTitle || "Ação necessária",
          description: actionDescription,
        }
        : null,
    };
  }, [avisoGeralForm]);
  const avisoGeralModalPreview = useMemo(() => {
    const dataPrevista = avisoGeralForm.publishMode === "scheduled" && avisoGeralForm.startsAt
      ? new Date(avisoGeralForm.startsAt)
      : null;
    const createdAt = dataPrevista && !Number.isNaN(dataPrevista.getTime())
      ? dataPrevista.toISOString()
      : new Date().toISOString();

    return {
      id: "admin-preview",
      title: avisoGeralPreview.titulo,
      message: avisoGeralPreview.mensagem,
      summary: avisoGeralPreview.mensagem,
      type: avisoGeralPreview.tipo,
      category: avisoGeralPreview.categoria,
      priority: avisoGeralPreview.prioridade,
      createdAt,
      updatedAt: createdAt,
      isNew: avisoGeralPreview.showNewBadge,
      allowClose: avisoGeralPreview.prioridade !== "critica" && avisoGeralForm.allowClose,
      allowSnooze: avisoGeralPreview.allowSnooze,
      detailUrl: avisoGeralPreview.detailUrl,
      detailButtonText: avisoGeralPreview.detailButtonText,
      requireConfirmation: avisoGeralPreview.requireConfirmation,
      imageUrl: avisoGeralPreview.imageUrl,
      createdByName: user?.nome || "",
      sections: {
        resume: avisoGeralPreview.mensagem,
        changes: avisoGeralPreview.changes,
        importantInfo: avisoGeralPreview.importantInfo,
        actionRequired: avisoGeralPreview.actionRequired,
      },
    };
  }, [avisoGeralForm.allowClose, avisoGeralForm.publishMode, avisoGeralForm.startsAt, avisoGeralPreview, user?.nome]);

  const obterStatusPillClass = (status) => {
    const classes = [styles.statusPill];

    if (status === 'resolvido') classes.push(styles.statusPillResolvido);
    else if (status === 'em_analise') classes.push(styles.statusPillAnalise);
    else if (status === 'ignorado') classes.push(styles.statusPillIgnorado);
    else classes.push(styles.statusPillAberto);

    return classes.join(' ');
  };

  const abrirSecaoAdmin = (secao) => {
    setSecaoAdmin(secao);
    window.history.replaceState(window.history.state, "", `#${secao}`);
    window.scrollTo({ top: 0 });
  };
  const contagensSecaoAdmin = {
    usuarios: { valor: usuarios.length },
    grupos: { valor: grupos.length },
    duvidas: { valor: duvidasPendentes.length, alerta: true },
    feedbacks: { valor: feedbacksAbertos, alerta: true },
  };

  if (loading) {
    return (
      <div className={`${styles.page} ${styles.consolePage}`}>
        <div className={styles.loading}>Carregando painel administrativo...</div>
      </div>
    );
  }

  return (
    <div className={`${styles.page} ${styles.consolePage}`}>
      {(confetesVendaTeste.length > 0 || fogosVendaTeste.length > 0 || celebracaoVendaTeste) && (
        <div className={styles.salesCelebrationLayer}>
          {fogosVendaTeste.map((fogo) => (
            <span
              key={fogo.id}
              className={styles.salesFirework}
              style={{
                "--sales-firework-color": fogo.cor,
                "--sales-firework-left": fogo.esquerda,
                "--sales-firework-delay": fogo.atraso,
                "--sales-firework-duration": fogo.duracao,
                "--sales-firework-rise": fogo.subida,
                "--sales-firework-drift": fogo.deslocamento,
                "--sales-firework-scale": fogo.escala,
              }}
              aria-hidden="true"
            >
              <span className={styles.salesFireworkComet} />
              <span className={styles.salesFireworkBurst}>
                {fogo.sparks.map((spark) => (
                  <i
                    key={spark.id}
                    className={styles.salesFireworkSpark}
                    style={{
                      "--sales-spark-angle": spark.angulo,
                      "--sales-spark-distance": spark.distancia,
                    }}
                  />
                ))}
              </span>
            </span>
          ))}

          {confetesVendaTeste.map((confete) => (
            <span
              key={confete.id}
              className={`${styles.salesConfettiPiece} ${
                confete.arredondado ? styles.salesConfettiRound : ""
              }`}
              style={{
                "--sales-confetti-color": confete.cor,
                "--sales-confetti-left": confete.esquerda,
                "--sales-confetti-delay": confete.atraso,
                "--sales-confetti-duration": confete.duracao,
                "--sales-confetti-size": confete.tamanho,
                "--sales-confetti-drift": confete.deslocamento,
                "--sales-confetti-rotate": confete.rotacao,
              }}
              aria-hidden="true"
            />
          ))}

          {celebracaoVendaTeste && (
            <div
              key={celebracaoVendaTeste.id}
              className={styles.salesBalloon}
              role="status"
              aria-live="polite"
            >
              <span className={styles.salesBalloonIcon}>✓</span>
              <span>
                <strong>Venda confirmada</strong>
                <small>Teste do efeito de comemoração</small>
              </span>
              <em>+1</em>
            </div>
          )}
        </div>
      )}

      <header className={styles.consoleTopbar}>
        <div className={styles.consoleBrand}>
          <span className={styles.consoleLogo}>
            <img src="/design-system/brand/acessanet-logo.png" alt="AcessaNet" width="86" height="32" />
          </span>
          <span className={styles.consoleBrandDivider} aria-hidden="true" />
          <div>
            <h1>Controle da empresa</h1>
            <p className={styles.subtitle}>
              {user.empresa_nome || "Empresa"} · {user.nome || "Administrador"}
            </p>
          </div>
        </div>

        <div className={styles.consoleTopActions}>
          <button type="button" className={styles.consoleGhostButton} onClick={voltarPaginaInterna}>
            <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
            Voltar
          </button>
          <button type="button" className={styles.consoleGhostDanger} onClick={logout}>
            <LogOut size={16} strokeWidth={2} aria-hidden="true" />
            Sair
          </button>
        </div>
      </header>

      {erro && <div className={styles.errorBox}>{erro}</div>}

      {usuarioSenha && (
        <div className={styles.modalOverlay}>
          <form className={styles.passwordModal} onSubmit={trocarSenhaUsuario}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Trocar senha</h2>
                <p>{usuarioSenha.nome} · {usuarioSenha.email}</p>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setUsuarioSenha(null)}
              >
                ×
              </button>
            </div>

            <label className={styles.passwordField}>
              Nova senha
              <input
                type="password"
                value={senhaAdmin.senha}
                onChange={(event) => setSenhaAdmin((atual) => ({
                  ...atual,
                  senha: event.target.value,
                }))}
                minLength="6"
                autoComplete="new-password"
                required
              />
            </label>

            <label className={styles.passwordField}>
              Confirmar senha
              <input
                type="password"
                value={senhaAdmin.confirmar}
                onChange={(event) => setSenhaAdmin((atual) => ({
                  ...atual,
                  confirmar: event.target.value,
                }))}
                minLength="6"
                autoComplete="new-password"
                required
              />
            </label>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setUsuarioSenha(null)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={styles.primaryButton}
                disabled={salvandoSenha}
              >
                {salvandoSenha ? "Salvando..." : "Atualizar senha"}
              </button>
            </div>
          </form>
        </div>
      )}

      {grupoAcessos && (
        <div className={styles.modalOverlay}>
          <div className={styles.accessModal}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Membros do grupo</h2>
                <p>
                  {grupoAcessos.grupo.nome} · {grupoAcessosGerenciadoPorSetor
                    ? `sincronizado com o setor ${grupoAcessos.grupo.setor_nome || "nao vinculado"}`
                    : "adicione ou remova pessoas deste grupo"}
                </p>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={fecharAcessosGrupo}
              >
                ×
              </button>
            </div>

            <div className={styles.accessSummary}>
              <span>{grupoAcessos.usuarios.filter((usuario) => usuario.membro).length} pessoas no grupo</span>
              <strong>
                {grupoAcessosGerenciadoPorSetor
                  ? `Setor · ${grupoAcessos.grupo.setor_nome || "nao vinculado"}`
                  : grupoAcessos.grupo.setor_nome
                  ? `Setor · ${grupoAcessos.grupo.setor_nome}`
                  : "Gerenciamento manual"}
              </strong>
            </div>

            <form className={styles.accessAddPanel} onSubmit={adicionarAcessoGrupo}>
              <label>
                Adicionar por
                <select
                  value={adicaoAcesso.tipo}
                  onChange={(event) => alterarAdicaoAcesso("tipo", event.target.value)}
                  disabled={salvandoAcessos || carregandoAcessos}
                >
                  <option value="usuario">Pessoa</option>
                  <option value="setor">Setor</option>
                  <option value="cargo">Cargo</option>
                </select>
              </label>

              {adicaoAcesso.tipo === "usuario" && (
                <label>
                  Pessoa
                  <select
                    value={adicaoAcesso.usuario_id}
                    onChange={(event) => alterarAdicaoAcesso("usuario_id", event.target.value)}
                    disabled={salvandoAcessos || carregandoAcessos}
                  >
                    <option value="" disabled>Selecione</option>
                    {grupoAcessos.usuarios
                      .filter((usuario) => !usuario.membro)
                      .map((usuario) => (
                        <option key={usuario.id} value={usuario.id}>
                          {usuario.nome} - {usuario.setor_nome || "Sem setor"}
                        </option>
                      ))}
                  </select>
                </label>
              )}

              {adicaoAcesso.tipo === "setor" && (
                <label>
                  Setor
                  <select
                    value={adicaoAcesso.setor_id}
                    onChange={(event) => alterarAdicaoAcesso("setor_id", event.target.value)}
                    disabled={salvandoAcessos || carregandoAcessos}
                  >
                    <option value="" disabled>Selecione</option>
                    {setores.map((setor) => (
                      <option key={setor.id} value={setor.id}>
                        {setor.nome}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {adicaoAcesso.tipo === "cargo" && (
                <label>
                  Cargo
                  <select
                    value={adicaoAcesso.perfil}
                    onChange={(event) => alterarAdicaoAcesso("perfil", event.target.value)}
                    disabled={salvandoAcessos || carregandoAcessos}
                  >
                    {perfilOptions.map((perfil) => (
                      <option key={perfil} value={perfil}>
                        {cargoLabel(perfil)}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <button
                type="submit"
                className={styles.primaryButton}
                disabled={salvandoAcessos || carregandoAcessos}
              >
                Adicionar
              </button>
            </form>

            <div className={styles.accessList}>
              {carregandoAcessos ? (
                <div className={styles.accessLoading}>Carregando acessos...</div>
              ) : grupoAcessos.usuarios.length === 0 ? (
                <div className={styles.accessLoading}>Nenhum usuario cadastrado.</div>
              ) : (
                grupoAcessos.usuarios.map((usuario) => {
                  const podeAlterar = !grupoAcessosGerenciadoPorSetor || usuario.membroOriginal;
                  const temAlteracao = Boolean(usuario.membro) !== Boolean(usuario.membroOriginal);
                  const textoStatus = usuario.membro
                    ? temAlteracao ? "Sera adicionado" : "No grupo"
                    : temAlteracao ? "Sera removido" : "Fora do grupo";

                  return (
                    <div
                      key={usuario.id}
                      className={`${styles.accessItem} ${
                        !podeAlterar ? styles.accessItemDisabled : ""
                      } ${
                        temAlteracao ? styles.accessItemPending : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(usuario.membro)}
                        disabled={!podeAlterar}
                        onChange={() => alternarAcessoGrupo(usuario.id)}
                      />
                      <div>
                        <strong>{usuario.nome}</strong>
                        <span>{usuario.setor_nome || "Sem setor"} · {usuario.email}</span>
                      </div>
                      <div className={styles.accessActions}>
                        <span className={usuario.membro ? styles.accessTagActive : styles.accessTag}>
                          {textoStatus}
                        </span>
                        {usuario.membro && podeAlterar && (
                          <button
                            type="button"
                            className={styles.smallDangerButton}
                            onClick={() => alternarAcessoGrupo(usuario.id)}
                            disabled={salvandoAcessos || carregandoAcessos}
                          >
                            Remover
                          </button>
                        )}
                        {!usuario.membro && podeAlterar && (
                          <button
                            type="button"
                            className={styles.smallSecondaryButton}
                            onClick={() => alternarAcessoGrupo(usuario.id)}
                            disabled={salvandoAcessos || carregandoAcessos}
                          >
                            Adicionar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={fecharAcessosGrupo}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={salvarAcessosGrupo}
                disabled={salvandoAcessos || carregandoAcessos || !grupoAcessosTemAlteracoes}
              >
                {salvandoAcessos ? "Salvando..." : "Salvar membros"}
              </button>
            </div>
          </div>
        </div>
      )}

      {grupoFixado && (
        <div className={styles.modalOverlay}>
          <form className={styles.passwordModal} onSubmit={salvarFixadoGrupo}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Mensagem fixada</h2>
                <p>{grupoFixado.nome} · aparece no topo do grupo</p>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={fecharFixadoGrupo}
                disabled={salvandoFixado}
              >
                ×
              </button>
            </div>

            <div className={styles.pinnedForm}>
              <label>
                Título
                <input
                  type="text"
                  value={fixadoForm.titulo}
                  onChange={(event) => alterarFixadoForm("titulo", event.target.value)}
                  maxLength="180"
                  required
                />
              </label>

              <label>
                Conteúdo
                <textarea
                  value={fixadoForm.conteudo}
                  onChange={(event) => alterarFixadoForm("conteudo", event.target.value)}
                  rows="6"
                  maxLength="3000"
                  placeholder="Ex.: Promoção atual, link do site, campanha ativa, texto padrão de atendimento..."
                />
              </label>

              <label className={styles.formCheckbox}>
                <input
                  type="checkbox"
                  checked={fixadoForm.ativo}
                  onChange={(event) => alterarFixadoForm("ativo", event.target.checked)}
                />
                Mostrar mensagem fixada no grupo
              </label>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={fecharFixadoGrupo}
                disabled={salvandoFixado}
              >
                Cancelar
              </button>
              <button type="submit" className={styles.primaryButton} disabled={salvandoFixado}>
                {salvandoFixado ? "Salvando..." : "Salvar fixado"}
              </button>
            </div>
          </form>
        </div>
      )}

      {!erro && (
        <>
          <div className={styles.consoleLayout}>
            <nav className={styles.consoleNav} aria-label="Seções do painel administrativo">
              <ul className={styles.consoleNavList}>
                {ADMIN_SECOES.map((secao) => {
                  const { id, label } = secao;
                  const contagem = contagensSecaoAdmin[id];
                  const ativo = secaoAdmin === id;

                  return (
                    <li key={id}>
                      <button
                        type="button"
                        className={`${styles.consoleNavItem} ${ativo ? styles.consoleNavItemActive : ""}`}
                        aria-current={ativo ? "page" : undefined}
                        onClick={() => abrirSecaoAdmin(id)}
                      >
                        <secao.Icone size={18} strokeWidth={1.9} aria-hidden="true" />
                        <span>{label}</span>
                        {contagem?.valor > 0 && (
                          <em className={contagem.alerta ? styles.consoleNavCountAlert : styles.consoleNavCount}>
                            {contagem.valor}
                          </em>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className={styles.consoleNavTools}>
                <span className={styles.consoleNavHeading}>Ferramentas</span>
                {ADMIN_FERRAMENTAS.map((ferramenta) => (
                  <button
                    key={ferramenta.id}
                    type="button"
                    className={styles.consoleNavTool}
                    onClick={() => navigate(ferramenta.rota)}
                  >
                    <ferramenta.Icone size={16} strokeWidth={1.9} aria-hidden="true" />
                    <span>{ferramenta.label}</span>
                    <ArrowUpRight size={14} strokeWidth={2} aria-hidden="true" className={styles.consoleNavToolArrow} />
                  </button>
                ))}
              </div>
            </nav>

            <main className={styles.consoleMain}>
              {secaoAdmin === "visao-geral" && (
                <div className={styles.consoleOverview}>
                  <div className={styles.consolePanelHeader}>
                    <h2>Visão geral</h2>
                    <p>Resumo da empresa e atalhos de administração.</p>
                  </div>

                  <div className={styles.consoleStats}>
                    <button type="button" className={styles.consoleStat} onClick={() => abrirSecaoAdmin("usuarios")}>
                      <span><Users size={16} strokeWidth={1.9} aria-hidden="true" /> Usuários</span>
                      <strong>{resumo?.total_usuarios || 0}</strong>
                    </button>
                    <div className={styles.consoleStat}>
                      <span><i className={styles.consoleOnlineDot} aria-hidden="true" /> Online agora</span>
                      <strong>{resumo?.status?.online || 0}</strong>
                    </div>
                    <button type="button" className={styles.consoleStat} onClick={() => abrirSecaoAdmin("grupos")}>
                      <span><UsersRound size={16} strokeWidth={1.9} aria-hidden="true" /> Grupos</span>
                      <strong>{resumo?.total_grupos || 0}</strong>
                    </button>
                    <button
                      type="button"
                      className={`${styles.consoleStat} ${duvidasPendentes.length > 0 ? styles.consoleStatAttention : ""}`}
                      onClick={() => abrirSecaoAdmin("duvidas")}
                    >
                      <span><MessageCircleQuestion size={16} strokeWidth={1.9} aria-hidden="true" /> Dúvidas pendentes</span>
                      <strong>{duvidasPendentes.length}</strong>
                    </button>
                    <button
                      type="button"
                      className={`${styles.consoleStat} ${feedbacksAbertos > 0 ? styles.consoleStatAttention : ""}`}
                      onClick={() => abrirSecaoAdmin("feedbacks")}
                    >
                      <span><MessageSquareWarning size={16} strokeWidth={1.9} aria-hidden="true" /> Feedbacks abertos</span>
                      <strong>{feedbacksAbertos}</strong>
                    </button>
                  </div>

                  <button type="button" className={styles.consoleNoticeCard} onClick={() => abrirSecaoAdmin("aviso-interno")}>
                    <span className={styles.consoleNoticeIcon} aria-hidden="true">
                      <Megaphone size={20} strokeWidth={1.9} />
                    </span>
                    <span className={styles.consoleNoticeBody}>
                      <small className={avisoGeral?.ativo ? styles.consoleNoticeLive : ""}>
                        {avisoGeral?.ativo ? "Aviso interno ativo" : "Nenhum aviso ativo"}
                      </small>
                      <strong>{avisoGeral?.titulo || "Aviso interno obrigatório"}</strong>
                      <span>
                        {avisoGeral
                          ? `${avisoGeral.confirmacoes || 0} confirmações · ${avisoGeral.pendentes || 0} pendentes`
                          : "Publique um aviso para que todos confirmem a leitura."}
                      </span>
                    </span>
                    <span className={styles.consoleNoticeAction}>
                      Editar aviso
                      <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
                    </span>
                  </button>

                  <div className={styles.consolePanelHeader}>
                    <h3>Ferramentas</h3>
                  </div>

                  <div className={styles.consoleToolsGrid}>
                    {ADMIN_FERRAMENTAS.map((ferramenta) => (
                      <button key={ferramenta.id} type="button" className={styles.consoleTool} onClick={() => navigate(ferramenta.rota)}>
                        <span className={styles.consoleToolIcon} aria-hidden="true">
                          <ferramenta.Icone size={19} strokeWidth={1.9} />
                        </span>
                        <span className={styles.consoleToolText}>
                          <strong>{ferramenta.label}</strong>
                          <small>{ferramenta.descricao}</small>
                        </span>
                        <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" className={styles.consoleToolArrow} />
                      </button>
                    ))}
                    <button
                      type="button"
                      className={styles.consoleTool}
                      onClick={testarEfeitoVenda}
                      disabled={testandoEfeitoVenda}
                    >
                      <span className={`${styles.consoleToolIcon} ${styles.consoleToolIconCelebrate}`} aria-hidden="true">
                        <PartyPopper size={19} strokeWidth={1.9} />
                      </span>
                      <span className={styles.consoleToolText}>
                        <strong>{testandoEfeitoVenda ? "Disparando teste..." : "Testar efeito de venda"}</strong>
                        <small>Mostra a comemoração de venda só nesta tela.</small>
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {secaoAdmin === "usuarios" && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2>Usuários</h2>
                  <p>Setor, permissão administrativa e criação de acesso.</p>
                </div>
                <button type="button" className={styles.primaryButton} onClick={abrirCadastroUsuario}>
                  Adicionar usuário
                </button>
              </div>

              {mostrarCadastroUsuario && (
                <form className={styles.userForm} onSubmit={criarUsuario}>
                  <div className={styles.formGrid}>
                    <label>
                      Nome
                      <input
                        type="text"
                        value={novoUsuario.nome}
                        onChange={(event) => alterarNovoUsuario("nome", event.target.value)}
                        placeholder="Nome do usuario"
                        required
                      />
                    </label>

                    <label>
                      Email
                      <input
                        type="email"
                        value={novoUsuario.email}
                        onChange={(event) => alterarNovoUsuario("email", event.target.value)}
                        placeholder="usuario@empresa.com"
                        required
                      />
                    </label>

                    <label>
                      Senha
                      <input
                        type="password"
                        value={novoUsuario.senha}
                        onChange={(event) => alterarNovoUsuario("senha", event.target.value)}
                        placeholder="Minimo 6 caracteres"
                        minLength="6"
                        required
                      />
                    </label>

                    <label>
                      Setor
                      <select
                        value={novoUsuario.setor_id}
                        onChange={(event) => alterarNovoUsuario("setor_id", event.target.value)}
                        required
                      >
                        <option value="" disabled>Selecione</option>
                        {setores.map((setor) => (
                          <option key={setor.id} value={setor.id}>
                            {setor.nome}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Perfil
                      <select
                        value={novoUsuario.perfil}
                        onChange={(event) => alterarNovoUsuario("perfil", event.target.value)}
                      >
                        {perfilOptions.map((option) => (
                          <option key={option} value={option}>{cargoLabel(option)}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className={styles.formActions}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => setMostrarCadastroUsuario(false)}
                    >
                      Cancelar
                    </button>
                    <button type="submit" className={styles.primaryButton} disabled={salvandoUsuario}>
                      {salvandoUsuario ? "Salvando..." : "Criar acesso"}
                    </button>
                  </div>
                </form>
              )}

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Usuário</th>
                      <th>Setor</th>
                      <th>Cargo</th>
                      <th>Mensagens</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map((usuario) => (
                      <tr key={usuario.id}>
                        <td>
                          <button
                            type="button"
                            className={styles.linkButton}
                            onClick={() => verHistoricoUsuario(usuario.id)}
                          >
                            <strong>{usuario.nome}</strong>
                          </button>
                          <span>{usuario.email}</span>
                          <span>{usuario.setor_nome || "Sem setor"}</span>
                        </td>
                        <td>
                          <select
                            value={usuario.setor_id || ""}
                            onChange={(event) => atualizarUsuario(usuario, "setor_id", event.target.value)}
                            className={styles.select}
                          >
                            <option value="" disabled>Sem setor</option>
                            {setores.map((setor) => (
                              <option key={setor.id} value={setor.id}>{setor.nome}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            value={usuario.perfil || "usuario"}
                            onChange={(event) => atualizarUsuario(usuario, "perfil", event.target.value)}
                            className={styles.select}
                          >
                            {perfilOptions.map((option) => (
                              <option key={option} value={option}>{cargoLabel(option)}</option>
                            ))}
                          </select>
                        </td>
                        <td>{usuario.mensagens_enviadas}</td>
                        <td>
                          <div className={styles.actionGroup}>
                            <button
                              type="button"
                              className={styles.smallSecondaryButton}
                              onClick={() => abrirTrocaSenha(usuario)}
                            >
                              Senha
                            </button>
                            <button
                              type="button"
                              className={styles.smallDangerButton}
                              onClick={() => excluirUsuario(usuario)}
                              disabled={usuario.id === user.id}
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
              )}

              {secaoAdmin === "grupos" && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2>Grupos</h2>
                  <p>Grupos da empresa e pessoas que participam de cada conversa.</p>
                </div>
                <button type="button" className={styles.primaryButton} onClick={abrirCadastroGrupo}>
                  Criar grupo
                </button>
              </div>

              {mostrarCadastroGrupo && (
                <form className={styles.userForm} onSubmit={criarGrupo}>
                  <div className={styles.formGrid}>
                    <label>
                      Nome do grupo
                      <input
                        type="text"
                        value={novoGrupo.nome}
                        onChange={(event) => alterarNovoGrupo("nome", event.target.value)}
                        placeholder="Ex.: Diretoria"
                        minLength="2"
                        maxLength="80"
                        required
                      />
                    </label>

                    <label>
                      Descricao
                      <textarea
                        value={novoGrupo.descricao}
                        onChange={(event) => alterarNovoGrupo("descricao", event.target.value)}
                        placeholder="Descricao curta do grupo"
                        maxLength="255"
                        rows="3"
                      />
                    </label>
                  </div>

                  <label className={styles.formCheckbox}>
                    <input
                      type="checkbox"
                      checked={novoGrupo.acessoTodos}
                      onChange={(event) => alterarNovoGrupo("acessoTodos", event.target.checked)}
                    />
                    Adicionar todos os usuarios agora
                  </label>

                  <div className={styles.formActions}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => setMostrarCadastroGrupo(false)}
                    >
                      Cancelar
                    </button>
                    <button type="submit" className={styles.primaryButton} disabled={salvandoGrupo}>
                      {salvandoGrupo ? "Criando..." : "Criar grupo"}
                    </button>
                  </div>
                </form>
              )}

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Grupo</th>
                      <th>Membros</th>
                      <th>Mensagens</th>
                      <th>Atualizado</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grupos.length === 0 ? (
                      <tr>
                        <td colSpan="5" className={styles.emptyCell}>Nenhum grupo cadastrado.</td>
                      </tr>
                    ) : (
                      grupos.map((grupo) => (
                        <tr key={grupo.id}>
                          <td>
                            <strong>
                              {grupo.nome}
                              {(grupo.fixo || grupo.setor_id) && (
                                <span className={styles.fixedGroupTag}>
                                  {grupo.setor_id ? "Setor" : "Fixo"}
                                </span>
                              )}
                            </strong>
                            <span>{grupo.descricao || "Sem descricao"}</span>
                          </td>
                          <td>{grupo.total_membros}</td>
                          <td>{grupo.total_mensagens}</td>
                          <td>{formatarData(grupo.atualizado_em)}</td>
                          <td>
                            <div className={styles.actionGroup}>
                              <button
                                type="button"
                                className={styles.smallSecondaryButton}
                                onClick={() => abrirAcessosGrupo(grupo)}
                              >
                                Membros
                              </button>
                              <button
                                type="button"
                                className={styles.smallSecondaryButton}
                                onClick={() => abrirFixadoGrupo(grupo)}
                              >
                                Fixado
                              </button>
                              <button
                                type="button"
                                className={styles.smallDangerButton}
                                onClick={() => excluirGrupo(grupo)}
                              >
                                Excluir
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
              )}

              {secaoAdmin === "aviso-interno" && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <h2>Aviso interno obrigatório</h2>
                <p>Mensagem exibida para todos até cada usuário marcar o V de confirmação.</p>
              </div>
            </div>

            <form className={styles.noticeForm} onSubmit={salvarAvisoGeral}>
              <div className={styles.noticeEditorLayout}>
                <div className={styles.noticeEditorFields}>
                  <section className={styles.noticeSubsection}>
                    <div className={styles.noticeSubsectionHeader}>
                      <strong>Dados principais</strong>
                      <span>Obrigatório</span>
                    </div>

                    <div className={styles.formGrid}>
                      <label className={styles.formWide}>
                        Título do aviso
                        <input
                          type="text"
                          value={avisoGeralForm.titulo}
                          onChange={(event) => alterarAvisoGeralForm("titulo", event.target.value)}
                          maxLength="180"
                          required
                        />
                      </label>

                      <label className={styles.formWide}>
                        Mensagem principal
                        <textarea
                          value={avisoGeralForm.mensagem}
                          onChange={(event) => alterarAvisoGeralForm("mensagem", event.target.value)}
                          rows="4"
                          maxLength="3000"
                          required
                        />
                      </label>

                      <label>
                        Tipo do aviso
                        <select
                          value={avisoGeralForm.tipo}
                          onChange={(event) => alterarAvisoGeralForm("tipo", event.target.value)}
                        >
                          {TIPOS_AVISO_GERAL.map((tipo) => (
                            <option key={tipo} value={tipo}>{tipo}</option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Categoria
                        <select
                          value={avisoGeralForm.categoria}
                          onChange={(event) => alterarAvisoGeralForm("categoria", event.target.value)}
                        >
                          {CATEGORIAS_AVISO_GERAL.map((categoria) => (
                            <option key={categoria} value={categoria}>{categoria}</option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Prioridade
                        <select
                          value={avisoGeralForm.prioridade}
                          onChange={(event) => alterarAvisoGeralForm("prioridade", event.target.value)}
                        >
                          {PRIORIDADES_AVISO_GERAL.map((prioridade) => (
                            <option key={prioridade.valor} value={prioridade.valor}>
                              {prioridade.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </section>

                  <section className={styles.noticeSubsection}>
                    <div className={styles.noticeSubsectionHeader}>
                      <strong>Imagem do aviso</strong>
                      <span>Opcional</span>
                    </div>

                    <div className={styles.noticeImageUploader}>
                      <label className={styles.noticeImageInput}>
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                          onChange={selecionarImagemAvisoGeral}
                        />
                        <span>
                          <Upload size={16} />
                          Escolher imagem
                        </span>
                        <small>JPG, PNG ou WEBP até {AVISO_GERAL_IMAGE_MAX_SIZE_MB} MB</small>
                      </label>

                      {avisoGeralPreview.imageUrl ? (
                        <div className={styles.noticeImagePreviewBox}>
                          <img src={avisoGeralPreview.imageUrl} alt="Prévia da imagem do aviso" />
                          <div>
                            <strong>{avisoGeralForm.imageFile ? "Prévia selecionada" : "Imagem atual"}</strong>
                            <span>Será exibida como miniatura recolhida para os usuários.</span>
                            <button
                              type="button"
                              className={styles.smallSecondaryButton}
                              onClick={removerImagemAvisoGeral}
                            >
                              <X size={15} />
                              Remover imagem
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className={styles.noticeImageEmpty}>
                          <ImageIcon size={18} />
                          <span>
                            {avisoGeralForm.removeImage
                              ? "Imagem marcada para remoção ao salvar."
                              : "Nenhuma imagem vinculada a este aviso."}
                          </span>
                        </div>
                      )}

                      {avisoGeralImageError && (
                        <p className={styles.noticeImageError}>{avisoGeralImageError}</p>
                      )}
                    </div>
                  </section>

                  <section className={styles.noticeSubsection}>
                    <div className={styles.noticeSubsectionHeader}>
                      <strong>Opções de conteúdo</strong>
                      <span>Opcional</span>
                    </div>

                    <div className={styles.noticeOptionStack}>
                      <label className={styles.noticeToggle}>
                        <span>
                          <input
                            type="checkbox"
                            checked={avisoGeralForm.changesEnabled}
                            onChange={(event) => alterarAvisoGeralForm("changesEnabled", event.target.checked)}
                          />
                          Adicionar seção “O que mudou”
                        </span>
                      </label>

                      {avisoGeralForm.changesEnabled && (
                        <div className={styles.noticeChangeGrid}>
                          {avisoGeralForm.changes.map((mudanca, indice) => (
                            <fieldset className={styles.noticeChangeItem} key={`mudanca-${indice}`}>
                              <legend>{`Card ${indice + 1}`}</legend>

                              <label>
                                Ícone
                                <select
                                  value={mudanca.icon}
                                  onChange={(event) => alterarMudancaAvisoGeral(indice, "icon", event.target.value)}
                                >
                                  {ICONES_AVISO_GERAL.map((icone) => (
                                    <option key={icone.valor} value={icone.valor}>
                                      {icone.label}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <label>
                                Título
                                <input
                                  type="text"
                                  value={mudanca.title}
                                  onChange={(event) => alterarMudancaAvisoGeral(indice, "title", event.target.value)}
                                  maxLength="120"
                                />
                              </label>

                              <label>
                                Descrição
                                <textarea
                                  value={mudanca.description}
                                  onChange={(event) => alterarMudancaAvisoGeral(indice, "description", event.target.value)}
                                  rows="2"
                                  maxLength="260"
                                />
                              </label>
                            </fieldset>
                          ))}
                        </div>
                      )}

                      <label className={styles.noticeToggle}>
                        <span>
                          <input
                            type="checkbox"
                            checked={avisoGeralForm.importantInfoEnabled}
                            onChange={(event) => alterarAvisoGeralForm("importantInfoEnabled", event.target.checked)}
                          />
                          Adicionar “Informações importantes”
                        </span>
                      </label>

                      {avisoGeralForm.importantInfoEnabled && (
                        <label>
                          Itens da lista
                          <textarea
                            value={avisoGeralForm.importantInfo}
                            onChange={(event) => alterarAvisoGeralForm("importantInfo", event.target.value)}
                            rows="4"
                            maxLength="1200"
                          />
                        </label>
                      )}

                      <label className={styles.noticeToggle}>
                        <span>
                          <input
                            type="checkbox"
                            checked={avisoGeralForm.actionRequiredEnabled}
                            onChange={(event) => alterarAvisoGeralForm("actionRequiredEnabled", event.target.checked)}
                          />
                          Adicionar “Ação necessária”
                        </span>
                      </label>

                      {avisoGeralForm.actionRequiredEnabled && (
                        <div className={styles.noticeActionGrid}>
                          <label>
                            Título da ação
                            <input
                              type="text"
                              value={avisoGeralForm.actionTitle}
                              onChange={(event) => alterarAvisoGeralForm("actionTitle", event.target.value)}
                              maxLength="120"
                            />
                          </label>

                          <label>
                            Descrição da ação
                            <textarea
                              value={avisoGeralForm.actionDescription}
                              onChange={(event) => alterarAvisoGeralForm("actionDescription", event.target.value)}
                              rows="3"
                              maxLength="500"
                            />
                          </label>
                        </div>
                      )}

                      <label className={styles.noticeToggle}>
                        <span>
                          <input
                            type="checkbox"
                            checked={avisoGeralForm.detailEnabled}
                            onChange={(event) => alterarAvisoGeralForm("detailEnabled", event.target.checked)}
                          />
                          Adicionar botão “Ver detalhes”
                        </span>
                      </label>

                      {avisoGeralForm.detailEnabled && (
                        <div className={styles.noticeActionGrid}>
                          <label>
                            URL ou rota interna
                            <input
                              type="text"
                              value={avisoGeralForm.detailUrl}
                              onChange={(event) => alterarAvisoGeralForm("detailUrl", event.target.value)}
                              maxLength="500"
                              placeholder="/avisos-internos"
                            />
                          </label>

                          <label>
                            Texto do botão
                            <input
                              type="text"
                              value={avisoGeralForm.detailButtonText}
                              onChange={(event) => alterarAvisoGeralForm("detailButtonText", event.target.value)}
                              maxLength="80"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  </section>

                  <section className={styles.noticeSubsection}>
                    <div className={styles.noticeSubsectionHeader}>
                      <strong>Configurações</strong>
                      <span>Exibição</span>
                    </div>

                    <div className={styles.noticeConfigGrid}>
                      <label className={styles.noticeToggle}>
                        <span>
                          <input
                            type="checkbox"
                            checked={avisoGeralForm.ativo}
                            onChange={(event) => alterarAvisoGeralForm("ativo", event.target.checked)}
                          />
                          Aviso ativo
                        </span>
                      </label>

                      <label className={styles.noticeToggle}>
                        <span>
                          <input
                            type="checkbox"
                            checked={avisoGeralForm.showNewBadge}
                            onChange={(event) => alterarAvisoGeralForm("showNewBadge", event.target.checked)}
                          />
                          Exibir badge “NOVO”
                        </span>
                      </label>

                      <label className={styles.noticeToggle}>
                        <span>
                          <input
                            type="checkbox"
                            checked={avisoGeralForm.requireConfirmation}
                            disabled={avisoGeralForm.prioridade === "critica"}
                            onChange={(event) => alterarAvisoGeralForm("requireConfirmation", event.target.checked)}
                          />
                          Exigir confirmação de leitura
                        </span>
                      </label>

                      <label className={styles.noticeToggle}>
                        <span>
                          <input
                            type="checkbox"
                            checked={avisoGeralForm.allowClose}
                            disabled={avisoGeralForm.prioridade === "critica"}
                            onChange={(event) => alterarAvisoGeralForm("allowClose", event.target.checked)}
                          />
                          Permitir fechar pelo X
                        </span>
                      </label>

                      <label className={styles.noticeToggle}>
                        <span>
                          <input
                            type="checkbox"
                            checked={avisoGeralForm.allowSnooze}
                            disabled={avisoGeralForm.prioridade === "critica"}
                            onChange={(event) => alterarAvisoGeralForm("allowSnooze", event.target.checked)}
                          />
                          Permitir “Lembrar depois”
                        </span>
                      </label>
                    </div>
                  </section>

                  <section className={styles.noticeSubsection}>
                    <div className={styles.noticeSubsectionHeader}>
                      <strong>Agendamento</strong>
                      <span>Opcional</span>
                    </div>

                    <div className={styles.formGrid}>
                      <label>
                        Publicação
                        <select
                          value={avisoGeralForm.publishMode}
                          onChange={(event) => alterarAvisoGeralForm("publishMode", event.target.value)}
                        >
                          <option value="now">Publicar agora</option>
                          <option value="scheduled">Agendar publicação</option>
                        </select>
                      </label>

                      {avisoGeralForm.publishMode === "scheduled" && (
                        <label>
                          Início
                          <input
                            type="datetime-local"
                            value={avisoGeralForm.startsAt}
                            onChange={(event) => alterarAvisoGeralForm("startsAt", event.target.value)}
                          />
                        </label>
                      )}

                      <label>
                        Término opcional
                        <input
                          type="datetime-local"
                          value={avisoGeralForm.endsAt}
                          onChange={(event) => alterarAvisoGeralForm("endsAt", event.target.value)}
                        />
                      </label>
                    </div>
                  </section>
                </div>

                <aside className={styles.noticePreviewPanel}>
                  <span className={styles.noticePreviewEyebrow}>Prévia ao vivo</span>
                  <div className={styles.noticePreviewCard}>
                    <div className={styles.noticePreviewHeader}>
                      <div>
                        <span>Aviso interno</span>
                        {avisoGeralPreview.showNewBadge && <em>NOVO</em>}
                      </div>
                      <h3>{avisoGeralPreview.titulo}</h3>
                      <p>{avisoGeralPreview.mensagem}</p>
                    </div>

                    <div className={styles.noticePreviewChips}>
                      {avisoGeralPreview.tipo && <span>{avisoGeralPreview.tipo}</span>}
                      {avisoGeralPreview.categoria && <span>{avisoGeralPreview.categoria}</span>}
                      <span>{`Prioridade ${avisoGeralPreview.prioridade}`}</span>
                    </div>

                    {avisoGeralPreview.imageUrl && (
                      <div className={styles.noticePreviewImage}>
                        <span>
                          <ImageIcon size={14} />
                          Ver imagem do aviso
                        </span>
                        <img src={avisoGeralPreview.imageUrl} alt="Imagem do aviso" />
                      </div>
                    )}

                    {avisoGeralPreview.changes.length > 0 && (
                      <div className={styles.noticePreviewBlock}>
                        <strong>O que mudou</strong>
                        {avisoGeralPreview.changes.map((mudanca, indice) => (
                          <p key={`${mudanca.title}-${indice}`}>
                            {mudanca.title || mudanca.description}
                          </p>
                        ))}
                      </div>
                    )}

                    {avisoGeralPreview.importantInfo.length > 0 && (
                      <div className={styles.noticePreviewBlock}>
                        <strong>Informações importantes</strong>
                        {avisoGeralPreview.importantInfo.map((item) => (
                          <p key={item}>{item}</p>
                        ))}
                      </div>
                    )}

                    {avisoGeralPreview.actionRequired && (
                      <div className={styles.noticePreviewAction}>
                        <strong>{avisoGeralPreview.actionRequired.title}</strong>
                        {avisoGeralPreview.actionRequired.description && (
                          <p>{avisoGeralPreview.actionRequired.description}</p>
                        )}
                      </div>
                    )}

                    <div className={styles.noticePreviewButtons}>
                      {avisoGeralPreview.detailUrl && <span>{avisoGeralPreview.detailButtonText}</span>}
                      {avisoGeralPreview.allowSnooze && <span>Lembrar depois</span>}
                      <strong>
                        {avisoGeralPreview.requireConfirmation ? "Confirmar leitura" : "Fechar aviso"}
                      </strong>
                    </div>
                  </div>
                </aside>
              </div>

              <div className={styles.noticeStatusRow}>
                <span>
                  {avisoGeral?.ativo ? "Ativo" : "Inativo"}
                  {avisoGeral?.id ? ` · aviso #${avisoGeral.id}` : ""}
                </span>
                <span>
                  {avisoGeral
                    ? `${avisoGeral.confirmacoes || 0} confirmações · ${avisoGeral.pendentes || 0} pendentes`
                    : "Nenhum aviso publicado"}
                </span>
                {avisoGeral?.atualizado_em && (
                  <span>Atualizado em {formatarData(avisoGeral.atualizado_em)}</span>
                )}
              </div>

              {avisoGeral && (
                <div className={styles.noticeConfirmationsGrid}>
                  <section className={styles.noticeConfirmationBox}>
                    <div className={styles.noticeConfirmationHeader}>
                      <strong>Quem confirmou</strong>
                      <span>{avisoGeral.confirmados?.length || 0}</span>
                    </div>

                    <div className={styles.noticeUserList}>
                      {avisoGeral.confirmados?.length ? (
                        avisoGeral.confirmados.map((usuario) => (
                          <div className={styles.noticeUserItem} key={usuario.id}>
                            <div>
                              <strong>{usuario.nome}</strong>
                              <span>{usuario.setor_nome || usuario.email || "Sem setor"}</span>
                            </div>
                            <time>{formatarData(usuario.confirmado_em)}</time>
                          </div>
                        ))
                      ) : (
                        <p className={styles.noticeEmptyState}>Ninguém confirmou ainda.</p>
                      )}
                    </div>
                  </section>

                  <section className={styles.noticeConfirmationBox}>
                    <div className={styles.noticeConfirmationHeader}>
                      <strong>Pendentes</strong>
                      <span>{avisoGeral.usuarios_pendentes?.length || 0}</span>
                    </div>

                    <div className={styles.noticeUserList}>
                      {avisoGeral.usuarios_pendentes?.length ? (
                        avisoGeral.usuarios_pendentes.map((usuario) => (
                          <div className={styles.noticeUserItem} key={usuario.id}>
                            <div>
                              <strong>{usuario.nome}</strong>
                              <span>{usuario.setor_nome || usuario.email || "Sem setor"}</span>
                            </div>
                            <small>Aguardando</small>
                          </div>
                        ))
                      ) : (
                        <p className={styles.noticeEmptyState}>Todos confirmaram este aviso.</p>
                      )}
                    </div>
                  </section>
                </div>
              )}

              <div className={styles.formActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={abrirPreviaAvisoGeral}
                >
                  <Eye size={16} />
                  Pré-visualizar aviso
                </button>
                <button type="submit" className={styles.primaryButton} disabled={salvandoAvisoGeral}>
                  {salvandoAvisoGeral ? "Salvando..." : "Publicar aviso"}
                </button>
              </div>
            </form>
          </section>
              )}

              {secaoAdmin === "duvidas" && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <h2>Dúvidas Respondidas</h2>
                <p>Perguntas enviadas pela página “Dúvidas Respondidas”. Responda para fixar a dúvida para toda a equipe.</p>
              </div>
            </div>

            <div className={styles.qaSummaryGrid}>
              <div className={styles.qaSummaryCard}>
                <span>Pendentes</span>
                <strong>{duvidasPendentes.length}</strong>
              </div>
              <div className={styles.qaSummaryCard}>
                <span>Fixadas</span>
                <strong>{duvidasRespondidas.length}</strong>
              </div>
              <div className={styles.qaSummaryCard}>
                <span>Total recebido</span>
                <strong>{duvidasBoasPraticas.length}</strong>
              </div>
            </div>

            <div className={styles.tableWrap}>
              <table className={`${styles.table} ${styles.qaTable}`}>
                <thead>
                  <tr>
                    <th>Funcionário</th>
                    <th>Pergunta</th>
                    <th>Status</th>
                    <th>Resposta fixada</th>
                    <th>Respondido por</th>
                    <th>Enviado</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {duvidasBoasPraticas.length === 0 ? (
                    <tr>
                      <td colSpan="7" className={styles.emptyCell}>Nenhuma dúvida enviada ainda.</td>
                    </tr>
                  ) : (
                    duvidasBoasPraticas.map((duvida) => (
                      <tr key={duvida.id}>
                        <td>
                          <strong>{duvida.nome}</strong>
                          <span>{duvida.setor || "Sem setor informado"}</span>
                        </td>
                        <td className={styles.messageCell}>{duvida.descricao}</td>
                        <td>
                          <span className={obterStatusPillClass(duvida.status || 'aberto')}>
                            {feedbackStatusLabel[duvida.status] || "Aberto"}
                          </span>
                        </td>
                        <td className={styles.messageCell}>
                          {duvida.resposta ? (
                            duvida.resposta
                          ) : (
                            <span className={styles.mutedText}>Aguardando resposta dos administradores.</span>
                          )}
                        </td>
                        <td>
                          {duvida.resolvido_por_nome || "-"}
                          {duvida.status === "resolvido" && duvida.resolvido_em ? (
                            <span>Fixada em {formatarData(duvida.resolvido_em)}</span>
                          ) : (
                            <span>Será fixada ao responder</span>
                          )}
                        </td>
                        <td>{formatarData(duvida.created_at)}</td>
                        <td>
                          <div className={styles.actionGroup}>
                            <button
                              type="button"
                              className={styles.smallSecondaryButton}
                              onClick={() => abrirRespostaModal(duvida, 'duvida')}
                              disabled={salvandoFeedbackStatus === duvida.id}
                            >
                              <MessageSquareReply size={14} />
                              {duvida.resposta ? "Editar" : "Responder"}
                            </button>
                            <button
                              type="button"
                              className={styles.smallDangerButton}
                              onClick={() => excluirFeedback(duvida)}
                              disabled={
                                excluindoFeedback === duvida.id
                                || salvandoFeedbackStatus === duvida.id
                              }
                            >
                              <Trash2 size={14} />
                              {excluindoFeedback === duvida.id ? "Excluindo..." : "Excluir"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
              )}

              {secaoAdmin === "feedbacks" && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <h2>Feedbacks recebidos</h2>
                <p>Bugs, sugestões e demais feedbacks enviados pelos funcionários.</p>
              </div>
            </div>

            <div className={styles.filters}>
              <div className={styles.segmented}>
                {feedbackFiltros.map((filtro) => (
                  <button
                    key={filtro.id}
                    type="button"
                    className={feedbackFiltro === filtro.id ? styles.activeSegment : ""}
                    onClick={() => setFeedbackFiltro(filtro.id)}
                  >
                    {filtro.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
	                <thead>
	                  <tr>
	                    <th>Funcionário</th>
	                    <th>Tipo</th>
	                    <th>Prioridade</th>
	                    <th>Página</th>
	                    <th>Descrição</th>
	                    <th>Resposta</th>
		                    <th>Status</th>
		                    <th>Resolvido por</th>
		                    <th>Enviado</th>
		                    <th>Ações</th>
		                  </tr>
		                </thead>
		                <tbody>
		                  {feedbacksFiltrados.length === 0 ? (
		                    <tr>
		                      <td colSpan="10" className={styles.emptyCell}>Nenhum feedback encontrado.</td>
		                    </tr>
		                  ) : (
	                    feedbacksFiltrados.map((feedback) => (
	                      <tr key={feedback.id}>
	                        <td>
	                          <strong>{feedback.nome}</strong>
	                          <span>{feedback.setor || "Sem setor informado"}</span>
                        </td>
                        <td>{feedbackTipoLabel[feedback.tipo] || feedback.tipo}</td>
                        <td>{feedbackPrioridadeLabel[feedback.prioridade] || feedback.prioridade}</td>
                        <td>{feedback.pagina || "-"}</td>
	                        <td className={styles.messageCell}>{feedback.descricao}</td>
                        <td className={styles.messageCell}>{feedback.resposta || "-"}</td>
	                        <td>
	                          <select
	                            value={feedback.status || "aberto"}
	                            className={styles.select}
	                            onChange={(event) => {
	                              const proximoStatus = event.target.value;
	                              const responsavelPadrao = proximoStatus === "resolvido"
	                                ? feedback.resolvido_por || user?.id || usuariosResponsaveisFeedback[0]?.id || ""
	                                : "";

	                              atualizarStatusFeedback(feedback.id, proximoStatus, responsavelPadrao);
	                            }}
	                            disabled={salvandoFeedbackStatus === feedback.id}
	                          >
	                            {feedbackStatusOptions.map((status) => (
	                              <option key={status} value={status}>
	                                {feedbackStatusLabel[status]}
	                              </option>
	                            ))}
	                          </select>
	                        </td>
	                        <td>
	                          <select
	                            value={feedback.resolvido_por || ""}
	                            className={`${styles.select} ${styles.feedbackResolverSelect}`}
	                            onChange={(event) => atualizarStatusFeedback(
	                              feedback.id,
	                              "resolvido",
	                              event.target.value
	                            )}
	                            disabled={salvandoFeedbackStatus === feedback.id || feedback.status !== "resolvido"}
	                          >
	                            <option value="">Selecione</option>
	                            {usuariosResponsaveisFeedback.map((usuario) => (
	                              <option key={usuario.id} value={usuario.id}>
	                                {usuario.nome}
	                              </option>
	                            ))}
	                          </select>
	                          {feedback.status === "resolvido" && feedback.resolvido_em ? (
	                            <span>Resolvido em {formatarData(feedback.resolvido_em)}</span>
	                          ) : (
	                            <span>Disponível ao marcar como resolvido</span>
	                          )}
		                        </td>
		                        <td>{formatarData(feedback.created_at)}</td>
		                        <td>
		                          <button
		                            type="button"
		                            className={styles.smallSecondaryButton}
		                            onClick={() => abrirRespostaModal(feedback)}
		                            disabled={salvandoFeedbackStatus === feedback.id}
		                          >
                                <MessageSquareReply size={14} />
		                            Responder
		                          </button>
		                          <button
		                            type="button"
		                            className={styles.smallDangerButton}
		                            onClick={() => excluirFeedback(feedback)}
		                            disabled={
		                              excluindoFeedback === feedback.id
		                              || salvandoFeedbackStatus === feedback.id
		                            }
		                          >
                                <Trash2 size={14} />
		                            {excluindoFeedback === feedback.id ? "Excluindo..." : "Excluir"}
		                          </button>
		                        </td>
		                      </tr>
		                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
              )}
            </main>
          </div>

          {respostaModalAberto && respostaModalFeedback && (
            <div className={styles.modalOverlay}>
              <form className={styles.passwordModal} onSubmit={salvarRespostaFeedback}>
                <div className={styles.modalHeader}>
                  <div>
                    <h2>{respostaModalOrigem === 'duvida' ? "Responder dúvida" : "Responder feedback"}</h2>
                    <p>
                      {respostaModalOrigem === 'duvida'
                        ? "Escreva a resposta para fixar a dúvida na página de boas práticas."
                        : "Escreva a resposta e marque o feedback como resolvido."}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={styles.modalClose}
                    onClick={fecharRespostaModal}
                    disabled={salvandoFeedbackStatus === respostaModalFeedback.id}
                  >
                    ×
                  </button>
                </div>

                <div className={styles.modalBody}>
                  <div>
                    <strong>De: {respostaModalFeedback.nome}</strong>
                    <p>{respostaModalFeedback.descricao}</p>
                  </div>

                  <label className={styles.modalField}>
                    Resposta
                    <textarea
                      value={respostaModalTexto}
                      onChange={(event) => setRespostaModalTexto(event.target.value)}
                      rows={6}
                      required
                    />
                  </label>
                </div>

                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={fecharRespostaModal}
                    disabled={salvandoFeedbackStatus === respostaModalFeedback.id}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className={styles.primaryButton}
                    disabled={salvandoFeedbackStatus === respostaModalFeedback.id || !respostaModalTexto.trim()}
                  >
                    <CheckCircle2 size={16} />
                    {salvandoFeedbackStatus === respostaModalFeedback.id ? "Salvando..." : "Salvar resposta"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {mostrarPreviaAvisoGeral && (
            <InternalNoticeModal
              notice={avisoGeralModalPreview}
              forceCloseButton
              onClose={() => setMostrarPreviaAvisoGeral(false)}
              onConfirm={() => setMostrarPreviaAvisoGeral(false)}
              onSnooze={() => setMostrarPreviaAvisoGeral(false)}
              onOpenDetails={() => {}}
            />
          )}
        </>
      )}
    </div>
  );
}
