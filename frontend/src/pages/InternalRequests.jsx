import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  FileUp,
  Inbox,
  Loader2,
  MessageSquareText,
  Paperclip,
  Plus,
  Search,
  Send,
  X,
} from 'lucide-react';
import api from '../services/api';
import { useInternalBack } from '../utils/internalNavigation';
import { PERFIL_ADMIN, PERFIL_ADMIN_COMERCIAL } from '../utils/perfis';
import styles from '../styles/InternalRequests.module.css';

const DEFAULT_OPTIONS = {
  setores: [
    'Suporte interno',
    'Marketing/Design',
    'Cadastro',
    'Comercial',
    'Financeiro/Administração',
    'TI/Sistemas',
    'RH',
    'Outro',
  ],
  tipos: [
    'Suporte interno',
    'Pedido de marketing/design',
    'Ajuste em cadastro',
    'Solicitação comercial',
    'Problema em sistema',
    'Financeiro/Administração',
    'Outro',
  ],
  prioridades: ['baixa', 'media', 'alta', 'urgente'],
  status: ['aberto', 'em_andamento', 'aguardando_retorno', 'resolvido', 'cancelado'],
  limite_anexo_mb: 50,
  usuarios: [],
};

const STATUS_LABELS = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  aguardando_retorno: 'Aguardando retorno',
  resolvido: 'Resolvido',
  cancelado: 'Cancelado',
};

const PRIORITY_LABELS = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
};

const criarFormularioVazio = () => ({
  setor: DEFAULT_OPTIONS.setores[0],
  tipo: DEFAULT_OPTIONS.tipos[0],
  prioridade: 'media',
  titulo: '',
  descricao: '',
  responsavel_criacao_id: '',
  responsavel_execucao_id: '',
  anexo: null,
});

const obterUsuarioLocal = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

const normalizarBusca = (valor = '') => (
  String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
);

