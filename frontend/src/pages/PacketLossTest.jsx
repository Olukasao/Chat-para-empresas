import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react';
import api from '../services/api';
import { useInternalBack } from '../utils/internalNavigation';
import styles from '../styles/ConnectivityTestSites.module.css';

const PACKET_STATUS_META = {
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
  moderate_loss: {
    label: 'Perda moderada',
    className: 'statusSlow',
    icon: AlertTriangle,
  },
  high_loss: {
    label: 'Perda alta',
    className: 'statusVerySlow',
    icon: WifiOff,
  },
  no_response: {
    label: 'Sem resposta ou bloqueado',
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

const normalizarHostCliente = (valor = '') => {
  let texto = String(valor || '').trim();

  if (!texto) {
    throw new Error('Host ou IP é obrigatório.');
  }

  if (/^https?:\/\//i.test(texto)) {
    try {
      texto = new URL(texto).hostname;
    } catch {
      throw new Error('Informe um host ou IP válido.');
    }
  }

  texto = texto.trim().replace(/\.$/, '');

  if (!texto || texto.startsWith('-') || texto.includes('/') || texto.includes('?') || texto.includes('#')) {
    throw new Error('Informe apenas o host ou IP, sem caminho ou parâmetros.');
  }

  if (!/^[a-z0-9:.-]+$/i.test(texto)) {
    throw new Error('Informe um host ou IP válido.');
  }

  if (texto.length > 255) {
    throw new Error('Host ou IP deve ter no máximo 255 caracteres.');
  }

  return texto.toLowerCase();
};

const obterPacketStatusMeta = (resultado) => (
  PACKET_STATUS_META[resultado?.status] || PACKET_STATUS_META.not_tested
);

const formatarMs = (valor) => (
  valor || valor === 0
    ? `${Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ms`
    : '-'
);

const formatarPercentual = (valor) => (
  valor || valor === 0
    ? `${Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
    : '-'
);

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

function PacketStatusBadge({ result }) {
  const meta = obterPacketStatusMeta(result);
  const Icone = meta.icon;

  return (
    <span className={`${styles.statusBadge} ${styles[meta.className]}`}>
      <Icone size={15} />
      {meta.label}
    </span>
  );
}

function PacketTargetFormModal({
  form,
  error,
  editingTarget,
  saving,
  onChange,
  onSubmit,
  onClose,
}) {
  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Adicionar destino">
      <form className={styles.modal} onSubmit={onSubmit}>
        <div className={styles.modalHeader}>
          <div>
            <strong>{editingTarget ? 'Editar destino' : 'Adicionar destino'}</strong>
            <span>Teste de perda de pacote via ping pelo backend da intranet</span>
          </div>
          <button type="button" className={styles.iconButton} onClick={onClose} title="Fechar">
            <X size={18} />
          </button>
        </div>

        {error && <div className={styles.formError}>{error}</div>}

        <label className={styles.field}>
          Nome
          <input
            type="text"
            value={form.name}
            onChange={(event) => onChange('name', event.target.value)}
            placeholder="DNS Cliente"
            maxLength={120}
            autoFocus
          />
        </label>

        <label className={styles.field}>
          Host ou IP
          <input
            type="text"
            value={form.host}
            onChange={(event) => onChange('host', event.target.value)}
            placeholder="192.168.1.1"
            maxLength={255}
          />
        </label>

        <div className={styles.modalActions}>
          <button type="button" className={styles.secondaryButton} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className={styles.primaryButton} disabled={saving}>
            {saving ? <Loader2 size={16} className={styles.spin} /> : <CheckCircle2 size={16} />}
            {saving ? 'Salvando...' : 'Salvar destino'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function PacketLossTest({ embedded = false }) {
  const voltarPaginaInterna = useInternalBack('/teste-conectividade-sites');
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const authHeaders = useMemo(() => (
    token ? { Authorization: `Bearer ${token}` } : {}
  ), [token]);

  const [targets, setTargets] = useState([]);
  const [resultsByTargetId, setResultsByTargetId] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [canManage, setCanManage] = useState(false);
  const [testingAll, setTestingAll] = useState(false);
  const [testingTargetIds, setTestingTargetIds] = useState([]);
  const [lastUpdated, setLastUpdated] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState(null);
  const [form, setForm] = useState({ name: '', host: '' });
  const [formError, setFormError] = useState('');
  const [savingTarget, setSavingTarget] = useState(false);
  const runningTestsRef = useRef(0);
  const feedbackTimeoutRef = useRef(null);

  const aplicarResultados = useCallback((resultados = []) => {
    if (!Array.isArray(resultados) || !resultados.length) return;

    setResultsByTargetId((atuais) => {
      const proximos = { ...atuais };

      resultados.forEach((resultado) => {
        if (resultado?.targetId) {
          proximos[resultado.targetId] = resultado;
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

  const aplicarTargets = useCallback((proximosTargets = []) => {
    setTargets(proximosTargets);
  }, []);

  const carregarTargets = useCallback(async ({ silent = false } = {}) => {
    if (!token) return;

    if (!silent) {
      setLoading(true);
    }

    try {
      const { data } = await api.get('/connectivity/packet-targets', { headers: authHeaders });
      const listaTargets = Array.isArray(data) ? data : data.targets || [];

      aplicarTargets(listaTargets);
      setCanManage(Boolean(data?.canManage));
      setError('');
    } catch (err) {
      console.error('Erro ao carregar destinos de perda de pacote:', err);
      setError(err.response?.data?.error || 'Não foi possível carregar os destinos.');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [aplicarTargets, authHeaders, token]);

  useEffect(() => {
    carregarTargets();
  }, [carregarTargets]);

  useEffect(() => () => {
    if (feedbackTimeoutRef.current) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }
  }, []);

  const testarTodos = useCallback(async () => {
    if (!token || runningTestsRef.current > 0) return;

    runningTestsRef.current += 1;
    setTestingAll(true);
    setFeedback('');

    try {
      const { data } = await api.post('/connectivity/packet-loss-test', {}, { headers: authHeaders });
      const resultados = Array.isArray(data) ? data : data.results || [];

      aplicarResultados(resultados);
      setLastUpdated(
        resultados.map((resultado) => resultado?.testedAt).filter(Boolean).sort().at(-1)
        || new Date().toISOString()
      );
      setError('');
    } catch (err) {
      console.error('Erro ao testar perda de pacote:', err);
      setError(err.response?.data?.error || 'Não foi possível executar o teste de perda de pacote.');
    } finally {
      runningTestsRef.current = Math.max(0, runningTestsRef.current - 1);
      setTestingAll(false);
    }
  }, [aplicarResultados, authHeaders, token]);

  const testarTarget = async (targetId) => {
    if (!token || runningTestsRef.current > 0) return;

    runningTestsRef.current += 1;
    setTestingTargetIds((atuais) => [...new Set([...atuais, targetId])]);

    try {
      const { data } = await api.post('/connectivity/packet-loss-test', { target_id: targetId }, { headers: authHeaders });
      const resultados = Array.isArray(data) ? data : data.results || [];

      aplicarResultados(resultados);
      setLastUpdated(
        resultados.map((resultado) => resultado?.testedAt).filter(Boolean).sort().at(-1)
        || new Date().toISOString()
      );
      setError('');
    } catch (err) {
      console.error('Erro ao testar destino:', err);
      setError(err.response?.data?.error || 'Não foi possível testar o destino.');
    } finally {
      runningTestsRef.current = Math.max(0, runningTestsRef.current - 1);
      setTestingTargetIds((atuais) => atuais.filter((id) => id !== targetId));
    }
  };

  const resumo = useMemo(() => {
    const valores = {
      total: targets.length,
      tested: 0,
      normal: 0,
      attention: 0,
      moderate: 0,
      high: 0,
      noResponse: 0,
    };

    targets.forEach((target) => {
      const resultado = resultsByTargetId[target.id];
      if (!resultado) return;

      valores.tested += 1;

      if (resultado.status === 'normal') valores.normal += 1;
      if (resultado.status === 'attention') valores.attention += 1;
      if (resultado.status === 'moderate_loss') valores.moderate += 1;
      if (resultado.status === 'high_loss') valores.high += 1;
      if (resultado.status === 'no_response') valores.noResponse += 1;
    });

    return valores;
  }, [resultsByTargetId, targets]);

  const testingTargetSet = useMemo(() => new Set(testingTargetIds), [testingTargetIds]);
  const anyTesting = testingAll || testingTargetIds.length > 0;

  const abrirCriacao = () => {
    setEditingTarget(null);
    setForm({ name: '', host: '' });
    setFormError('');
    setModalOpen(true);
  };

  const abrirEdicao = (target) => {
    setEditingTarget(target);
    setForm({ name: target.name, host: target.host });
    setFormError('');
    setModalOpen(true);
  };

  const fecharModal = () => {
    if (savingTarget) return;
    setModalOpen(false);
    setEditingTarget(null);
    setFormError('');
  };

  const alterarForm = (field, value) => {
    setForm((atual) => ({ ...atual, [field]: value }));
    setFormError('');
  };

  const salvarTarget = async (event) => {
    event.preventDefault();

    const name = form.name.trim();
    let host;

    try {
      if (!name) {
        throw new Error('Nome do destino é obrigatório.');
      }

      host = normalizarHostCliente(form.host);

      const duplicado = targets.some((target) => (
        target.id !== editingTarget?.id && target.host.toLowerCase() === host.toLowerCase()
      ));

      if (duplicado) {
        throw new Error('Já existe um destino cadastrado com esse host ou IP.');
      }
    } catch (err) {
      setFormError(err.message);
      return;
    }

    setSavingTarget(true);

    try {
      const payload = { name, host };
      const { data } = editingTarget
        ? await api.put(`/connectivity/packet-targets/${editingTarget.id}`, payload, { headers: authHeaders })
        : await api.post('/connectivity/packet-targets', payload, { headers: authHeaders });

      aplicarTargets(data.targets || []);
      setModalOpen(false);
      setEditingTarget(null);
      setFeedback(editingTarget ? 'Destino atualizado.' : 'Destino adicionado.');
    } catch (err) {
      console.error('Erro ao salvar destino:', err);
      setFormError(err.response?.data?.error || 'Não foi possível salvar o destino.');
    } finally {
      setSavingTarget(false);
    }
  };

  const removerTarget = async (target) => {
    if (!window.confirm(`Remover ${target.name}?`)) return;

    try {
      const { data } = await api.delete(`/connectivity/packet-targets/${target.id}`, { headers: authHeaders });
      aplicarTargets(data.targets || []);
      setResultsByTargetId((atuais) => {
        const proximos = { ...atuais };
        delete proximos[target.id];
        return proximos;
      });
      setFeedback('Destino removido.');
    } catch (err) {
      console.error('Erro ao remover destino:', err);
      setError(err.response?.data?.error || 'Não foi possível remover o destino.');
    }
  };

  const copiarDiagnostico = async () => {
    const dataTexto = formatarDataHora(new Date());
    const linhas = [
      `Teste de perda de pacote - ${dataTexto}`,
      '',
      ...targets.map((target) => {
        const resultado = resultsByTargetId[target.id];
        const meta = obterPacketStatusMeta(resultado);

        if (!resultado) {
          return `${target.name}: Sem teste`;
        }

        const alerta = resultado.warning ? ` - ${resultado.warning}` : '';

        return [
          `${target.name}: ${meta.label}`,
          `Host: ${target.host}`,
          `IP: ${resultado.resolvedIp || '-'}`,
          `Pacotes: ${resultado.received}/${resultado.sent}`,
          `Perda: ${formatarPercentual(resultado.packetLossPercent)}`,
          `Latência: min ${formatarMs(resultado.minMs)} / média ${formatarMs(resultado.avgMs)} / máx ${formatarMs(resultado.maxMs)}`,
          `Jitter: ${formatarMs(resultado.jitterMs)}${alerta}`,
        ].join(' | ');
      }),
    ];

    try {
      await copiarTexto(linhas.join('\n'));
      setFeedback('Resultado copiado!');

      if (feedbackTimeoutRef.current) {
        window.clearTimeout(feedbackTimeoutRef.current);
      }

      feedbackTimeoutRef.current = window.setTimeout(() => setFeedback(''), 2600);
    } catch (err) {
      console.error('Erro ao copiar resultado:', err);
      setError('Não foi possível copiar o resultado.');
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
              <Activity size={15} />
              NOC
            </span>
            <h1>Teste de Perda de Pacote</h1>
            <p>Teste ping, latência, perda de pacotes e estabilidade da conexão.</p>
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
            <button type="button" className={styles.primaryButton} onClick={testarTodos} disabled={anyTesting || loading}>
              {testingAll ? <Loader2 size={17} className={styles.spin} /> : <RefreshCw size={17} />}
              {testingAll ? 'Testando...' : 'Testar perda de pacote'}
            </button>

            {canManage && (
              <button type="button" className={styles.secondaryButton} onClick={abrirCriacao}>
                <Plus size={17} />
                Adicionar destino
              </button>
            )}

            <button type="button" className={styles.secondaryButton} onClick={copiarDiagnostico} disabled={!targets.length}>
              <Copy size={17} />
              Copiar resultado
            </button>
          </div>
        </header>

        {error && <div className={styles.errorBanner}>{error}</div>}
        {feedback && <div className={styles.feedbackBanner}>{feedback}</div>}

        <section className={styles.summaryGrid} aria-label="Resumo de perda de pacote">
          <article className={styles.summaryCard}>
            <Activity size={18} />
            <span>Destinos</span>
            <strong>{resumo.total}</strong>
          </article>
          <article className={styles.summaryCard}>
            <CheckCircle2 size={18} />
            <span>Testados</span>
            <strong>{resumo.tested}</strong>
          </article>
          <article className={`${styles.summaryCard} ${styles.summaryNormal}`}>
            <CheckCircle2 size={18} />
            <span>Normais</span>
            <strong>{resumo.normal}</strong>
          </article>
          <article className={`${styles.summaryCard} ${styles.summarySlow}`}>
            <AlertTriangle size={18} />
            <span>Atenção/Moderada</span>
            <strong>{resumo.attention + resumo.moderate}</strong>
          </article>
          <article className={`${styles.summaryCard} ${styles.summaryOffline}`}>
            <WifiOff size={18} />
            <span>Alta/Sem resposta</span>
            <strong>{resumo.high + resumo.noResponse}</strong>
          </article>
        </section>

        <section className={styles.sectionBlock} aria-labelledby="packet-loss-targets-title">
          <div className={styles.sectionHeader}>
            <div>
              <span>Ping</span>
              <h2 id="packet-loss-targets-title">Destinos monitorados</h2>
            </div>
            <div className={styles.sectionHeaderActions}>
              <button type="button" className={styles.primaryButton} onClick={testarTodos} disabled={anyTesting || loading}>
                {testingAll ? <Loader2 size={16} className={styles.spin} /> : <Activity size={16} />}
                {testingAll ? 'Testando...' : 'Testar todos'}
              </button>
              {canManage && (
                <button type="button" className={styles.secondaryButton} onClick={abrirCriacao}>
                  <Plus size={16} />
                  Adicionar destino
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className={styles.loadingBox}>
              <Loader2 size={22} className={styles.spin} />
              Carregando destinos
            </div>
          ) : (
            <div className={styles.cardsGrid}>
              {targets.map((target) => {
                const resultado = resultsByTargetId[target.id];
                const testingTarget = testingTargetSet.has(target.id);

                return (
                  <article key={`packet-${target.id}`} className={styles.siteCard}>
                    <div className={styles.siteCardHeader}>
                      <span className={styles.siteIcon}>
                        <Activity size={19} />
                      </span>
                      <div>
                        <strong>{target.name}</strong>
                        <span className={styles.hostText}>{target.host}</span>
                      </div>
                    </div>

                    <div className={styles.siteMetrics}>
                      <PacketStatusBadge result={resultado} />
                      <span>Perda {formatarPercentual(resultado?.packetLossPercent)}</span>
                      <span>Média {formatarMs(resultado?.avgMs)}</span>
                      <span>Jitter {formatarMs(resultado?.jitterMs)}</span>
                    </div>

                    <dl className={styles.siteDetails}>
                      <div>
                        <dt>IP resolvido</dt>
                        <dd>{resultado?.resolvedIp || '-'}</dd>
                      </div>
                      <div>
                        <dt>Pacotes</dt>
                        <dd>{resultado ? `${resultado.received}/${resultado.sent}` : '-'}</dd>
                      </div>
                      <div>
                        <dt>Latência min/máx</dt>
                        <dd>{resultado ? `${formatarMs(resultado.minMs)} / ${formatarMs(resultado.maxMs)}` : '-'}</dd>
                      </div>
                      <div>
                        <dt>Último teste</dt>
                        <dd>{formatarDataHora(resultado?.testedAt)}</dd>
                      </div>
                    </dl>

                    {resultado?.warning && (
                      <div className={styles.warningText}>{resultado.warning}</div>
                    )}

                    <div className={styles.cardActions}>
                      <button
                        type="button"
                        className={styles.actionButton}
                        onClick={() => testarTarget(target.id)}
                        disabled={anyTesting}
                      >
                        {testingTarget ? <Loader2 size={15} className={styles.spin} /> : <RefreshCw size={15} />}
                        Testar
                      </button>
                      {canManage && !target.isDefault && (
                        <>
                          <button type="button" className={styles.iconAction} onClick={() => abrirEdicao(target)} title="Editar destino">
                            <Edit3 size={15} />
                          </button>
                          <button type="button" className={styles.iconActionDanger} onClick={() => removerTarget(target)} title="Remover destino">
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

        <section className={styles.sectionBlock} aria-labelledby="packet-loss-table-title">
          <div className={styles.sectionHeader}>
            <div>
              <span>Detalhamento</span>
              <h2 id="packet-loss-table-title">Resultados de perda de pacote</h2>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={`${styles.resultsTable} ${styles.packetTable}`}>
              <thead>
                <tr>
                  <th>Host</th>
                  <th>IP resolvido</th>
                  <th>Enviados</th>
                  <th>Recebidos</th>
                  <th>Perdidos</th>
                  <th>Perda</th>
                  <th>Min</th>
                  <th>Média</th>
                  <th>Máx</th>
                  <th>Jitter</th>
                  <th>Status final</th>
                  <th>Data/hora</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {targets.length ? targets.map((target) => {
                  const resultado = resultsByTargetId[target.id];
                  const testingTarget = testingTargetSet.has(target.id);
                  const lostPackets = resultado
                    ? Math.max(0, Number(resultado.sent || 0) - Number(resultado.received || 0))
                    : null;

                  return (
                    <tr key={`packet-row-${target.id}`}>
                      <td>
                        <strong>{target.name}</strong>
                        {target.isDefault && <span className={styles.defaultTag}>Padrão</span>}
                        <span className={styles.tableSubtext}>{target.host}</span>
                      </td>
                      <td>{resultado?.resolvedIp || '-'}</td>
                      <td>{resultado?.sent ?? '-'}</td>
                      <td>{resultado?.received ?? '-'}</td>
                      <td>{lostPackets ?? '-'}</td>
                      <td>{formatarPercentual(resultado?.packetLossPercent)}</td>
                      <td>{formatarMs(resultado?.minMs)}</td>
                      <td>{formatarMs(resultado?.avgMs)}</td>
                      <td>{formatarMs(resultado?.maxMs)}</td>
                      <td>{formatarMs(resultado?.jitterMs)}</td>
                      <td>
                        <PacketStatusBadge result={resultado} />
                        {resultado?.warning && <div className={styles.warningText}>{resultado.warning}</div>}
                      </td>
                      <td>{formatarDataHora(resultado?.testedAt)}</td>
                      <td>
                        <div className={styles.tableActions}>
                          <button type="button" onClick={() => testarTarget(target.id)} disabled={anyTesting}>
                            {testingTarget ? <Loader2 size={14} className={styles.spin} /> : <RefreshCw size={14} />}
                            Testar
                          </button>
                          {canManage && !target.isDefault && (
                            <>
                              <button type="button" onClick={() => abrirEdicao(target)}>
                                <Edit3 size={14} />
                                Editar
                              </button>
                              <button type="button" className={styles.dangerTextButton} onClick={() => removerTarget(target)}>
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
                    <td colSpan="13" className={styles.emptyCell}>Nenhum destino cadastrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {modalOpen && (
        <PacketTargetFormModal
          form={form}
          error={formError}
          editingTarget={editingTarget}
          saving={savingTarget}
          onChange={alterarForm}
          onSubmit={salvarTarget}
          onClose={fecharModal}
        />
      )}
    </main>
  );
}
