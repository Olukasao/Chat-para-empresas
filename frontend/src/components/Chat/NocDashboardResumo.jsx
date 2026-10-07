import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import styles from '../../styles/Chat.module.css';

const DASHBOARD_SOCKET_URL =
  import.meta.env.VITE_NOC_DASHBOARD_SOCKET_URL || 'http://192.168.1.133:5000';

const DASHBOARD_REFRESH_INTERVAL_MS = 3 * 60 * 1000;

const METRICAS_NOC = [
  { id: 'baixa', key: 'BAIXA', label: 'Baixa' },
  { id: 'regular', key: 'REGULAR', label: 'Regular' },
  { id: 'alta', key: 'ALTA', label: 'Alta' },
  { id: 'offline', key: 'OFFLINE', label: 'Offline' },
];

const criarResumoVazio = () => (
  METRICAS_NOC.reduce((acc, metrica) => {
    acc[metrica.key] = 0;
    return acc;
  }, {})
);

const obterNivel = (valor) => {
  if (valor > 30) return 'critico';
  if (valor >= 20) return 'atencao';
  return 'normal';
};

const formatarHora = (data) => {
  if (!data) return '--:--:--';

  return data.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export default function NocDashboardResumo() {
  const [resumo, setResumo] = useState(criarResumoVazio);
  const [conectado, setConectado] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);
  const [metricasAlteradas, setMetricasAlteradas] = useState([]);
  const destaqueTimeoutRef = useRef(null);
  const ultimaAtualizacaoRef = useRef(null);

  useEffect(() => {
    const dashboardSocket = io(DASHBOARD_SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      timeout: 5000,
      autoConnect: false,
    });

    const atualizarResumo = (data = {}) => {
      const grupos = data.grupos || {};
      const proximoResumo = criarResumoVazio();
      const agora = new Date();

      METRICAS_NOC.forEach((metrica) => {
        proximoResumo[metrica.key] = Number(grupos[metrica.key] || 0);
      });

      setResumo((resumoAtual) => {
        const alteradas = METRICAS_NOC
          .filter((metrica) => Number(resumoAtual[metrica.key] || 0) !== proximoResumo[metrica.key])
          .map((metrica) => metrica.id);

        if (alteradas.length > 0) {
          setMetricasAlteradas(alteradas);
          window.clearTimeout(destaqueTimeoutRef.current);
          destaqueTimeoutRef.current = window.setTimeout(() => {
            setMetricasAlteradas([]);
          }, 800);
        }

        return proximoResumo;
      });

      ultimaAtualizacaoRef.current = agora.getTime();
      setUltimaAtualizacao(agora);
    };

    const solicitarAtualizacao = () => {
      if (!dashboardSocket.connected) {
        dashboardSocket.connect();
        return;
      }

      dashboardSocket.emit('request_update');
    };

    const garantirAtualizacaoPeriodica = () => {
      const ultimaAtualizacaoMs = ultimaAtualizacaoRef.current || 0;
      const estaDesatualizado =
        Date.now() - ultimaAtualizacaoMs >= DASHBOARD_REFRESH_INTERVAL_MS;

      if (dashboardSocket.connected) {
        dashboardSocket.emit('request_update');
      }

      if (!dashboardSocket.connected || estaDesatualizado) {
        dashboardSocket.disconnect();
        dashboardSocket.connect();
      }
    };

    dashboardSocket.on('connect', () => {
      setConectado(true);
      solicitarAtualizacao();
    });
    dashboardSocket.on('disconnect', () => setConectado(false));
    dashboardSocket.on('connect_error', () => setConectado(false));
    dashboardSocket.on('update', atualizarResumo);

    dashboardSocket.connect();

    const refreshInterval = window.setInterval(
      garantirAtualizacaoPeriodica,
      DASHBOARD_REFRESH_INTERVAL_MS
    );

    return () => {
      window.clearTimeout(destaqueTimeoutRef.current);
      window.clearInterval(refreshInterval);
      dashboardSocket.disconnect();
    };
  }, []);

  const metricas = useMemo(() => (
    METRICAS_NOC.map((metrica) => {
      const total = Number(resumo[metrica.key] || 0);

      return {
        ...metrica,
        total,
        nivel: obterNivel(total),
      };
    })
  ), [resumo]);

  const statusRede = useMemo(() => {
    const offline = Number(resumo.OFFLINE || 0);

    if (offline > 60) {
      return { label: 'Massivo detectado', className: styles.nocStatusCritico };
    }

    if (offline > 25) {
      return { label: 'Instabilidade detectada', className: styles.nocStatusAtencao };
    }

    return { label: 'Rede operacional', className: styles.nocStatusNormal };
  }, [resumo.OFFLINE]);

  const nivelClasses = {
    normal: styles.nocMetricNormal,
    atencao: styles.nocMetricAtencao,
    critico: styles.nocMetricCritico,
  };

  return (
    <section className={styles.nocDashboardPanel} aria-label="Resumo de chamados NOC">
      <div className={styles.nocDashboardHeader}>
        <div>
          <strong>Chamados NOC</strong>
          <span className={`${styles.nocNetworkStatus} ${statusRede.className}`}>
            {statusRede.label}
          </span>
        </div>
        <p>
          <span
            className={`${styles.nocSocketDot} ${
              conectado ? styles.online : styles.offline
            }`}
          />
          {conectado ? 'Dashboard conectado' : 'Dashboard desconectado'}
          <span>Atualizado: {formatarHora(ultimaAtualizacao)}</span>
        </p>
      </div>

      <div className={styles.nocMetricGrid}>
        {metricas.map((metrica) => (
          <article
            key={metrica.id}
            className={`${styles.nocMetricCard} ${nivelClasses[metrica.nivel]} ${
              metricasAlteradas.includes(metrica.id) ? styles.nocMetricChanged : ''
            }`}
          >
            <span>{metrica.label}</span>
            <strong>{metrica.total}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
