import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Ban,
  History,
  Loader2,
  Play,
  ShieldAlert,
  Square,
} from 'lucide-react';
import api from '../../services/api';
import {
  connectSocket,
  socket,
} from '../../services/socket';
import { useInternalBack } from '../../utils/internalNavigation';
import CustomerSearch from '../../components/NetworkDiagnostics/CustomerSearch';
import CustomerConnectionCard from '../../components/NetworkDiagnostics/CustomerConnectionCard';
import CurrentTrafficCard from '../../components/NetworkDiagnostics/CurrentTrafficCard';
import ConnectionQualityCard from '../../components/NetworkDiagnostics/ConnectionQualityCard';
import TrafficChart from '../../components/NetworkDiagnostics/TrafficChart';
import DiagnosticProgress from '../../components/NetworkDiagnostics/DiagnosticProgress';
import DiagnosticResult from '../../components/NetworkDiagnostics/DiagnosticResult';
import DiagnosticHistory from '../../components/NetworkDiagnostics/DiagnosticHistory';
import styles from '../../styles/NetworkDiagnostics.module.css';

const SEARCH_DEBOUNCE_MS = 450;
const TRAFFIC_REFRESH_MS = 10000;
const HISTORY_LIMIT = 10;

const initialAccess = {
  can_view: false,
  can_run: false,
  can_history: false,
  can_admin: false,
  permissions: {},
};

const initialHistoryFilters = {
  customer: '',
  user: '',
  pop: '',
  status: '',
  date_from: '',
  date_to: '',
};

const appendTrafficPoint = (points, point, period) => {
  if (!point?.at) return points;

  const hasMetric = Number.isFinite(Number(point.downloadMbps)) || Number.isFinite(Number(point.uploadMbps));
  if (!hasMetric) return points;

  const minutes = {
    '5m': 5,
    '15m': 15,
    '30m': 30,
    '1h': 60,
  }[period] || 5;
  const cutoff = Date.now() - minutes * 60 * 1000;
  const next = [
    ...points.filter((item) => item.at !== point.at),
    point,
  ]
    .filter((item) => new Date(item.at).getTime() >= cutoff)
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return next.slice(-240);
};

