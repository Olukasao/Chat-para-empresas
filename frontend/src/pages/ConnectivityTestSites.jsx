import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Copy,
  Edit3,
  ExternalLink,
  Globe2,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useInternalBack } from '../utils/internalNavigation';
import styles from '../styles/ConnectivityTestSites.module.css';

const AUTO_REFRESH_INTERVAL_MS = 60000;

const STATUS_META = {
  normal: {
    label: 'Normal',
    className: 'statusNormal',
    icon: CheckCircle2,
  },
  attention: {
    label: 'Atenção',
    className: 'statusAttention',
    icon: AlertTriangle,
  },
  slow: {
    label: 'Lento',
    className: 'statusSlow',
    icon: Clock3,
  },
  very_slow: {
    label: 'Muito lento',
    className: 'statusVerySlow',
    icon: AlertTriangle,
  },
  offline: {
    label: 'Fora',
    className: 'statusOffline',
    icon: WifiOff,
  },
  not_tested: {
    label: 'Sem teste',
    className: 'statusNeutral',
    icon: Activity,
  },
};

const formatarDataHora = (valor) => {
  if (!valor) return '-';

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '-';

  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const normalizarUrlCliente = (valor = '') => {
  const texto = String(valor || '').trim();

  if (!/^https?:\/\//i.test(texto)) {
    throw new Error('A URL deve começar com http:// ou https://.');
  }

  let url;

  try {
    url = new URL(texto);
  } catch {
    throw new Error('Informe uma URL válida.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('A URL deve usar http:// ou https://.');
  }

  url.hash = '';

  if (url.pathname === '/' && !url.search) {
    return url.origin;
  }

  return url.href;
};

const obterStatusMeta = (resultado) => (
  STATUS_META[resultado?.status] || STATUS_META.not_tested
);

const formatarTempo = (resultado) => {
  if (!resultado) return '-';
  return `${Number(resultado.totalTimeMs || 0).toLocaleString('pt-BR')} ms`;
};

const formatarHttp = (resultado) => {
  if (!resultado) return '-';
  return resultado.statusCode || resultado.statusCode === 0 ? `HTTP ${resultado.statusCode}` : 'HTTP 000';
};

const copiarTexto = async (texto) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(texto);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = texto;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
};

function StatusBadge({ result }) {
  const meta = obterStatusMeta(result);
  const Icone = meta.icon;

  return (
    <span className={`${styles.statusBadge} ${styles[meta.className]}`}>
      <Icone size={15} />
      {meta.label}
    </span>
  );
}

function SiteFormModal({
  form,
  error,
  editingSite,
  saving,
  onChange,
  onSubmit,
  onClose,
}) {
  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Adicionar URL">
      <form className={styles.modal} onSubmit={onSubmit}>
        <div className={styles.modalHeader}>
          <div>
            <strong>{editingSite ? 'Editar URL' : 'Adicionar URL'}</strong>
            <span>Teste HTTP/HTTPS pelo backend da intranet</span>
          </div>
          <button type="button" className={styles.iconButton} onClick={onClose} title="Fechar">
            <X size={18} />
          </button>
        </div>

        {error && <div className={styles.formError}>{error}</div>}

        <label className={styles.field}>
          Nome do site
          <input
            type="text"
            value={form.name}
            onChange={(event) => onChange('name', event.target.value)}
            placeholder="Netflix"
            maxLength={120}
            autoFocus
          />
        </label>

        <label className={styles.field}>
          URL do site
          <input
            type="url"
            value={form.url}
            onChange={(event) => onChange('url', event.target.value)}
            placeholder="https://www.netflix.com"
          />
        </label>

        <div className={styles.modalActions}>
          <button type="button" className={styles.secondaryButton} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className={styles.primaryButton} disabled={saving}>
            {saving ? <Loader2 size={16} className={styles.spin} /> : <CheckCircle2 size={16} />}
            {saving ? 'Salvando...' : 'Salvar URL'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function ConnectivityTestSites({ embedded = false }) {
  const voltarPaginaInterna = useInternalBack('/chat');
  const navigate = useNavigate();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const authHeaders = useMemo(() => (
    token ? { Authorization: `Bearer ${token}` } : {}
  ), [token]);

  const [sites, setSites] = useState([]);
  const [resultsBySiteId, setResultsBySiteId] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [canManage, setCanManage] = useState(false);
  const [testingAll, setTestingAll] = useState(false);
  const [testingSiteIds, setTestingSiteIds] = useState([]);
  const [lastUpdated, setLastUpdated] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSite, setEditingSite] = useState(null);
  const [form, setForm] = useState({ name: '', url: '' });
  const [formError, setFormError] = useState('');
  const [savingSite, setSavingSite] = useState(false);
  const runningTestsRef = useRef(0);
  const feedbackTimeoutRef = useRef(null);

  const aplicarResultados = useCallback((resultados = []) => {
    if (!Array.isArray(resultados) || !resultados.length) return;

    setResultsBySiteId((atuais) => {
      const proximos = { ...atuais };

      resultados.forEach((resultado) => {
        if (resultado?.siteId) {
          proximos[resultado.siteId] = resultado;
        }
      });

      return proximos;
    });

    const testedAt = resultados
      .map((resultado) => resultado?.testedAt)
      .filter(Boolean)
      .sort()
      .at(-1);

    if (testedAt) {
      setLastUpdated(testedAt);
    }
  }, []);

  const aplicarSites = useCallback((proximosSites = []) => {
    setSites(proximosSites);

    const resultados = {};
    const datas = [];

    proximosSites.forEach((site) => {
      if (site.lastResult) {
        resultados[site.id] = site.lastResult;
        if (site.lastResult.testedAt) {
          datas.push(site.lastResult.testedAt);
        }
      }
    });

    setResultsBySiteId((atuais) => ({
      ...atuais,
      ...resultados,
    }));

    if (datas.length) {
      setLastUpdated(datas.sort().at(-1));
    }
  }, []);

  const carregarSites = useCallback(async ({ silent = false } = {}) => {
    if (!token) return;

    if (!silent) {
      setLoading(true);
    }

    try {
      const { data } = await api.get('/connectivity/sites', { headers: authHeaders });
      const listaSites = Array.isArray(data) ? data : data.sites || [];

      aplicarSites(listaSites);
      setCanManage(Boolean(data?.canManage));
      setError('');
    } catch (err) {
      console.error('Erro ao carregar sites de conectividade:', err);
      setError(err.response?.data?.error || 'Não foi possível carregar os sites.');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [aplicarSites, authHeaders, token]);

  useEffect(() => {
    carregarSites();
  }, [carregarSites]);

  const testarTodos = useCallback(async ({ silent = false, skipLock = false } = {}) => {
    if (!token || (!skipLock && runningTestsRef.current > 0)) return;

    if (!skipLock) {
      runningTestsRef.current += 1;
    }
    setTestingAll(true);
    if (!silent) {
      setFeedback('');
    }

    try {
      const { data } = await api.post('/connectivity/test', {}, { headers: authHeaders });
      aplicarResultados(data.results || []);
      setLastUpdated(data.testedAt || new Date().toISOString());
      setError('');
    } catch (err) {
      console.error('Erro ao testar conectividade:', err);
      setError(err.response?.data?.error || 'Não foi possível executar o teste.');
    } finally {
      if (!skipLock) {
        runningTestsRef.current = Math.max(0, runningTestsRef.current - 1);
      }
      setTestingAll(false);
    }
  }, [aplicarResultados, authHeaders, token]);

  useEffect(() => {
    if (!autoRefresh) return undefined;

    const intervalId = window.setInterval(() => {
      if (runningTestsRef.current === 0) {
        testarTodos({ silent: true });
      }
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [autoRefresh, testarTodos]);

  useEffect(() => () => {
    if (feedbackTimeoutRef.current) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }
  }, []);

  const testarSite = async (siteId) => {
    if (!token || runningTestsRef.current > 0) return;

    runningTestsRef.current += 1;
    setTestingSiteIds((atuais) => [...new Set([...atuais, siteId])]);

    try {
      const { data } = await api.post('/connectivity/test-one', { site_id: siteId }, { headers: authHeaders });
      aplicarResultados(data.result ? [data.result] : []);
      setLastUpdated(data.testedAt || new Date().toISOString());
      setError('');
    } catch (err) {
      console.error('Erro ao testar site:', err);
      setError(err.response?.data?.error || 'Não foi possível testar o site.');
    } finally {
      runningTestsRef.current = Math.max(0, runningTestsRef.current - 1);
      setTestingSiteIds((atuais) => atuais.filter((id) => id !== siteId));
    }
  };

  const resumo = useMemo(() => {
    const valores = {
      total: sites.length,
      tested: 0,
      normal: 0,
      attention: 0,
      slow: 0,
      offline: 0,
    };

    sites.forEach((site) => {
      const resultado = resultsBySiteId[site.id];
      if (!resultado) return;

      valores.tested += 1;

      if (resultado.status === 'normal') valores.normal += 1;
      if (resultado.status === 'attention') valores.attention += 1;
      if (resultado.status === 'slow' || resultado.status === 'very_slow') valores.slow += 1;
      if (resultado.status === 'offline') valores.offline += 1;
    });

    return valores;
  }, [resultsBySiteId, sites]);

  const testingSiteSet = useMemo(() => new Set(testingSiteIds), [testingSiteIds]);
  const anyTesting = testingAll || testingSiteIds.length > 0;

  const abrirCriacao = () => {
    setEditingSite(null);
    setForm({ name: '', url: '' });
    setFormError('');
    setModalOpen(true);
  };

  const abrirEdicao = (site) => {
    setEditingSite(site);
    setForm({ name: site.name, url: site.url });
    setFormError('');
    setModalOpen(true);
  };

  const fecharModal = () => {
    if (savingSite) return;
    setModalOpen(false);
    setEditingSite(null);
    setFormError('');
  };

  const alterarForm = (field, value) => {
    setForm((atual) => ({ ...atual, [field]: value }));
    setFormError('');
  };

  const salvarSite = async (event) => {
    event.preventDefault();

    const name = form.name.trim();
    let url;

    try {
      if (!name) {
        throw new Error('Nome do site é obrigatório.');
      }

      url = normalizarUrlCliente(form.url);

      const duplicado = sites.some((site) => (
        site.id !== editingSite?.id && site.url.toLowerCase() === url.toLowerCase()
      ));

      if (duplicado) {
        throw new Error('Já existe um site cadastrado com essa URL.');
      }
    } catch (err) {
      setFormError(err.message);
      return;
    }

    setSavingSite(true);

    try {
      const payload = { name, url };
      const { data } = editingSite
        ? await api.put(`/connectivity/sites/${editingSite.id}`, payload, { headers: authHeaders })
        : await api.post('/connectivity/sites', payload, { headers: authHeaders });

      aplicarSites(data.sites || []);
      setModalOpen(false);
      setEditingSite(null);
      setFeedback(editingSite ? 'URL atualizada.' : 'URL adicionada.');
    } catch (err) {
      console.error('Erro ao salvar site:', err);
      setFormError(err.response?.data?.error || 'Não foi possível salvar a URL.');
    } finally {
      setSavingSite(false);
    }
  };

  const removerSite = async (site) => {
    if (!window.confirm(`Remover ${site.name}?`)) return;

    try {
      const { data } = await api.delete(`/connectivity/sites/${site.id}`, { headers: authHeaders });
      aplicarSites(data.sites || []);
      setFeedback('URL removida.');
    } catch (err) {
      console.error('Erro ao remover site:', err);
      setError(err.response?.data?.error || 'Não foi possível remover a URL.');
    }
  };

  const abrirTestePerdaPacote = () => {
    navigate('/teste-perda-pacote');
  };

  const acionarAtalhoDiagnostico = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      abrirTestePerdaPacote();
    }
  };

  const copiarDiagnostico = async () => {
    const dataTexto = formatarDataHora(new Date());
    const linhas = [
      `Teste de conectividade externa - ${dataTexto}`,
      '',
      ...sites.map((site) => {
        const resultado = resultsBySiteId[site.id];
        const meta = obterStatusMeta(resultado);

        if (!resultado) {
          return `${site.name}: Sem teste`;
        }

        const http = resultado.statusCode ? `HTTP ${resultado.statusCode}` : 'HTTP 000';
        const erro = resultado.error ? ` - ${resultado.error}` : '';

        return `${site.name}: ${meta.label} - ${resultado.totalTimeMs}ms - ${http}${erro}`;
      }),
    ];

    try {
      await copiarTexto(linhas.join('\n'));
      setFeedback('Diagnóstico copiado!');

      if (feedbackTimeoutRef.current) {
        window.clearTimeout(feedbackTimeoutRef.current);
      }

      feedbackTimeoutRef.current = window.setTimeout(() => setFeedback(''), 2600);
    } catch (err) {
      console.error('Erro ao copiar diagnóstico:', err);
      setError('Não foi possível copiar o diagnóstico.');
    }
  };

  const pageClasses = [
    styles.page,
    embedded ? styles.embeddedPage : '',
  ].filter(Boolean).join(' ');

  return (
    <main className={pageClasses}>
      <div className={styles.shell}>
        <button type="button" className={styles.backButton} onClick={voltarPaginaInterna}>
          <ArrowLeft size={16} />
          Voltar
        </button>

        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <span className={styles.kicker}>
              <Globe2 size={15} />
              NOC
            </span>
            <h1>Teste de Conectividade por Sites</h1>
            <p>Verifique rapidamente quais sites estão normais, lentos ou indisponíveis.</p>
            <div className={styles.updateLine}>
              <span>Última atualização: {formatarDataHora(lastUpdated)}</span>
              {anyTesting && (
                <span className={styles.loadingIndicator}>
                  <Loader2 size={14} className={styles.spin} />
                  Testando
                </span>
              )}
            </div>
          </div>

          <div className={styles.headerActions}>
            <button type="button" className={styles.primaryButton} onClick={() => testarTodos()} disabled={anyTesting || loading}>
              {testingAll ? <Loader2 size={17} className={styles.spin} /> : <RefreshCw size={17} />}
              {testingAll ? 'Testando...' : 'Testar agora'}
            </button>

            {canManage && (
              <button type="button" className={styles.secondaryButton} onClick={abrirCriacao}>
                <Plus size={17} />
                Adicionar URL
              </button>
            )}

            <button type="button" className={styles.secondaryButton} onClick={copiarDiagnostico} disabled={!sites.length}>
              <Copy size={17} />
              Copiar diagnóstico
            </button>

            <label className={styles.autoRefreshSwitch}>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(event) => setAutoRefresh(event.target.checked)}
              />
              <span />
              Atualizar automaticamente
            </label>
          </div>
        </header>

        {error && <div className={styles.errorBanner}>{error}</div>}
        {feedback && <div className={styles.feedbackBanner}>{feedback}</div>}

        <section className={styles.summaryGrid} aria-label="Resumo dos testes">
          <article className={styles.summaryCard}>
            <Globe2 size={18} />
            <span>Total de sites</span>
            <strong>{resumo.total}</strong>
          </article>
          <article className={styles.summaryCard}>
            <Activity size={18} />
            <span>Testados</span>
            <strong>{resumo.tested}</strong>
          </article>
          <article className={`${styles.summaryCard} ${styles.summaryNormal}`}>
            <CheckCircle2 size={18} />
            <span>Normais</span>
            <strong>{resumo.normal}</strong>
          </article>
          <article className={`${styles.summaryCard} ${styles.summarySlow}`}>
            <Zap size={18} />
            <span>Atenção/Lentos</span>
            <strong>{resumo.attention + resumo.slow}</strong>
          </article>
          <article className={`${styles.summaryCard} ${styles.summaryOffline}`}>
            <WifiOff size={18} />
            <span>Fora</span>
            <strong>{resumo.offline}</strong>
          </article>
        </section>

        <section className={styles.sectionBlock} aria-labelledby="diagnostic-tools-title">
          <div className={styles.sectionHeader}>
            <div>
              <span>Ferramentas de Diagnóstico</span>
              <h2 id="diagnostic-tools-title">Ferramentas de Diagnóstico</h2>
            </div>
          </div>

          <div
            className={styles.diagnosticShortcutCard}
            onClick={abrirTestePerdaPacote}
            role="link"
            tabIndex={0}
            onKeyDown={acionarAtalhoDiagnostico}
          >
            <div className={styles.diagnosticShortcutIcon}>📡</div>
            <div className={styles.diagnosticShortcutContent}>
              <h3>Teste de Perda de Pacote</h3>
              <p>Teste ping, latência, perda de pacotes e estabilidade da conexão.</p>
            </div>
            <button
              type="button"
              className={styles.diagnosticShortcutButton}
              onClick={(event) => {
                event.stopPropagation();
                abrirTestePerdaPacote();
              }}
            >
              Abrir teste →
            </button>
          </div>
        </section>

        <section className={styles.sectionBlock} aria-labelledby="connectivity-results-title">
          <div className={styles.sectionHeader}>
            <div>
              <span>Teste HTTP/HTTPS</span>
              <h2 id="connectivity-results-title">Sites monitorados</h2>
            </div>
            <div className={styles.sectionHeaderActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => testarTodos()} disabled={anyTesting || loading}>
                {testingAll ? <Loader2 size={16} className={styles.spin} /> : <RefreshCw size={16} />}
                {testingAll ? 'Testando HTTP...' : 'Testar HTTP/HTTPS'}
              </button>
            </div>
          </div>

          {loading ? (
            <div className={styles.loadingBox}>
              <Loader2 size={22} className={styles.spin} />
              Carregando sites
            </div>
          ) : (
            <div className={styles.cardsGrid}>
              {sites.map((site) => {
                const resultado = resultsBySiteId[site.id];
                const testingSite = testingSiteSet.has(site.id);

                return (
                  <article key={site.id} className={styles.siteCard}>
                    <div className={styles.siteCardHeader}>
                      <span className={styles.siteIcon}>
                        <Globe2 size={19} />
                      </span>
                      <div>
                        <strong>{site.name}</strong>
                        <a href={site.url} target="_blank" rel="noopener noreferrer">
                          {site.url}
                        </a>
                      </div>
                    </div>

                    <div className={styles.siteMetrics}>
                      <StatusBadge result={resultado} />
                      <span>{formatarTempo(resultado)}</span>
                      <span>{formatarHttp(resultado)}</span>
                    </div>

                    <dl className={styles.siteDetails}>
                      <div>
                        <dt>Último teste</dt>
                        <dd>{formatarDataHora(resultado?.testedAt)}</dd>
                      </div>
                      <div>
                        <dt>Erro</dt>
                        <dd>{resultado?.error || '-'}</dd>
                      </div>
                    </dl>

                    <div className={styles.cardActions}>
                      <button
                        type="button"
                        className={styles.actionButton}
                        onClick={() => testarSite(site.id)}
                        disabled={anyTesting}
                      >
                        {testingSite ? <Loader2 size={15} className={styles.spin} /> : <RefreshCw size={15} />}
                        Testar
                      </button>
                      <a className={styles.actionLink} href={site.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink size={15} />
                        Abrir site
                      </a>
                      {canManage && !site.isDefault && (
                        <>
                          <button type="button" className={styles.iconAction} onClick={() => abrirEdicao(site)} title="Editar URL">
                            <Edit3 size={15} />
                          </button>
                          <button type="button" className={styles.iconActionDanger} onClick={() => removerSite(site)} title="Remover URL">
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className={styles.sectionBlock} aria-labelledby="connectivity-table-title">
          <div className={styles.sectionHeader}>
            <div>
              <span>Detalhamento HTTP/HTTPS</span>
              <h2 id="connectivity-table-title">Lista detalhada</h2>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.resultsTable}>
              <thead>
                <tr>
                  <th>Site</th>
                  <th>URL</th>
                  <th>HTTP</th>
                  <th>Tempo total</th>
                  <th>Situação</th>
                  <th>Erro</th>
                  <th>Último teste</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {sites.length ? sites.map((site) => {
                  const resultado = resultsBySiteId[site.id];
                  const testingSite = testingSiteSet.has(site.id);

                  return (
                    <tr key={`row-${site.id}`}>
                      <td>
                        <strong>{site.name}</strong>
                        {site.isDefault && <span className={styles.defaultTag}>Padrão</span>}
                      </td>
                      <td>
                        <a href={site.url} target="_blank" rel="noopener noreferrer">{site.url}</a>
                      </td>
                      <td>{formatarHttp(resultado)}</td>
                      <td>{formatarTempo(resultado)}</td>
                      <td><StatusBadge result={resultado} /></td>
                      <td>{resultado?.error || '-'}</td>
                      <td>{formatarDataHora(resultado?.testedAt)}</td>
                      <td>
                        <div className={styles.tableActions}>
                          <button type="button" onClick={() => testarSite(site.id)} disabled={anyTesting}>
                            {testingSite ? <Loader2 size={14} className={styles.spin} /> : <RefreshCw size={14} />}
                            Testar
                          </button>
                          <a href={site.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink size={14} />
                            Abrir site
                          </a>
                          {canManage && !site.isDefault && (
                            <>
                              <button type="button" onClick={() => abrirEdicao(site)}>
                                <Edit3 size={14} />
                                Editar
                              </button>
                              <button type="button" className={styles.dangerTextButton} onClick={() => removerSite(site)}>
                                <Trash2 size={14} />
                                Remover
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan="8" className={styles.emptyCell}>Nenhum site cadastrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

      </div>

      {modalOpen && (
        <SiteFormModal
          form={form}
          error={formError}
          editingSite={editingSite}
          saving={savingSite}
          onChange={alterarForm}
          onSubmit={salvarSite}
          onClose={fecharModal}
        />
      )}

    </main>
  );
}
