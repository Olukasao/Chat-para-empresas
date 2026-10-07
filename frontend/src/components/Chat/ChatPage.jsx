import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  BadgePercent,
  Bell,
  BellOff,
  BellRing,
  CircleHelp,
  FolderOpen,
  GraduationCap,
  Globe2,
  Home,
  Image as ImageIcon,
  Megaphone,
  Network,
  PackageSearch,
  Palette,
  Settings,
  ShoppingBag,
  Target,
  Trophy,
  Users,
  Wifi,
} from 'lucide-react';
import api from '../../services/api';
import {
  connectSocket,
  disconnectSocket,
  syncSocketUser,
} from '../../services/socket';
import { setActiveBrowserNotificationConversation } from '../../services/browserNotifications';
import { useBrowserNotifications } from '../../contexts/browserNotificationContext';
import styles from '../../styles/Chat.module.css';
import logoAcessa from '../../assets/logo.png';
import useTheme from '../../utils/useTheme';
import { createInternalNavigationState } from '../../utils/internalNavigation';
import { hasAvisosInternosUpdate, markAvisosInternosAsSeen } from '../../utils/avisosInternos';
import {
  formatarDataHoraListaChat,
  obterDataOrdenacaoChat,
  obterDataUltimaMensagemGrupo,
} from '../../utils/chatDatas';
import { removerFormatacaoMensagem } from '../../utils/formatacaoMensagem';
import { obterIconeGrupo } from '../../utils/grupoIcones';
import {
  extrairGruposChat,
  formatarBadgeNaoLidas,
  normalizarTotalNaoLidas,
} from '../../utils/chatUnread';
import { nomesGruposUsuario, normalizarGruposUsuario } from '../../utils/usuarioGrupos';

// Componentes filhos
import ConversasDiretas from './ConversasDiretas';
import Grupos from './Grupos';
import MensagensDiretas from './MensagensDiretas';
import MensagensGrupo from './MensagensGrupo';
import ChatAppearanceModal from './ChatAppearanceModal';
import { CHAT_APPEARANCE_DEFAULTS, buildChatAppearanceCssVars } from './chatAppearance';
import ImageCropModal from './ImageCropModal';
import ImagePreviewModal from './ImagePreviewModal';
import CornerSeal from './CornerSeal';
import HomeBanner from '../HomeBanner';
import MassivoAlertCard from '../MassivoAlertCard';
import CcnaCompetitionHighlightCard from '../CcnaCompetitionHighlightCard';
import PricingCalculator from '../PricingCalculator';
import SemiDedicadoCalculator from '../SemiDedicadoCalculator';
import PlanChangeCalculator from '../PlanChangeCalculator';
import InternalNoticeManager from '../InternalNoticeManager';
import { normalizeHomeBannerContent } from '../../utils/homeBanner';

const MAX_PROFILE_IMAGE_SIZE = 200 * 1024 * 1024;
const APP_TITLE = 'Acessanet - Chat interno';
const UNREAD_COLOR = '#DC2626';
const MENTION_BLINK_INTERVAL_MS = 850;
const MESSAGE_SOUND_VOLUME = 1.0;
const MESSAGE_SOUND_COOLDOWN_MS = 350;
const MESSAGE_SOUND_SAMPLE_RATE = 44100;
const PRANK_SOUND_MAX_VOLUME = 0.7;
const PRANK_SOUND_DEFAULT_VOLUME = 0.6;
const PRANK_SOUND_PATHS_BY_KEY = Object.freeze({
  faaaa: '/sounds/faaaa.wav',
  vine_boom: '/sounds/vine-boom.wav',
  metal_pipe: '/sounds/metal-pipe.wav',
  windows_error: '/sounds/windows-error.wav',
  bruh: '/sounds/bruh.wav',
  minecraft_cave: '/sounds/minecraft-cave.wav',
});
const PRANK_SOUND_ALLOWED_PATHS = new Set(Object.values(PRANK_SOUND_PATHS_BY_KEY));
const PRANK_SOUND_ALLOWED_PATH_REGEX = /^\/sounds\/(?:custom\/)?[a-zA-Z0-9._-]+\.(mp3|wav|ogg|opus|webm|m4a|mp4|aac|flac)$/i;
const MICROSIP_PROTOCOL_URL = 'tel:';
const AVISOS_INTERNOS_CHECK_INTERVAL_MS = 60000;
const DASHBOARD_SOCKET_URL =
  import.meta.env.VITE_NOC_DASHBOARD_SOCKET_URL || 'http://192.168.1.133:5000';
const DASHBOARD_ALERTAS_REFRESH_INTERVAL_MS = 3 * 60 * 1000;
const CHAT_RESYNC_DELAY_MS = 250;
const CHAT_RESYNC_MIN_INTERVAL_MS = 2500;
const SALES_DASHBOARD_KEY = 'ATIVAÇÃO DE CONTRATO - COMUM';
const SALES_CELEBRATION_DURATION_MS = 5200;
const SALES_CONFETTI_COUNT = 72;
const SALES_CONFETTI_COLORS = [
  '#22C55E',
  '#38BDF8',
  '#FACC15',
  '#F97316',
  '#EC4899',
  '#FFFFFF',
];
const SALES_FIREWORK_COUNT = 7;
const SALES_FIREWORK_SPARKS = 14;
const LIMITE_GRUPOS_RESUMO_USUARIO = 2;
const MASSIVOS_DASHBOARD = [
  { id: 'mrt', key: 'BACKBONE GPON ACESSANET | MRT', label: 'MRT' },
  { id: 'das', key: 'BACKBONE GPON ACESSANET | DAS', label: 'DAS' },
  { id: 'srp', key: 'BACKBONE GPON ACESSANET | SRP', label: 'SRP' },
  { id: 'pv', key: 'BACKBONE GPON ACESSANET | PV', label: 'PV' },
  { id: 'lrj', key: 'BACKBONE GPON ACESSANET | LRJ', label: 'LRJ' },
];
const QUICK_ACCESS_CALCULATOR_MENU_ID = 'calculadoras-intranet';
const QUICK_ACCESS_CALCULATOR_IDS = [
  'calculadora-internet-dedicada',
  'calculadora-semi-dedicado',
  'calculadora-acordo',
  'calculadora-troca-plano',
];
const QUICK_ACCESS_CALCULATOR_ID_SET = new Set(QUICK_ACCESS_CALCULATOR_IDS);
const CONTROLE_OPERACIONAL_ENABLED = import.meta.env.VITE_CONTROLE_OPERACIONAL_ENABLED === 'true';
const QUICK_ACCESS_SECTION_DEFINITIONS = [
  {
    id: 'principais',
    title: 'Acessos principais',
    subtitle: 'Rotina principal da operação',
    itemIds: [
      'sgp',
      'solicitacoes-internas',
      'solicitacoes-compras',
      'agenda',
      'roleta-premios',
      ...(CONTROLE_OPERACIONAL_ENABLED ? ['controle-operacional'] : []),
      'busca-global',
    ],
  },
  {
    id: 'monitoramento',
    title: 'Monitoramento e rede',
    subtitle: 'Status, painéis e testes de conectividade',
    itemIds: [
      'monitoramento-total',
      'olt-cloud',
      'zabbix',
      'teste-conectividade-sites',
      'diagnostico-conexao-cliente',
      'falhas-gerais',
      'dashboards',
      'grafana',
    ],
  },
  {
    id: 'atendimento',
    title: 'Atendimento e apoio',
    subtitle: 'Materiais e ferramentas de suporte diário',
    itemIds: ['notas-rapidas', 'efeitos-sonoros', 'plantao-domingo', 'microsip', 'boas-praticas-duvidas', 'imagens'],
  },
  {
    id: 'comercial',
    title: 'Comercial e financeiro',
    subtitle: 'Vendas, procedimentos e boas práticas',
    itemIds: ['vendas', 'procedimentos-financeiro', 'boas-praticas-atendimento'],
  },
  {
    id: 'administracao',
    title: 'Administração interna',
    subtitle: 'Acessos administrativos e identidades',
    itemIds: ['assinaturas-email', 'mundiale'],
  },
];
const QUICK_ACCESS_PRESENTATION = {
  'falhas-gerais': {
    badge: 'Crítico',
    description: 'Sites úteis para diagnosticar indisponibilidades',
    variant: 'critical',
  },
  'plantao-domingo': {
    badge: 'Escala',
  },
  'monitoramento-total': {
    description: 'Visão geral dos painéis de monitoramento',
  },
  'solicitacoes-compras': {
    badge: 'Novo',
    description: 'Solicitações de materiais e acompanhamento',
  },
  'roleta-premios': {
    badge: 'Prêmios',
    description: 'Giros, histórico e resgates da campanha ativa',
  },
  'teste-conectividade-sites': {
    description: 'Teste rápido de HTTP, HTTPS e DNS',
  },
  'diagnostico-conexao-cliente': {
    badge: 'NOC',
    description: 'Sessão, consumo atual, qualidade e histórico',
  },
  'controle-operacional': {
    badge: 'Admin',
    description: 'Auditoria da agenda, chat e operação',
    variant: 'critical',
  },
  dashboards: {
    description: 'Painel NOC em tempo real',
  },
  imagens: {
    description: 'Imagens compartilhadas pela administração',
  },
  'efeitos-sonoros': {
    badge: 'Restrito',
    description: 'Efeitos remotos para usuários online',
  },
};
const DASHBOARD_NAV_ITEMS = [
  { id: 'inicio', label: 'Início', path: '/chat', icon: Home },
  { id: 'monitoramento-total', label: 'Monitoramento Total', path: '/monitoramento-total', icon: Activity },
  { id: 'diagnostico-conexao-cliente', label: 'Diagnóstico de Conexão', path: '/diagnostico-conexao-cliente', icon: Network, requiresNetworkDiagnosticAccess: true },
  { id: 'controle-operacional', label: 'Controle Operacional', path: '/controle-operacional', icon: Activity },
  { id: 'roleta-premios', label: 'Roleta de Prêmios', path: '/roleta-premios', icon: Trophy },
  { id: 'teste-conectividade-sites', label: 'Teste de Sites', path: '/teste-conectividade-sites', icon: Globe2 },
  { id: 'vendas', label: 'Vendas', path: '/acesso-rapido/vendas', icon: ShoppingBag },
  { id: 'treinamentos', label: 'Wiki/Cursos', path: '/cursos', icon: GraduationCap },
  { id: 'comunicados', label: 'Comunicados', path: '/avisos-internos', icon: Megaphone, badge: 3 },
  { id: 'materiais', label: 'Materiais', path: '/wiki', icon: FolderOpen },
  { id: 'imagens', label: 'Imagens', path: '/imagens', icon: ImageIcon },
  { id: 'campanhas', label: 'Campanhas', path: '/avisos-internos', icon: BadgePercent },
  { id: 'clientes', label: 'Chamados', path: '/solicitacoes-internas', icon: Users },
  { id: 'compras', label: 'Compras', path: '/solicitacoes', icon: PackageSearch, requiresPurchaseAccess: true },
  { id: 'relatorios', label: 'Relatórios', path: '/busca-global', icon: BarChart3 },
  { id: 'duvidas', label: 'Dúvidas', path: '/boas-praticas-duvidas', icon: CircleHelp },
  { id: 'configuracoes', label: 'Configurações', path: '/admin', icon: Settings },
];

const obterItemDashboardAtivo = (pathname = '') => (
  DASHBOARD_NAV_ITEMS.find((item) => (
    pathname === item.path ||
    (item.path !== '/chat' && pathname.startsWith(`${item.path}/`))
  ))?.id || (pathname === '/' ? 'inicio' : '')
);

const obterCalculadorasIntranet = (items = []) => {
  const menuCalculadoras = items.find((item) => item.id === QUICK_ACCESS_CALCULATOR_MENU_ID);

  if (Array.isArray(menuCalculadoras?.children) && menuCalculadoras.children.length > 0) {
    return menuCalculadoras.children;
  }

  return QUICK_ACCESS_CALCULATOR_IDS
    .map((id) => items.find((item) => item.id === id))
    .filter(Boolean);
};

const obterApresentacaoQuickAccess = (item = {}) => ({
  title: item.label,
  badge: '',
  description: item.subtitle || '',
  variant: '',
  ...(QUICK_ACCESS_PRESENTATION[item.id] || {}),
});

function QuickAccessSection({ section, renderItem }) {
  return (
    <div className={`chat-home-shortcuts-category chat-home-shortcuts-category-${section.id}`}>
      <div className="chat-home-shortcuts-category-header">
        <div>
          <strong>{section.title}</strong>
          {section.subtitle && <span>{section.subtitle}</span>}
        </div>
      </div>

      <div className={`chat-home-shortcuts-grid ${section.gridClassName || ''}`.trim()}>
        {section.items.map((item) => renderItem(item, section.id))}
      </div>
    </div>
  );
}

