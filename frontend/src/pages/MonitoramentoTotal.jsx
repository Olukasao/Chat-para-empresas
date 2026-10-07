import { useCallback, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Clock3,
  ExternalLink,
  Gauge,
  Headphones,
  Map,
  MonitorCheck,
  Network,
  PackageMinus,
  RadioTower,
  RefreshCw,
  Router,
  ShieldCheck,
  UserCheck,
  UserX,
  Users,
  Wifi,
  Wrench,
  XCircle,
} from 'lucide-react';
import logoAcessa from '../assets/logo.png';
import { obterChamadoLink } from '../constants/chamadosLinks';
import { useInternalBack, useInternalNavigation } from '../utils/internalNavigation';
import styles from '../styles/MonitoramentoTotal.module.css';

const DASHBOARD_SOCKET_URL =
  import.meta.env.VITE_NOC_DASHBOARD_SOCKET_URL || 'http://192.168.1.133:5000';

const DASHBOARD_REFRESH_INTERVAL_MS = 3 * 60 * 1000;
const AGENDA_TECNICOS_PORT = 8500;
const AGENDA_INSTALACAO_PORT = 8501;

const KPIS_CLIENTES = [
  { id: 'total', label: 'Total de Clientes', icon: Users, tone: 'total' },
  { id: 'atualmente', label: 'Total atualmente', icon: Activity, tone: 'current' },
  { id: 'ativos', label: 'Clientes Ativos', icon: UserCheck, tone: 'active' },
  { id: 'reduzido', label: 'Clientes V. Reduzida', icon: Gauge, tone: 'reduced' },
  { id: 'suspensos', label: 'Clientes Suspensos', icon: AlertTriangle, tone: 'suspended' },
  { id: 'cancelados', label: 'Clientes Cancelados', icon: XCircle, tone: 'cancelled' },
];

const CHAMADOS_NOC = [
  { id: 'suporte-tecnico', label: 'Suporte Técnico', dashboardKey: 'SUPORTE TÉCNICO', icon: Headphones, tone: 'info' },
  { id: 'n1', label: 'N1', dashboardKey: 'SUPORTE N1', icon: CircleDot, tone: 'info' },
  { id: 'n2', label: 'N2', dashboardKey: 'SUPORTE N2', icon: CircleDot, tone: 'info' },
  { id: 'n3', label: 'N3', dashboardKey: 'SUPORTE N3', icon: CircleDot, tone: 'info' },
  { id: 'baixa', label: 'Baixa', dashboardKey: 'BAIXA', icon: CheckCircle2, tone: 'success' },
  { id: 'regular', label: 'Regular', dashboardKey: 'REGULAR', icon: Clock3, tone: 'warning' },
  { id: 'alta', label: 'Alta', dashboardKey: 'ALTA', icon: AlertTriangle, tone: 'danger' },
  { id: 'offline', label: 'Offline', dashboardKey: 'OFFLINE', icon: Wifi, tone: 'danger' },
  { id: 'roteador', label: 'Roteador', dashboardKey: 'ROTEADOR', icon: Router, tone: 'info' },
  { id: 'atenuacao', label: 'Atenuação', dashboardKey: 'ATENUAÇÃO', icon: RadioTower, tone: 'warning' },
  { id: 'instalacao', label: 'Instalação', dashboardKey: 'ATIVAÇÃO DE CONTRATO - COMUM', icon: Wrench, tone: 'success' },
  {
    id: 'retirada-equipamento',
    label: 'Retirada de Equipamento',
    dashboardKey: 'RETIRADA DE EQUIPAMENTO',
    icon: PackageMinus,
    tone: 'warning',
  },
  {
    id: 'retirada-equipamento-suspensos',
    label: 'Retirada de Equipamento - Suspensos',
    dashboardKey: 'RETIRADA DE EQUIPAMENTO - SUSPENSOS',
    icon: PackageMinus,
    tone: 'danger',
  },
  {
    id: 'mudanca-endereco',
    label: 'Mudança de Endereço',
    dashboardKey: 'ATIVAÇÃO DE CONTRATO - MUDANÇA DE ENDEREÇO',
    icon: Map,
    tone: 'info',
  },
  {
    id: 'mudanca-ponto-interno',
    label: 'Mudança de Ponto interno',
    dashboardKey: 'MUDANÇA DE PONTO INTERNO',
    icon: Network,
    tone: 'info',
  },
  { id: 'retencao', label: 'Retenção', dashboardKey: 'RETENÇÃO', icon: ShieldCheck, tone: 'purple' },
];

