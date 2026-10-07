import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  CloudCog,
  Code2,
  Goal,
  Headphones,
  LayoutDashboard,
  LockKeyhole,
  Megaphone,
  Menu,
  Radio,
  Search,
  Shield,
  ShieldCheck,
  Shirt,
  Siren,
  StickyNote,
  Sun,
  Target,
  Trophy,
  X,
} from 'lucide-react';
import api from '../services/api';
import HeroCopaBanner from '../components/HeroCopaBanner';
import WikiCopaCard from '../components/WikiCopaCard';
import { PERFIL_ADMIN } from '../utils/perfis';
import '../styles/IntranetCopaPreview.css';

const DASHBOARD_SOCKET_URL =
  import.meta.env.VITE_NOC_DASHBOARD_SOCKET_URL || 'http://192.168.1.133:5000';

const AGENDA_TECNICOS_URL = 'https://192.168.1.133:8500';

const MASSIVOS_DASHBOARD = [
  { id: 'mrt', key: 'BACKBONE GPON ACESSANET | MRT', label: 'MRT' },
  { id: 'das', key: 'BACKBONE GPON ACESSANET | DAS', label: 'DAS' },
  { id: 'srp', key: 'BACKBONE GPON ACESSANET | SRP', label: 'SRP' },
  { id: 'pv', key: 'BACKBONE GPON ACESSANET | PV', label: 'PV' },
  { id: 'lrj', key: 'BACKBONE GPON ACESSANET | LRJ', label: 'LRJ' },
];

const GROUPS = [
  {
    id: 'marketing',
    name: 'Marketing/Redes Sociais/De...',
    members: '5 membros',
    time: '10:19',
    icon: Megaphone,
    tone: 'yellow',
  },
  {
    id: 'noc',
    name: 'NOC',
    members: '8 membros',
    time: '28/05 18:19',
    icon: Target,
    tone: 'cyan',
  },
  {
    id: 'desenvolvimento',
    name: 'Desenvolvimento',
    members: '1 membros',
    time: '',
    icon: Code2,
    tone: 'green',
  },
  {
    id: 'suporte',
    name: 'Suporte',
    members: '4 membros',
    time: '21/05 08:00',
    icon: Headphones,
    tone: 'blue',
  },
];

const DIRECTS = [
  { id: 'atendimento', name: 'Atendimento', members: 'Online', time: '10:22', icon: Headphones, tone: 'green' },
  { id: 'noc-direto', name: 'Equipe NOC', members: '3 online', time: '10:18', icon: Radio, tone: 'cyan' },
  { id: 'gestao', name: 'Gestão', members: 'Última mensagem ontem', time: 'Ontem', icon: Shield, tone: 'yellow' },
];

const RESTRICTED_GROUPS = [
  'Atendimento',
  'Gerência',
  'Administrativo',
  'Comercial Acessa Net',
  'Financeiro',
];

const QUICK_ACCESS = [
  {
    id: 'sgp',
    title: 'SGP',
    description: 'Gestão de clientes',
    icon: Shield,
    url: 'https://acessanet.sgp.net.br/admin/',
    tone: 'green',
  },
  {
    id: 'olt-cloud',
    title: 'OLT Cloud',
    description: 'Gerenciamento de rede',
    icon: CloudCog,
    url: 'https://acessanet.oltcloud.co/',
    tone: 'cyan',
  },
  {
    id: 'dashboards',
    title: 'Dashboards',
    description: 'Indicadores operacionais',
    icon: BarChart3,
    url: 'http://192.168.1.133/',
    tone: 'blue',
    network: true,
  },
  {
    id: 'agenda',
    title: 'Agenda',
    description: 'Técnicos e instalações',
    icon: CalendarDays,
    url: AGENDA_TECNICOS_URL,
    tone: 'yellow',
  },
  {
    id: 'notas',
    title: 'Notas Rápidas',
    description: 'Anotações do dia a dia',
    icon: StickyNote,
    path: '/notas-rapidas',
    tone: 'green',
  },
  {
    id: 'plantao',
    title: 'Plantão domingo',
    description: 'Escala da equipe',
    icon: Goal,
    path: '/plantao-domingo',
    tone: 'cyan',
  },
];