export default function DiagnosticoConexaoCliente({ embedded = false }) {
  const voltarPaginaInterna = useInternalBack('/chat');
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const authHeaders = useMemo(() => (
    token ? { Authorization: `Bearer ${token}` } : {}
  ), [token]);

  const [access, setAccess] = useState(initialAccess);
  const [integrations, setIntegrations] = useState({});
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [pageError, setPageError] = useState('');
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [diagnostic, setDiagnostic] = useState(null);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const [latestTraffic, setLatestTraffic] = useState(null);
  const [trafficPoints, setTrafficPoints] = useState([]);
  const [trafficPeriod, setTrafficPeriod] = useState('5m');
  const [trafficPaused, setTrafficPaused] = useState(false);
  const [running, setRunning] = useState(false);
  const [activeRunId, setActiveRunId] = useState('');
  const [activeRunStatus, setActiveRunStatus] = useState('');
  const [progress, setProgress] = useState([]);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyFilters, setHistoryFilters] = useState(initialHistoryFilters);
  const [historyLoading, setHistoryLoading] = useState(false);
  const searchAbortRef = useRef(null);
  const detailAbortRef = useRef(null);
  const trafficAbortRef = useRef(null);
  const trafficLoadingRef = useRef(false);

  const selectedCustomerId = selectedCustomer?.id || diagnostic?.customer?.id || '';
  const canRun = Boolean(access.can_run && selectedCustomerId && !running);
  const integrationMessage = integrations?.sgp && !integrations.sgp.available
    ? integrations.sgp.message
    : '';

  const carregarPermissoes = useCallback(async () => {
    if (!token) return;

    try {
      setLoadingAccess(true);
      setPageError('');

      const { data } = await api.get('/network-diagnostics/permissions/me', {
        headers: authHeaders,
      });

      setAccess(data.access || initialAccess);
      setIntegrations(data.integrations || {});
    } catch (err) {
      console.error('Erro ao carregar permissões de diagnóstico:', err);
      setPageError(err.response?.data?.error || 'Não foi possível carregar permissões.');
    } finally {
      setLoadingAccess(false);
    }
  }, [authHeaders, token]);

  const carregarHistorico = useCallback(async (nextPage = 1, nextFilters = initialHistoryFilters) => {
    if (!token || !access.can_history) return;

    try {
      setHistoryLoading(true);
      const { data } = await api.get('/network-diagnostics/history', {
        headers: authHeaders,
        params: {
          page: nextPage,
          limit: HISTORY_LIMIT,
          customer: nextFilters.customer || undefined,
          user: nextFilters.user || undefined,
          pop: nextFilters.pop || undefined,
          status: nextFilters.status || undefined,
          date_from: nextFilters.date_from || undefined,
          date_to: nextFilters.date_to || undefined,
        },
      });

      setHistoryRows(Array.isArray(data.rows) ? data.rows : []);
      setHistoryTotal(Number(data.total || 0));
      setHistoryPage(Number(data.page || nextPage));
    } catch (err) {
      console.error('Erro ao carregar histórico de diagnósticos:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [access.can_history, authHeaders, token]);

  const carregarResumoCliente = useCallback(async (customer) => {
    if (!customer?.id || !token) return;

    detailAbortRef.current?.abort();
    const controller = new AbortController();
    detailAbortRef.current = controller;

    try {
      setDiagnosticLoading(true);
      setPageError('');

      const { data } = await api.get(`/network-diagnostics/customers/${encodeURIComponent(customer.id)}`, {
        headers: authHeaders,
        signal: controller.signal,
      });

      setDiagnostic(data.diagnostic || null);
      setIntegrations((current) => data.integrations || current);
    } catch (err) {
      if (err.name === 'CanceledError') return;
      console.error('Erro ao carregar diagnóstico do cliente:', err);
      setPageError(err.response?.data?.error || 'Não foi possível carregar o diagnóstico do cliente.');
      setDiagnostic({
        customer,
        connection: {
          status: customer.status || 'unknown',
          pppoeUsername: customer.pppoeUsername,
          ip: customer.ip,
          popName: customer.popName,
          sessionUptimeSeconds: customer.sessionUptimeSeconds,
        },
        traffic: {
          available: false,
          message: err.response?.data?.error || 'Não foi possível consultar dados completos do cliente.',
        },
        quality: {},
        capacityTest: {
          supported: false,
          message: 'Teste remoto indisponível para este equipamento.',
          tooltip: 'Este teste exige suporte da ONU ou do roteador do cliente por ACS, TR-069, TR-143 ou tecnologia equivalente.',
        },
        conclusion: {
          status: 'partial',
          title: 'Diagnóstico parcial',
          message: err.response?.data?.error || 'Dados completos do cliente indisponíveis no momento.',
        },
      });
    } finally {
      setDiagnosticLoading(false);
    }
  }, [authHeaders, token]);

  const selecionarCliente = useCallback((customer) => {
    setSelectedCustomer(customer);
    setDiagnostic(null);
    setLatestTraffic(null);
    setTrafficPoints([]);
    setProgress([]);
    setActiveRunId('');
    setActiveRunStatus('');
    carregarResumoCliente(customer);
  }, [carregarResumoCliente]);

  const executarDiagnostico = async () => {
    if (!canRun) return;

    try {
      setRunning(true);
      setPageError('');
      setProgress([{
        step: 'queued',
        message: 'Diagnóstico solicitado.',
        at: new Date().toISOString(),
        active: true,
      }]);

      const { data } = await api.post(
        `/network-diagnostics/customers/${encodeURIComponent(selectedCustomerId)}/run`,
        { customer: selectedCustomer || diagnostic?.customer || null },
        { headers: authHeaders }
      );

      setActiveRunId(data.runId);
      setActiveRunStatus(data.status || 'queued');
    } catch (err) {
      console.error('Erro ao executar diagnóstico:', err);
      setPageError(err.response?.data?.error || 'Não foi possível iniciar o diagnóstico.');
      setRunning(false);
    }
  };

  const cancelarDiagnostico = async () => {
    if (!activeRunId || !running) return;

    try {
      await api.post(`/network-diagnostics/runs/${encodeURIComponent(activeRunId)}/cancel`, null, {
        headers: authHeaders,
      });
      setActiveRunStatus('cancel_requested');
    } catch (err) {
      console.error('Erro ao cancelar diagnóstico:', err);
      setPageError(err.response?.data?.error || 'Não foi possível cancelar o diagnóstico.');
    }
  };

  useEffect(() => {
    carregarPermissoes();
  }, [carregarPermissoes]);

  useEffect(() => {
    if (!access.can_history) return;
    carregarHistorico(1, historyFilters);
  }, [access.can_history, carregarHistorico, historyFilters]);

  useEffect(() => {
    if (!access.can_view || !token) return undefined;

    const cleanQuery = query.trim();

    searchAbortRef.current?.abort();

    if (cleanQuery.length < 2) {
      setCustomers([]);
      setSearchError('');
      setSearchLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    searchAbortRef.current = controller;
    const timeout = window.setTimeout(async () => {
      try {
        setSearchLoading(true);
        setSearchError('');

        const { data } = await api.get('/network-diagnostics/customers/search', {
          headers: authHeaders,
          params: { q: cleanQuery },
          signal: controller.signal,
        });

        setCustomers(Array.isArray(data.customers) ? data.customers : []);
        setIntegrations((current) => data.integrations || current);
      } catch (err) {
        if (err.name === 'CanceledError') return;
        console.error('Erro ao pesquisar cliente:', err);
        setCustomers([]);
        setSearchError(err.response?.data?.error || 'Cliente não encontrado.');
      } finally {
        setSearchLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [access.can_view, authHeaders, query, token]);

  useEffect(() => {
    if (!selectedCustomerId || !access.can_view || !token) return undefined;

    let intervalId;
    let stopped = false;

    const carregarTrafego = async () => {
      if (document.visibilityState === 'hidden') {
        setTrafficPaused(true);
        return;
      }

      setTrafficPaused(false);
      if (trafficLoadingRef.current) return;

      const controller = new AbortController();
      trafficAbortRef.current = controller;
      trafficLoadingRef.current = true;

      try {
        const { data } = await api.get(`/network-diagnostics/customers/${encodeURIComponent(selectedCustomerId)}/traffic`, {
          headers: authHeaders,
          params: { period: trafficPeriod },
          signal: controller.signal,
        });

        if (stopped) return;

        setLatestTraffic(data);
        setIntegrations((current) => ({
          ...current,
          traffic: data.availability || current.traffic,
          hillstone: data.availability || current.hillstone,
        }));
        setTrafficPoints((current) => appendTrafficPoint(current, data.point, trafficPeriod));
      } catch (err) {
        if (err.name !== 'CanceledError') {
          console.error('Erro ao consultar tráfego:', err);
        }
      } finally {
        if (trafficAbortRef.current === controller) {
          trafficAbortRef.current = null;
        }
        trafficLoadingRef.current = false;
      }
    };

    carregarTrafego();
    intervalId = window.setInterval(carregarTrafego, TRAFFIC_REFRESH_MS);

    return () => {
      stopped = true;
      window.clearInterval(intervalId);
      trafficAbortRef.current?.abort();
    };
  }, [access.can_view, authHeaders, selectedCustomerId, token, trafficPeriod]);

  useEffect(() => {
    if (!activeRunId || !token) return undefined;

    const socketInstance = connectSocket(token);

    const joinRun = () => {
      socketInstance.emit('network-diagnostic:join', { runId: activeRunId });
    };

    const handleStarted = (payload = {}) => {
      if (payload.runId !== activeRunId) return;
      setActiveRunStatus('running');
      setRunning(true);
    };

    const handleProgress = (payload = {}) => {
      if (payload.runId !== activeRunId) return;
      setActiveRunStatus((current) => (current === 'queued' ? 'running' : current || 'running'));
      setProgress((current) => [
        ...current.map((item) => ({ ...item, active: false })),
        { ...payload, active: true },
      ]);
    };

    const handleCompleted = (payload = {}) => {
      if (payload.runId !== activeRunId) return;
      setRunning(false);
      setActiveRunStatus('completed');
      setDiagnostic((current) => payload.diagnostic || current);
      setProgress((current) => current.map((item) => ({ ...item, active: false })));
      carregarHistorico(1, historyFilters);
    };

    const handleFailed = (payload = {}) => {
      if (payload.runId !== activeRunId) return;
      setRunning(false);
      setActiveRunStatus(payload.run?.status || 'failed');
      setPageError(payload.error || 'Diagnóstico finalizado com falha.');
      setProgress((current) => current.map((item) => ({ ...item, active: false })));
      carregarHistorico(1, historyFilters);
    };

    const handleSocketError = (payload = {}) => {
      if (payload.runId && payload.runId !== activeRunId) return;
      setPageError(payload.error || 'Não foi possível acompanhar o diagnóstico.');
    };

    socketInstance.on('connect', joinRun);
    socketInstance.io.on('reconnect', joinRun);
    socketInstance.on('network-diagnostic:started', handleStarted);
    socketInstance.on('network-diagnostic:progress', handleProgress);
    socketInstance.on('network-diagnostic:completed', handleCompleted);
    socketInstance.on('network-diagnostic:failed', handleFailed);
    socketInstance.on('network-diagnostic:error', handleSocketError);

    if (socket.connected) {
      joinRun();
    }

    return () => {
      socketInstance.emit('network-diagnostic:leave', { runId: activeRunId });
      socketInstance.off('connect', joinRun);
      socketInstance.io.off('reconnect', joinRun);
      socketInstance.off('network-diagnostic:started', handleStarted);
      socketInstance.off('network-diagnostic:progress', handleProgress);
      socketInstance.off('network-diagnostic:completed', handleCompleted);
      socketInstance.off('network-diagnostic:failed', handleFailed);
      socketInstance.off('network-diagnostic:error', handleSocketError);
    };
  }, [activeRunId, carregarHistorico, historyFilters, token]);

  useEffect(() => () => {
    searchAbortRef.current?.abort();
    detailAbortRef.current?.abort();
    trafficAbortRef.current?.abort();
  }, []);

  const capacity = diagnostic?.capacityTest || {
    supported: false,
    message: 'Teste remoto indisponível para este equipamento.',
    tooltip: 'Este teste exige suporte da ONU ou do roteador do cliente por ACS, TR-069, TR-143 ou tecnologia equivalente.',
  };

  return (
    <main className={`${styles.page} ${embedded ? styles.embeddedPage : ''}`}>
      <div className={styles.shell}>
        {!embedded && (
          <button type="button" className={styles.backButton} onClick={voltarPaginaInterna}>
            <ArrowLeft size={16} />
            Voltar
          </button>
        )}

        <header className={styles.header}>
          <div>
            <span className={styles.kicker}>Diagnóstico de Conexão do Cliente</span>
            <h1>Diagnóstico de Conexão</h1>
            <p>Consumo atual, sessão, qualidade e histórico do cliente em uma única visão operacional.</p>
          </div>
          <div className={styles.headerActions}>
            <button type="button" className={styles.primaryButton} onClick={executarDiagnostico} disabled={!canRun}>
              {running ? <Loader2 size={17} className={styles.spin} /> : <Play size={17} />}
              Executar diagnóstico
            </button>
            <button type="button" className={styles.secondaryButton} onClick={cancelarDiagnostico} disabled={!running || !activeRunId}>
              <Square size={16} />
              Cancelar
            </button>
          </div>
        </header>

        {loadingAccess ? (
          <div className={styles.loadingState}>
            <Loader2 size={24} className={styles.spin} />
            Carregando permissões
          </div>
        ) : !access.can_view ? (
          <section className={styles.panel}>
            <div className={styles.restrictedState}>
              <ShieldAlert size={32} />
              <strong>Você não possui permissão para visualizar este diagnóstico.</strong>
            </div>
          </section>
        ) : (
          <>
            {pageError && <div className={styles.errorBanner}>{pageError}</div>}

            <div className={styles.mainGrid}>
              <CustomerSearch
                query={query}
                onQueryChange={setQuery}
                customers={customers}
                loading={searchLoading}
                error={searchError}
                selectedCustomerId={selectedCustomerId}
                onSelect={selecionarCliente}
                integrationMessage={integrationMessage}
              />

              <div className={styles.stack}>
                {diagnosticLoading ? (
                  <div className={styles.loadingState}>
                    <Loader2 size={22} className={styles.spin} />
                    Carregando cliente
                  </div>
                ) : diagnostic ? (
                  <>
                    <CustomerConnectionCard diagnostic={diagnostic} />
                    <DiagnosticResult diagnostic={diagnostic} />
                  </>
                ) : (
                  <section className={styles.panel}>
                    <div className={styles.emptyState}>
                      <Ban size={28} />
                      <strong>Nenhum cliente selecionado.</strong>
                    </div>
                  </section>
                )}
              </div>
            </div>

            {diagnostic && (
              <>
                <div className={styles.contentGrid}>
                  <CurrentTrafficCard diagnostic={diagnostic} latestTraffic={latestTraffic} />
                  <ConnectionQualityCard diagnostic={diagnostic} />
                </div>

                <TrafficChart
                  points={trafficPoints}
                  period={trafficPeriod}
                  onPeriodChange={setTrafficPeriod}
                  paused={trafficPaused}
                  availability={integrations.traffic || integrations.sgpTraffic || integrations.hillstone}
                />

                <section className={styles.panel} aria-labelledby="capacity-title">
                  <div className={styles.panelHeader}>
                    <div>
                      <span className={styles.kicker}>Teste de capacidade</span>
                      <h2 id="capacity-title">Teste remoto do equipamento</h2>
                    </div>
                    <button type="button" className={styles.secondaryButton} disabled title={capacity.tooltip}>
                      <Ban size={16} />
                      {capacity.message || 'Teste remoto indisponível para este equipamento.'}
                    </button>
                  </div>
                </section>

                <DiagnosticProgress progress={progress} activeRunStatus={activeRunStatus} />
              </>
            )}

            <div className={styles.historyAnchor}>
              <History size={18} />
              <span>Histórico</span>
            </div>

            <DiagnosticHistory
              filters={historyFilters}
              onFiltersChange={(nextFilters) => {
                setHistoryFilters(nextFilters);
                setHistoryPage(1);
              }}
              rows={historyRows}
              page={historyPage}
              total={historyTotal}
              limit={HISTORY_LIMIT}
              loading={historyLoading}
              canHistory={access.can_history}
              onRefresh={() => carregarHistorico(historyPage, historyFilters)}
              onPageChange={(nextPage) => carregarHistorico(nextPage, historyFilters)}
            />
          </>
        )}
      </div>
    </main>
  );
}