const MASSIVOS_DASHBOARD_KEYS = [
  'BACKBONE GPON ACESSANET | MRT',
  'BACKBONE GPON ACESSANET | DAS',
  'BACKBONE GPON ACESSANET | SRP',
  'BACKBONE GPON ACESSANET | PV',
  'BACKBONE GPON ACESSANET | LRJ',
];

const criarClientesVazio = () => ({
  total: null,
  ativos: null,
  reduzido: null,
  suspensos: null,
  cancelados: null,
});

const criarAgendaUrl = (port, params = '') => {
  const host = typeof window !== 'undefined' && window.location.hostname
    ? window.location.hostname
    : '192.168.1.133';

  return `https://${host}:${port}${params}`;
};

const formatarHora = (data) => {
  if (!data) return '--:--:--';

  return data.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const formatarDataCompleta = (data) => (
  data.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
);

const formatarDataIsoLocal = (data) => {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');

  return `${ano}-${mes}-${dia}`;
};

const formatarNumero = (valor) => {
  if (valor === null || valor === undefined) return '--';
  if (typeof valor === 'string') return valor;

  return Number(valor || 0).toLocaleString('pt-BR');
};

const obterValorGrupo = (grupos, chave) => Number(grupos?.[chave] || 0);

const obterStatusDashboardCard = (valor, chamadoId) => {
  if (chamadoId === 'retencao') {
    if (valor >= 5) return 'vermelho';
    if (valor >= 3) return 'amarelo';
    return 'verde';
  }

  if (valor > 30) return 'vermelho';
  if (valor >= 20) return 'amarelo';
  return 'verde';
};

function StatusPill({ online, children }) {
  return (
    <span className={`${styles.statusPill} ${online ? styles.statusPillOnline : styles.statusPillOffline}`}>
      <span className={styles.statusDot} />
      {children}
    </span>
  );
}

function KpiCards({ clientes }) {
  const totalAtualmente =
    clientes.ativos === null && clientes.reduzido === null && clientes.suspensos === null
      ? null
      : Number(clientes.ativos || 0) + Number(clientes.reduzido || 0) + Number(clientes.suspensos || 0);

  const valores = {
    ...clientes,
    atualmente: totalAtualmente,
  };

  return (
    <section className={styles.kpiGrid} aria-label="Cards principais do dashboard">
      {KPIS_CLIENTES.map((kpi) => {
        const Icone = kpi.icon;

        return (
          <article key={kpi.id} className={`${styles.kpiCard} ${styles[`tone-${kpi.tone}`]}`}>
            <span className={styles.cardIcon}>
              <Icone size={18} />
            </span>
            <span className={styles.cardLabel}>{kpi.label}</span>
            <strong>{formatarNumero(valores[kpi.id])}</strong>
          </article>
        );
      })}
    </section>
  );
}

function ChamadosNocCards({ grupos }) {
  return (
    <section className={styles.sectionBlock} aria-labelledby="titulo-chamados-noc">
      <div className={styles.sectionHeader}>
        <div>
          <span className={styles.sectionKicker}>Chamados NOC</span>
          <h2 id="titulo-chamados-noc">Chamados NOC</h2>
        </div>
      </div>

      <div className={styles.chamadosGrid}>
        {CHAMADOS_NOC.map((chamado) => {
          const total = obterValorGrupo(grupos, chamado.dashboardKey);
          const Icone = chamado.icon;
          const link = obterChamadoLink(chamado.label);
          const statusDashboard = obterStatusDashboardCard(total, chamado.id);
          const cardClassName = [
            styles.chamadoCard,
            styles[`chamado-${chamado.tone}`],
            styles[`status-${statusDashboard}`],
            link ? 'noc-clickable-card' : '',
          ].filter(Boolean).join(' ');
          const conteudo = (
            <>
              <span className={styles.chamadoIcon}>
                <Icone size={17} />
              </span>
              <span className={styles.chamadoLabel}>{chamado.label}</span>
              <strong>{formatarNumero(total)}</strong>
              {link && <ExternalLink className={styles.chamadoExternalIcon} size={15} aria-hidden="true" />}
            </>
          );

          if (link) {
            return (
              <a
                key={chamado.id}
                className={cardClassName}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Abrir relatório SGP de ${chamado.label}`}
              >
                {conteudo}
              </a>
            );
          }

          return (
            <article
              key={chamado.id}
              className={cardClassName}
            >
              {conteudo}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function SituacaoOperacionalCard({ ausenciasCount, grupos, conectado }) {
  const massivosAtivos = MASSIVOS_DASHBOARD_KEYS.filter((key) => obterValorGrupo(grupos, key) > 0).length;
  const totalMassivos = MASSIVOS_DASHBOARD_KEYS.reduce((total, key) => total + obterValorGrupo(grupos, key), 0);

  // Integrar aqui presença e status operacional quando esses endpoints forem expostos pelas agendas.
  const itens = [
    {
      id: 'tecnicos-online',
      label: 'Técnicos online',
      value: '--',
      detail: 'Integração pendente',
      tone: 'muted',
      icon: UserCheck,
    },
    {
      id: 'ausencias',
      label: 'Técnicos em ausência',
      value: ausenciasCount === null ? '--' : ausenciasCount,
      detail: 'Agenda Técnicos',
      tone: Number(ausenciasCount || 0) > 0 ? 'warning' : 'success',
      icon: UserX,
    },
    {
      id: 'instalacoes',
      label: 'Instalações do dia',
      value: '--',
      detail: 'Agenda Instalação',
      tone: 'muted',
      icon: CalendarClock,
    },
    {
      id: 'andamento',
      label: 'Atendimentos em andamento',
      value: '--',
      detail: 'Integração pendente',
      tone: 'muted',
      icon: Activity,
    },
    {
      id: 'plantao',
      label: 'Plantão ativo',
      value: conectado ? 'Verificar' : '--',
      detail: 'Escala do sistema',
      tone: conectado ? 'info' : 'muted',
      icon: ShieldCheck,
    },
    {
      id: 'massivos',
      label: 'Massivos ativos',
      value: massivosAtivos,
      detail: `${totalMassivos} chamados`,
      tone: massivosAtivos > 0 ? 'danger' : 'success',
      icon: RadioTower,
    },
  ];

  return (
    <aside className={styles.operationalPanel} aria-label="Situação Operacional">
      <div className={styles.operationalHeader}>
        <span className={styles.sectionKicker}>Situação Operacional</span>
        <h2>Situação Operacional</h2>
      </div>

      <div className={styles.operationalList}>
        {itens.map((item) => {
          const Icone = item.icon;

          return (
            <article key={item.id} className={`${styles.operationalItem} ${styles[`operational-${item.tone}`]}`}>
              <span className={styles.operationalIcon}>
                <Icone size={17} />
              </span>
              <span>
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </span>
              <em>{formatarNumero(item.value)}</em>
            </article>
          );
        })}
      </div>
    </aside>
  );
}

function StatusLegend() {
  const legendas = [
    { label: 'Aberta', tone: 'open' },
    { label: 'Encerrada', tone: 'closed' },
    { label: 'Em execução', tone: 'running' },
    { label: 'Massivos', tone: 'massive' },
    { label: 'Iracema', tone: 'iracema' },
    { label: 'Mapa', tone: 'map' },
  ];

  return (
    <div className={styles.legend} aria-label="Legenda da agenda">
      {legendas.map((item) => (
        <span key={item.label}>
          <i className={styles[`legend-${item.tone}`]} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function AgendaPreview({ titulo, src, fullUrl }) {
  return (
    <section className={styles.agendaPanel} aria-label={titulo}>
      <div className={styles.agendaHeader}>
        <div>
          <span className={styles.sectionKicker}>Agenda</span>
          <h2>{titulo}</h2>
        </div>
        <a className={styles.fullAgendaButton} href={fullUrl} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={15} />
          Ver agenda completa
        </a>
      </div>

      <StatusLegend />

      <div className={styles.agendaFrameWrap}>
        <iframe
          className={styles.agendaFrame}
          title={titulo}
          src={src}
        />
      </div>
    </section>
  );
}

export default function MonitoramentoTotal({ embedded = false } = {}) {
  const voltarPaginaInterna = useInternalBack('/chat');
  const navegarInterno = useInternalNavigation();
  const [clientes, setClientes] = useState(criarClientesVazio);
  const [grupos, setGrupos] = useState({});
  const [conectado, setConectado] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);
  const [agora, setAgora] = useState(() => new Date());
  const [erro, setErro] = useState('');
  const [ausenciasCount, setAusenciasCount] = useState(null);

  const agendaTecnicosUrl = useMemo(() => criarAgendaUrl(AGENDA_TECNICOS_PORT), []);
  const agendaInstalacaoUrl = useMemo(() => criarAgendaUrl(AGENDA_INSTALACAO_PORT), []);
  const agendaTecnicosEmbedUrl = useMemo(() => criarAgendaUrl(AGENDA_TECNICOS_PORT, '?monitoramento=1'), []);
  const agendaInstalacaoEmbedUrl = useMemo(() => criarAgendaUrl(AGENDA_INSTALACAO_PORT, '?embed=1'), []);

  const buscarAusenciasTecnicos = useCallback(async () => {
    const dataAtual = formatarDataIsoLocal(new Date());
    const endpoints = [
      criarAgendaUrl(AGENDA_TECNICOS_PORT, `/api/technician-absences?date=${dataAtual}`),
      criarAgendaUrl(AGENDA_INSTALACAO_PORT, `/api/technician-absences?date=${dataAtual}`),
    ];

    try {
      const respostas = await Promise.allSettled(
        endpoints.map(async (endpoint) => {
          const resposta = await fetch(endpoint);
          if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
          return resposta.json();
        })
      );

      const total = respostas.reduce((soma, resposta) => {
        if (resposta.status !== 'fulfilled') return soma;
        const absences = Array.isArray(resposta.value?.absences)
          ? resposta.value.absences
          : resposta.value?.ausencias || [];

        return soma + absences.length;
      }, 0);

      setAusenciasCount(total);
    } catch (err) {
      console.error('Erro ao buscar ausências das agendas:', err);
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setAgora(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let ativo = true;
    const executarBusca = () => {
      window.setTimeout(() => {
        if (ativo) buscarAusenciasTecnicos();
      }, 0);
    };

    executarBusca();
    const timer = window.setInterval(executarBusca, DASHBOARD_REFRESH_INTERVAL_MS);

    return () => {
      ativo = false;
      window.clearInterval(timer);
    };
  }, [buscarAusenciasTecnicos]);

  useEffect(() => {
    const dashboardSocket = io(DASHBOARD_SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      timeout: 5000,
      autoConnect: false,
    });

    const marcarAtualizacao = () => {
      const dataAtual = new Date();
      setUltimaAtualizacao(dataAtual);
      setAgora(dataAtual);
      setErro('');
    };

    const solicitarAtualizacao = () => {
      if (dashboardSocket.connected) {
        dashboardSocket.emit('request_update');
        return;
      }

      dashboardSocket.connect();
    };

    dashboardSocket.on('connect', () => {
      setConectado(true);
      setErro('');
      dashboardSocket.emit('request_update');
    });

    dashboardSocket.on('disconnect', () => {
      setConectado(false);
    });

    dashboardSocket.on('connect_error', () => {
      setConectado(false);
      setErro('Conexão com o dashboard em recuperação.');
    });

    dashboardSocket.on('update', (data = {}) => {
      setGrupos(data.grupos || {});
      marcarAtualizacao();
    });

    dashboardSocket.on('clientes', (data = {}) => {
      setClientes({
        total: Number(data.total || 0),
        ativos: Number(data.ativos || 0),
        reduzido: Number(data.reduzido || 0),
        suspensos: Number(data.suspensos || 0),
        cancelados: Number(data.cancelados || 0),
      });
      marcarAtualizacao();
    });

    dashboardSocket.connect();

    const refreshInterval = window.setInterval(
      solicitarAtualizacao,
      DASHBOARD_REFRESH_INTERVAL_MS
    );

    return () => {
      window.clearInterval(refreshInterval);
      dashboardSocket.disconnect();
    };
  }, []);

  const statusRede = useMemo(() => {
    const offline = obterValorGrupo(grupos, 'OFFLINE');
    const totalMassivos = MASSIVOS_DASHBOARD_KEYS.reduce((total, key) => total + obterValorGrupo(grupos, key), 0);

    if (totalMassivos > 5 || offline > 60) {
      return {
        label: 'Massivo detectado',
        online: false,
        className: styles.networkCritical,
      };
    }

    if (offline > 25) {
      return {
        label: 'Instabilidade detectada',
        online: false,
        className: styles.networkWarning,
      };
    }

    return {
      label: 'Rede Operacional',
      online: true,
      className: styles.networkOk,
    };
  }, [grupos]);

  const pageClassName = [
    styles.page,
    embedded ? styles.embeddedPage : '',
  ].filter(Boolean).join(' ');

  return (
    <main className={pageClassName}>
      <div className={styles.shell}>
        <button type="button" className={styles.backButton} onClick={voltarPaginaInterna}>
          <ArrowLeft size={16} />
          Voltar
        </button>

        <header className={styles.hero}>
          <div className={styles.heroBrand}>
            <span className={styles.logoWrap}>
              <img src={logoAcessa} alt="Acessanet" />
            </span>
            <div>
              <span className={styles.heroKicker}>
                <MonitorCheck size={15} />
                Monitoramento Total
              </span>
              <h1>Central de Monitoramento NOC</h1>
            </div>
          </div>

          <div className={styles.heroStatusGrid}>
            <StatusPill online={statusRede.online}>{statusRede.label}</StatusPill>
            <StatusPill online={conectado}>{conectado ? 'Servidor conectado' : 'Servidor desconectado'}</StatusPill>
            <span className={styles.datePill}>
              <RefreshCw size={14} />
              Última atualização: {formatarHora(ultimaAtualizacao)}
            </span>
            <span className={styles.datePill}>
              <CalendarDays size={14} />
              {formatarDataCompleta(agora)}
            </span>
          </div>

          <div className={styles.heroActions}>
            <button type="button" onClick={() => navegarInterno('/plantao-domingo')}>
              <ShieldCheck size={16} />
              Verificar Plantão
            </button>
            <a href={agendaTecnicosUrl} target="_blank" rel="noopener noreferrer">
              <Clock3 size={16} />
              Horários dos Técnicos
            </a>
          </div>
        </header>

        {erro && <div className={styles.errorBox}>{erro}</div>}

        <div className={styles.topGrid}>
          <KpiCards clientes={clientes} />
        </div>

        <ChamadosNocCards grupos={grupos} />

        <section className={styles.agendasSection} aria-label="Agendas do NOC">
          <AgendaPreview
            titulo="Agenda de Técnicos"
            src={agendaTecnicosEmbedUrl}
            fullUrl={agendaTecnicosUrl}
          />
          <AgendaPreview
            titulo="Agenda Técnicos - Instalação"
            src={agendaInstalacaoEmbedUrl}
            fullUrl={agendaInstalacaoUrl}
          />
        </section>

        <SituacaoOperacionalCard
          ausenciasCount={ausenciasCount}
          grupos={grupos}
          conectado={conectado}
        />
      </div>
    </main>
  );
}