const formatarData = (valor) => {
  if (!valor) return '';

  return new Date(valor).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatarTamanho = (bytes = 0) => {
  const tamanho = Number(bytes || 0);

  if (!tamanho) return '';
  if (tamanho >= 1024 * 1024) return `${(tamanho / (1024 * 1024)).toFixed(1)} MB`;
  if (tamanho >= 1024) return `${Math.round(tamanho / 1024)} KB`;

  return `${tamanho} B`;
};

const normalizarId = (valor) => String(valor || '');

const criarEdicaoSolicitacao = (solicitacao = {}) => ({
  status: solicitacao.status || 'aberto',
  resposta: solicitacao.resposta || '',
  responsavel_criacao_id: normalizarId(solicitacao.responsavel_criacao?.id),
  responsavel_execucao_id: normalizarId(solicitacao.responsavel_execucao?.id),
});

export default function InternalRequests() {
  const navigate = useNavigate();
  const voltarPaginaInterna = useInternalBack('/chat');
  const usuarioLocal = useMemo(() => obterUsuarioLocal(), []);
  const token = useMemo(() => localStorage.getItem('token'), []);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const perfilPodeGerenciar = [PERFIL_ADMIN, PERFIL_ADMIN_COMERCIAL].includes(usuarioLocal?.perfil);

  const [solicitacoes, setSolicitacoes] = useState([]);
  const [opcoes, setOpcoes] = useState(DEFAULT_OPTIONS);
  const [podeGerenciar, setPodeGerenciar] = useState(perfilPodeGerenciar);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('todos');
  const [tipoFiltro, setTipoFiltro] = useState('todos');
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState(criarFormularioVazio);
  const [enviando, setEnviando] = useState(false);
  const [edicoes, setEdicoes] = useState({});
  const [salvandoId, setSalvandoId] = useState(null);
  const [concluindoId, setConcluindoId] = useState(null);
  const usuariosResponsaveis = useMemo(() => (
    Array.isArray(opcoes.usuarios) ? opcoes.usuarios : []
  ), [opcoes.usuarios]);

  const carregarSolicitacoes = useCallback(async () => {
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    try {
      setCarregando(true);
      setErro('');

      const { data } = await api.get('/internal-requests', { headers });

      setSolicitacoes(Array.isArray(data.requests) ? data.requests : []);
      setPodeGerenciar(Boolean(data.can_manage));
      setOpcoes({ ...DEFAULT_OPTIONS, ...(data.options || {}) });
    } catch (err) {
      console.error('Erro ao carregar solicitações internas:', err);

      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login', { replace: true });
        return;
      }

      setErro(err.response?.data?.error || 'Não foi possível carregar as solicitações.');
    } finally {
      setCarregando(false);
    }
  }, [headers, navigate, token]);

  useEffect(() => {
    carregarSolicitacoes();
  }, [carregarSolicitacoes]);

  const estatisticas = useMemo(() => {
    const contadores = opcoes.status.reduce((acc, status) => ({ ...acc, [status]: 0 }), {});

    solicitacoes.forEach((solicitacao) => {
      contadores[solicitacao.status] = Number(contadores[solicitacao.status] || 0) + 1;
    });

    return contadores;
  }, [opcoes.status, solicitacoes]);

  const solicitacoesFiltradas = useMemo(() => {
    const termo = normalizarBusca(busca.trim());

    return solicitacoes.filter((solicitacao) => {
      const combinaStatus = statusFiltro === 'todos' || solicitacao.status === statusFiltro;
      const combinaTipo = tipoFiltro === 'todos' || solicitacao.tipo === tipoFiltro;
      const combinaBusca = !termo || normalizarBusca([
        solicitacao.titulo,
        solicitacao.descricao,
        solicitacao.setor,
        solicitacao.tipo,
        solicitacao.prioridade,
        solicitacao.status,
        solicitacao.resposta,
        solicitacao.solicitante?.nome,
        solicitacao.responsavel_criacao?.nome,
        solicitacao.responsavel_execucao?.nome,
        solicitacao.concluido_por?.nome,
      ].filter(Boolean).join(' ')).includes(termo);

      return combinaStatus && combinaTipo && combinaBusca;
    });
  }, [busca, solicitacoes, statusFiltro, tipoFiltro]);

  const atualizarForm = (campo, valor) => {
    setErro('');
    setForm((atual) => ({
      ...atual,
      [campo]: valor,
    }));
  };

  const abrirNovaSolicitacao = () => {
    const usuarioAtualId = normalizarId(usuarioLocal?.id);
    const usuarioAtualDisponivel = usuariosResponsaveis.some((usuario) => (
      normalizarId(usuario.id) === usuarioAtualId
    ));

    setForm({
      ...criarFormularioVazio(),
      setor: opcoes.setores[0] || DEFAULT_OPTIONS.setores[0],
      tipo: opcoes.tipos[0] || DEFAULT_OPTIONS.tipos[0],
      responsavel_criacao_id: usuarioAtualDisponivel ? usuarioAtualId : '',
    });
    setErro('');
    setModalAberto(true);
  };

  const fecharModal = () => {
    if (enviando) return;
    setModalAberto(false);
    setForm(criarFormularioVazio());
  };

  const enviarSolicitacao = async (event) => {
    event.preventDefault();

    const titulo = form.titulo.trim();
    const descricao = form.descricao.trim();

    if (!titulo || !descricao) {
      setErro('Informe o título e a descrição da solicitação.');
      return;
    }

    try {
      setEnviando(true);
      setErro('');

      const payload = new FormData();
      payload.append('setor', form.setor);
      payload.append('tipo', form.tipo);
      payload.append('prioridade', form.prioridade);
      payload.append('titulo', titulo);
      payload.append('descricao', descricao);
      payload.append('responsavel_criacao_id', form.responsavel_criacao_id || '');
      payload.append('responsavel_execucao_id', form.responsavel_execucao_id || '');

      if (form.anexo) {
        payload.append('anexo', form.anexo);
      }

      const { data } = await api.post('/internal-requests', payload, { headers });

      setSolicitacoes((atuais) => [data, ...atuais]);
      setModalAberto(false);
      setForm(criarFormularioVazio());
    } catch (err) {
      console.error('Erro ao enviar solicitação interna:', err);
      setErro(err.response?.data?.error || 'Não foi possível enviar a solicitação.');
    } finally {
      setEnviando(false);
    }
  };

  const obterEdicao = (solicitacao) => edicoes[solicitacao.id] || criarEdicaoSolicitacao(solicitacao);

  const atualizarEdicao = (solicitacaoId, campo, valor) => {
    setEdicoes((atuais) => ({
      ...atuais,
      [solicitacaoId]: {
        ...(atuais[solicitacaoId] || criarEdicaoSolicitacao(
          solicitacoes.find((item) => item.id === solicitacaoId)
        )),
        [campo]: valor,
      },
    }));
  };

  const salvarResposta = async (solicitacao) => {
    if (!podeGerenciar) return;

    const edicao = obterEdicao(solicitacao);

    try {
      setSalvandoId(solicitacao.id);
      setErro('');

      const { data } = await api.patch(
        `/internal-requests/${solicitacao.id}`,
        edicao,
        { headers }
      );

      setSolicitacoes((atuais) => atuais.map((item) => (
        item.id === data.id ? data : item
      )));
      setEdicoes((atuais) => {
        const proximas = { ...atuais };
        delete proximas[solicitacao.id];
        return proximas;
      });
    } catch (err) {
      console.error('Erro ao atualizar solicitação interna:', err);
      setErro(err.response?.data?.error || 'Não foi possível atualizar a solicitação.');
    } finally {
      setSalvandoId(null);
    }
  };

  const concluirSolicitacao = async (solicitacao) => {
    try {
      setConcluindoId(solicitacao.id);
      setErro('');

      const { data } = await api.patch(
        `/internal-requests/${solicitacao.id}/complete`,
        {},
        { headers }
      );

      setSolicitacoes((atuais) => atuais.map((item) => (
        item.id === data.id ? data : item
      )));
    } catch (err) {
      console.error('Erro ao concluir solicitação interna:', err);
      setErro(err.response?.data?.error || 'Não foi possível concluir a solicitação.');
    } finally {
      setConcluindoId(null);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <button type="button" className={styles.backButton} onClick={voltarPaginaInterna}>
          <ArrowLeft size={18} />
          Voltar
        </button>

        <header className={styles.header}>
          <div>
            <span className={styles.kicker}>
              <Inbox size={16} />
              Operação interna
            </span>
            <h1>Central de Chamados</h1>
          </div>
          <button type="button" className={styles.primaryButton} onClick={abrirNovaSolicitacao}>
            <Plus size={18} />
            Nova solicitação
          </button>
        </header>

        <section className={styles.statsGrid}>
          {opcoes.status.map((status) => (
            <button
              key={status}
              type="button"
              className={`${styles.statCard} ${statusFiltro === status ? styles.statCardActive : ''}`}
              onClick={() => setStatusFiltro((atual) => (atual === status ? 'todos' : status))}
            >
              <span>{STATUS_LABELS[status] || status}</span>
              <strong>{estatisticas[status] || 0}</strong>
            </button>
          ))}
        </section>

        <section className={styles.toolbar}>
          <label className={styles.searchBox}>
            <Search size={18} />
            <input
              type="search"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar solicitação"
            />
          </label>

          <select value={statusFiltro} onChange={(event) => setStatusFiltro(event.target.value)}>
            <option value="todos">Todos os status</option>
            {opcoes.status.map((status) => (
              <option key={status} value={status}>{STATUS_LABELS[status] || status}</option>
            ))}
          </select>

          <select value={tipoFiltro} onChange={(event) => setTipoFiltro(event.target.value)}>
            <option value="todos">Todos os tipos</option>
            {opcoes.tipos.map((tipo) => (
              <option key={tipo} value={tipo}>{tipo}</option>
            ))}
          </select>
        </section>

        {erro && <div className={styles.errorBox}>{erro}</div>}

        {carregando ? (
          <div className={styles.loadingBox}>
            <Loader2 size={18} />
            Carregando solicitações...
          </div>
        ) : solicitacoesFiltradas.length === 0 ? (
          <section className={styles.emptyState}>
            <Inbox size={38} />
            <strong>Nenhuma solicitação encontrada</strong>
          </section>
        ) : (
          <section className={styles.requestList}>
            {solicitacoesFiltradas.map((solicitacao) => {
              const edicao = obterEdicao(solicitacao);
              const usuarioAtualExecuta = normalizarId(solicitacao.responsavel_execucao?.id)
                === normalizarId(usuarioLocal?.id);
              const podeConcluir = usuarioAtualExecuta
                && !['resolvido', 'cancelado'].includes(solicitacao.status);

              return (
                <article key={solicitacao.id} className={styles.requestCard}>
                  <div className={styles.requestMain}>
                    <div className={styles.requestTop}>
                      <span className={`${styles.statusBadge} ${styles[`status_${solicitacao.status}`] || ''}`}>
                        {STATUS_LABELS[solicitacao.status] || solicitacao.status}
                      </span>
                      <span className={`${styles.priorityBadge} ${styles[`priority_${solicitacao.prioridade}`] || ''}`}>
                        {PRIORITY_LABELS[solicitacao.prioridade] || solicitacao.prioridade}
                      </span>
                    </div>

                    <h2>{solicitacao.titulo}</h2>
                    <p>{solicitacao.descricao}</p>

                    <div className={styles.metaGrid}>
                      <span>{solicitacao.tipo}</span>
                      <span>{solicitacao.setor}</span>
                      <span>{solicitacao.solicitante?.nome || 'Solicitante'}</span>
                      <span>{formatarData(solicitacao.criado_em)}</span>
                    </div>

                    <div className={styles.assignmentGrid}>
                      <div>
                        <span>Responsável por criar</span>
                        <strong>{solicitacao.responsavel_criacao?.nome || 'Não definido'}</strong>
                      </div>
                      <div>
                        <span>Responsável por realizar</span>
                        <strong>{solicitacao.responsavel_execucao?.nome || 'Não definido'}</strong>
                      </div>
                    </div>

                    {podeConcluir && (
                      <button
                        type="button"
                        className={styles.completeButton}
                        onClick={() => concluirSolicitacao(solicitacao)}
                        disabled={concluindoId === solicitacao.id}
                      >
                        {concluindoId === solicitacao.id ? <Loader2 size={16} /> : <CheckCircle2 size={16} />}
                        {concluindoId === solicitacao.id ? 'Concluindo...' : 'Concluir'}
                      </button>
                    )}

                    {solicitacao.anexo && (
                      <a
                        className={styles.attachmentLink}
                        href={solicitacao.anexo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Paperclip size={16} />
                        <span>{solicitacao.anexo.nome}</span>
                        {solicitacao.anexo.tamanho ? <small>{formatarTamanho(solicitacao.anexo.tamanho)}</small> : null}
                      </a>
                    )}

                    {solicitacao.resposta && (
                      <div className={styles.responseBox}>
                        <strong>
                          <CheckCircle2 size={16} />
                          Resposta
                        </strong>
                        <p>{solicitacao.resposta}</p>
                        <small>
                          {solicitacao.responsavel?.nome ? `Respondido por ${solicitacao.responsavel.nome}` : 'Respondido'}
                          {solicitacao.respondido_em ? ` em ${formatarData(solicitacao.respondido_em)}` : ''}
                        </small>
                      </div>
                    )}

                    {solicitacao.concluido_em && (
                      <div className={styles.completionBox}>
                        <CheckCircle2 size={16} />
                        <span>
                          Concluído por {solicitacao.concluido_por?.nome || 'responsável'}
                          {' em '}
                          {formatarData(solicitacao.concluido_em)}
                        </span>
                      </div>
                    )}
                  </div>

                  {podeGerenciar && (
                    <aside className={styles.managerPanel}>
                      <label>
                        Responsável por criar
                        <select
                          value={edicao.responsavel_criacao_id}
                          onChange={(event) => atualizarEdicao(solicitacao.id, 'responsavel_criacao_id', event.target.value)}
                        >
                          <option value="">Não definido</option>
                          {usuariosResponsaveis.map((usuario) => (
                            <option key={usuario.id} value={usuario.id}>{usuario.nome}</option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Responsável por realizar
                        <select
                          value={edicao.responsavel_execucao_id}
                          onChange={(event) => atualizarEdicao(solicitacao.id, 'responsavel_execucao_id', event.target.value)}
                        >
                          <option value="">Não definido</option>
                          {usuariosResponsaveis.map((usuario) => (
                            <option key={usuario.id} value={usuario.id}>{usuario.nome}</option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Status
                        <select
                          value={edicao.status}
                          onChange={(event) => atualizarEdicao(solicitacao.id, 'status', event.target.value)}
                        >
                          {opcoes.status.map((status) => (
                            <option key={status} value={status}>{STATUS_LABELS[status] || status}</option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Resposta
                        <textarea
                          rows={5}
                          value={edicao.resposta}
                          onChange={(event) => atualizarEdicao(solicitacao.id, 'resposta', event.target.value)}
                          placeholder="Responder solicitação"
                        />
                      </label>

                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => salvarResposta(solicitacao)}
                        disabled={salvandoId === solicitacao.id}
                      >
                        {salvandoId === solicitacao.id ? <Loader2 size={16} /> : <Send size={16} />}
                        {salvandoId === solicitacao.id ? 'Salvando...' : 'Salvar retorno'}
                      </button>
                    </aside>
                  )}
                </article>
              );
            })}
          </section>
        )}

        {modalAberto && (
          <div className={styles.modalOverlay} onClick={fecharModal}>
            <form className={styles.modal} onSubmit={enviarSolicitacao} onClick={(event) => event.stopPropagation()}>
              <div className={styles.modalHeader}>
                <div>
                  <h2>Nova solicitação</h2>
                </div>
                <button type="button" className={styles.iconButton} onClick={fecharModal} disabled={enviando}>
                  <X size={20} />
                </button>
              </div>

              <div className={styles.formGrid}>
                <label>
                  Setor
                  <select value={form.setor} onChange={(event) => atualizarForm('setor', event.target.value)}>
                    {opcoes.setores.map((setor) => (
                      <option key={setor} value={setor}>{setor}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Tipo
                  <select value={form.tipo} onChange={(event) => atualizarForm('tipo', event.target.value)}>
                    {opcoes.tipos.map((tipo) => (
                      <option key={tipo} value={tipo}>{tipo}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Prioridade
                  <select value={form.prioridade} onChange={(event) => atualizarForm('prioridade', event.target.value)}>
                    {opcoes.prioridades.map((prioridade) => (
                      <option key={prioridade} value={prioridade}>
                        {PRIORITY_LABELS[prioridade] || prioridade}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className={styles.assignmentFormGrid}>
                <label>
                  Responsável por criar
                  <select
                    value={form.responsavel_criacao_id}
                    onChange={(event) => atualizarForm('responsavel_criacao_id', event.target.value)}
                  >
                    <option value="">Não definido</option>
                    {usuariosResponsaveis.map((usuario) => (
                      <option key={usuario.id} value={usuario.id}>{usuario.nome}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Responsável por realizar
                  <select
                    value={form.responsavel_execucao_id}
                    onChange={(event) => atualizarForm('responsavel_execucao_id', event.target.value)}
                  >
                    <option value="">Não definido</option>
                    {usuariosResponsaveis.map((usuario) => (
                      <option key={usuario.id} value={usuario.id}>{usuario.nome}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className={styles.field}>
                Título
                <input
                  type="text"
                  value={form.titulo}
                  onChange={(event) => atualizarForm('titulo', event.target.value)}
                  maxLength={180}
                  autoFocus
                />
              </label>

              <label className={styles.field}>
                Descrição
                <textarea
                  rows={6}
                  value={form.descricao}
                  onChange={(event) => atualizarForm('descricao', event.target.value)}
                />
              </label>

              <label className={styles.uploadBox}>
                <FileUp size={18} />
                <span>{form.anexo ? form.anexo.name : `Anexar arquivo até ${opcoes.limite_anexo_mb} MB`}</span>
                <input
                  type="file"
                  onChange={(event) => atualizarForm('anexo', event.target.files?.[0] || null)}
                />
              </label>

              <div className={styles.modalActions}>
                <button type="button" className={styles.secondaryButton} onClick={fecharModal} disabled={enviando}>
                  Cancelar
                </button>
                <button type="submit" className={styles.primaryButton} disabled={enviando}>
                  {enviando ? <Loader2 size={16} /> : <MessageSquareText size={16} />}
                  {enviando ? 'Enviando...' : 'Abrir solicitação'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