const FALLBACK_ALERTS = [
  { id: 'mrt', label: 'MRT', total: 2 },
  { id: 'srp', label: 'SRP', total: 1 },
  { id: 'pv', label: 'PV', total: 1 },
  { id: 'sla', label: 'SLA', total: 1 },
];

const normalizeText = (value = '') => (
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
);

function LoadingScreen({ error, onBack }) {
  return (
    <div className={`cupLoading ${error ? 'cupLoading--error' : ''}`}>
      <div className="cupLoadingIcon">
        {error ? <ShieldCheck size={36} /> : <Goal size={36} />}
      </div>
      <strong>{error ? 'Não foi possível abrir a prévia' : 'Montando o Modo Copa'}</strong>
      <span>{error || 'Validando seu acesso de administrador...'}</span>
      {error && (
        <button type="button" onClick={onBack}>
          Voltar à intranet
        </button>
      )}
    </div>
  );
}

function SidebarGroupItem({ item, onClick }) {
  const Icon = item.icon;

  return (
    <button type="button" className="cupGroupItem" onClick={onClick}>
      <span className={`cupGroupIcon cupGroupIcon--${item.tone}`}>
        <Icon size={18} />
      </span>
      <span className="cupGroupCopy">
        <strong>{item.name}</strong>
        <small>{item.members}</small>
      </span>
      {item.time && <time>{item.time}</time>}
    </button>
  );
}

function RestrictedItem({ name, onClick }) {
  return (
    <button type="button" className="cupRestrictedItem" onClick={onClick}>
      <span className="cupRestrictedLock">
        <LockKeyhole size={15} />
      </span>
      <span className="cupGroupCopy">
        <strong>{name}</strong>
        <small>Acesso restrito ao cargo/per...</small>
      </span>
      <span className="cupRestrictedBadge">Restrito</span>
    </button>
  );
}