function DashboardSidebar({ activeItemId, onNavigate, items = DASHBOARD_NAV_ITEMS }) {
  return (
    <aside className={styles.dashboardSidebar} aria-label="Menu principal">
      <div className={styles.dashboardSidebarBrand}>
        <span className={styles.dashboardSidebarBrandIcon}>
          <Wifi size={22} />
        </span>
        <span className={styles.dashboardSidebarBrandText}>
          <strong>Acessanet</strong>
        </span>
      </div>

      <nav className={styles.dashboardSidebarNav}>
        {items.map((item) => {
          const IconeItem = item.icon;
          const ativo = activeItemId === item.id;

          return (
            <button
              key={item.id}
              type="button"
              className={`${styles.dashboardSidebarItem} ${ativo ? styles.dashboardSidebarItemActive : ''}`}
              onClick={() => onNavigate(item.path)}
              title={item.label}
              aria-current={ativo ? 'page' : undefined}
            >
              <span className={styles.dashboardSidebarItemIcon}>
                <IconeItem size={18} strokeWidth={1.9} />
              </span>
              <span className={styles.dashboardSidebarItemLabel}>{item.label}</span>
              {item.badge && (
                <span className={styles.dashboardSidebarBadge}>{item.badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className={styles.dashboardSidebarTip}>
        <span>Dica do dia</span>
        <p>A comunicação clara gera confiança e conecta pessoas.</p>
        <Target size={58} strokeWidth={1.4} />
      </div>
    </aside>
  );
}

const getFaviconLink = () => {
  let link = document.querySelector('link[rel~="icon"]');

  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }

  return link;
};

const normalizarMencaoUsuario = (valor = '') => (
  String(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
);

const textoNormalizadoParaMencoes = (valor = '') => (
  String(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
);

const montarHandlesMencaoUsuario = (nome = '') => {
  const partes = String(nome).trim().split(/\s+/).filter(Boolean);

  return [
    normalizarMencaoUsuario(nome),
    normalizarMencaoUsuario(partes[0] || ''),
  ].filter(Boolean);
};

const extrairMassivosDashboard = (grupos = {}) => (
  MASSIVOS_DASHBOARD
    .map((massivo) => ({
      ...massivo,
      total: Number(grupos[massivo.key] || 0),
    }))
    .filter((massivo) => massivo.total > 0)
);

const criarConfetesVenda = () => (
  Array.from({ length: SALES_CONFETTI_COUNT }, (_, index) => {
    const tamanho = 6 + Math.random() * 9;
    const duracao = 2600 + Math.random() * 1900;

    return {
      id: `${Date.now()}-${index}`,
      cor: SALES_CONFETTI_COLORS[index % SALES_CONFETTI_COLORS.length],
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

const criarFogosVenda = () => (
  Array.from({ length: SALES_FIREWORK_COUNT }, (_, index) => ({
    id: `${Date.now()}-fogo-${index}`,
    cor: SALES_CONFETTI_COLORS[index % SALES_CONFETTI_COLORS.length],
    esquerda: `${8 + Math.random() * 84}%`,
    atraso: `${index * 145 + Math.random() * 360}ms`,
    duracao: `${2100 + Math.random() * 900}ms`,
    subida: `-${42 + Math.random() * 38}vh`,
    deslocamento: `${(Math.random() - 0.5) * 210}px`,
    escala: `${0.78 + Math.random() * 0.48}`,
    sparks: Array.from({ length: SALES_FIREWORK_SPARKS }, (_, sparkIndex) => ({
      id: sparkIndex,
      angulo: `${(360 / SALES_FIREWORK_SPARKS) * sparkIndex}deg`,
      distancia: `${34 + Math.random() * 34}px`,
    })),
  }))
);

const mensagemMencionaUsuario = (data, usuario) => {
  if (!data || !usuario || Number(data.remetente_id) === Number(usuario.id)) {
    return false;
  }

  const mencoes = Array.isArray(data.mencoes) ? data.mencoes : [];

  if (mencoes.some((mencao) => Number(mencao?.id ?? mencao) === Number(usuario.id))) {
    return true;
  }

  if (data.tipo_mensagem && data.tipo_mensagem !== 'texto') {
    return false;
  }

  const handles = montarHandlesMencaoUsuario(usuario.nome);
  if (!handles.length || !data.mensagem) return false;

  const texto = textoNormalizadoParaMencoes(data.mensagem);

  return handles.some((handle) => {
    const regex = new RegExp(`(^|[^a-z0-9_])@${handle}(?![a-z0-9_])`);
    return regex.test(texto);
  });
};

const paginaEstaForaDaAba = () => (
  document.hidden || !document.hasFocus()
);

const faviconFallbackComAlerta = () => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="12" fill="#075E54"/>
      <path d="M19 18h26a8 8 0 0 1 8 8v12a8 8 0 0 1-8 8H32l-10 8v-8h-3a8 8 0 0 1-8-8V26a8 8 0 0 1 8-8Z" fill="#fff"/>
      <rect x="0" y="53" width="64" height="11" rx="3" fill="${UNREAD_COLOR}"/>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const criarFaviconComAlerta = (faviconOriginal) => (
  new Promise((resolve) => {
    if (!faviconOriginal) {
      resolve(faviconFallbackComAlerta());
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;

    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      ctx.clearRect(0, 0, 64, 64);
      ctx.drawImage(img, 6, 2, 52, 52);
      ctx.fillStyle = UNREAD_COLOR;
      ctx.beginPath();
      ctx.roundRect(0, 53, 64, 11, 3);
      ctx.fill();
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => resolve(faviconFallbackComAlerta());
    img.src = faviconOriginal;
  })
);

const escreverTextoWav = (view, offset, texto) => {
  for (let i = 0; i < texto.length; i += 1) {
    view.setUint8(offset + i, texto.charCodeAt(i));
  }
};

const criarSomMensagemDataUrl = () => {
  if (typeof window === 'undefined' || typeof window.btoa !== 'function') {
    return '';
  }

  const duracao = 0.28;
  const totalSamples = Math.floor(MESSAGE_SOUND_SAMPLE_RATE * duracao);
  const buffer = new ArrayBuffer(44 + totalSamples * 2);
  const view = new DataView(buffer);

  escreverTextoWav(view, 0, 'RIFF');
  view.setUint32(4, 36 + totalSamples * 2, true);
  escreverTextoWav(view, 8, 'WAVE');
  escreverTextoWav(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, MESSAGE_SOUND_SAMPLE_RATE, true);
  view.setUint32(28, MESSAGE_SOUND_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  escreverTextoWav(view, 36, 'data');
  view.setUint32(40, totalSamples * 2, true);

  const tons = [
    { inicio: 0, fim: 0.11, frequencia: 880 },
    { inicio: 0.12, fim: 0.26, frequencia: 1175 },
  ];

  for (let i = 0; i < totalSamples; i += 1) {
    const tempo = i / MESSAGE_SOUND_SAMPLE_RATE;
    const tom = tons.find((item) => tempo >= item.inicio && tempo <= item.fim);
    let sample = 0;

    if (tom) {
      const progresso = (tempo - tom.inicio) / (tom.fim - tom.inicio);
      const envelope = Math.sin(Math.PI * progresso);
      sample = Math.sin(2 * Math.PI * tom.frequencia * (tempo - tom.inicio)) * envelope * 0.6;
    }

    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 0x7fff, true);
  }

  const bytes = new Uint8Array(buffer);
  let binario = '';

  for (let i = 0; i < bytes.length; i += 1) {
    binario += String.fromCharCode(bytes[i]);
  }

  return `data:audio/wav;base64,${window.btoa(binario)}`;
};

export default function ChatPage({ internalPage = null, hideDashboardSidebar = false } = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    isLightTheme: temaClaro,
    toggleTheme: alternarTema,
  } = useTheme();
  const {
    permission: browserNotificationPermission,
    isSupported: browserNotificationSupported,
    requestPermission: requestBrowserNotificationPermission,
  } = useBrowserNotifications();

  // ESTADO GLOBAL
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // ABAS E NAVEGAÇÃO
  const [abaSelecionada, setAbaSelecionada] = useState('diretas'); // 'diretas' ou 'grupos'
  const [conversaSelecionada, setConversaSelecionada] = useState(null);
  const [grupoSelecionado, setGrupoSelecionado] = useState(null);
  const [mensagemFavoritaParaFocar, setMensagemFavoritaParaFocar] = useState(null);
  const [mostrarUsuarios, setMostrarUsuarios] = useState(false);
  const [busca, setBusca] = useState('');
  const [chatsSidebarAberta, setChatsSidebarAberta] = useState(false);
  const [alertaMencao, setAlertaMencao] = useState(null);
  const [agendaMenuAberto, setAgendaMenuAberto] = useState(null);
  const [calculadoraAberta, setCalculadoraAberta] = useState(null);
  const [quickAccessItems, setQuickAccessItems] = useState([]);
  const [meusAcessosRapidos, setMeusAcessosRapidos] = useState([]);
  const [quickAccessSearch, setQuickAccessSearch] = useState('');
  const [quickAccessLoading, setQuickAccessLoading] = useState(true);
  const [quickAccessErro, setQuickAccessErro] = useState('');
  const [quickAccessModalAberto, setQuickAccessModalAberto] = useState(false);
  const [quickAccessSavingIds, setQuickAccessSavingIds] = useState([]);
  const [quickAccessToast, setQuickAccessToast] = useState('');
  const [chatAppearance, setChatAppearance] = useState(CHAT_APPEARANCE_DEFAULTS);
  const [chatAppearanceAberto, setChatAppearanceAberto] = useState(false);
  const [purchaseMenuAccess, setPurchaseMenuAccess] = useState({ canAccess: false, unread: 0 });
  const [avisosAtualizadoEm, setAvisosAtualizadoEm] = useState(null);
  const [avisosInternosPendentes, setAvisosInternosPendentes] = useState(false);
  const [bannerHome, setBannerHome] = useState(() => normalizeHomeBannerContent());
  const [dashboardAlertasConectado, setDashboardAlertasConectado] = useState(false);
  const [massivosDashboard, setMassivosDashboard] = useState([]);
  const [celebracaoVenda, setCelebracaoVenda] = useState(null);
  const [confetesVenda, setConfetesVenda] = useState([]);
  const [fogosVenda, setFogosVenda] = useState([]);
  const [feedbackModalAberto, setFeedbackModalAberto] = useState(false);
  const [feedbackEnviando, setFeedbackEnviando] = useState(false);
  const [feedbackErro, setFeedbackErro] = useState('');
  const [feedbackSucesso, setFeedbackSucesso] = useState('');
  const [feedbackForm, setFeedbackForm] = useState({
    nome: '',
    tipo: 'bug',
    setor: '',
    prioridade: 'media',
    pagina: '',
    descricao: '',
  });

  // DADOS
  const [conversas, setConversas] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [socket, setSocket] = useState(null);
  const [erroDados, setErroDados] = useState('');
  const [perfilAberto, setPerfilAberto] = useState(false);
  const [perfilVisualizado, setPerfilVisualizado] = useState(null);
  const [imagemPerfilVisualizada, setImagemPerfilVisualizada] = useState(null);
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [imagemPerfilParaEditar, setImagemPerfilParaEditar] = useState(null);
  const [perfilForm, setPerfilForm] = useState({
    nome: '',
    avatar: '',
    senha_atual: '',
    nova_senha: '',
    confirmar_senha: '',
  });

  // SOCKET
  const socketRef = useRef(null);
  const tokenRef = useRef(null);
  const userRef = useRef(null);
  const conversasRef = useRef([]);
  const gruposRef = useRef([]);
  const conversaSelecionadaRef = useRef(null);
  const grupoSelecionadoRef = useRef(null);
  const abaSelecionadaRef = useRef('diretas');
  const mobileHistoryPushedRef = useRef(false);
  const socketEventsVistosRef = useRef(new Set());
  const faviconOriginalRef = useRef(null);
  const faviconTipoOriginalRef = useRef('');
  const profileFileInputRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioMensagemRef = useRef(null);
  const audioMensagemLiberadoRef = useRef(false);
  const audioEfeitosRemotosRef = useRef(new Map());
  const audioEfeitosRemotosLiberadoRef = useRef(false);
  const audioEfeitoRemotoAtualRef = useRef(null);
  const ultimoSomMensagemRef = useRef(0);
  const agendaMenuRef = useRef(null);
  const totalVendasDashboardRef = useRef(null);
  const celebracaoVendaTimeoutRef = useRef(null);
  const confetesVendaTimeoutRef = useRef(null);
  const fogosVendaTimeoutRef = useRef(null);
  const quickAccessToastTimeoutRef = useRef(null);
  const resyncTimeoutRef = useRef(null);
  const resyncInFlightRef = useRef(false);
  const lastResyncAtRef = useRef(0);

  const totalDiretasNaoLidas = conversas.reduce(
    (total, conversa) => total + normalizarTotalNaoLidas(conversa.nao_lidas),
    0
  );
  const totalGruposNaoLidas = grupos.reduce(
    (total, grupo) => total + normalizarTotalNaoLidas(grupo.unreadCount ?? grupo.nao_lidas),
    0
  );
  const totalNaoLidas = totalDiretasNaoLidas + totalGruposNaoLidas;
  const tituloPadrao = totalNaoLidas > 0
    ? `(${totalNaoLidas}) ${APP_TITLE}`
    : APP_TITLE;

  const encerrarSessaoExpirada = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    disconnectSocket();
    navigate('/login', { replace: true });
  };

  const obterAudioContext = () => {
    if (typeof window === 'undefined') return null;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!audioContextRef.current) {
      audioContextRef.current = window.__chatAudioContext || new AudioContextClass();
      window.__chatAudioContext = audioContextRef.current;
    }

    return audioContextRef.current;
  };

  const obterAudioMensagem = () => {
    if (typeof window === 'undefined' || typeof window.Audio !== 'function') return null;

    if (!audioMensagemRef.current) {
      const audio = new window.Audio(criarSomMensagemDataUrl());
      audio.preload = 'auto';
      audio.volume = MESSAGE_SOUND_VOLUME;
      audioMensagemRef.current = audio;
    }

    return audioMensagemRef.current;
  };

  const obterCaminhoEfeitoRemoto = (payload = {}) => {
    const soundKey = String(payload.sound_key || payload.soundKey || '').trim().toLowerCase();
    const caminhoPorChave = PRANK_SOUND_PATHS_BY_KEY[soundKey];

    if (caminhoPorChave) {
      return caminhoPorChave;
    }

    const caminho = String(payload.sound || '').trim();
    if (PRANK_SOUND_ALLOWED_PATHS.has(caminho)) return caminho;

    return PRANK_SOUND_ALLOWED_PATH_REGEX.test(caminho) ? caminho : '';
  };

  const obterAudioEfeitoRemoto = (src) => {
    if (typeof window === 'undefined' || typeof window.Audio !== 'function' || !src) return null;

    const cache = audioEfeitosRemotosRef.current;
    if (!cache.has(src)) {
      const audio = new window.Audio(src);
      audio.preload = 'auto';
      audio.volume = PRANK_SOUND_DEFAULT_VOLUME;
      cache.set(src, audio);
    }

    return cache.get(src);
  };

  const liberarAudioEfeitosRemotos = () => {
    if (audioEfeitosRemotosLiberadoRef.current) return;

    const audios = Object.values(PRANK_SOUND_PATHS_BY_KEY)
      .map((src) => obterAudioEfeitoRemoto(src))
      .filter(Boolean);

    if (!audios.length) return;

    audioEfeitosRemotosLiberadoRef.current = true;

    audios.forEach((audio) => {
      try {
        audio.muted = true;
        audio.currentTime = 0;

        const playPromise = audio.play();

        if (playPromise?.then) {
          playPromise
            .then(() => {
              audio.pause();
              audio.currentTime = 0;
              audio.muted = false;
            })
            .catch(() => {
              audio.muted = false;
              audioEfeitosRemotosLiberadoRef.current = false;
            });
        } else {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
        }
      } catch {
        audio.muted = false;
        audioEfeitosRemotosLiberadoRef.current = false;
      }
    });
  };

  const tocarEfeitoSonoroRemoto = (payload = {}) => {
    const src = obterCaminhoEfeitoRemoto(payload);

    if (!src) {
      console.warn('[SOUND_EFFECTS] Efeito sonoro remoto bloqueado: som não permitido.');
      return;
    }

    const audio = obterAudioEfeitoRemoto(src);
    if (!audio) return;

    const volumeRecebido = Number(payload.volume);
    const volume = Number.isFinite(volumeRecebido)
      ? Math.max(0, Math.min(PRANK_SOUND_MAX_VOLUME, volumeRecebido > 1 ? volumeRecebido / 100 : volumeRecebido))
      : PRANK_SOUND_DEFAULT_VOLUME;

    try {
      if (audioEfeitoRemotoAtualRef.current && audioEfeitoRemotoAtualRef.current !== audio) {
        audioEfeitoRemotoAtualRef.current.pause();
        audioEfeitoRemotoAtualRef.current.currentTime = 0;
      }

      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      audio.volume = volume;
      audioEfeitoRemotoAtualRef.current = audio;

      const playPromise = audio.play();

      if (playPromise?.catch) {
        playPromise.catch((err) => {
          console.warn('[SOUND_EFFECTS] Navegador bloqueou o efeito sonoro remoto:', err?.message || err);
        });
      }
    } catch (err) {
      console.warn('[SOUND_EFFECTS] Erro ao tocar efeito sonoro remoto:', err);
    }
  };

  const tocarTomMensagem = (context, inicio, frequencia, duracao) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequencia, inicio);

    gain.gain.setValueAtTime(0.001, inicio);
    gain.gain.exponentialRampToValueAtTime(MESSAGE_SOUND_VOLUME, inicio + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.001, inicio + duracao);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(inicio);
    oscillator.stop(inicio + duracao + 0.02);
  };

  const tocarSomMensagemWebAudio = () => {
    const context = obterAudioContext();
    if (!context) return;

    const tocar = () => {
      const inicio = context.currentTime + 0.01;
      tocarTomMensagem(context, inicio, 740, 0.12);
      tocarTomMensagem(context, inicio + 0.13, 980, 0.14);
    };

    if (context.state === 'suspended') {
      context.resume().then(tocar).catch(() => {});
      return;
    }

    tocar();
  };

  const tocarTomVenda = (context, inicio, frequencia, duracao, volume = 0.42) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'triangle';
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
      // Aumenta os níveis de ganho para tornar a notificação de venda mais audível
      tocarTomVenda(context, inicio, 523.25, 0.16, 0.6);
      tocarTomVenda(context, inicio + 0.1, 659.25, 0.18, 0.7);
      tocarTomVenda(context, inicio + 0.2, 783.99, 0.2, 0.8);
      tocarTomVenda(context, inicio + 0.32, 1046.5, 0.24, 0.85);
    };

    if (context.state === 'suspended') {
      context.resume().then(tocar).catch(() => {});
      return;
    }

    tocar();
  };

  const comemorarVenda = (incremento, totalAtual, opcoes = {}) => {
    const totalIncremento = Math.max(1, Number(incremento || 1));

    tocarSomVenda();

    setConfetesVenda(criarConfetesVenda());
    setFogosVenda(criarFogosVenda());
    setCelebracaoVenda({
      id: Date.now(),
      incremento: totalIncremento,
      totalAtual,
      titulo: opcoes.titulo || '',
      subtitulo: opcoes.subtitulo || '',
    });

    window.clearTimeout(celebracaoVendaTimeoutRef.current);
    window.clearTimeout(confetesVendaTimeoutRef.current);
    window.clearTimeout(fogosVendaTimeoutRef.current);

    celebracaoVendaTimeoutRef.current = window.setTimeout(() => {
      setCelebracaoVenda(null);
    }, SALES_CELEBRATION_DURATION_MS);

    confetesVendaTimeoutRef.current = window.setTimeout(() => {
      setConfetesVenda([]);
    }, SALES_CELEBRATION_DURATION_MS + 600);

    fogosVendaTimeoutRef.current = window.setTimeout(() => {
      setFogosVenda([]);
    }, SALES_CELEBRATION_DURATION_MS + 600);
  };

  const liberarAudioMensagem = () => {
    const audio = obterAudioMensagem();
    liberarAudioEfeitosRemotos();

    if (audio && !audioMensagemLiberadoRef.current) {
      audio.muted = true;
      audio.currentTime = 0;

      const playPromise = audio.play();

      if (playPromise?.then) {
        playPromise
          .then(() => {
            audio.pause();
            audio.currentTime = 0;
            audio.muted = false;
            audio.volume = MESSAGE_SOUND_VOLUME;
            audioMensagemLiberadoRef.current = true;
          })
          .catch(() => {
            audio.muted = false;
          });
      } else {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
        audioMensagemLiberadoRef.current = true;
      }
    }

    const context = obterAudioContext();
    if (context?.state === 'suspended') {
      context.resume().catch(() => {});
    }
  };

  const tocarSomMensagem = () => {
    const agora = Date.now();

    if (agora - ultimoSomMensagemRef.current < MESSAGE_SOUND_COOLDOWN_MS) {
      return;
    }

    ultimoSomMensagemRef.current = agora;

    const audio = obterAudioMensagem();

    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      audio.volume = MESSAGE_SOUND_VOLUME;

      const playPromise = audio.play();

      if (playPromise?.catch) {
        playPromise.catch(() => {
          tocarSomMensagemWebAudio();
        });
      }

      return;
    }

    tocarSomMensagemWebAudio();
  };

  // ========================================
  // FUNÇÕES
  // ========================================

  const previewMensagem = (data) => {
    if (data.tipo_mensagem === 'imagem') {
      return '[Imagem]';
    }

    if (data.tipo_mensagem === 'audio') {
      return '[Áudio]';
    }

    if (data.tipo_mensagem === 'arquivo') {
      return '[Arquivo]';
    }

    if (data.tipo_mensagem === 'sticker') {
      return 'Figurinha';
    }

    return removerFormatacaoMensagem(data.preview || data.mensagem);
  };

  const ordenarPorAtualizacao = (items) => (
    [...items].sort((a, b) => {
      const acessoDiff =
        Number(b.tem_acesso !== false) - Number(a.tem_acesso !== false);

      if (acessoDiff !== 0) {
        return acessoDiff;
      }

      const favoritoDiff = Number(Boolean(b.favorito)) - Number(Boolean(a.favorito));

      if (favoritoDiff !== 0) {
        return favoritoDiff;
      }

      return (
        new Date(obterDataOrdenacaoChat(b) || 0) -
        new Date(obterDataOrdenacaoChat(a) || 0)
      );
    })
  );

  const normalizarBusca = (valor = '') => (
    String(valor)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
  );

  const combinaComBusca = (termo, ...valores) => (
    normalizarBusca(valores.filter(Boolean).join(' ')).includes(termo)
  );

  const registrarEventoSocket = (tipo, data) => {
    const chave = data.id
      ? `${tipo}:${data.id}`
      : `${tipo}:${data.remetente_id}:${data.conversa_id || data.grupo_id}:${data.criada_em || data.preview || data.mensagem}`;

    if (socketEventsVistosRef.current.has(chave)) {
      return false;
    }

    socketEventsVistosRef.current.add(chave);

    if (socketEventsVistosRef.current.size > 300) {
      const [primeiraChave] = socketEventsVistosRef.current;
      socketEventsVistosRef.current.delete(primeiraChave);
    }

    return true;
  };

  const marcarConversaComoLida = (usuarioId) => {
    setConversas((prev) =>
      prev.map((conversa) =>
        Number(conversa.usuario_outro_id) === Number(usuarioId)
          ? { ...conversa, nao_lidas: 0 }
          : conversa
      )
    );
  };

  const marcarGrupoComoLido = (grupoId) => {
    setGrupos((prev) =>
      prev.map((grupo) =>
        Number(grupo.id) === Number(grupoId)
          ? { ...grupo, nao_lidas: 0, unreadCount: 0, tem_mencao: false }
          : grupo
      )
    );
  };

  const atualizarConversaComMensagem = (data, usuarioAtualId, tokenLocal) => {
    const remetenteId = Number(data.remetente_id);
    const destinatarioId = data.usuario_id ? Number(data.usuario_id) : null;
    const conversaId = data.conversa_id ? Number(data.conversa_id) : null;
    const usuarioAtual = Number(usuarioAtualId);
    const outroUsuarioId = remetenteId === usuarioAtual ? destinatarioId : remetenteId;
    const conversaAtiva =
      remetenteId !== usuarioAtual &&
      abaSelecionadaRef.current === 'diretas' &&
      Number(conversaSelecionadaRef.current) === remetenteId;

    const encontrou = conversasRef.current.some((conversa) => (
      (conversaId && Number(conversa.id) === conversaId) ||
      (outroUsuarioId && Number(conversa.usuario_outro_id) === outroUsuarioId)
    ));

    setConversas((prev) => {
      const atualizadas = prev.map((conversa) => {
        const mesmaConversa =
          (conversaId && Number(conversa.id) === conversaId) ||
          (outroUsuarioId && Number(conversa.usuario_outro_id) === outroUsuarioId);

        if (!mesmaConversa) {
          return conversa;
        }

        return {
          ...conversa,
          ultima_mensagem: previewMensagem(data),
          ultima_mensagem_em: data.criada_em || new Date().toISOString(),
          atualizada_em: data.criada_em || new Date().toISOString(),
          nao_lidas:
            remetenteId === usuarioAtual || conversaAtiva
              ? 0
              : Number(conversa.nao_lidas || 0) + 1,
        };
      });

      return ordenarPorAtualizacao(atualizadas);
    });

    if (conversaAtiva && conversaId) {
      socketRef.current?.emit('mark_conversa_read', {
        conversa_id: conversaId,
        usuario_id: usuarioAtual,
      });
    }

    if (!encontrou && tokenLocal) {
      carregarDados(tokenLocal);
    }
  };

  const atualizarGrupoComMensagem = (data, usuarioAtualInfo, tokenLocal) => {
    const remetenteId = Number(data.remetente_id);
    const grupoId = Number(data.grupo_id);
    const usuarioAtualDados = typeof usuarioAtualInfo === 'object'
      ? usuarioAtualInfo
      : userRef.current;
    const usuarioAtual = Number(usuarioAtualDados?.id ?? usuarioAtualInfo);
    const grupoAtivo =
      remetenteId !== usuarioAtual &&
      abaSelecionadaRef.current === 'grupos' &&
      Number(grupoSelecionadoRef.current) === grupoId;
    const mencionouUsuario = mensagemMencionaUsuario(data, usuarioAtualDados);

    const encontrou = gruposRef.current.some((grupo) => Number(grupo.id) === grupoId);

    setGrupos((prev) => {
      const atualizados = prev.map((grupo) => {
        if (Number(grupo.id) !== grupoId) {
          return grupo;
        }

        const naoLidasAtual = normalizarTotalNaoLidas(grupo.unreadCount ?? grupo.nao_lidas);
        const naoLidas = remetenteId === usuarioAtual
          ? naoLidasAtual
          : grupoAtivo
            ? 0
            : naoLidasAtual + 1;

        return {
          ...grupo,
          ultima_mensagem: previewMensagem(data),
          ultima_mensagem_em: data.criada_em || new Date().toISOString(),
          atualizado_em: data.criada_em || new Date().toISOString(),
          tem_mencao: grupoAtivo ? false : (mencionouUsuario || Boolean(grupo.tem_mencao)),
          nao_lidas: naoLidas,
          unreadCount: naoLidas,
        };
      });

      return ordenarPorAtualizacao(atualizados);
    });

    if (grupoAtivo) {
      socketRef.current?.emit('mark_group_read', {
        grupo_id: grupoId,
        usuario_id: usuarioAtual,
      });
    }

    if (!encontrou && tokenLocal) {
      carregarDados(tokenLocal);
    }
  };

  async function carregarDados(tokenLocal) {
    try {
      setErroDados('');
      const headers = { Authorization: `Bearer ${tokenLocal}` };

      // Carregar em paralelo
      const [conversasRes, gruposRes, usuariosRes] = await Promise.all([
        api.get('/chat/conversas-diretas', { headers }),
        api.get('/chat/grupos', { headers }),
        api.get('/chat/usuarios', { headers }),
      ]);

      setConversas(ordenarPorAtualizacao(conversasRes.data));
      setGrupos(ordenarPorAtualizacao(extrairGruposChat(gruposRes.data)));
      setUsuarios(usuariosRes.data);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);

      if (err.response?.status === 401) {
        encerrarSessaoExpirada();
        return;
      }

      setErroDados('Não foi possível carregar o chat. Verifique sua conexão com o servidor 192.168.1.133:8600.');
    }
  }

  async function carregarBannerHome(tokenLocal = token) {
    if (!tokenLocal) return;

    try {
      const { data } = await api.get('/banner-home', {
        headers: { Authorization: `Bearer ${tokenLocal}` },
      });

      setBannerHome(normalizeHomeBannerContent(data));
    } catch (err) {
      console.error('Erro ao carregar banner da home:', err);

      if (err.response?.status === 401) {
        encerrarSessaoExpirada();
        return;
      }

      setBannerHome(normalizeHomeBannerContent());
    }
  }

  const aplicarRespostaAcessosRapidos = (data = {}) => {
    setQuickAccessItems(Array.isArray(data.available) ? data.available : []);
    setMeusAcessosRapidos(Array.isArray(data.selected) ? data.selected : []);
  };

  async function carregarAcessosRapidos(tokenLocal = token) {
    if (!tokenLocal) return;

    try {
      setQuickAccessLoading(true);
      setQuickAccessErro('');

      const { data } = await api.get('/me/quick-access', {
        headers: { Authorization: `Bearer ${tokenLocal}` },
      });

      aplicarRespostaAcessosRapidos(data);
    } catch (err) {
      console.error('Erro ao carregar acessos rápidos:', err);

      if (err.response?.status === 401) {
        encerrarSessaoExpirada();
        return;
      }

      setQuickAccessErro('Não foi possível carregar seus acessos rápidos.');
    } finally {
      setQuickAccessLoading(false);
    }
  }

  async function carregarPersonalizacaoChat(tokenLocal = token) {
    if (!tokenLocal) return;

    try {
      const { data } = await api.get('/chat/appearance', {
        headers: { Authorization: `Bearer ${tokenLocal}` },
      });

      setChatAppearance(data?.preferences || CHAT_APPEARANCE_DEFAULTS);
    } catch (err) {
      console.error('Erro ao carregar personalização do chat:', err);
    }
  }

  async function carregarPermissoesCompras(tokenLocal = token) {
    if (!tokenLocal) return;

    try {
      const { data } = await api.get('/purchase-permissions/me', {
        headers: { Authorization: `Bearer ${tokenLocal}` },
      });

      setPurchaseMenuAccess({
        canAccess: Boolean(data?.can_access),
        unread: Number(data?.unread_notifications || 0),
      });
    } catch (err) {
      if (err.response?.status === 401) {
        encerrarSessaoExpirada();
        return;
      }

      setPurchaseMenuAccess({ canAccess: false, unread: 0 });
    }
  }

  const marcarQuickAccessProcessando = (quickAccessId, processando) => {
    setQuickAccessSavingIds((atuais) => {
      const atualizados = new Set(atuais);

      if (processando) {
        atualizados.add(quickAccessId);
      } else {
        atualizados.delete(quickAccessId);
      }

      return Array.from(atualizados);
    });
  };

  const mostrarQuickAccessToast = (mensagem) => {
    window.clearTimeout(quickAccessToastTimeoutRef.current);
    setQuickAccessToast(mensagem);
    quickAccessToastTimeoutRef.current = window.setTimeout(() => {
      setQuickAccessToast('');
    }, 2400);
  };

  const reentrarSalasSocket = (socketInstance = socketRef.current, userData = userRef.current) => {
    if (!socketInstance || !userData?.id) return;

    syncSocketUser(userData);

    const grupoAtual = grupoSelecionadoRef.current;
    if (grupoAtual) {
      socketInstance.emit('join_group', { grupo_id: grupoAtual });
      socketInstance.emit('mark_group_read', {
        grupo_id: grupoAtual,
        usuario_id: userData.id,
      });
    }
  };

  const ressincronizarChat = async (motivo = 'manual') => {
    const tokenLocal = tokenRef.current;
    const userData = userRef.current;

    if (!tokenLocal || !userData?.id) return;

    const agora = Date.now();
    if (resyncInFlightRef.current) return;
    if (agora - lastResyncAtRef.current < CHAT_RESYNC_MIN_INTERVAL_MS) return;

    resyncInFlightRef.current = true;
    lastResyncAtRef.current = agora;

    try {
      setErroDados('');

      const socketAtual = socketRef.current;
      if (socketAtual) {
        if (!socketAtual.connected) {
          socketAtual.connect();
        }

        reentrarSalasSocket(socketAtual, userData);
      }

      await carregarDados(tokenLocal);
      carregarStatusAvisosInternos(tokenLocal, userData);

      console.log(`[CHAT] Ressincronização concluída (${motivo})`);
    } catch (err) {
      console.error(`[CHAT] Erro na ressincronização (${motivo}):`, err);
      setErroDados('Não foi possível atualizar o chat agora. Tentando manter as mensagens pela API.');
    } finally {
      resyncInFlightRef.current = false;
    }
  };

  const agendarRessincronizacaoChat = (motivo) => {
    window.clearTimeout(resyncTimeoutRef.current);
    resyncTimeoutRef.current = window.setTimeout(() => {
      ressincronizarChat(motivo);
    }, CHAT_RESYNC_DELAY_MS);
  };

  const atualizarStatusAvisosInternos = (data, userData = user) => {
    const atualizadoEm = data?.atualizado_em || null;

    setAvisosAtualizadoEm(atualizadoEm);
    setAvisosInternosPendentes(hasAvisosInternosUpdate(userData, atualizadoEm));
  };

  async function carregarStatusAvisosInternos(tokenLocal, userData = user) {
    if (!tokenLocal) return;

    try {
      const headers = { Authorization: `Bearer ${tokenLocal}` };
      const { data } = await api.get('/avisos-internos', { headers });
      atualizarStatusAvisosInternos(data, userData);
    } catch (err) {
      console.error('Erro ao verificar avisos internos:', err);

      if (err.response?.status === 401) {
        encerrarSessaoExpirada();
      }
    }
  }

  async function ocultarConversaDaLista(conversa) {
    const conversaId = Number(conversa?.id);

    if (!conversaId || !token) {
      return false;
    }

    try {
      const headers = { Authorization: `Bearer ${token}` };

      await api.delete(`/chat/conversas-diretas/${conversaId}/ocultar`, { headers });

      setConversas((prev) => prev.filter((item) => Number(item.id) !== conversaId));

      if (Number(conversaSelecionadaRef.current) === Number(conversa.usuario_outro_id)) {
        conversaSelecionadaRef.current = null;
        setConversaSelecionada(null);
      }

      return true;
    } catch (err) {
      console.error('Erro ao remover conversa da lista:', err);

      if (err.response?.status === 401) {
        encerrarSessaoExpirada();
        return false;
      }

      alert(err.response?.data?.error || 'Não foi possível remover esta conversa da sua lista.');
      return false;
    }
  }

  async function alternarFavoritoChat({ tipo, referenciaId, favorito }) {
    if (!token) return;

    try {
      const headers = { Authorization: `Bearer ${token}` };

      await api.patch('/chat/favoritos', {
        tipo,
        referencia_id: referenciaId,
        favorito,
      }, { headers });

      if (tipo === 'direta') {
        setConversas((prev) => ordenarPorAtualizacao(
          prev.map((conversa) => (
            Number(conversa.id) === Number(referenciaId)
              ? { ...conversa, favorito }
              : conversa
          ))
        ));
      }

      if (tipo === 'grupo') {
        setGrupos((prev) => ordenarPorAtualizacao(
          prev.map((grupo) => (
            Number(grupo.id) === Number(referenciaId)
              ? { ...grupo, favorito }
              : grupo
          ))
        ));
      }
    } catch (err) {
      console.error('Erro ao atualizar favorito:', err);

      if (err.response?.status === 401) {
        encerrarSessaoExpirada();
        return;
      }

      alert(err.response?.data?.error || 'Não foi possível atualizar o favorito.');
    }
  }

  function atualizarStatusUsuario(data) {
    const usuarioId = Number(data.usuario_id);

    setUsuarios((prev) =>
      prev.map((u) =>
        Number(u.id) === usuarioId
          ? {
              ...u,
              status: data.status,
              ultimo_acesso: data.ultimo_acesso || u.ultimo_acesso,
            }
          : u
      )
    );

    setConversas((prev) =>
      prev.map((conversa) =>
        Number(conversa.usuario_outro_id) === usuarioId
          ? {
              ...conversa,
              usuario_outro_status: data.status,
              usuario_outro_ultimo_acesso:
                data.ultimo_acesso || conversa.usuario_outro_ultimo_acesso,
            }
          : conversa
      )
    );
  }

  // ========================================
  // INICIALIZAÇÃO
  // ========================================

  useEffect(() => {
    conversasRef.current = conversas;
  }, [conversas]);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    gruposRef.current = grupos;
  }, [grupos]);

  useEffect(() => {
    conversaSelecionadaRef.current = conversaSelecionada;
  }, [conversaSelecionada]);

  useEffect(() => {
    grupoSelecionadoRef.current = grupoSelecionado;
  }, [grupoSelecionado]);

  useEffect(() => {
    abaSelecionadaRef.current = abaSelecionada;
  }, [abaSelecionada]);

  useEffect(() => {
    if (abaSelecionada === 'diretas' && conversaSelecionada) {
      setActiveBrowserNotificationConversation({
        type: 'direct',
        id: conversaSelecionada,
      });
    } else if (abaSelecionada === 'grupos' && grupoSelecionado) {
      setActiveBrowserNotificationConversation({
        type: 'group',
        id: grupoSelecionado,
      });
    } else {
      setActiveBrowserNotificationConversation(null);
    }

    return () => {
      setActiveBrowserNotificationConversation(null);
    };
  }, [abaSelecionada, conversaSelecionada, grupoSelecionado]);

  useEffect(() => {
    window.addEventListener('pointerdown', liberarAudioMensagem);
    window.addEventListener('keydown', liberarAudioMensagem);
    window.addEventListener('touchstart', liberarAudioMensagem);

	    return () => {
	      window.removeEventListener('pointerdown', liberarAudioMensagem);
	      window.removeEventListener('keydown', liberarAudioMensagem);
	      window.removeEventListener('touchstart', liberarAudioMensagem);
	    };
	    // Os listeners precisam ser registrados uma vez; a função usa refs internas.
	    // eslint-disable-next-line react-hooks/exhaustive-deps
	  }, []);

  useEffect(() => {
    if (!agendaMenuAberto) return undefined;

    const fecharAgendaAoClicarFora = (event) => {
      if (agendaMenuRef.current?.contains(event.target)) return;
      setAgendaMenuAberto(null);
    };

    document.addEventListener('mousedown', fecharAgendaAoClicarFora);

    return () => {
      document.removeEventListener('mousedown', fecharAgendaAoClicarFora);
    };
  }, [agendaMenuAberto]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const calculadoraSolicitada = params.get('calculadora');

    if (calculadoraSolicitada === 'link-dedicado') {
      setCalculadoraAberta('link-dedicado');
    }

    if (
      calculadoraSolicitada === 'semi-dedicado' ||
      calculadoraSolicitada === 'semi-dedicado-comercial' ||
      calculadoraSolicitada === 'comercial'
    ) {
      setCalculadoraAberta('semi-dedicado');
    }

    if (
      calculadoraSolicitada === 'troca-plano' ||
      calculadoraSolicitada === 'troca-de-plano'
    ) {
      setCalculadoraAberta('troca-plano');
    }
  }, [location.search]);

  useEffect(() => {
    if (!calculadoraAberta) return undefined;

    const fecharCalculadoraComEsc = (event) => {
      if (event.key === 'Escape') {
        setCalculadoraAberta(null);
      }
    };

    window.addEventListener('keydown', fecharCalculadoraComEsc);

    return () => {
      window.removeEventListener('keydown', fecharCalculadoraComEsc);
    };
  }, [calculadoraAberta]);

  useEffect(() => {
    if (!quickAccessModalAberto) return undefined;

    const fecharGerenciadorComEsc = (event) => {
      if (event.key === 'Escape') {
        setQuickAccessModalAberto(false);
      }
    };

    window.addEventListener('keydown', fecharGerenciadorComEsc);

    return () => {
      window.removeEventListener('keydown', fecharGerenciadorComEsc);
    };
  }, [quickAccessModalAberto]);

  useEffect(() => {
    if (!token || !user?.id) return undefined;

    const intervalId = window.setInterval(() => {
      carregarStatusAvisosInternos(token, user);
    }, AVISOS_INTERNOS_CHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user]);

  useEffect(() => {
    const dashboardSocket = io(DASHBOARD_SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      timeout: 5000,
      autoConnect: false,
    });

    const atualizarAlertas = (data = {}) => {
      const gruposDashboard = data.grupos || {};
      const totalVendasAtual = Number(gruposDashboard[SALES_DASHBOARD_KEY] || 0);
      const totalVendasAnterior = totalVendasDashboardRef.current;

      setMassivosDashboard(extrairMassivosDashboard(gruposDashboard));

      totalVendasDashboardRef.current = totalVendasAtual;

      if (totalVendasAnterior === null || totalVendasAtual <= totalVendasAnterior) {
        return;
      }

      comemorarVenda(totalVendasAtual - totalVendasAnterior, totalVendasAtual);
    };

    const solicitarAtualizacao = () => {
      if (dashboardSocket.connected) {
        dashboardSocket.emit('request_update');
        return;
      }

      dashboardSocket.connect();
    };

    dashboardSocket.on('connect', () => {
      setDashboardAlertasConectado(true);
      dashboardSocket.emit('request_update');
    });
    dashboardSocket.on('disconnect', () => setDashboardAlertasConectado(false));
    dashboardSocket.on('connect_error', () => setDashboardAlertasConectado(false));
    dashboardSocket.on('update', atualizarAlertas);

    dashboardSocket.connect();

    const refreshInterval = window.setInterval(
      solicitarAtualizacao,
      DASHBOARD_ALERTAS_REFRESH_INTERVAL_MS
    );

    return () => {
      window.clearInterval(refreshInterval);
      window.clearTimeout(celebracaoVendaTimeoutRef.current);
      window.clearTimeout(confetesVendaTimeoutRef.current);
      window.clearTimeout(fogosVendaTimeoutRef.current);
      dashboardSocket.disconnect();
    };
    // O socket do dashboard deve abrir uma vez; os handlers usam refs e estado atualizados internamente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!alertaMencao) {
      document.title = tituloPadrao;
    }

    document.documentElement.classList.toggle('chatTemNaoLidas', totalNaoLidas > 0);

    const faviconLink = getFaviconLink();

    if (!faviconOriginalRef.current) {
      faviconOriginalRef.current = faviconLink.href;
      faviconTipoOriginalRef.current = faviconLink.type || '';
    }

    if (totalNaoLidas === 0) {
      faviconLink.href = faviconOriginalRef.current;
      faviconLink.type = faviconTipoOriginalRef.current;
      return;
    }

    let cancelado = false;

    criarFaviconComAlerta(faviconOriginalRef.current).then((faviconComAlerta) => {
      if (!cancelado) {
        faviconLink.href = faviconComAlerta;
        faviconLink.type = 'image/png';
      }
    });

    return () => {
      cancelado = true;
    };
  }, [totalNaoLidas, alertaMencao, tituloPadrao]);

  useEffect(() => {
    if (!alertaMencao) return undefined;

    let destacar = true;
    const tituloMencao = `@ ${alertaMencao.remetente_nome || 'Mencionaram voce'} - ${APP_TITLE}`;
    const alternarTitulo = () => {
      document.title = destacar ? tituloMencao : tituloPadrao;
      destacar = !destacar;
    };

    alternarTitulo();
    const intervalId = window.setInterval(alternarTitulo, MENTION_BLINK_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
      document.title = tituloPadrao;
    };
  }, [alertaMencao, tituloPadrao]);

  useEffect(() => {
    const limparQuandoFocar = () => {
      if (!document.hidden && document.hasFocus()) {
        setAlertaMencao(null);
      }
    };

    window.addEventListener('focus', limparQuandoFocar);
    document.addEventListener('visibilitychange', limparQuandoFocar);

    return () => {
      window.removeEventListener('focus', limparQuandoFocar);
      document.removeEventListener('visibilitychange', limparQuandoFocar);
    };
  }, []);

  useEffect(() => {
    if (!token || !user?.id) return undefined;

    const sincronizarQuandoOnline = () => {
      if (document.hidden) return;
      agendarRessincronizacaoChat('online');
    };

    window.addEventListener('online', sincronizarQuandoOnline);

    return () => {
      window.removeEventListener('online', sincronizarQuandoOnline);
      window.clearTimeout(resyncTimeoutRef.current);
    };
    // A rotina usa refs para token/user/socket e evita registrar listeners por render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.id]);

  useEffect(() => () => {
    document.title = APP_TITLE;
    document.documentElement.classList.remove('chatTemNaoLidas');
    audioEfeitoRemotoAtualRef.current?.pause?.();
    audioEfeitosRemotosRef.current?.forEach?.((audio) => audio.pause?.());

    const faviconLink = getFaviconLink();
    if (faviconOriginalRef.current) {
      faviconLink.href = faviconOriginalRef.current;
      faviconLink.type = faviconTipoOriginalRef.current;
    }
  }, []);

  useEffect(() => {
    let cancelado = false;
    let limparSocketAtual = () => {};

    const inicializar = async () => {
      const tokenLocal = localStorage.getItem('token');
      const userLocal = localStorage.getItem('user');

      if (!tokenLocal) {
        window.location.href = '/login';
        return;
      }

      try {
        setToken(tokenLocal);
        const headers = { Authorization: `Bearer ${tokenLocal}` };
        let userData = JSON.parse(userLocal) || {};

        try {
          const { data } = await api.get('/me', { headers });
          userData = data;
          localStorage.setItem('user', JSON.stringify(data));
        } catch (err) {
          console.error('Erro ao buscar perfil atual:', err);

          if (err.response?.status === 401) {
            encerrarSessaoExpirada();
            return;
          }
        }

        if (cancelado) return;

        setUser(userData);
        carregarBannerHome(tokenLocal);

        // Conectar ao Socket.IO compartilhado
        const socketInstance = connectSocket(tokenLocal);

        socketRef.current = socketInstance;
        setSocket(socketInstance);

        const handleConnect = () => {
          console.log('✅ Conectado ao Socket.IO');
          reentrarSalasSocket(socketInstance, userData);
        };

        const handleReconnect = (tentativa) => {
          console.log(`✅ Socket.IO reconectado após ${tentativa} tentativa(s)`);
          reentrarSalasSocket(socketInstance, userData);
          agendarRessincronizacaoChat('socket-reconnect');
        };

        const handleDisconnect = (motivo) => {
          console.log(`❌ Desconectado do Socket.IO: ${motivo}`);
        };

        const handleConnectError = (err) => {
          console.error('Erro de conexão do Socket.IO:', err.message);
        };

        const handleUserStatusChanged = (data) => {
          atualizarStatusUsuario(data);
        };

        const handleSalesCelebrationTest = (data = {}) => {
          comemorarVenda(Number(data.incremento || 1), null, {
            titulo: 'Teste de venda',
            subtitulo: data.criado_por
              ? `Disparado por ${data.criado_por}`
              : 'Disparado pelo painel admin',
          });
        };

        const handleAvisosInternosRefresh = () => {
          carregarStatusAvisosInternos(tokenLocal, userData);
        };

        const handleForceRefresh = (data = {}) => {
          console.log('[CHAT] Atualização global solicitada:', data.reason || 'refresh');
          window.location.reload();
        };

        const handlePrankSound = (data = {}) => {
          tocarEfeitoSonoroRemoto(data);
        };

        const handlePurchaseNotification = () => {
          setPurchaseMenuAccess((current) => ({
            canAccess: true,
            unread: Number(current.unread || 0) + 1,
          }));
        };

        const handleDirectMessage = (data) => {
          if (registrarEventoSocket('direct', data)) {
            if (Number(data.remetente_id) !== Number(userData.id)) {
              tocarSomMensagem();
            }
            atualizarConversaComMensagem(data, userData.id, tokenLocal);
          }
        };

        const handleGroupMessage = (data) => {
          if (registrarEventoSocket('group', data)) {
            if (Number(data.remetente_id) !== Number(userData.id)) {
              tocarSomMensagem();
            }

            if (
              mensagemMencionaUsuario(data, userData) &&
              paginaEstaForaDaAba()
            ) {
              setAlertaMencao({
                grupo_id: data.grupo_id,
                remetente_nome: data.remetente_nome,
              });
            }

            atualizarGrupoComMensagem(data, userData, tokenLocal);
          }
        };

        const handleGroupAccessRemoved = (data) => {
          const grupoId = Number(data.grupo_id);

          setGrupos((prev) => ordenarPorAtualizacao(
            prev.map((grupo) => (
              Number(grupo.id) === grupoId
                ? {
                    ...grupo,
                    tem_acesso: false,
                    favorito: false,
                    nao_lidas: 0,
                    unreadCount: 0,
                    ultima_mensagem: null,
                  }
                : grupo
            ))
          ));

          if (Number(grupoSelecionadoRef.current) === grupoId) {
            grupoSelecionadoRef.current = null;
            setGrupoSelecionado(null);
            setAlertaMencao(null);
          }

          carregarDados(tokenLocal);
        };

        const handleGroupAccessChanged = (data) => {
          const gruposRemovidos = Array.isArray(data.grupos_removidos)
            ? data.grupos_removidos.map(Number)
            : [];

          if (gruposRemovidos.length) {
            setGrupos((prev) => ordenarPorAtualizacao(
              prev.map((grupo) => (
                gruposRemovidos.includes(Number(grupo.id))
                  ? {
                      ...grupo,
                      tem_acesso: false,
                      favorito: false,
                      nao_lidas: 0,
                      unreadCount: 0,
                      ultima_mensagem: null,
                    }
                  : grupo
              ))
            ));

            if (gruposRemovidos.includes(Number(grupoSelecionadoRef.current))) {
              grupoSelecionadoRef.current = null;
              setGrupoSelecionado(null);
              setAlertaMencao(null);
            }
          }

          carregarDados(tokenLocal);
        };

        const handleTypingDirect = (data) => {
          console.log('Usuário digitando:', data);
        };

        const handleTypingGroup = (data) => {
          console.log('Usuário digitando no grupo:', data);
        };

        socketInstance.on('connect', handleConnect);
        socketInstance.io.on('reconnect', handleReconnect);
        socketInstance.on('disconnect', handleDisconnect);
        socketInstance.on('connect_error', handleConnectError);

        // Listeners de eventos
        socketInstance.on('user_status_changed', handleUserStatusChanged);
        socketInstance.on('sales_celebration_test', handleSalesCelebrationTest);
        socketInstance.on('announcement:new', handleAvisosInternosRefresh);
        socketInstance.on('announcements:updated', handleAvisosInternosRefresh);
        socketInstance.on('avisos_internos_updated', handleAvisosInternosRefresh);
        socketInstance.on('chat:force-refresh', handleForceRefresh);
        socketInstance.on('system:force-refresh', handleForceRefresh);
        socketInstance.on('play-prank-sound', handlePrankSound);
        socketInstance.on('purchase_notification', handlePurchaseNotification);
        socketInstance.on('receive_direct_message', handleDirectMessage);
        socketInstance.on('new_direct_message_notification', handleDirectMessage);
        socketInstance.on('receive_group_message', handleGroupMessage);
        socketInstance.on('group_access_removed', handleGroupAccessRemoved);
        socketInstance.on('group_access_changed', handleGroupAccessChanged);
        socketInstance.on('user_typing_direct', handleTypingDirect);
        socketInstance.on('user_typing_group', handleTypingGroup);

        limparSocketAtual = () => {
          socketInstance.off('connect', handleConnect);
          socketInstance.io.off('reconnect', handleReconnect);
          socketInstance.off('disconnect', handleDisconnect);
          socketInstance.off('connect_error', handleConnectError);
          socketInstance.off('user_status_changed', handleUserStatusChanged);
          socketInstance.off('sales_celebration_test', handleSalesCelebrationTest);
          socketInstance.off('announcement:new', handleAvisosInternosRefresh);
          socketInstance.off('announcements:updated', handleAvisosInternosRefresh);
          socketInstance.off('avisos_internos_updated', handleAvisosInternosRefresh);
          socketInstance.off('chat:force-refresh', handleForceRefresh);
          socketInstance.off('system:force-refresh', handleForceRefresh);
          socketInstance.off('play-prank-sound', handlePrankSound);
          socketInstance.off('purchase_notification', handlePurchaseNotification);
          socketInstance.off('receive_direct_message', handleDirectMessage);
          socketInstance.off('new_direct_message_notification', handleDirectMessage);
          socketInstance.off('receive_group_message', handleGroupMessage);
          socketInstance.off('group_access_removed', handleGroupAccessRemoved);
          socketInstance.off('group_access_changed', handleGroupAccessChanged);
          socketInstance.off('user_typing_direct', handleTypingDirect);
          socketInstance.off('user_typing_group', handleTypingGroup);
        };

        if (socketInstance.connected) {
          reentrarSalasSocket(socketInstance, userData);
        }

        // Carregar dados
        await carregarPermissoesCompras(tokenLocal);
        await carregarAcessosRapidos(tokenLocal);
        await carregarPersonalizacaoChat(tokenLocal);
        await carregarDados(tokenLocal);
        await carregarStatusAvisosInternos(tokenLocal, userData);
      } catch (err) {
        console.error('Erro ao inicializar:', err);
      } finally {
        if (!cancelado) {
          setLoading(false);
        }
      }
    };

    inicializar();

    return () => {
      cancelado = true;
      window.clearTimeout(quickAccessToastTimeoutRef.current);
      window.clearTimeout(resyncTimeoutRef.current);
      limparSocketAtual();
      socketRef.current = null;
    };
    // O socket deve abrir uma vez; os handlers leem estado atualizado via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Empilha uma entrada de histórico ao abrir uma conversa no mobile, para que o botão
  // voltar do navegador/Android feche a conversa em vez de sair da intranet.
  const empilharHistoricoConversaMobile = () => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    if (!window.matchMedia('(max-width: 768px)').matches) return;
    if (mobileHistoryPushedRef.current) return;

    try {
      window.history.pushState({ chatMobileConversationOpen: true }, '');
      mobileHistoryPushedRef.current = true;
    } catch {
      // Ambientes sem suporte a History API (raro) apenas ignoram o back gesture extra.
    }
  };

  const abrirConversa = (usuario_id) => {
    conversaSelecionadaRef.current = usuario_id;
    grupoSelecionadoRef.current = null;
    abaSelecionadaRef.current = 'diretas';
    setConversaSelecionada(usuario_id);
    setGrupoSelecionado(null);
    setAbaSelecionada('diretas');
    setMostrarUsuarios(false);
    marcarConversaComoLida(usuario_id);
    empilharHistoricoConversaMobile();
  };

  const abrirGrupo = (grupoReferencia) => {
    const grupo = typeof grupoReferencia === 'object'
      ? grupoReferencia
      : gruposRef.current.find((item) => Number(item.id) === Number(grupoReferencia));
    const grupo_id = Number(grupo?.id ?? grupoReferencia);

    if (!grupo_id) return;

    if (grupo?.tem_acesso === false) {
      alert('Você não tem permissão para entrar neste grupo. Peça acesso a um administrador.');
      return;
    }

    grupoSelecionadoRef.current = grupo_id;
    conversaSelecionadaRef.current = null;
    abaSelecionadaRef.current = 'grupos';
    setGrupoSelecionado(grupo_id);
    setConversaSelecionada(null);
    setAbaSelecionada('grupos');
    setMostrarUsuarios(false);
    marcarGrupoComoLido(grupo_id);
    setAlertaMencao((atual) => (
      Number(atual?.grupo_id) === Number(grupo_id) ? null : atual
    ));
    empilharHistoricoConversaMobile();
  };

  const abrirOrigemMensagemFavorita = (favorito) => {
    const origem = favorito?.origem || {};
    const messageId = Number(favorito?.message_id || favorito?.id);

    if (!messageId) return;

    if (origem.tipo === 'grupo' && origem.grupo_id) {
      setMensagemFavoritaParaFocar({
        tipo: 'grupo',
        origemId: Number(origem.grupo_id),
        messageId,
      });
      abrirGrupo(origem.grupo_id);
      return;
    }

    if (origem.tipo === 'direta' && origem.destinatario_id) {
      setMensagemFavoritaParaFocar({
        tipo: 'direta',
        origemId: Number(origem.destinatario_id),
        messageId,
      });
      abrirConversa(origem.destinatario_id);
    }
  };

  const abrirNovaConversa = () => {
    conversaSelecionadaRef.current = null;
    grupoSelecionadoRef.current = null;
    abaSelecionadaRef.current = 'diretas';
    setAbaSelecionada('diretas');
    setConversaSelecionada(null);
    setGrupoSelecionado(null);
    setMostrarUsuarios((atual) => !atual);
  };

  const voltarParaHomeChat = () => {
    if (internalPage) {
      navigate('/chat');
      return;
    }

    conversaSelecionadaRef.current = null;
    grupoSelecionadoRef.current = null;
    setConversaSelecionada(null);
    setGrupoSelecionado(null);
    setMostrarUsuarios(false);
    setChatsSidebarAberta(false);
    setAlertaMencao(null);
  };

  // Botão "voltar" da tela de conversa no mobile: fecha a conversa e retorna para a
  // lista (tela 1), não para o dashboard/banners da home.
  const voltarDaConversaMobile = () => {
    if (mobileHistoryPushedRef.current) {
      mobileHistoryPushedRef.current = false;
      window.history.back();
      return;
    }

    conversaSelecionadaRef.current = null;
    grupoSelecionadoRef.current = null;
    setConversaSelecionada(null);
    setGrupoSelecionado(null);
    setChatsSidebarAberta(true);
  };

  // Suporte ao botão voltar do navegador/Android: se uma conversa estiver aberta no
  // mobile, o back fecha a conversa em vez de navegar para fora da intranet.
  useEffect(() => {
    const handlePopState = () => {
      if (
        mobileHistoryPushedRef.current &&
        (conversaSelecionadaRef.current || grupoSelecionadoRef.current)
      ) {
        mobileHistoryPushedRef.current = false;
        conversaSelecionadaRef.current = null;
        grupoSelecionadoRef.current = null;
        setConversaSelecionada(null);
        setGrupoSelecionado(null);
        setChatsSidebarAberta(true);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Ajusta a altura real da viewport (--app-vh) usando visualViewport quando disponível,
  // para o teclado do celular não esconder o campo de mensagem (100dvh sozinho nem
  // sempre reage a tempo em todos os navegadores mobile).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return undefined;

    const vv = window.visualViewport;
    const atualizarAltura = () => {
      document.documentElement.style.setProperty('--app-vh', `${vv.height}px`);
    };

    atualizarAltura();
    vv.addEventListener('resize', atualizarAltura);
    vv.addEventListener('scroll', atualizarAltura);

    return () => {
      vv.removeEventListener('resize', atualizarAltura);
      vv.removeEventListener('scroll', atualizarAltura);
    };
  }, []);

  const selecionarAba = (aba) => {
    abaSelecionadaRef.current = aba;
    setAbaSelecionada(aba);
    setMostrarUsuarios(false);
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const conversaId = Number(params.get('conversa'));
    const grupoId = Number(params.get('grupo'));

    if (Number.isInteger(conversaId) && conversaId > 0) {
      const usuarioExiste = usuarios.some((usuario) => Number(usuario.id) === conversaId);

      if (!usuarioExiste) return;
      if (
        abaSelecionadaRef.current === 'diretas' &&
        Number(conversaSelecionadaRef.current) === conversaId
      ) {
        return;
      }

      abrirConversa(conversaId);
      return;
    }

    if (Number.isInteger(grupoId) && grupoId > 0) {
      const grupo = grupos.find((item) => Number(item.id) === grupoId);

      if (!grupo) return;
      if (
        abaSelecionadaRef.current === 'grupos' &&
        Number(grupoSelecionadoRef.current) === grupoId
      ) {
        return;
      }

      abrirGrupo(grupo);
    }
    // O efeito reage apenas à URL e às listas carregadas; os handlers usam refs atualizadas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, usuarios, grupos]);

  const abrirMicroSip = () => {
    window.location.href = MICROSIP_PROTOCOL_URL;
  };

  const executarQuickAccess = (item) => {
    if (!item) return;

    if (item.type === 'internal' && item.target) {
      navigate(item.target);
      return;
    }

    if (item.type === 'external' && item.target) {
      window.open(item.target, '_blank', 'noopener,noreferrer');
      return;
    }

    if (item.type === 'protocol' && item.target) {
      if (item.target === MICROSIP_PROTOCOL_URL) {
        abrirMicroSip();
        return;
      }

      window.location.href = item.target;
      return;
    }

    if (item.type === 'modal' && item.target === 'calculadora-link-dedicado') {
      setCalculadoraAberta('link-dedicado');
      return;
    }

    if (item.type === 'modal' && item.target === 'calculadora-semi-dedicado') {
      setCalculadoraAberta('semi-dedicado');
      return;
    }

    if (item.type === 'modal' && item.target === 'calculadora-troca-plano') {
      setCalculadoraAberta('troca-plano');
    }
  };

  const abrirGerenciadorAcessosRapidos = () => {
    setQuickAccessErro('');
    setQuickAccessModalAberto(true);

    if (!quickAccessItems.length && token) {
      carregarAcessosRapidos(token);
    }
  };

  const adicionarAcessoRapido = async (quickAccessId) => {
    if (!token || !quickAccessId) return;

    try {
      marcarQuickAccessProcessando(quickAccessId, true);

      const { data } = await api.post('/me/quick-access', {
        quick_access_id: quickAccessId,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setQuickAccessErro('');
      aplicarRespostaAcessosRapidos(data);
      mostrarQuickAccessToast('Acesso adicionado.');
    } catch (err) {
      console.error('Erro ao adicionar acesso rápido:', err);

      if (err.response?.status === 401) {
        encerrarSessaoExpirada();
        return;
      }

      setQuickAccessErro(err.response?.data?.error || 'Não foi possível adicionar o acesso.');
    } finally {
      marcarQuickAccessProcessando(quickAccessId, false);
    }
  };

  const removerAcessoRapido = async (quickAccessId) => {
    if (!token || !quickAccessId) return;

    try {
      marcarQuickAccessProcessando(quickAccessId, true);

      const { data } = await api.delete(`/me/quick-access/${quickAccessId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setQuickAccessErro('');
      aplicarRespostaAcessosRapidos(data);
      mostrarQuickAccessToast('Acesso removido.');
    } catch (err) {
      console.error('Erro ao remover acesso rápido:', err);

      if (err.response?.status === 401) {
        encerrarSessaoExpirada();
        return;
      }

      setQuickAccessErro(err.response?.data?.error || 'Não foi possível remover o acesso.');
    } finally {
      marcarQuickAccessProcessando(quickAccessId, false);
    }
  };

  const moverAcessoRapido = async (quickAccessId, direcao) => {
    if (!token) return;

    const indiceAtual = meusAcessosRapidos.findIndex((item) => item.id === quickAccessId);
    const indiceDestino = direcao === 'up' ? indiceAtual - 1 : indiceAtual + 1;

    if (indiceAtual < 0 || indiceDestino < 0 || indiceDestino >= meusAcessosRapidos.length) {
      return;
    }

    const anteriores = meusAcessosRapidos;
    const reordenados = [...meusAcessosRapidos];
    [reordenados[indiceAtual], reordenados[indiceDestino]] = [
      reordenados[indiceDestino],
      reordenados[indiceAtual],
    ];

    setMeusAcessosRapidos(reordenados);

    try {
      marcarQuickAccessProcessando(quickAccessId, true);

      const { data } = await api.put('/me/quick-access/order', {
        quick_access_ids: reordenados.map((item) => item.id),
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setQuickAccessErro('');
      aplicarRespostaAcessosRapidos(data);
      mostrarQuickAccessToast('Ordem atualizada.');
    } catch (err) {
      console.error('Erro ao ordenar acessos rápidos:', err);

      if (err.response?.status === 401) {
        encerrarSessaoExpirada();
        return;
      }

      setMeusAcessosRapidos(anteriores);
      setQuickAccessErro(err.response?.data?.error || 'Não foi possível atualizar a ordem.');
    } finally {
      marcarQuickAccessProcessando(quickAccessId, false);
    }
  };

  const abrirAvisosInternos = () => {
    markAvisosInternosAsSeen(user, avisosAtualizadoEm);
    setAvisosInternosPendentes(false);
    navigate('/avisos-internos');
  };

  const abrirFeedbackModal = () => {
    setFeedbackErro('');
    setFeedbackSucesso('');
    setFeedbackForm((atual) => ({
      ...atual,
      nome: atual.nome || user?.nome || '',
      setor: atual.setor || user?.setor_nome || '',
      pagina: window.location.pathname || '/chat',
    }));
    setFeedbackModalAberto(true);
  };

  const fecharFeedbackModal = () => {
    if (feedbackEnviando) return;
    setFeedbackModalAberto(false);
    setFeedbackErro('');
  };

  const alterarFeedbackForm = (campo, valor) => {
    setFeedbackErro('');
    setFeedbackSucesso('');
    setFeedbackForm((atual) => ({
      ...atual,
      [campo]: valor,
    }));
  };

  const enviarFeedback = async (event) => {
    event.preventDefault();

    const nome = feedbackForm.nome.trim();
    const descricao = feedbackForm.descricao.trim();

    if (!nome || !feedbackForm.tipo || !descricao) {
      setFeedbackErro('Preencha nome, tipo e descrição para enviar.');
      return;
    }

    try {
      setFeedbackEnviando(true);
      setFeedbackErro('');
      setFeedbackSucesso('');

      await api.post('/feedbacks', {
        nome,
        tipo: feedbackForm.tipo,
        setor: feedbackForm.setor.trim(),
        prioridade: feedbackForm.prioridade,
        pagina: feedbackForm.pagina.trim(),
        descricao,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setFeedbackSucesso('Feedback enviado com sucesso.');
      setFeedbackForm({
        nome: user?.nome || '',
        tipo: 'bug',
        setor: user?.setor_nome || '',
        prioridade: 'media',
        pagina: window.location.pathname || '/chat',
        descricao: '',
      });

      window.setTimeout(() => {
        setFeedbackModalAberto(false);
        setFeedbackSucesso('');
      }, 900);
    } catch (err) {
      console.error('Erro ao enviar feedback:', err);
      setFeedbackErro('Não foi possível enviar o feedback. Tente novamente.');
    } finally {
      setFeedbackEnviando(false);
    }
  };

  const atualizarDados = async () => {
    if (!token) return;
    await carregarDados(token);
  };

  const logout = () => {
    disconnectSocket();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  const renderAvatar = (usuario, className = styles.conversaAvatar) => (
    <div className={className}>
      {usuario?.avatar ? (
        <img
          src={usuario.avatar}
          alt={usuario.nome || 'Avatar'}
          className={styles.avatarImage}
        />
      ) : (
        <span>{usuario?.nome?.charAt(0)?.toUpperCase()}</span>
      )}
    </div>
  );

  const renderResumoGruposUsuario = (usuario, options = {}) => {
    const {
      className = '',
    } = options;
    const setor = usuario?.setor_nome || '';

    if (!setor) return null;

    return (
      <div className={`${styles.userGroupChips} ${className}`.trim()}>
        <span className={styles.conversaCategory} title={`Categoria principal: ${setor}`}>
          {setor}
        </span>
      </div>
    );
  };

  const abrirPerfil = () => {
    setPerfilForm({
      nome: user?.nome || '',
      avatar: user?.avatar || '',
      senha_atual: '',
      nova_senha: '',
      confirmar_senha: '',
    });
    setPerfilAberto(true);
  };

  const alterarPerfilForm = (campo, valor) => {
    setPerfilForm((atual) => ({
      ...atual,
      [campo]: valor,
    }));
  };

  const arquivoParaDataUrl = (arquivo) => (
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(arquivo);
    })
  );

  const selecionarFotoPerfil = async (event) => {
    const arquivo = event.target.files?.[0];
    event.target.value = '';

    if (!arquivo) return;

    if (!arquivo.type.startsWith('image/')) {
      alert('Selecione apenas imagens.');
      return;
    }

    if (arquivo.size > MAX_PROFILE_IMAGE_SIZE) {
      alert('Foto muito grande. Envie imagens de até 200 MB.');
      return;
    }

    try {
      const dataUrl = await arquivoParaDataUrl(arquivo);
      setImagemPerfilParaEditar({
        src: dataUrl,
        name: arquivo.name,
        type: arquivo.type,
      });
    } catch (err) {
      console.error('Erro ao carregar foto:', err);
      alert('Não foi possível carregar a foto.');
    }
  };

  const usarFotoPerfilEditada = async ({ dataUrl }) => {
    alterarPerfilForm('avatar', dataUrl);
    setImagemPerfilParaEditar(null);
  };

  const salvarPerfil = async (event) => {
    event.preventDefault();

    if (perfilForm.nova_senha && perfilForm.nova_senha !== perfilForm.confirmar_senha) {
      alert('A confirmação da nova senha não confere.');
      return;
    }

    try {
      setSalvandoPerfil(true);

      const payload = {
        nome: perfilForm.nome,
        avatar: perfilForm.avatar || null,
      };

      if (perfilForm.nova_senha) {
        payload.senha_atual = perfilForm.senha_atual;
        payload.nova_senha = perfilForm.nova_senha;
      }

      const { data } = await api.put('/profile', payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setUser(data);
      localStorage.setItem('user', JSON.stringify(data));
      setPerfilAberto(false);
      await carregarDados(token);
    } catch (err) {
      console.error('Erro ao salvar perfil:', err);
      alert(err.response?.data?.error || 'Não foi possível salvar o perfil.');
    } finally {
      setSalvandoPerfil(false);
    }
  };

  const descreverQuickAccess = (item) => {
    if (item.subtitle) return item.subtitle;
    if (item.type === 'internal') return 'Página interna';
    if (item.type === 'external') return 'Abre em nova aba';
    if (item.type === 'modal') return 'Ferramenta do chat';
    if (item.type === 'protocol') return 'Abre aplicativo';
    if (item.type === 'menu') return 'Menu de opções';
    return 'Acesso rápido';
  };

  const renderQuickAccessItem = (item, scope = 'general', options = {}) => {
    const { stagger = true } = options;
    const apresentacao = obterApresentacaoQuickAccess(item);
    const temDescricao = Boolean(apresentacao.description);
    const menuKey = `${scope}-${item.id}`;
    const cardClassName = [
      'chat-home-shortcut-card',
      temDescricao ? 'chat-home-shortcut-card-with-subtitle' : '',
      apresentacao.variant ? `chat-home-shortcut-card-${apresentacao.variant}` : '',
      stagger ? 'stagger-item' : '',
    ].filter(Boolean).join(' ');
    const renderCardContent = () => (
      <>
        <span className="chat-home-shortcut-icon">{item.icon}</span>
        <span className="chat-home-shortcut-copy">
          <span className="chat-home-shortcut-title-row">
            <strong>{apresentacao.title}</strong>
            {apresentacao.badge && (
              <span className={`chat-home-shortcut-badge ${
                apresentacao.variant ? `chat-home-shortcut-badge-${apresentacao.variant}` : ''
              }`.trim()}>
                {apresentacao.badge}
              </span>
            )}
          </span>
          {temDescricao && <em>{apresentacao.description}</em>}
        </span>
        <small>→</small>
      </>
    );

    if (item.type === 'menu') {
      const menuAberto = agendaMenuAberto === menuKey;

      return (
        <div
          key={item.id}
          className={`chat-home-shortcut-menu-wrap ${stagger ? 'stagger-item' : ''} ${
            menuAberto ? 'chat-home-shortcut-menu-wrap-open' : ''
          }`.trim()}
          ref={menuAberto ? agendaMenuRef : null}
        >
          <button
            type="button"
            className={cardClassName}
            onClick={() => setAgendaMenuAberto((atual) => (atual === menuKey ? null : menuKey))}
            aria-expanded={menuAberto}
          >
            {renderCardContent()}
          </button>

          {menuAberto && (
            <div className="chat-home-agenda-menu">
              {(item.children || []).map((child) => (
                <button
                  key={child.id}
                  type="button"
                  className="chat-home-agenda-option"
                  onClick={() => {
                    setAgendaMenuAberto(null);
                    executarQuickAccess(child);
                  }}
                >
                  <span>{child.icon}</span>
                  {child.label}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <button
        key={item.id}
        type="button"
        className={cardClassName}
        onClick={() => executarQuickAccess(item)}
      >
        {renderCardContent()}
      </button>
    );
  };

  const renderMeuAcessoRapido = (item) => (
    <div key={item.id} className="chat-home-personal-shortcut stagger-item">
      {renderQuickAccessItem(item, 'personal', { stagger: false })}
      <button
        type="button"
        className="chat-home-shortcut-remove"
        onClick={() => removerAcessoRapido(item.id)}
        disabled={quickAccessSavingIds.includes(item.id)}
        title={`Remover ${item.label}`}
        aria-label={`Remover ${item.label}`}
      >
        ×
      </button>
    </div>
  );

  // ========================================
  // RENDERIZAÇÃO
  // ========================================

  if (loading) {
    return (
      <div className={styles.chatViewport}>
        <div className={styles.chatContainer}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p>Carregando chat...</p>
          </div>
        </div>
      </div>
    );
  }

  const usuarioInfoSelecionado = conversaSelecionada
    ? usuarios.find((usuario) => Number(usuario.id) === Number(conversaSelecionada)) || null
    : null;
  const termoBusca = normalizarBusca(busca.trim());
  const pesquisando = termoBusca.length > 0;
  const usuariosBusca = pesquisando
    ? usuarios
        .filter((usuario) => (
          combinaComBusca(
            termoBusca,
            usuario.nome,
            usuario.email,
            usuario.setor_nome,
            usuario.status,
            nomesGruposUsuario(usuario).join(' ')
          )
        ))
        .sort((a, b) => (
          String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', {
            sensitivity: 'base',
          })
        ))
    : [];
  const gruposBusca = pesquisando
    ? grupos.filter((grupo) => combinaComBusca(
          termoBusca,
          grupo.nome,
          grupo.setor_nome,
          grupo.descricao,
          grupo.ultima_mensagem,
          grupo.total_membros
      ))
    : [];
  const totalResultadosBusca = usuariosBusca.length + gruposBusca.length;
  const meusAcessosRapidosIds = new Set(meusAcessosRapidos.map((item) => item.id));
  const quickAccessSavingSet = new Set(quickAccessSavingIds);
  const temMenuCalculadoras = quickAccessItems.some(
    (item) => item.id === QUICK_ACCESS_CALCULATOR_MENU_ID
  );
  const quickAccessItemsSemFilhosCalculadoras = quickAccessItems.filter((item) => (
    item.id === QUICK_ACCESS_CALCULATOR_MENU_ID ||
    !QUICK_ACCESS_CALCULATOR_ID_SET.has(item.id)
  ));
  const quickAccessManagerItems = temMenuCalculadoras ? quickAccessItemsSemFilhosCalculadoras : quickAccessItems;
  const calculadorasIntranet = obterCalculadorasIntranet(quickAccessItems);
  const quickAccessItemsPorId = new Map(
    quickAccessItemsSemFilhosCalculadoras.map((item) => [item.id, item])
  );
  const quickAccessIdsOrganizados = new Set();
  const quickAccessSectionsBase = QUICK_ACCESS_SECTION_DEFINITIONS
    .map((section) => {
      const items = section.itemIds
        .map((itemId) => quickAccessItemsPorId.get(itemId))
        .filter(Boolean);

      items.forEach((item) => quickAccessIdsOrganizados.add(item.id));

      return {
        ...section,
        items,
      };
    })
    .filter((section) => section.items.length > 0);
  const menuCalculadorasItem = quickAccessItemsPorId.get(QUICK_ACCESS_CALCULATOR_MENU_ID);
  const calculadorasSectionItems = [
    ...(menuCalculadorasItem ? [menuCalculadorasItem] : []),
    ...calculadorasIntranet,
  ].filter((item, index, items) => (
    items.findIndex((itemComparado) => itemComparado.id === item.id) === index
  ));

  if (calculadorasSectionItems.length > 0) {
    quickAccessSectionsBase.push({
      id: 'calculadoras',
      title: 'Calculadoras',
      subtitle: 'Ferramentas de cálculo para consultas rápidas',
      gridClassName: 'chat-home-calculators-grid',
      items: calculadorasSectionItems,
    });
    calculadorasSectionItems.forEach((item) => quickAccessIdsOrganizados.add(item.id));
    quickAccessIdsOrganizados.add(QUICK_ACCESS_CALCULATOR_MENU_ID);
  }

  const outrosAcessosRapidos = quickAccessItemsSemFilhosCalculadoras.filter((item) => (
    !quickAccessIdsOrganizados.has(item.id)
  ));

  if (outrosAcessosRapidos.length > 0) {
    quickAccessSectionsBase.push({
      id: 'outros',
      title: 'Outros acessos',
      subtitle: 'Atalhos adicionais disponíveis para o seu perfil',
      items: outrosAcessosRapidos,
    });
  }

  const termoBuscaAcessoRapido = normalizarBusca(quickAccessSearch.trim());
  const quickAccessSections = quickAccessSectionsBase
    .map((section) => {
      const items = termoBuscaAcessoRapido
        ? section.items.filter((item) => {
            const apresentacao = obterApresentacaoQuickAccess(item);
            return combinaComBusca(
              termoBuscaAcessoRapido,
              apresentacao.title,
              apresentacao.description,
              apresentacao.badge,
              item.label,
              item.subtitle
            );
          })
        : section.items;

      return {
        ...section,
        items,
      };
    })
    .filter((section) => section.items.length > 0);
  const totalMassivosDashboard = massivosDashboard.reduce(
    (total, massivo) => total + massivo.total,
    0
  );
  const temPaginaInterna = Boolean(internalPage);
  const estaNaHomeChat = !conversaSelecionada && !grupoSelecionado && !temPaginaInterna;
  const dashboardActiveItemId = obterItemDashboardAtivo(location.pathname);
  const networkDiagnosticMenuAccess = quickAccessItems.some((item) => item.id === 'diagnostico-conexao-cliente');
  const dashboardNavItems = DASHBOARD_NAV_ITEMS
    .filter((item) => CONTROLE_OPERACIONAL_ENABLED || item.id !== 'controle-operacional')
    .filter((item) => !item.requiresPurchaseAccess || purchaseMenuAccess.canAccess)
    .filter((item) => !item.requiresNetworkDiagnosticAccess || networkDiagnosticMenuAccess)
    .map((item) => (
      item.id === 'compras' && purchaseMenuAccess.unread > 0
        ? { ...item, badge: formatarBadgeNaoLidas(purchaseMenuAccess.unread) }
        : item
    ));
  const navegarDashboard = (path) => {
    if (!path || path === location.pathname) return;

    if (path === '/chat') {
      navigate(path);
      return;
    }

    navigate(path, {
      state: createInternalNavigationState(location),
    });
  };
  const sidebarChatsVisivel = !estaNaHomeChat || chatsSidebarAberta;
  const temConversaAberta = Boolean(conversaSelecionada || grupoSelecionado);
  const gruposPerfilVisualizado = normalizarGruposUsuario(perfilVisualizado);
  const mostrarDashboardSidebar = temPaginaInterna && !hideDashboardSidebar;
  const chatContainerClasses = [
    styles.chatContainer,
    temaClaro ? styles.lightTheme : '',
    mostrarDashboardSidebar ? styles.dashboardLayout : '',
    estaNaHomeChat ? styles.homeLayout : '',
    estaNaHomeChat && sidebarChatsVisivel ? styles.homeSidebarOpen : '',
    estaNaHomeChat && !sidebarChatsVisivel ? styles.homeSidebarClosed : '',
    // Mobile: quando há conversa/grupo aberto, a lista some e a conversa ocupa a tela toda
    // (ver @media 768px em Chat.module.css); no desktop essa classe não tem efeito.
    temConversaAberta ? styles.conversaAbertaMobile : '',
  ].filter(Boolean).join(' ');
  const chatAppearanceCssVars = buildChatAppearanceCssVars(chatAppearance);
  const calculadoraModalConfig = calculadoraAberta === 'troca-plano'
    ? {
        ariaLabel: 'Calculadora de Troca de Plano',
        title: 'Calculadora de Troca de Plano',
        subtitle: 'Estimativa proporcional da próxima fatura.',
        content: <PlanChangeCalculator />,
      }
    : calculadoraAberta === 'semi-dedicado'
    ? {
        ariaLabel: 'Calculadora Semi Dedicado',
        title: 'Calculadora Semi Dedicado',
        subtitle: 'Precificação comercial por banda e prazo de contrato.',
        content: <SemiDedicadoCalculator />,
      }
    : calculadoraAberta === 'link-dedicado'
      ? {
          ariaLabel: 'Calculadora de Link Dedicado',
          title: 'Calculadora Internet Dedicada',
          subtitle: 'Link Dedicado com SLA8, IP/30 e ONU Bridge.',
          content: <PricingCalculator />,
      }
    : null;
  const BrowserNotificationIcon = !browserNotificationSupported || browserNotificationPermission === 'denied'
    ? BellOff
    : browserNotificationPermission === 'granted'
      ? BellRing
      : Bell;
  const browserNotificationLabel = !browserNotificationSupported
    ? 'Notificações indisponíveis'
    : browserNotificationPermission === 'granted'
      ? 'Notificações ativadas'
      : browserNotificationPermission === 'denied'
        ? 'Notificações bloqueadas'
        : 'Ativar notificações';
  const browserNotificationHint = browserNotificationPermission === 'denied'
    ? 'Clique no cadeado ao lado do endereço do site e altere Notificações → Permitir.'
    : '';
  const browserNotificationCardClass = [
    styles.notificationCard,
    browserNotificationPermission === 'granted' ? styles.notificationCardActive : '',
    browserNotificationPermission === 'denied' ? styles.notificationCardBlocked : '',
  ].filter(Boolean).join(' ');
  const solicitarPermissaoNotificacoes = async () => {
    if (!browserNotificationSupported || browserNotificationPermission === 'granted') return;

    try {
      await requestBrowserNotificationPermission();
    } catch (err) {
      console.error('Erro ao solicitar permissão de notificações:', err);
    }
  };

  return (
    <div className={`${styles.chatViewport} ${temaClaro ? styles.lightThemeViewport : ''}`}>
      {(confetesVenda.length > 0 || fogosVenda.length > 0 || celebracaoVenda) && (
        <div className={styles.salesCelebrationLayer}>
          {fogosVenda.map((fogo) => (
            <span
              key={fogo.id}
              className={styles.salesFirework}
              style={{
                '--sales-firework-color': fogo.cor,
                '--sales-firework-left': fogo.esquerda,
                '--sales-firework-delay': fogo.atraso,
                '--sales-firework-duration': fogo.duracao,
                '--sales-firework-rise': fogo.subida,
                '--sales-firework-drift': fogo.deslocamento,
                '--sales-firework-scale': fogo.escala,
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
                      '--sales-spark-angle': spark.angulo,
                      '--sales-spark-distance': spark.distancia,
                    }}
                  />
                ))}
              </span>
            </span>
          ))}

          {confetesVenda.map((confete) => (
            <span
              key={confete.id}
              className={`${styles.salesConfettiPiece} ${
                confete.arredondado ? styles.salesConfettiRound : ''
              }`}
              style={{
                '--sales-confetti-color': confete.cor,
                '--sales-confetti-left': confete.esquerda,
                '--sales-confetti-delay': confete.atraso,
                '--sales-confetti-duration': confete.duracao,
                '--sales-confetti-size': confete.tamanho,
                '--sales-confetti-drift': confete.deslocamento,
                '--sales-confetti-rotate': confete.rotacao,
              }}
              aria-hidden="true"
            />
          ))}

          {celebracaoVenda && (
            <div
              key={celebracaoVenda.id}
              className={styles.salesBalloon}
              role="status"
              aria-live="polite"
            >
              <span className={styles.salesBalloonIcon}>✓</span>
              <span>
                <strong>
                  {celebracaoVenda.titulo || (celebracaoVenda.incremento > 1
                    ? `${celebracaoVenda.incremento} novas vendas`
                    : 'Venda confirmada')}
                </strong>
                <small>
                  {celebracaoVenda.subtitulo || SALES_DASHBOARD_KEY}
                </small>
              </span>
              <em>
                +{celebracaoVenda.incremento}
              </em>
            </div>
          )}
        </div>
      )}
      <div className={chatContainerClasses} style={chatAppearanceCssVars}>
        {/* SIDEBAR */}
        {mostrarDashboardSidebar ? (
          <DashboardSidebar
            activeItemId={dashboardActiveItemId}
            onNavigate={navegarDashboard}
            items={dashboardNavItems}
          />
        ) : !temPaginaInterna ? (
        <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarHeaderTop}>
            <button
              type="button"
              className={styles.sidebarLogoButton}
              onClick={voltarParaHomeChat}
              title="Voltar para a página principal"
            >
              <img
                src={logoAcessa}
                alt="Acessa Net"
                className={styles.sidebarLogo}
              />
            </button>
            <div className={styles.sidebarActions}>
              <button
                className={`${styles.iconButton} ${mostrarUsuarios ? styles.activeAction : ''}`}
                title="Nova conversa"
                onClick={abrirNovaConversa}
              >
                💬
              </button>
              <button
                type="button"
                className={styles.iconButton}
                title={temaClaro ? 'Ativar modo escuro' : 'Ativar modo claro'}
                onClick={alternarTema}
              >
                {temaClaro ? '☾' : '☀'}
              </button>
              {estaNaHomeChat && sidebarChatsVisivel && (
                <button
                  className={styles.iconButton}
                  title="Fechar chats"
                  onClick={() => setChatsSidebarAberta(false)}
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className={styles.notificationSettings}>
            <div className={browserNotificationCardClass}>
              <button
                type="button"
                className={styles.notificationButton}
                onClick={solicitarPermissaoNotificacoes}
                disabled={
                  !browserNotificationSupported ||
                  browserNotificationPermission === 'granted' ||
                  browserNotificationPermission === 'denied'
                }
                title={browserNotificationLabel}
              >
                <span className={styles.notificationIconBadge}>
                  <BrowserNotificationIcon size={14} strokeWidth={2} />
                </span>
                <span className={styles.notificationTextGroup}>
                  <span className={styles.notificationTitle}>{browserNotificationLabel}</span>
                  {browserNotificationHint && (
                    <span className={styles.notificationHint}>{browserNotificationHint}</span>
                  )}
                </span>
              </button>
            </div>
          </div>

          <div className={styles.searchBox}>
            <span>🔍</span>
            <input
              type="text"
              placeholder="Pesquisar chats e grupos..."
              className={styles.searchInput}
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
            />
          </div>
        </div>

        {/* ABAS */}
        <div className={styles.tabsContainer}>
          <button
            className={`${styles.tab} ${abaSelecionada === 'diretas' ? styles.active : ''}`}
            onClick={() => selecionarAba('diretas')}
          >
            <span>Diretas</span>
            {totalDiretasNaoLidas > 0 && (
              <span className={styles.tabBadge}>{totalDiretasNaoLidas}</span>
            )}
          </button>
          <button
            className={`${styles.tab} ${abaSelecionada === 'grupos' ? styles.active : ''}`}
            onClick={() => selecionarAba('grupos')}
          >
            <span>Grupos</span>
            {totalGruposNaoLidas > 0 && (
              <span className={styles.tabBadge}>{formatarBadgeNaoLidas(totalGruposNaoLidas)}</span>
            )}
          </button>
        </div>

        {erroDados && (
          <div className={styles.errorBanner}>
            {erroDados}
          </div>
        )}

        {/* CONTEÚDO DA SIDEBAR */}
        <div className={styles.sidebarContent}>
          {pesquisando ? (
            <div className={styles.searchResults}>
              <div className={styles.searchSectionHeader}>
                <span>Usuários</span>
                <strong>{usuariosBusca.length}</strong>
              </div>

              {usuariosBusca.map((usuario) => (
                <div
                  key={`usuario-${usuario.id}`}
                  className={`${styles.conversaItem} ${
                    conversaSelecionada === usuario.id ? styles.active : ''
                  }`}
                  onClick={() => abrirConversa(usuario.id)}
                >
                  <div className={styles.conversaAvatar}>
                    {usuario.avatar ? (
                      <img
                        src={usuario.avatar}
                        alt={usuario.nome || 'Avatar'}
                        className={styles.avatarImage}
                      />
                    ) : (
                      <span>{usuario.nome?.charAt(0)?.toUpperCase()}</span>
                    )}
                    <div
                      className={`${styles.statusIndicator} ${
                        usuario.status === 'online'
                          ? styles.online
                          : usuario.status === 'away'
                          ? styles.away
                          : styles.offline
                      }`}
                    />
                  </div>
                  <div className={styles.conversaInfo}>
                    <div className={styles.conversaNameRow}>
                      <p className={styles.conversaNome}>{usuario.nome}</p>
                      {renderResumoGruposUsuario(usuario)}
                    </div>
                    <p className={styles.conversaPreview}>
                      {usuario.email}
                    </p>
                  </div>
                  <div className={styles.conversaMeta}>
                    <p className={styles.startChatText}>Abrir</p>
                  </div>
                </div>
              ))}

              <div className={styles.searchSectionHeader}>
                <span>Grupos</span>
                <strong>{gruposBusca.length}</strong>
              </div>

              {gruposBusca.map((grupo) => {
                const dataUltimaMensagem = obterDataUltimaMensagemGrupo(grupo);
                const naoLidasGrupo = normalizarTotalNaoLidas(grupo.unreadCount ?? grupo.nao_lidas);

                return (
                  <div
                    key={`grupo-${grupo.id}`}
                    className={`${styles.conversaItem} ${
                      grupoSelecionado === grupo.id ? styles.active : ''
                    } ${
                      naoLidasGrupo > 0 ? styles.temNaoLida : ''
                    } ${
                      grupo.tem_acesso === false ? styles.conversaItemLocked : ''
                    }`}
                    onClick={() => abrirGrupo(grupo)}
                    title={grupo.tem_acesso === false ? 'Acesso restrito a usuários autorizados' : undefined}
                  >
                    <div className={`${styles.conversaAvatar} ${styles.grupo}`}>
                      <span>{grupo.tem_acesso === false ? '🔒' : obterIconeGrupo(grupo)}</span>
                    </div>
                    <div className={styles.conversaInfo}>
                      <p className={styles.conversaNome}>
                        {grupo.nome}
                        <span className={styles.memberCount}>({grupo.total_membros})</span>
                      </p>
                      <p className={styles.conversaPreview}>
                        {grupo.tem_acesso === false
                          ? 'Acesso restrito ao cargo/permissão do grupo'
                          : removerFormatacaoMensagem(grupo.ultima_mensagem)
                            || grupo.descricao
                            || 'Sem mensagens'}
                      </p>
                    </div>
                    <div className={styles.conversaMeta}>
                      {grupo.tem_acesso === false ? (
                        <span className={styles.restrictedBadge}>Restrito</span>
                      ) : (
                        <>
                          <p
                            className={`${styles.conversaHora} ${
                              naoLidasGrupo > 0 ? styles.horaNaoLida : ''
                            }`}
                          >
                            {formatarDataHoraListaChat(dataUltimaMensagem)}
                          </p>
                          {naoLidasGrupo > 0 && (
                            <div className={styles.badgeNaoLido}>
                              {formatarBadgeNaoLidas(naoLidasGrupo)}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {totalResultadosBusca === 0 && (
                <div className={styles.emptyList}>
                  <p>Nada encontrado</p>
                  <p>Tente buscar por nome, setor, email ou grupo</p>
                </div>
              )}
            </div>
          ) : abaSelecionada === 'diretas' ? (
            <ConversasDiretas
              conversas={conversas}
              usuarios={usuarios}
              conversaSelecionada={conversaSelecionada}
              onSelectConversa={abrirConversa}
              onOcultarConversa={ocultarConversaDaLista}
              onToggleFavorito={alternarFavoritoChat}
              onViewProfile={setPerfilVisualizado}
              mostrarUsuarios={mostrarUsuarios}
              busca={busca}
            />
          ) : (
            <Grupos
              grupos={grupos}
              grupoSelecionado={grupoSelecionado}
              onSelectGrupo={abrirGrupo}
              onToggleFavorito={alternarFavoritoChat}
              onViewProfile={setPerfilVisualizado}
              busca={busca}
            />
          )}
        </div>

        {/* FOOTER DA SIDEBAR */}
        {user && (
          <div className={styles.sidebarFooter}>
            <button
              type="button"
              className={styles.avatarButton}
              title="Meu perfil"
              onClick={abrirPerfil}
            >
              {renderAvatar(user)}
            </button>
            <div className={styles.userInfo}>
              <p className={styles.userName}>{user.nome}</p>
              {renderResumoGruposUsuario(user, {
                limite: 1,
                className: styles.footerGroupChips,
              }) || <p className={styles.userSetor}>{user.setor_nome}</p>}
            </div>
            <button
              className={styles.iconButton}
              title="Meu perfil"
              onClick={abrirPerfil}
            >
              👤
            </button>
            <button
              className={styles.iconButton}
              title="Personalizar chat"
              onClick={() => setChatAppearanceAberto(true)}
            >
              <Palette size={18} />
            </button>
            {user.perfil === 'admin' && (
              <button
                className={styles.iconButton}
                title="Painel admin"
                onClick={() => navigate('/admin')}
              >
                ⚙
              </button>
            )}
            <button
              className={styles.iconButton}
              title="Logout"
              onClick={logout}
            >
              🚪
            </button>
          </div>
        )}
        </div>
        ) : null}

        {perfilAberto && (
          <div className={styles.modalOverlay}>
            <form className={styles.profileModal} onSubmit={salvarPerfil}>
            <div className={styles.profileHeader}>
              <div>
                <h2>Meu perfil</h2>
                <p>Atualize seus dados de acesso ao chat.</p>
              </div>
              <button
                type="button"
                className={styles.iconButton}
                title="Fechar"
                onClick={() => setPerfilAberto(false)}
              >
                ×
              </button>
            </div>

            <div className={styles.profilePhotoRow}>
              <div className={styles.profilePhotoPreview}>
                {perfilForm.avatar ? (
                  <img src={perfilForm.avatar} alt="Foto de perfil" />
                ) : (
                  <span>{perfilForm.nome?.charAt(0)?.toUpperCase() || '?'}</span>
                )}
              </div>
              <div className={styles.profilePhotoActions}>
                <button
                  type="button"
                  className={styles.secondaryProfileButton}
                  onClick={() => profileFileInputRef.current?.click()}
                >
                  Trocar foto
                </button>
                <button
                  type="button"
                  className={styles.secondaryProfileButton}
                  onClick={() => alterarPerfilForm('avatar', '')}
                >
                  Remover foto
                </button>
                <input
                  ref={profileFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  className={styles.hiddenFileInput}
                  onChange={selecionarFotoPerfil}
                />
              </div>
            </div>

            <label className={styles.profileField}>
              Nome
              <input
                type="text"
                value={perfilForm.nome}
                onChange={(event) => alterarPerfilForm('nome', event.target.value)}
                minLength="2"
                required
              />
            </label>

            <div className={styles.profilePasswordBox}>
              <p>Trocar senha</p>
              <label className={styles.profileField}>
                Senha atual
                <input
                  type="password"
                  value={perfilForm.senha_atual}
                  onChange={(event) => alterarPerfilForm('senha_atual', event.target.value)}
                  autoComplete="current-password"
                />
              </label>
              <label className={styles.profileField}>
                Nova senha
                <input
                  type="password"
                  value={perfilForm.nova_senha}
                  onChange={(event) => alterarPerfilForm('nova_senha', event.target.value)}
                  minLength="6"
                  autoComplete="new-password"
                />
              </label>
              <label className={styles.profileField}>
                Confirmar nova senha
                <input
                  type="password"
                  value={perfilForm.confirmar_senha}
                  onChange={(event) => alterarPerfilForm('confirmar_senha', event.target.value)}
                  minLength="6"
                  autoComplete="new-password"
                />
              </label>
            </div>

            <div className={styles.profileActions}>
              <button
                type="button"
                className={styles.secondaryProfileButton}
                onClick={() => setPerfilAberto(false)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={styles.primaryProfileButton}
                disabled={salvandoPerfil}
              >
                {salvandoPerfil ? 'Salvando...' : 'Salvar perfil'}
              </button>
            </div>
            </form>
          </div>
        )}

        {perfilVisualizado && (
          <div
            className={styles.modalOverlay}
            role="dialog"
            aria-modal="true"
            aria-label={`Perfil de ${perfilVisualizado.nome || 'usuário'}`}
            onClick={() => setPerfilVisualizado(null)}
          >
            <section
              className={styles.profileViewModal}
              onClick={(event) => event.stopPropagation()}
            >
              <div className={styles.profileHeader}>
                <div>
                  <h2>Visualizar perfil</h2>
                  <p>Grupos e categoria da pessoa no chat interno.</p>
                </div>
                <button
                  type="button"
                  className={styles.iconButton}
                  title="Fechar"
                  onClick={() => setPerfilVisualizado(null)}
                >
                  ×
                </button>
              </div>

              <div className={styles.profileViewBody}>
                <div className={styles.profileViewIdentity}>
                  {perfilVisualizado.avatar ? (
                    <button
                      type="button"
                      className={`${styles.avatarPreviewButton} ${styles.profileViewAvatar}`}
                      title="Clique para ampliar a foto"
                      aria-label={`Ampliar foto de ${perfilVisualizado.nome || 'usuário'}`}
                      onClick={() => setImagemPerfilVisualizada(perfilVisualizado.avatar)}
                    >
                      <img
                        src={perfilVisualizado.avatar}
                        alt={perfilVisualizado.nome || 'Foto de perfil'}
                        className={styles.avatarImage}
                      />
                    </button>
                  ) : (
                    renderAvatar(perfilVisualizado, styles.profileViewAvatar)
                  )}
                  <div>
                    <h3>{perfilVisualizado.nome}</h3>
                  </div>
                </div>

                <section className={styles.profileGroupSection}>
                  <span>Categoria principal</span>
                  <div className={styles.profileGroupList}>
                    {perfilVisualizado.setor_nome ? (
                      <span className={styles.conversaCategory}>{perfilVisualizado.setor_nome}</span>
                    ) : (
                      <p className={styles.profileEmptyGroups}>Sem categoria principal.</p>
                    )}
                  </div>
                </section>

                <section className={styles.profileGroupSection}>
                  <div className={styles.profileSectionHeader}>
                    <span>Grupos que participa</span>
                    <strong>{gruposPerfilVisualizado.length}</strong>
                  </div>
                  {gruposPerfilVisualizado.length ? (
                    <div className={styles.profileGroupList}>
                      {gruposPerfilVisualizado.map((grupo) => (
                        <span
                          key={`${perfilVisualizado.id}-perfil-grupo-${grupo.id || grupo.nome}`}
                          className={styles.profileGroupFullChip}
                          title={grupo.nome}
                        >
                          {grupo.nome}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.profileEmptyGroups}>Sem grupos vinculados.</p>
                  )}
                </section>
              </div>
            </section>
          </div>
        )}

        {imagemPerfilVisualizada && (
          <ImagePreviewModal
            imageUrl={imagemPerfilVisualizada}
            alt={perfilVisualizado?.nome
              ? `Foto de perfil de ${perfilVisualizado.nome}`
              : 'Foto de perfil ampliada'}
            ariaLabel={perfilVisualizado?.nome
              ? `Foto ampliada de ${perfilVisualizado.nome}`
              : 'Foto de perfil ampliada'}
            onClose={() => setImagemPerfilVisualizada(null)}
          />
        )}

        <InternalNoticeManager token={token} onUnauthorized={encerrarSessaoExpirada} />

        {imagemPerfilParaEditar && (
          <ImageCropModal
            imagem={imagemPerfilParaEditar}
            title="Editar foto de perfil"
            confirmLabel="Usar foto"
            defaultAspect={1}
            onCancel={() => setImagemPerfilParaEditar(null)}
            onConfirm={usarFotoPerfilEditada}
          />
        )}

        {calculadoraModalConfig && (
          <div
            className={styles.modalOverlay}
            role="dialog"
            aria-modal="true"
            aria-label={calculadoraModalConfig.ariaLabel}
            onClick={() => setCalculadoraAberta(null)}
          >
            <section
              className={styles.pricingFloatingModal}
              onClick={(event) => event.stopPropagation()}
            >
              <div className={styles.pricingFloatingHeader}>
                <div>
                  <h2>{calculadoraModalConfig.title}</h2>
                  <p>{calculadoraModalConfig.subtitle}</p>
                </div>
                <button
                  type="button"
                  className={styles.iconButton}
                  title="Fechar calculadora"
                  onClick={() => setCalculadoraAberta(null)}
                >
                  ×
                </button>
              </div>
              <div className={styles.pricingFloatingBody}>
                {calculadoraModalConfig.content}
              </div>
            </section>
          </div>
        )}

        {/* ÁREA DO CHAT */}
        <div className={styles.chatArea}>
        {conversaSelecionada && abaSelecionada === 'diretas' && user ? (
          <MensagensDiretas
            usuario_id={conversaSelecionada}
            usuario_atual={user}
            socket={socket}
            token={token}
            appearance={chatAppearance}
            onGlobalAppearanceSaved={setChatAppearance}
            usuarioInfoAtualizada={usuarioInfoSelecionado}
            onClearConversation={atualizarDados}
            onViewProfile={setPerfilVisualizado}
            onOpenFavoriteOrigin={abrirOrigemMensagemFavorita}
            onVoltarMobile={voltarDaConversaMobile}
            focusMessageId={
              mensagemFavoritaParaFocar?.tipo === 'direta' &&
              Number(mensagemFavoritaParaFocar.origemId) === Number(conversaSelecionada)
                ? mensagemFavoritaParaFocar.messageId
                : null
            }
            onFocusMessageHandled={() => setMensagemFavoritaParaFocar(null)}
          />
        ) : grupoSelecionado && abaSelecionada === 'grupos' && user ? (
          <MensagensGrupo
            grupo_id={grupoSelecionado}
            usuario_atual={user}
            socket={socket}
            token={token}
            appearance={chatAppearance}
            onGlobalAppearanceSaved={setChatAppearance}
            onClearConversation={atualizarDados}
            onViewProfile={setPerfilVisualizado}
            onOpenFavoriteOrigin={abrirOrigemMensagemFavorita}
            onVoltarMobile={voltarDaConversaMobile}
            focusMessageId={
              mensagemFavoritaParaFocar?.tipo === 'grupo' &&
              Number(mensagemFavoritaParaFocar.origemId) === Number(grupoSelecionado)
                ? mensagemFavoritaParaFocar.messageId
                : null
            }
            onFocusMessageHandled={() => setMensagemFavoritaParaFocar(null)}
          />
        ) : temPaginaInterna ? (
          <div className={styles.internalPageArea}>
            {internalPage}
          </div>
        ) : (
          <div
            className={styles.emptyChat}
            style={{
              position: 'relative',
              overflowX: 'hidden',
              overflowY: 'auto',
              padding: 'clamp(8px, 1.8vh, 18px) clamp(18px, 4vh, 34px) clamp(18px, 4vh, 34px)',
              gap: '0',
              justifyContent: 'flex-start',
              textAlign: 'left',
            }}
          >
            <style>{`
              .chat-home-shell {
                position: relative;
                z-index: 1;
                width: min(100%, 1220px);
                display: flex;
                flex-direction: column;
                align-items: center;
                margin: 0;
              }

              .home-enter-animation {
                --enter-ease: cubic-bezier(0.22, 1, 0.36, 1);
              }

              .fade-scale-in {
                animation: homeFadeScaleIn var(--enter-duration, 560ms) var(--enter-ease, ease) var(--enter-delay, 0ms) backwards;
                will-change: opacity, transform;
              }

              .fade-in {
                animation: homeFadeIn var(--enter-duration, 500ms) var(--enter-ease, ease) var(--enter-delay, 0ms) backwards;
                will-change: opacity;
              }

              .slide-up-in,
              .stagger-item {
                animation: homeSlideUpIn var(--enter-duration, 560ms) var(--enter-ease, ease) var(--enter-delay, 0ms) backwards;
                will-change: opacity, transform;
              }

              @keyframes homeFadeIn {
                from {
                  opacity: 0;
                }
                to {
                  opacity: 1;
                }
              }

              @keyframes homeFadeScaleIn {
                from {
                  opacity: 0;
                  transform: scale(0.94);
                }
                to {
                  opacity: 1;
                  transform: scale(1);
                }
              }

              @keyframes homeSlideUpIn {
                from {
                  opacity: 0;
                  transform: translateY(18px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
              }

              .chat-home-orbit {
                position: absolute;
                border-radius: 50%;
                pointer-events: none;
                border: 1px solid rgba(0, 174, 255, 0.055);
              }

              .chat-home-orbit.one {
                width: 980px;
                height: 980px;
                transform: translateY(-120px);
              }

              .chat-home-orbit.two {
                width: 1360px;
                height: 1360px;
                transform: translateY(-150px);
                opacity: 0.65;
              }

              .chat-home-glow {
                position: absolute;
                width: 520px;
                height: 150px;
                bottom: 36px;
                left: 50%;
                transform: translateX(-50%);
                background: radial-gradient(circle, rgba(0, 174, 255, 0.18) 0%, rgba(0, 174, 255, 0.045) 44%, transparent 72%);
                filter: blur(12px);
                pointer-events: none;
              }

              .chat-home-hero-bar {
                width: min(100%, 1160px);
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
                margin-bottom: 12px;
              }

              .chat-home-hero-top-actions {
                display: flex;
                align-items: center;
                justify-content: flex-end;
                gap: 10px;
                flex-shrink: 0;
              }

              .chat-home-chat-toggle {
                min-height: 40px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                border: 1px solid rgba(80, 190, 255, 0.24);
                border-radius: 999px;
                background: rgba(0, 174, 255, 0.08);
                color: #8bdcff;
                cursor: pointer;
                font-size: 13px;
                font-weight: 900;
                padding: 0 14px;
                white-space: nowrap;
                transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
              }

              .chat-home-chat-toggle:hover {
                transform: translateY(-2px);
                border-color: rgba(80, 190, 255, 0.44);
                background: rgba(0, 174, 255, 0.14);
              }

              .chat-home-chat-toggle-badge {
                min-width: 22px;
                height: 22px;
                display: inline-grid;
                place-items: center;
                padding: 0 6px;
                border-radius: 999px;
                background: #dc2626;
                color: #ffffff;
                font-size: 11px;
                font-weight: 900;
                line-height: 1;
                box-shadow: 0 0 0 2px rgba(2, 8, 23, 0.86);
              }

              .chat-home-hero-top-actions .chat-home-tip-link {
                margin-top: 0;
              }

              .chat-home-brand-title {
                min-width: 0;
                margin: 0;
                color: #f4fbff;
                font-size: 32px;
                line-height: 1.1;
                font-weight: 900;
                letter-spacing: 0;
                text-align: left;
                text-shadow: 0 0 22px rgba(0, 174, 255, 0.2);
              }

              .chat-home-brand-title span {
                color: #58c8ff;
              }

              .chat-success-banner {
                position: relative;
                width: min(100%, 1160px);
                min-height: 305px;
                padding: 34px 36px;
                border-radius: 24px;
                border: 1px solid rgba(86, 207, 255, 0.46);
                background:
                  radial-gradient(circle at 72% 38%, rgba(0, 174, 255, 0.17), transparent 30%),
                  radial-gradient(circle at 22% 12%, rgba(0, 174, 255, 0.12), transparent 24%),
                  linear-gradient(135deg, rgba(13, 31, 54, 0.88), rgba(4, 11, 23, 0.92));
                box-shadow:
                  0 26px 72px rgba(0, 0, 0, 0.34),
                  0 0 34px rgba(0, 174, 255, 0.12),
                  inset 0 1px 0 rgba(255, 255, 255, 0.06);
                overflow: hidden;
              }

              .chat-success-banner::before {
                content: "";
                position: absolute;
                inset: 0;
                background:
                  linear-gradient(90deg, rgba(0, 174, 255, 0.08), transparent 38%, rgba(0, 174, 255, 0.06)),
                  repeating-linear-gradient(115deg, rgba(255,255,255,0.022) 0px, rgba(255,255,255,0.022) 1px, transparent 1px, transparent 18px);
                pointer-events: none;
              }

              .chat-success-banner::after {
                content: "";
                position: absolute;
                left: 0;
                right: 0;
                bottom: 0;
                height: 2px;
                background: linear-gradient(90deg, transparent, rgba(0, 174, 255, 0.96), transparent);
                opacity: 0.8;
              }

              .chat-success-content {
                position: relative;
                z-index: 1;
                display: grid;
                grid-template-columns: 1.1fr 0.9fr;
                gap: 34px;
                align-items: center;
              }

              .chat-success-tag {
                width: fit-content;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 22px;
                padding: 8px 14px;
                border-radius: 999px;
                border: 1px solid rgba(80, 190, 255, 0.24);
                background: rgba(0, 174, 255, 0.09);
                color: #58c8ff;
                font-size: 12px;
                font-weight: 800;
                letter-spacing: 0.8px;
                text-transform: uppercase;
              }

              .chat-success-title {
                margin: 0;
                max-width: 480px;
                color: #f4fbff;
                font-size: clamp(30px, 3.1vw, 48px);
                line-height: 1.1;
                font-weight: 900;
                letter-spacing: 0;
                text-shadow: 0 0 22px rgba(80, 190, 255, 0.16);
              }

              .chat-success-title span {
                color: #22bfff;
                text-shadow: 0 0 24px rgba(0, 174, 255, 0.36);
              }

              .chat-success-subtitle {
                max-width: 440px;
                margin: 20px 0 0;
                color: #c5d5e5;
                font-size: 15px;
                line-height: 1.65;
              }

              .chat-success-visual {
                position: relative;
                min-height: 230px;
                display: flex;
                align-items: center;
                justify-content: flex-end;
              }

              .chat-success-visual::before {
                content: "";
                position: absolute;
                inset: 18px 4px;
                border-radius: 28px;
                background: radial-gradient(circle at center, rgba(0, 174, 255, 0.13), transparent 66%);
                filter: blur(8px);
                pointer-events: none;
              }

              .chat-offer-box {
                position: relative;
                z-index: 2;
                margin-left: auto;
                width: min(320px, 100%);
                padding: 26px 26px 24px;
                border-radius: 22px;
                border: 1px solid rgba(80, 190, 255, 0.36);
                background: linear-gradient(145deg, rgba(6, 18, 35, 0.98), rgba(3, 10, 22, 0.96));
                backdrop-filter: none;
                box-shadow:
                  0 20px 45px rgba(0, 0, 0, 0.28),
                  0 0 30px rgba(0, 174, 255, 0.1);
                text-align: center;
              }

              .chat-offer-title {
                margin: 0;
                color: #f4fbff;
                font-size: 34px;
                font-weight: 900;
                letter-spacing: 0;
              }

              .chat-offer-title span {
                display: block;
                margin-top: 8px;
                color: #22bfff;
                font-size: 27px;
              }

              .chat-offer-features {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 10px;
                margin: 24px 0 22px;
              }

              .chat-offer-feature {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 7px;
                color: #c5d5e5;
                font-size: 11px;
                line-height: 1.25;
              }

              .chat-offer-feature strong {
                color: #58c8ff;
                font-size: 20px;
                line-height: 1;
              }

              .chat-home-btn {
                width: 100%;
                border: 0;
                border-radius: 10px;
                padding: 13px 18px;
                background: linear-gradient(135deg, #22bfff, #0878d9);
                color: #f4fbff;
                font-size: 14px;
                font-weight: 800;
                cursor: pointer;
                box-shadow: 0 12px 26px rgba(0, 174, 255, 0.22);
                transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
              }

              .chat-home-btn:hover {
                transform: translateY(-2px);
                filter: brightness(1.08);
                box-shadow: 0 18px 34px rgba(0, 174, 255, 0.32);
              }

              .chat-home-secondary-grid {
                width: min(100%, 1160px);
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 18px;
                margin-top: 24px;
              }

              .chat-home-mini-card {
                position: relative;
                min-height: 120px;
                display: grid;
                grid-template-columns: 68px 1fr auto;
                align-items: center;
                gap: 20px;
                padding: 22px 24px;
                border-radius: 20px;
                border: 1px solid rgba(80, 190, 255, 0.18);
                background: linear-gradient(145deg, rgba(13, 30, 52, 0.72), rgba(5, 13, 26, 0.84));
                color: inherit;
                text-align: left;
                cursor: pointer;
                overflow: hidden;
                box-shadow: 0 18px 44px rgba(0, 0, 0, 0.24);
                transition: transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease;
              }

              .chat-home-mini-card:hover {
                transform: translateY(-6px);
                border-color: rgba(80, 190, 255, 0.36);
                box-shadow:
                  0 26px 58px rgba(0, 0, 0, 0.34),
                  0 0 28px rgba(0, 174, 255, 0.10);
              }

              .chat-home-mini-icon {
                width: 62px;
                height: 62px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #58c8ff;
                font-size: 28px;
                background: radial-gradient(circle, rgba(0,174,255,0.2), rgba(5,13,26,0.94));
                border: 1px solid rgba(80,190,255,0.18);
              }

              .chat-home-mini-card strong {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                color: #f4fbff;
                font-size: 17px;
                margin-bottom: 8px;
              }

              .chat-home-mini-card strong span {
                padding: 4px 9px;
                border-radius: 999px;
                color: #58c8ff;
                font-size: 11px;
                font-weight: 800;
                background: rgba(0, 174, 255, 0.1);
              }

              .chat-home-mini-card p {
                margin: 0;
                color: #c5d5e5;
                font-size: 14px;
                line-height: 1.45;
              }

              .chat-home-mini-arrow {
                color: #58c8ff;
                font-size: 22px;
                opacity: 0.72;
                transform: translateX(-4px);
                transition: transform 0.22s ease, opacity 0.22s ease;
              }

              .chat-home-mini-card:hover .chat-home-mini-arrow {
                opacity: 1;
                transform: translateX(2px);
              }

              .chat-home-percent {
                position: absolute;
                right: 28px;
                bottom: -18px;
                color: rgba(88, 200, 255, 0.08);
                font-size: 118px;
                font-weight: 900;
                line-height: 1;
                pointer-events: none;
              }

              .chat-home-mini-card-wiki {
                border-color: rgba(80, 190, 255, 0.2);
              }

              .chat-home-mini-card-wiki:hover {
                border-color: rgba(80, 190, 255, 0.42);
              }

              .chat-home-wiki-bg {
                position: absolute;
                right: 28px;
                bottom: -20px;
                color: rgba(88, 200, 255, 0.07);
                font-size: 124px;
                font-weight: 900;
                line-height: 1;
                pointer-events: none;
              }

              .chat-home-bars {
                position: absolute;
                right: 28px;
                bottom: 20px;
                display: flex;
                align-items: flex-end;
                gap: 10px;
                opacity: 0.35;
                pointer-events: none;
              }

              .chat-home-bars span {
                width: 24px;
                border-radius: 8px 8px 0 0;
                background: linear-gradient(180deg, #8c5cff, rgba(88, 200, 255, 0.18));
              }

              .chat-home-mini-card-warning {
                border-color: rgba(80, 190, 255, 0.18);
              }

              .chat-home-mini-card-warning-active {
                border-color: rgba(255, 116, 72, 0.3);
                box-shadow:
                  0 18px 44px rgba(0, 0, 0, 0.24),
                  0 0 22px rgba(255, 82, 48, 0.16),
                  inset 0 0 0 1px rgba(255, 138, 92, 0.08);
                isolation: isolate;
              }

              .chat-home-mini-card-warning-active::before {
                content: "";
                position: absolute;
                inset: -120%;
                z-index: 0;
                border-radius: 50%;
                background:
                  conic-gradient(
                    from 0deg,
                    transparent 0deg,
                    transparent 248deg,
                    rgba(255, 116, 72, 0.22) 276deg,
                    rgba(255, 179, 71, 0.94) 294deg,
                    rgba(255, 82, 48, 0.68) 314deg,
                    rgba(255, 116, 72, 0.18) 336deg,
                    transparent 360deg
                  );
                pointer-events: none;
                animation: chatAlertBorderSpin 3.2s linear infinite;
              }

              .chat-home-mini-card-warning-active::after {
                content: "";
                position: absolute;
                inset: 1.5px;
                z-index: 0;
                border-radius: 18.5px;
                background:
                  radial-gradient(circle at 18% 18%, rgba(255, 179, 71, 0.08), transparent 34%),
                  radial-gradient(circle at 82% 72%, rgba(255, 82, 48, 0.08), transparent 32%),
                  linear-gradient(145deg, rgba(13, 30, 52, 0.76), rgba(5, 13, 26, 0.88));
                pointer-events: none;
              }

              .chat-home-mini-card-warning-active > * {
                position: relative;
                z-index: 1;
              }

              .chat-home-mini-card-warning:hover {
                border-color: rgba(80, 190, 255, 0.36);
                box-shadow:
                  0 22px 52px rgba(0, 0, 0, 0.34),
                  0 0 28px rgba(0, 174, 255, 0.10);
              }

              .chat-home-mini-card-warning-active:hover {
                border-color: rgba(255, 138, 92, 0.62);
                box-shadow:
                  0 22px 52px rgba(0, 0, 0, 0.34),
                  0 0 30px rgba(255, 82, 48, 0.22),
                  inset 0 0 0 1px rgba(255, 138, 92, 0.12);
              }

              .chat-home-mini-card-warning .chat-home-mini-icon {
                background: radial-gradient(circle, rgba(0,174,255,0.2), rgba(5,13,26,0.94));
                border-color: rgba(80,190,255,0.18);
              }

              .chat-home-mini-card-warning-active .chat-home-mini-icon {
                background:
                  radial-gradient(circle, rgba(255, 122, 64, 0.16), rgba(15, 23, 42, 0.92));
                border-color: rgba(255, 122, 64, 0.35);
                color: #ffb347;
                box-shadow: 0 0 22px rgba(255, 122, 64, 0.22);
                animation: chatAlertIconPulse 1.8s ease-in-out infinite;
              }

              .chat-home-mini-card-warning .chat-home-mini-arrow {
                color: #58c8ff;
              }

              .chat-home-alert-copy {
                min-width: 0;
              }

              .chat-home-alert-title-row {
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                gap: 8px;
                margin-bottom: 8px;
              }

              .chat-home-alert-title-row strong {
                margin-bottom: 0;
              }

              .chat-home-alert-count-badge {
                display: inline-flex;
                align-items: center;
                min-height: 24px;
                border: 1px solid rgba(80, 190, 255, 0.22);
                border-radius: 999px;
                background: rgba(0, 174, 255, 0.12);
                color: #8bdcff;
                font-size: 11px;
                font-weight: 900;
                line-height: 1;
                padding: 0 9px;
                white-space: nowrap;
              }

              .chat-home-alert-message {
                margin: 0;
                color: #c5d5e5;
                font-size: 14px;
                line-height: 1.45;
              }

              .chat-home-alert-caption {
                display: block;
                color: rgba(226, 239, 255, 0.78);
                font-size: 12px;
                font-weight: 800;
                line-height: 1.35;
                text-transform: uppercase;
              }

              .chat-home-alert-tags {
                display: flex;
                flex-wrap: wrap;
                gap: 7px;
                margin-top: 8px;
              }

              .chat-home-alert-tag {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                min-height: 28px;
                border: 1px solid rgba(255, 138, 92, 0.34);
                border-radius: 999px;
                background: rgba(255, 104, 64, 0.16);
                color: #ffd8c7;
                font-size: 12px;
                font-weight: 900;
                line-height: 1;
                padding: 0 10px;
              }

              .chat-home-alert-tag strong {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 18px;
                height: 18px;
                margin: 0;
                border-radius: 999px;
                background: rgba(255, 138, 92, 0.18);
                color: #fff7ed;
                font-size: 11px;
                line-height: 1;
              }

              .chat-home-alert-status {
                display: block;
                margin-top: 4px;
                color: #9fb3c8;
                font-size: 12px;
                font-weight: 700;
              }

              .chat-home-alert-glow {
                position: absolute;
                right: 38px;
                bottom: 26px;
                width: 104px;
                height: 104px;
                pointer-events: none;
                opacity: 0;
              }

              .chat-home-mini-card-warning-active .chat-home-alert-glow {
                opacity: 0;
              }

              .chat-home-alert-glow span {
                position: absolute;
                inset: 0;
                border-radius: 50%;
                border: 1px solid rgba(255, 202, 40, 0.24);
                animation: none;
              }

              .chat-home-mini-card-warning-active .chat-home-alert-glow span {
                border-color: rgba(255, 138, 92, 0.22);
                animation-duration: 3.8s;
              }

              .chat-home-alert-glow span:nth-child(2) {
                animation-delay: 0.55s;
              }

              .chat-home-alert-glow span:nth-child(3) {
                animation-delay: 1.1s;
              }

              @keyframes chatAlertPulse {
                0% {
                  transform: scale(0.35);
                  opacity: 0.65;
                }
                100% {
                  transform: scale(1.15);
                  opacity: 0;
                }
              }

              @keyframes chatAlertIconPulse {
                0%, 100% {
                  box-shadow:
                    0 0 18px rgba(255, 122, 64, 0.18),
                    inset 0 0 0 1px rgba(255, 211, 184, 0.04);
                  transform: scale(1);
                }
                50% {
                  box-shadow:
                    0 0 28px rgba(255, 122, 64, 0.34),
                    inset 0 0 0 1px rgba(255, 211, 184, 0.1);
                  transform: scale(1.035);
                }
              }

              @keyframes chatAlertBorderSpin {
                to {
                  transform: rotate(360deg);
                }
              }


              .chat-home-shortcuts {
                width: min(100%, 1160px);
                margin-top: 18px;
              }

              .chat-home-shortcuts-header {
                display: flex;
                align-items: flex-end;
                justify-content: space-between;
                margin-bottom: 10px;
              }

              .chat-home-shortcuts-header strong {
                display: block;
                color: #f4fbff;
                font-size: 15px;
                font-weight: 900;
                letter-spacing: 0.2px;
              }

              .chat-home-shortcuts-header span {
                display: block;
                margin-top: 4px;
                color: #9fb7cc;
                font-size: 12px;
              }

              .chat-home-my-shortcuts {
                margin-top: 18px;
              }

              .chat-home-quick-access-search {
                min-height: 42px;
                display: grid;
                grid-template-columns: auto 1fr;
                align-items: center;
                gap: 10px;
                margin: 0 0 14px;
                padding: 0 14px;
                border: 1px solid rgba(80, 190, 255, 0.24);
                border-radius: 12px;
                background: rgba(2, 18, 34, 0.74);
                box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);
              }

              .chat-home-quick-access-search span {
                color: #58c8ff;
                font-size: 14px;
                line-height: 1;
              }

              .chat-home-quick-access-search input {
                width: 100%;
                min-width: 0;
                border: 0;
                outline: 0;
                background: transparent;
                color: #f4fbff;
                font-size: 13px;
                font-weight: 800;
              }

              .chat-home-quick-access-search input::placeholder {
                color: rgba(159, 183, 204, 0.82);
              }

              .chat-home-shortcuts-categories {
                display: grid;
                gap: 16px;
              }

              .chat-home-shortcuts-category {
                min-width: 0;
              }

              .chat-home-shortcuts-category-header {
                display: flex;
                align-items: center;
                gap: 9px;
                margin-bottom: 8px;
              }

              .chat-home-shortcuts-category-header::before {
                width: 3px;
                height: 20px;
                border-radius: 999px;
                background: linear-gradient(180deg, #22bfff, #67e8f9);
                content: "";
                flex: 0 0 auto;
                box-shadow: 0 0 16px rgba(34, 191, 255, 0.28);
              }

              .chat-home-shortcuts-category-header strong {
                display: block;
                color: #f4fbff;
                font-size: 13px;
                font-weight: 900;
              }

              .chat-home-shortcuts-category-header span {
                display: block;
                margin-top: 2px;
                color: #8faabd;
                font-size: 11px;
                font-weight: 700;
              }

              .chat-home-shortcuts-category-calculadoras .chat-home-shortcuts-category-header strong {
                color: #7dd3fc;
              }

              .chat-home-calculators-grid .chat-home-shortcut-card {
                border-color: rgba(45, 212, 191, 0.28);
                background:
                  linear-gradient(145deg, rgba(11, 40, 58, 0.72), rgba(4, 18, 31, 0.88));
              }

              .chat-home-calculators-grid .chat-home-shortcut-icon {
                border-color: rgba(45, 212, 191, 0.24);
                background: rgba(45, 212, 191, 0.1);
                color: #67e8f9;
              }

              .chat-home-manage-shortcuts {
                min-height: 34px;
                padding: 0 13px;
                border: 1px solid rgba(80, 190, 255, 0.22);
                border-radius: 999px;
                background: rgba(0, 174, 255, 0.08);
                color: #bfeaff;
                cursor: pointer;
                font-size: 12px;
                font-weight: 800;
                white-space: nowrap;
                transition:
                  background 0.18s ease,
                  border-color 0.18s ease,
                  color 0.18s ease;
              }

              .chat-home-manage-shortcuts:hover,
              .chat-home-manage-shortcuts:focus-visible {
                border-color: rgba(80, 190, 255, 0.48);
                background: rgba(0, 174, 255, 0.14);
                color: #f4fbff;
                outline: none;
              }

              .chat-home-shortcuts-toast {
                margin: -2px 0 10px;
                color: #8be7b0;
                font-size: 12px;
                font-weight: 800;
              }

              .chat-home-shortcuts-empty {
                min-height: 82px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 14px;
                padding: 14px 16px;
                border: 1px dashed rgba(80, 190, 255, 0.28);
                border-radius: 14px;
                background: rgba(0, 174, 255, 0.06);
                color: #d8f2ff;
              }

              .chat-home-shortcuts-empty.compact {
                min-height: 54px;
                justify-content: center;
                color: #9fb7cc;
                font-size: 13px;
                font-weight: 700;
              }

              .chat-home-shortcuts-empty p {
                margin: 0;
                color: #d8f2ff;
                font-size: 13px;
                font-weight: 800;
              }

              .chat-home-shortcuts-empty button {
                min-height: 34px;
                padding: 0 14px;
                border: none;
                border-radius: 999px;
                background: linear-gradient(135deg, #22bfff, #3b82f6);
                color: #001421;
                cursor: pointer;
                font-size: 12px;
                font-weight: 900;
                white-space: nowrap;
              }

              .chat-home-shortcuts-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                gap: 10px 12px;
              }

              .chat-home-shortcut-card {
                min-height: 58px;
                display: grid;
                grid-template-columns: 42px minmax(0, 1fr) auto;
                align-items: center;
                gap: 12px;
                padding: 11px 14px;
                border-radius: 12px;
                border: 1px solid rgba(80, 190, 255, 0.22);
                background:
                  linear-gradient(145deg, rgba(8, 24, 43, 0.66), rgba(4, 12, 24, 0.82));
                color: #f4fbff;
                text-align: left;
                cursor: pointer;
                box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
                transition:
                  transform 0.18s ease,
                  border-color 0.18s ease,
                  background 0.18s ease,
                  box-shadow 0.18s ease;
              }

              .chat-home-shortcut-card:hover {
                transform: translateY(-3px);
                border-color: rgba(80, 190, 255, 0.48);
                background:
                  linear-gradient(145deg, rgba(10, 36, 63, 0.82), rgba(5, 16, 32, 0.94));
                box-shadow:
                  0 18px 34px rgba(0, 0, 0, 0.28),
                  0 0 20px rgba(0, 174, 255, 0.08);
              }

              .chat-home-shortcut-icon {
                width: 34px;
                height: 34px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 10px;
                border: 1px solid rgba(80, 190, 255, 0.2);
                background: rgba(0, 174, 255, 0.08);
                color: #22bfff;
                font-size: 18px;
                font-weight: 900;
                line-height: 1;
              }

              .chat-home-shortcut-card-with-subtitle {
                min-height: 76px;
              }

              .chat-home-shortcut-copy {
                min-width: 0;
                display: grid;
                gap: 3px;
              }

              .chat-home-shortcut-title-row {
                min-width: 0;
                display: flex;
                align-items: center;
                gap: 7px;
              }

              .chat-home-shortcut-card strong {
                min-width: 0;
                color: #f4fbff;
                font-size: 14px;
                font-weight: 800;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }

              .chat-home-shortcut-badge {
                flex: 0 0 auto;
                max-width: 84px;
                padding: 3px 7px;
                border: 1px solid rgba(80, 190, 255, 0.28);
                border-radius: 999px;
                background: rgba(0, 174, 255, 0.1);
                color: #bfeaff;
                font-size: 10px;
                font-weight: 900;
                line-height: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              }

              .chat-home-shortcut-copy em {
                min-width: 0;
                display: -webkit-box;
                -webkit-box-orient: vertical;
                -webkit-line-clamp: 2;
                color: rgba(226, 239, 255, 0.72);
                font-size: 11px;
                font-style: normal;
                font-weight: 800;
                line-height: 1.25;
                overflow: hidden;
                text-overflow: ellipsis;
              }

              .chat-home-shortcut-card small {
                color: #58c8ff;
                font-size: 16px;
                font-weight: 900;
                opacity: 0.78;
                transition: transform 0.18s ease, opacity 0.18s ease;
              }

              .chat-home-shortcut-card:hover small {
                opacity: 1;
                transform: translateX(3px);
              }

              .chat-home-shortcut-card-critical {
                border-color: rgba(248, 113, 113, 0.34);
                background:
                  linear-gradient(145deg, rgba(50, 16, 28, 0.62), rgba(4, 12, 24, 0.88));
              }

              .chat-home-shortcut-card-critical:hover {
                border-color: rgba(248, 113, 113, 0.62);
                box-shadow:
                  0 18px 34px rgba(0, 0, 0, 0.3),
                  0 0 22px rgba(248, 113, 113, 0.1);
              }

              .chat-home-shortcut-card-critical .chat-home-shortcut-icon {
                border-color: rgba(248, 113, 113, 0.3);
                background: rgba(248, 113, 113, 0.12);
                color: #fecaca;
              }

              .chat-home-shortcut-badge-critical {
                border-color: rgba(248, 113, 113, 0.4);
                background: rgba(248, 113, 113, 0.14);
                color: #fecaca;
              }

              .chat-home-personal-shortcut {
                position: relative;
                min-width: 0;
              }

              .chat-home-personal-shortcut > .chat-home-shortcut-card,
              .chat-home-personal-shortcut > .chat-home-shortcut-menu-wrap {
                width: 100%;
              }

              .chat-home-personal-shortcut .chat-home-shortcut-card {
                padding-right: 42px;
              }

              .chat-home-shortcut-remove {
                position: absolute;
                right: 9px;
                top: 50%;
                width: 26px;
                height: 26px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.08);
                color: #d8f2ff;
                cursor: pointer;
                font-size: 17px;
                line-height: 1;
                transform: translateY(-50%);
                transition:
                  background 0.18s ease,
                  border-color 0.18s ease,
                  color 0.18s ease;
              }

              .chat-home-shortcut-remove:hover,
              .chat-home-shortcut-remove:focus-visible {
                border-color: rgba(248, 113, 113, 0.48);
                background: rgba(248, 113, 113, 0.16);
                color: #fecaca;
                outline: none;
              }

              .chat-home-shortcut-remove:disabled {
                cursor: wait;
                opacity: 0.55;
              }

              .chat-home-shortcut-menu-wrap {
                position: relative;
                min-width: 0;
              }

              .chat-home-shortcut-menu-wrap-open {
                z-index: 40;
              }

              .chat-home-shortcut-menu-wrap .chat-home-shortcut-card {
                width: 100%;
              }

              .chat-home-agenda-menu {
                position: absolute;
                left: 8px;
                right: 8px;
                top: calc(100% + 8px);
                z-index: 12;
                display: grid;
                gap: 7px;
                padding: 8px;
                border: 1px solid rgba(80, 190, 255, 0.24);
                border-radius: 14px;
                background: rgba(4, 12, 24, 0.98);
                box-shadow:
                  0 18px 36px rgba(0, 0, 0, 0.32),
                  0 0 24px rgba(0, 174, 255, 0.1);
              }

              .chat-home-agenda-option {
                min-height: 42px;
                display: flex;
                align-items: center;
                gap: 9px;
                border: 1px solid rgba(80, 190, 255, 0.18);
                border-radius: 999px;
                background: rgba(0, 174, 255, 0.08);
                color: #f4fbff;
                cursor: pointer;
                font-size: 13px;
                font-weight: 800;
                padding: 0 12px;
                text-align: left;
              }

              .chat-home-agenda-option:hover,
              .chat-home-agenda-option:focus-visible {
                border-color: rgba(80, 190, 255, 0.42);
                background: rgba(0, 174, 255, 0.14);
                outline: none;
              }

              .chat-home-agenda-option span {
                width: 24px;
                height: 24px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                background: rgba(88, 200, 255, 0.14);
                color: #58c8ff;
                flex-shrink: 0;
              }

              .quick-access-modal {
                width: min(640px, calc(100vw - 28px));
                max-height: min(720px, calc(100vh - 40px));
                display: flex;
                flex-direction: column;
                gap: 14px;
                padding: 22px;
                border: 1px solid rgba(80, 190, 255, 0.24);
                border-radius: 18px;
                background:
                  linear-gradient(145deg, rgba(8, 24, 43, 0.98), rgba(4, 12, 24, 0.98));
                color: #f4fbff;
                box-shadow:
                  0 24px 64px rgba(0, 0, 0, 0.42),
                  0 0 32px rgba(0, 174, 255, 0.12);
              }

              .quick-access-modal h2 {
                margin: 0;
                color: #f4fbff;
                font-size: 20px;
                font-weight: 900;
              }

              .quick-access-modal p {
                margin: 4px 0 0;
                color: #9fb7cc;
                font-size: 13px;
              }

              .quick-access-message {
                padding: 10px 12px;
                border-radius: 12px;
                font-size: 13px;
                font-weight: 800;
              }

              .quick-access-message-error {
                border: 1px solid rgba(248, 113, 113, 0.32);
                background: rgba(127, 29, 29, 0.22);
                color: #fecaca;
              }

              .quick-access-message-success {
                border: 1px solid rgba(74, 222, 128, 0.26);
                background: rgba(20, 83, 45, 0.18);
                color: #bbf7d0;
              }

              .quick-access-manager-list {
                display: grid;
                gap: 10px;
                overflow-y: auto;
                padding-right: 4px;
              }

              .quick-access-manager-item {
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                align-items: center;
                gap: 10px;
                padding: 10px;
                border: 1px solid rgba(80, 190, 255, 0.18);
                border-radius: 14px;
                background: rgba(255, 255, 255, 0.04);
              }

              .quick-access-manager-item.is-selected {
                border-color: rgba(34, 191, 255, 0.42);
                background: rgba(0, 174, 255, 0.1);
              }

              .quick-access-manager-toggle {
                display: grid;
                grid-template-columns: 20px 34px minmax(0, 1fr);
                align-items: center;
                gap: 12px;
                min-width: 0;
                padding: 0;
                border: none;
                background: transparent;
                color: inherit;
                cursor: pointer;
                text-align: left;
              }

              .quick-access-manager-toggle input {
                width: 16px;
                height: 16px;
                accent-color: #22bfff;
                pointer-events: none;
              }

              .quick-access-manager-toggle:disabled {
                cursor: wait;
                opacity: 0.7;
              }

              .quick-access-manager-copy {
                min-width: 0;
                display: grid;
                gap: 3px;
              }

              .quick-access-manager-copy strong {
                color: #f4fbff;
                font-size: 14px;
                font-weight: 900;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              }

              .quick-access-manager-copy small {
                color: #9fb7cc;
                font-size: 12px;
                font-weight: 700;
              }

              .quick-access-manager-actions {
                display: flex;
                align-items: center;
                gap: 6px;
              }

              .quick-access-manager-actions button {
                min-height: 30px;
                padding: 0 10px;
                border: 1px solid rgba(80, 190, 255, 0.2);
                border-radius: 999px;
                background: rgba(0, 174, 255, 0.08);
                color: #d8f2ff;
                cursor: pointer;
                font-size: 12px;
                font-weight: 900;
              }

              .quick-access-manager-actions button:hover:not(:disabled),
              .quick-access-manager-actions button:focus-visible:not(:disabled) {
                border-color: rgba(80, 190, 255, 0.48);
                background: rgba(0, 174, 255, 0.14);
                outline: none;
              }

              .quick-access-manager-actions button:disabled {
                cursor: not-allowed;
                opacity: 0.45;
              }

              .chat-home-secondary-grid > .stagger-item:nth-child(1) {
                --enter-delay: 390ms;
              }

              .chat-home-secondary-grid > .stagger-item:nth-child(2) {
                --enter-delay: 455ms;
              }

              .chat-home-shortcuts-grid > .stagger-item:nth-child(1) {
                --enter-delay: 500ms;
              }

              .chat-home-shortcuts-grid > .stagger-item:nth-child(2) {
                --enter-delay: 545ms;
              }

              .chat-home-shortcuts-grid > .stagger-item:nth-child(3) {
                --enter-delay: 590ms;
              }

              .chat-home-shortcuts-grid > .stagger-item:nth-child(4) {
                --enter-delay: 635ms;
              }

              .chat-home-shortcuts-grid > .stagger-item:nth-child(5) {
                --enter-delay: 680ms;
              }

              .chat-home-shortcuts-grid > .stagger-item:nth-child(6) {
                --enter-delay: 725ms;
              }

              .chat-home-shortcuts-grid > .stagger-item:nth-child(7) {
                --enter-delay: 770ms;
              }

	              .chat-home-shortcuts-grid > .stagger-item:nth-child(8) {
	                --enter-delay: 815ms;
	              }

	              .chat-home-shortcuts-grid > .stagger-item:nth-child(9) {
	                --enter-delay: 860ms;
	              }

	              .chat-home-shortcuts-grid > .stagger-item:nth-child(10) {
	                --enter-delay: 905ms;
	              }

	              .chat-home-shortcuts-grid > .stagger-item:nth-child(11) {
	                --enter-delay: 950ms;
	              }

	              .chat-home-shortcuts-grid > .stagger-item:nth-child(12) {
	                --enter-delay: 995ms;
	              }
	
	              .home-actions-bottom .feedback-report-button {
	                --enter-delay: 1040ms;
	              }
	
	              .home-actions-bottom .changelog-button {
	                --enter-delay: 1085ms;
	              }
	
		              .chat-home-corner-seal {
		                --enter-delay: 1130ms;
		              }

              .home-actions-bottom {
                width: min(100%, 1000px);
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                gap: 10px;
                margin-top: 16px;
              }

              .feedback-report-button,
              .changelog-button {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                border: 1px solid rgba(80, 190, 255, 0.24);
                border-radius: 999px;
                padding: 10px 16px;
                background: rgba(0, 174, 255, 0.08);
                color: #8bdcff;
                cursor: pointer;
                font-size: 13px;
                font-weight: 800;
                text-decoration: none;
                transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
              }

              .feedback-report-button:hover,
              .changelog-button:hover {
                transform: translateY(-2px);
                border-color: rgba(80, 190, 255, 0.42);
                background: rgba(0, 174, 255, 0.14);
              }

	              .chat-home-corner-seal {
	                position: fixed;
	                right: 16px;
	                bottom: 4px;
                z-index: 2;
                margin: 0;
                color: rgba(219, 234, 254, 0.36);
                font-size: 11px;
                line-height: 1.5;
                text-align: right;
              }

	              .chat-home-corner-seal a {
	                color: rgba(139, 220, 255, 0.58);
	                font-weight: 700;
	                text-decoration: none;
	              }
	
	              .chat-home-corner-seal a:hover {
	                color: #b7ecff;
	                text-decoration: underline;
	              }

              .feedback-modal {
                width: min(560px, 100%);
                border: 1px solid rgba(90, 190, 255, 0.22);
                border-radius: 14px;
                background: #061222;
                color: #eaf7ff;
                box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
                overflow: hidden;
              }

              .feedback-modal-body {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 12px;
                padding: 16px;
              }

              .feedback-modal-body label {
                display: flex;
                flex-direction: column;
                gap: 6px;
                color: #a8bdd2;
                font-size: 12px;
                font-weight: 800;
                text-transform: uppercase;
              }

              .feedback-modal-body input,
              .feedback-modal-body select,
              .feedback-modal-body textarea {
                width: 100%;
                border: 1px solid rgba(90, 190, 255, 0.2);
                border-radius: 8px;
                background: rgba(255, 255, 255, 0.05);
                color: #f4fbff;
                font: inherit;
                font-size: 14px;
                font-weight: 500;
                padding: 10px 12px;
                text-transform: none;
              }

              .feedback-modal-body textarea {
                resize: vertical;
              }

              .feedback-modal-body input:focus,
              .feedback-modal-body select:focus,
              .feedback-modal-body textarea:focus {
                border-color: rgba(88, 200, 255, 0.55);
                outline: 2px solid rgba(0, 174, 255, 0.16);
              }

              .feedback-modal-body select option {
                color: #17202a;
              }

              .feedback-field-wide {
                grid-column: 1 / -1;
              }

              .feedback-message {
                grid-column: 1 / -1;
                border-radius: 8px;
                padding: 10px 12px;
                font-size: 13px;
                font-weight: 800;
              }

              .feedback-message-error {
                border: 1px solid rgba(248, 113, 113, 0.28);
                background: rgba(127, 29, 29, 0.35);
                color: #fecaca;
              }

              .feedback-message-success {
                border: 1px solid rgba(74, 222, 128, 0.3);
                background: rgba(20, 83, 45, 0.35);
                color: #bbf7d0;
              }

              .chat-home-tip {
                width: min(100%, 1000px);
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 22px;
                margin-top: 26px;
                color: #c5d5e5;
              }

              .chat-home-tip-left {
                display: flex;
                align-items: center;
                gap: 16px;
              }

              .chat-home-tip-icon {
                width: 48px;
                height: 48px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 1px solid rgba(80, 190, 255, 0.2);
                background: rgba(0, 174, 255, 0.08);
                color: #58c8ff;
                font-size: 22px;
              }

              .chat-home-tip strong {
                display: block;
                color: #f4fbff;
                font-size: 15px;
                margin-bottom: 4px;
              }

              .chat-home-tip p {
                margin: 0;
                font-size: 13px;
                line-height: 1.4;
              }

              .chat-home-tip-link {
                border: 0;
                background: transparent;
                color: #58c8ff;
                font-weight: 800;
                cursor: pointer;
                white-space: nowrap;
                transition: transform 0.2s ease, color 0.2s ease;
              }

              .chat-home-tip-link-updated {
                position: relative;
                border-radius: 999px;
                padding: 10px 14px;
                background: rgba(249, 115, 22, 0.16);
                color: #ffb86b;
                animation: chatAvisosPulse 1.05s ease-in-out infinite;
                box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.46);
              }

              .chat-home-tip-link-updated::before {
                content: 'Novo';
                position: absolute;
                top: -14px;
                right: 4px;
                border-radius: 999px;
                padding: 3px 7px;
                background: #f97316;
                color: #fff7ed;
                font-size: 10px;
                font-weight: 900;
                line-height: 1;
              }

              .chat-home-tip-link:hover {
                transform: translateX(4px);
                color: #8bdcff;
              }

              .chat-home-tip-link-updated:hover {
                color: #fff7ed;
              }

              @keyframes chatAvisosPulse {
                0% {
                  box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.45);
                  filter: brightness(1);
                }
                50% {
                  box-shadow: 0 0 0 9px rgba(249, 115, 22, 0);
                  filter: brightness(1.25);
                }
                100% {
                  box-shadow: 0 0 0 0 rgba(249, 115, 22, 0);
                  filter: brightness(1);
                }
              }

              @media (prefers-reduced-motion: reduce) {
                .fade-scale-in,
                .fade-in,
                .slide-up-in,
                .stagger-item {
                  animation: none;
                }

                .chat-home-tip-link-updated {
                  animation: none;
                  box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.32);
                }
              }

              @media (max-width: 1180px) {
                .chat-success-content {
                  grid-template-columns: 1fr;
                }

                .chat-success-visual {
                  min-height: 220px;
                }

                .chat-offer-box {
                  margin: 0 auto;
                }

                .chat-home-secondary-grid {
                  grid-template-columns: 1fr;
                }

              }

              @media (max-width: 780px) {
                .chat-success-banner {
                  padding: 26px 22px;
                }

                .chat-success-title {
                  font-size: 30px;
                }

                .chat-offer-box {
                  width: 100%;
                }

                .chat-home-mini-card {
                  grid-template-columns: 54px 1fr;
                }

                .chat-home-mini-arrow {
                  display: none;
                }

                .chat-home-shortcuts-grid {
                  grid-template-columns: 1fr;
                }

                .chat-home-quick-access-search {
                  margin-bottom: 12px;
                }

                .chat-home-shortcuts-header {
                  align-items: flex-start;
                  flex-direction: column;
                  gap: 10px;
                }

                .chat-home-manage-shortcuts {
                  width: 100%;
                }

                .chat-home-shortcuts-empty {
                  align-items: stretch;
                  flex-direction: column;
                }

                .chat-home-shortcuts-empty button {
                  width: 100%;
                }

                .chat-home-shortcut-card {
                  min-height: 54px;
                }

                .chat-home-shortcut-card-with-subtitle {
                  min-height: 72px;
                }

                .quick-access-modal {
                  width: calc(100vw - 20px);
                  max-height: calc(100vh - 20px);
                  padding: 18px;
                }

                .quick-access-manager-item {
                  grid-template-columns: 1fr;
                }

                .quick-access-manager-actions {
                  justify-content: flex-end;
                  flex-wrap: wrap;
                }

                .home-actions-bottom {
                  align-items: stretch;
                }

                .feedback-report-button,
                .changelog-button {
                  width: 100%;
                }

	                .chat-home-corner-seal {
	                  right: 10px;
	                  bottom: 3px;
                  max-width: calc(100% - 20px);
                  font-size: 10px;
                  text-align: right;
                }

                .feedback-modal-body {
                  grid-template-columns: 1fr;
                }

                .chat-home-hero-bar {
                  margin-bottom: 8px;
                }

                .chat-home-brand-title {
                  font-size: 25px;
                  text-align: left;
                }

                .chat-home-hero-top-actions .chat-home-tip-link {
                  max-width: 100%;
                  margin-top: 0;
                }
              }

              @media (max-width: 520px) {
                .chat-home-hero-bar {
                  align-items: stretch;
                  flex-direction: column;
                  gap: 10px;
                }

                .chat-home-brand-title {
                  text-align: center;
                }

                .chat-home-hero-top-actions .chat-home-tip-link {
                  width: 100%;
                  text-align: center;
                }

              }
            `}</style>

            <div className="chat-home-orbit one" />
            <div className="chat-home-orbit two" />
            <div className="chat-home-glow" />

            <div className="chat-home-shell home-enter-animation">
              <div className="chat-home-hero-bar slide-up-in" style={{ '--enter-delay': '80ms' }}>
                <h1 className="chat-home-brand-title">
                  Intranet <span>Dias Gestão</span>
                </h1>

                <div className="chat-home-hero-top-actions">
                  <button
                    type="button"
                    className="chat-home-chat-toggle"
                    onClick={() => setChatsSidebarAberta((atual) => !atual)}
                  >
                    <span>{sidebarChatsVisivel ? '× Fechar chats' : '☰ Abrir chats'}</span>
                    {totalNaoLidas > 0 && (
                      <span
                        className="chat-home-chat-toggle-badge"
                        aria-label={`${totalNaoLidas} mensagens não lidas`}
                        title={`${totalNaoLidas} mensagens não lidas`}
                      >
                        {totalNaoLidas > 9 ? '9+' : totalNaoLidas}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    className={`chat-home-tip-link ${avisosInternosPendentes ? 'chat-home-tip-link-updated' : ''}`}
                    onClick={abrirAvisosInternos}
                  >
                    Ver avisos internos →
                  </button>
                </div>
              </div>

              <HomeBanner
                content={bannerHome}
                className="slide-up-in"
                style={{ '--enter-delay': '140ms', '--enter-duration': '660ms' }}
              />

              <div className="chat-home-secondary-grid">
                <CcnaCompetitionHighlightCard
                  className="stagger-item"
                  onOpen={() => navigate('/competicao-ccna')}
                />

                <MassivoAlertCard
                  className="stagger-item"
                  conectado={dashboardAlertasConectado}
                  massivos={massivosDashboard}
                  massivosCount={totalMassivosDashboard}
                  onOpen={() => window.open('http://192.168.1.133/', '_blank', 'noopener,noreferrer')}
                />
              </div>

              <section className="chat-home-shortcuts chat-home-my-shortcuts">
                <div className="chat-home-shortcuts-header">
                  <div>
                    <strong>Meu Acesso Rápido</strong>
                    <span>Atalhos escolhidos para o seu usuário</span>
                  </div>
                  <button
                    type="button"
                    className="chat-home-manage-shortcuts"
                    onClick={abrirGerenciadorAcessosRapidos}
                  >
                    Gerenciar meus acessos
                  </button>
                </div>

                {quickAccessToast && (
                  <div className="chat-home-shortcuts-toast">{quickAccessToast}</div>
                )}

                {quickAccessLoading ? (
                  <div className="chat-home-shortcuts-empty compact">
                    Carregando acessos...
                  </div>
                ) : meusAcessosRapidos.length > 0 ? (
                  <div className="chat-home-shortcuts-grid">
                    {meusAcessosRapidos.map(renderMeuAcessoRapido)}
                  </div>
                ) : (
                  <div className="chat-home-shortcuts-empty">
                    <p>Você ainda não adicionou acessos rápidos.</p>
                    <button type="button" onClick={abrirGerenciadorAcessosRapidos}>
                      Escolher acessos
                    </button>
                  </div>
                )}
              </section>

              <section className="chat-home-shortcuts">
                <div className="chat-home-shortcuts-header">
                  <div>
                    <strong>Acessos rápidos</strong>
                    <span>Painel organizado por rotina de trabalho</span>
                  </div>
                </div>

                <label className="chat-home-quick-access-search">
                  <span>🔍</span>
                  <input
                    type="search"
                    placeholder="Buscar acesso rápido..."
                    value={quickAccessSearch}
                    onChange={(event) => setQuickAccessSearch(event.target.value)}
                  />
                </label>

                {quickAccessLoading ? (
                  <div className="chat-home-shortcuts-empty compact">
                    Carregando acessos...
                  </div>
                ) : quickAccessErro ? (
                  <div className="chat-home-shortcuts-empty compact">
                    {quickAccessErro}
                  </div>
                ) : quickAccessSections.length > 0 ? (
                  <div className="chat-home-shortcuts-categories">
                    {quickAccessSections.map((section) => (
                      <QuickAccessSection
                        key={section.id}
                        section={section}
                        renderItem={renderQuickAccessItem}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="chat-home-shortcuts-empty compact">
                    Nenhum acesso encontrado.
                  </div>
                )}
              </section>

              <div className="home-actions-bottom">
                <button
                  type="button"
                  className="feedback-report-button stagger-item"
                  onClick={abrirFeedbackModal}
                >
                  Relatar bug ou sugestão
                </button>

                <button
                  type="button"
                  className="changelog-button stagger-item"
                  onClick={() => navigate('/changelog')}
                >
                  Changelog
                </button>
              </div>

              <CornerSeal className="chat-home-corner-seal stagger-item" />

              {quickAccessModalAberto && (
                <div
                  className={styles.modalOverlay}
                  onClick={() => setQuickAccessModalAberto(false)}
                >
                  <section
                    className="quick-access-modal"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className={styles.profileHeader}>
                      <div>
                        <h2>Gerenciar meus acessos</h2>
                        <p>Escolha os atalhos que aparecem em Meu Acesso Rápido.</p>
                      </div>
                      <button
                        type="button"
                        className={styles.iconButton}
                        title="Fechar"
                        onClick={() => setQuickAccessModalAberto(false)}
                      >
                        ×
                      </button>
                    </div>

                    {quickAccessErro && (
                      <div className="quick-access-message quick-access-message-error">
                        {quickAccessErro}
                      </div>
                    )}

                    {quickAccessToast && (
                      <div className="quick-access-message quick-access-message-success">
                        {quickAccessToast}
                      </div>
                    )}

                    <div className="quick-access-manager-list">
                      {quickAccessManagerItems.map((item) => {
                        const selecionado = meusAcessosRapidosIds.has(item.id);
                        const processando = quickAccessSavingSet.has(item.id);
                        const indiceSelecionado = meusAcessosRapidos.findIndex((acesso) => acesso.id === item.id);

                        return (
                          <div
                            key={item.id}
                            className={`quick-access-manager-item ${selecionado ? 'is-selected' : ''}`}
                          >
                            <button
                              type="button"
                              className="quick-access-manager-toggle"
                              onClick={() => (
                                selecionado
                                  ? removerAcessoRapido(item.id)
                                  : adicionarAcessoRapido(item.id)
                              )}
                              disabled={processando}
                            >
                              <input type="checkbox" checked={selecionado} readOnly />
                              <span className="chat-home-shortcut-icon">{item.icon}</span>
                              <span className="quick-access-manager-copy">
                                <strong>{item.label}</strong>
                                <small>{descreverQuickAccess(item)}</small>
                              </span>
                            </button>

                            {selecionado && (
                              <div className="quick-access-manager-actions">
                                <button
                                  type="button"
                                  onClick={() => moverAcessoRapido(item.id, 'up')}
                                  disabled={processando || indiceSelecionado <= 0}
                                  title="Mover para cima"
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moverAcessoRapido(item.id, 'down')}
                                  disabled={processando || indiceSelecionado === meusAcessosRapidos.length - 1}
                                  title="Mover para baixo"
                                >
                                  ↓
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removerAcessoRapido(item.id)}
                                  disabled={processando}
                                >
                                  Remover
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </div>
              )}

              {feedbackModalAberto && (
                <div className={styles.modalOverlay}>
                  <form className="feedback-modal" onSubmit={enviarFeedback} noValidate>
                    <div className={styles.profileHeader}>
                      <div>
                        <h2>Relatar bug ou sugestão</h2>
                        <p>Envie problemas encontrados ou ideias para melhorar o sistema.</p>
                      </div>
                      <button
                        type="button"
                        className={styles.iconButton}
                        title="Fechar"
                        onClick={fecharFeedbackModal}
                        disabled={feedbackEnviando}
                      >
                        ×
                      </button>
                    </div>

                    <div className="feedback-modal-body">
                      {feedbackErro && (
                        <div className="feedback-message feedback-message-error">
                          {feedbackErro}
                        </div>
                      )}
                      {feedbackSucesso && (
                        <div className="feedback-message feedback-message-success">
                          {feedbackSucesso}
                        </div>
                      )}

                      <label>
                        Nome do funcionário
                        <input
                          type="text"
                          value={feedbackForm.nome}
                          onChange={(event) => alterarFeedbackForm('nome', event.target.value)}
                          required
                        />
                      </label>

                      <label>
                        Tipo
                        <select
                          value={feedbackForm.tipo}
                          onChange={(event) => alterarFeedbackForm('tipo', event.target.value)}
                          required
                        >
                          <option value="bug">Bug / Erro</option>
                          <option value="sugestao">Sugestão de melhoria</option>
                        </select>
                      </label>

                      <label>
                        Setor ou categoria
                        <input
                          type="text"
                          value={feedbackForm.setor}
                          onChange={(event) => alterarFeedbackForm('setor', event.target.value)}
                        />
                      </label>

                      <label>
                        Prioridade
                        <select
                          value={feedbackForm.prioridade}
                          onChange={(event) => alterarFeedbackForm('prioridade', event.target.value)}
                        >
                          <option value="baixa">Baixa</option>
                          <option value="media">Média</option>
                          <option value="alta">Alta</option>
                        </select>
                      </label>

                      <label className="feedback-field-wide">
                        Página onde ocorreu
                        <input
                          type="text"
                          value={feedbackForm.pagina}
                          onChange={(event) => alterarFeedbackForm('pagina', event.target.value)}
                          placeholder="/chat"
                        />
                      </label>

                      <label className="feedback-field-wide">
                        Descrição
                        <textarea
                          value={feedbackForm.descricao}
                          onChange={(event) => alterarFeedbackForm('descricao', event.target.value)}
                          rows="5"
                          required
                        />
                      </label>
                    </div>

                    <div className={styles.profileActions}>
                      <button
                        type="button"
                        className={styles.secondaryProfileButton}
                        onClick={fecharFeedbackModal}
                        disabled={feedbackEnviando}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className={styles.primaryProfileButton}
                        disabled={feedbackEnviando}
                      >
                        {feedbackEnviando ? 'Enviando...' : 'Enviar'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

            </div>
          </div>
        )}
        </div>
        <ChatAppearanceModal
          open={chatAppearanceAberto}
          onClose={() => setChatAppearanceAberto(false)}
          token={token}
          onSaved={({ preferences }) => setChatAppearance(preferences)}
        />
      </div>
    </div>
  );
}