function Sidebar({
  activeTab,
  filter,
  groups,
  isMobileOpen,
  onCloseMobile,
  onFilterChange,
  onOpenChat,
  onTabChange,
  user,
}) {
  const firstName = user?.nome?.trim().split(/\s+/)[0] || 'Lucas';
  const initials = user?.nome
    ?.trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'L';

  return (
    <aside className={`cupSidebar ${isMobileOpen ? 'is-mobile-open' : ''}`}>
      <div className="cupSidebarPanel">
        <button
          type="button"
          className="cupSidebarMobileClose"
          onClick={onCloseMobile}
          aria-label="Fechar menu"
        >
          <X size={19} />
        </button>

        <div className="cupSidebarBrand">
          <span className="cupBrandTrophy">
            <Trophy size={28} />
          </span>
          <span className="cupBrandWords">
            <strong>Dias</strong>
            <small>Gestão</small>
          </span>
          <div className="cupBrandActions">
            <span className="cupTinyBall" aria-hidden="true" />
            <button type="button" aria-label="Alertas">
              <Bell size={16} />
            </button>
            <button type="button" aria-label="Tema">
              <Sun size={16} />
            </button>
          </div>
        </div>

        <label className="cupSidebarSearch">
          <Search size={16} />
          <input
            type="search"
            value={filter}
            onChange={(event) => onFilterChange(event.target.value)}
            placeholder="Pesquisar chats e grupos..."
          />
        </label>

        <div className="cupSidebarTabs">
          <button
            type="button"
            className={activeTab === 'diretas' ? 'is-active' : ''}
            onClick={() => onTabChange('diretas')}
          >
            Diretas
          </button>
          <button
            type="button"
            className={activeTab === 'grupos' ? 'is-active' : ''}
            onClick={() => onTabChange('grupos')}
          >
            Grupos
          </button>
        </div>

        <div className="cupSidebarScroll">
          <div className="cupSidebarSectionHeading">
            <strong>{activeTab === 'grupos' ? 'Grupos' : 'Diretas'}</strong>
            <span>{groups.length}</span>
          </div>

          <div className="cupGroupList">
            {groups.map((item) => (
              <SidebarGroupItem
                key={item.id}
                item={item}
                onClick={onOpenChat}
              />
            ))}
            {groups.length === 0 && (
              <div className="cupSidebarEmpty">Nenhuma conversa encontrada.</div>
            )}
          </div>

          {activeTab === 'grupos' && (
            <>
              <div className="cupSidebarSectionHeading cupSidebarSectionHeading--restricted">
                <strong>Acesso restrito</strong>
                <span>8</span>
              </div>
              <div className="cupGroupList">
                {RESTRICTED_GROUPS.map((name) => (
                  <RestrictedItem key={name} name={name} onClick={onOpenChat} />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="cupSidebarUser">
          <span className="cupUserAvatar">
            {user?.avatar ? <img src={user.avatar} alt="" /> : initials}
            <i />
          </span>
          <span className="cupUserCopy">
            <strong>{firstName}</strong>
            <small>Administrador</small>
          </span>
          <span className="cupJersey" title="Camisa 10">
            <Shirt size={25} />
            <b>10</b>
          </span>
          <button type="button" aria-label="Mais opções">•••</button>
        </div>
      </div>
    </aside>
  );
}

function Header({ chatsOpen, onOpenMobile, onToggleChats, onOpenNotices }) {
  return (
    <header className="cupHeader">
      <div className="cupHeaderTitle">
        <button
          type="button"
          className="cupMobileMenuButton"
          onClick={onOpenMobile}
          aria-label="Abrir chats"
        >
          <Menu size={21} />
        </button>
        <h1>
          Intranet Dias Gestão <span>– Modo Copa</span>
        </h1>
      </div>

      <div className="cupHeaderActions">
        <button type="button" className="cupCloseChatsButton" onClick={onToggleChats}>
          {chatsOpen ? '× Fechar chats' : '☰ Abrir chats'}
        </button>
        <button type="button" className="cupNoticesButton" onClick={onOpenNotices}>
          <Bell size={15} />
          Ver avisos internos
          <ArrowRight size={15} />
        </button>
      </div>
    </header>
  );
}

function InfoCards({ alerts, onOpenAlerts, onOpenWiki }) {
  const total = alerts.reduce((sum, item) => sum + Number(item.total || 0), 0);

  return (
    <section className="cupInfoGrid">
      <WikiCopaCard onOpen={onOpenWiki} />

      <button type="button" className="cupAlertsCard" onClick={onOpenAlerts}>
        <div className="cupCrowd" aria-hidden="true">
          {Array.from({ length: 13 }, (_, index) => <i key={index} />)}
        </div>
        <span className="cupAlertIcon">
          <Siren size={27} />
        </span>
        <span className="cupAlertsCopy">
          <span className="cupInfoTitleRow">
            <strong>Alertas de hoje</strong>
            <em>{total || 4} não lidas</em>
          </span>
          <small>Dia de jogo: foco total!</small>
          <span className="cupAlertChips">
            {alerts.map((item) => (
              <i key={item.id}>
                {item.label} <b>{item.total}</b>
              </i>
            ))}
          </span>
        </span>
        <ArrowRight className="cupAlertsArrow" size={21} />
      </button>
    </section>
  );
}

function QuickAccessCard({ item, onOpen }) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      className={`cupQuickCard cupQuickCard--${item.tone}`}
      onClick={() => onOpen(item)}
    >
      {item.network && <span className="cupNetworkDetail" aria-hidden="true" />}
      <span className="cupQuickIcon">
        <Icon size={24} />
      </span>
      <span className="cupQuickCopy">
        <strong>{item.title}</strong>
        <small>{item.description}</small>
      </span>
      <ArrowRight className="cupQuickArrow" size={19} />
      <span className="cupQuickStripe" aria-hidden="true" />
    </button>
  );
}

function QuickAccess({ onOpen }) {
  return (
    <section className="cupQuickSection">
      <div className="cupSectionHeading">
        <span className="cupHeadingBall" aria-hidden="true" />
        <div>
          <h2>Acessos rápidos</h2>
          <p>Sistemas usados no dia a dia</p>
        </div>
      </div>

      <div className="cupQuickGrid">
        {QUICK_ACCESS.map((item) => (
          <QuickAccessCard key={item.id} item={item} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

export default function IntranetCopaPreview() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [authStatus, setAuthStatus] = useState('checking');
  const [authError, setAuthError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('grupos');
  const [filter, setFilter] = useState('');
  const [massivos, setMassivos] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const controller = new AbortController();

    if (!token) {
      navigate('/login', { replace: true });
      return () => controller.abort();
    }

    const validateAccess = async () => {
      try {
        const { data } = await api.get('/me', {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (data?.perfil !== PERFIL_ADMIN) {
          navigate('/', { replace: true });
          return;
        }

        localStorage.setItem('user', JSON.stringify(data));
        setUser(data);
        setAuthStatus('ready');
      } catch (error) {
        if (error.code === 'ERR_CANCELED') return;

        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          navigate('/login', { replace: true });
          return;
        }

        setAuthError('Não foi possível validar seu acesso agora.');
        setAuthStatus('error');
      }
    };

    validateAccess();
    return () => controller.abort();
  }, [navigate]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Intranet Dias Gestão - Modo Copa';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    if (authStatus !== 'ready') return undefined;

    const dashboardSocket = io(DASHBOARD_SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      timeout: 5000,
      autoConnect: false,
    });

    dashboardSocket.on('connect', () => dashboardSocket.emit('request_update'));
    dashboardSocket.on('update', (data = {}) => {
      const groups = data.grupos || {};
      setMassivos(
        MASSIVOS_DASHBOARD
          .map((item) => ({ ...item, total: Number(groups[item.key] || 0) }))
          .filter((item) => item.total > 0)
      );
    });
    dashboardSocket.connect();

    return () => dashboardSocket.disconnect();
  }, [authStatus]);

  const filteredGroups = useMemo(() => {
    const source = activeTab === 'grupos' ? GROUPS : DIRECTS;
    const term = normalizeText(filter.trim());

    if (!term) return source;
    return source.filter((item) => normalizeText(`${item.name} ${item.members}`).includes(term));
  }, [activeTab, filter]);

  const alerts = massivos.length > 0 ? massivos.slice(0, 4) : FALLBACK_ALERTS;

  const openQuickAccess = (item) => {
    if (item.path) {
      navigate(item.path);
      return;
    }
    window.open(item.url, '_blank', 'noopener,noreferrer');
  };

  if (authStatus === 'checking') {
    return <LoadingScreen />;
  }

  if (authStatus === 'error') {
    return <LoadingScreen error={authError} onBack={() => navigate('/', { replace: true })} />;
  }

  return (
    <div className={`cupPreview ${sidebarOpen ? 'has-sidebar' : 'no-sidebar'}`}>
      <div className="cupPageGlow cupPageGlow--one" aria-hidden="true" />
      <div className="cupPageGlow cupPageGlow--two" aria-hidden="true" />

      {mobileSidebarOpen && (
        <button
          type="button"
          className="cupMobileOverlay"
          onClick={() => setMobileSidebarOpen(false)}
          aria-label="Fechar chats"
        />
      )}

      {sidebarOpen && (
        <Sidebar
          activeTab={activeTab}
          filter={filter}
          groups={filteredGroups}
          isMobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          onFilterChange={setFilter}
          onOpenChat={() => navigate('/chat')}
          onTabChange={setActiveTab}
          user={user}
        />
      )}

      <main className="cupMain">
        <Header
          chatsOpen={sidebarOpen}
          onOpenMobile={() => {
            setSidebarOpen(true);
            window.setTimeout(() => setMobileSidebarOpen(true), 0);
          }}
          onToggleChats={() => setSidebarOpen((current) => !current)}
          onOpenNotices={() => navigate('/avisos-internos')}
        />

        <div className="cupContent">
          <HeroCopaBanner />
          <InfoCards
            alerts={alerts}
            onOpenAlerts={() => window.open('http://192.168.1.133/', '_blank', 'noopener,noreferrer')}
            onOpenWiki={() => navigate('/wiki')}
          />
          <QuickAccess onOpen={openQuickAccess} />
          <div className="cupGrassTexture" aria-hidden="true" />
        </div>
      </main>
    </div>
  );
}
