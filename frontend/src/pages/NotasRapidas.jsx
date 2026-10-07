import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Copy,
  Eye,
  Pencil,
  Pin,
  Plus,
  Search,
  Share2,
  StickyNote,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import api from '../services/api';
import { socket } from '../services/socket';
import { useInternalBack } from '../utils/internalNavigation';
import styles from '../styles/NotasRapidas.module.css';

const criarFormularioVazio = () => ({
  title: '',
  content: '',
  pinned: false,
  sharedUsers: [],
});

const PERMISSOES_COMPARTILHAMENTO = [
  { value: 'view', label: 'Pode visualizar', shortLabel: 'Visualização' },
  { value: 'edit', label: 'Pode editar', shortLabel: 'Edição' },
];

const obterRotuloPermissao = (permissao) => (
  permissao === 'edit' ? 'Pode editar' : 'Pode visualizar'
);

const obterRotuloPermissaoCurto = (permissao) => (
  permissao === 'edit' ? 'Edição' : 'Visualização'
);

const normalizarPermissao = (permissao) => (
  permissao === 'edit' ? 'edit' : 'view'
);

const montarCompartilhamentosFormNota = (nota) => (
  (nota?.shared_users || []).map((usuario) => ({
    user_id: Number(usuario.id),
    permission: normalizarPermissao(usuario.permission),
  }))
);

const formatarData = (data) => {
  if (!data) return '-';

  return new Date(data).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const normalizarBusca = (valor = '') => (
  String(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
);

const obterIniciais = (nome = '') => (
  String(nome)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase() || '?'
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
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
};

export default function NotasRapidas() {
  const navigate = useNavigate();
  const voltarPaginaInterna = useInternalBack('/chat');
  const [notas, setNotas] = useState([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [notaAberta, setNotaAberta] = useState(null);
  const [notaEditando, setNotaEditando] = useState(null);
  const [form, setForm] = useState(criarFormularioVazio);
  const [salvando, setSalvando] = useState(false);
  const [notaParaExcluir, setNotaParaExcluir] = useState(null);
  const [excluindo, setExcluindo] = useState(false);
  const [copiadoId, setCopiadoId] = useState(null);
  const [usuariosCompartilhamento, setUsuariosCompartilhamento] = useState([]);
  const [buscaUsuarios, setBuscaUsuarios] = useState('');
  const [avisoAtualizacao, setAvisoAtualizacao] = useState('');
  const [notasAtualizadasIds, setNotasAtualizadasIds] = useState([]);
  const avisoTimeoutRef = useRef(null);
  const badgeTimeoutRef = useRef(null);

  const token = useMemo(() => localStorage.getItem('token'), []);
  const usuarioAtual = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }, []);
  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
  }), [token]);

  const aplicarNotaAtualizada = (notaAtualizada) => {
    if (!notaAtualizada?.id) return;

    setNotas((atuais) => {
      const existe = atuais.some((nota) => Number(nota.id) === Number(notaAtualizada.id));

      if (!existe) {
        return [notaAtualizada, ...atuais];
      }

      return atuais.map((nota) => (
        Number(nota.id) === Number(notaAtualizada.id) ? notaAtualizada : nota
      ));
    });

    setNotaAberta((atual) => (
      Number(atual?.id) === Number(notaAtualizada.id) ? notaAtualizada : atual
    ));

    setNotaEditando((atual) => (
      Number(atual?.id) === Number(notaAtualizada.id) ? notaAtualizada : atual
    ));
  };

  const removerNotaLocalmente = (noteId) => {
    setNotas((atuais) => atuais.filter((nota) => Number(nota.id) !== Number(noteId)));
    setNotaAberta((atual) => (Number(atual?.id) === Number(noteId) ? null : atual));
    setNotaEditando((atual) => (Number(atual?.id) === Number(noteId) ? null : atual));
  };

  const mostrarAvisoAtualizacao = (mensagem) => {
    window.clearTimeout(avisoTimeoutRef.current);
    setAvisoAtualizacao(mensagem);
    avisoTimeoutRef.current = window.setTimeout(() => {
      setAvisoAtualizacao('');
    }, 3600);
  };

  const marcarNotaAtualizada = (noteId) => {
    setNotasAtualizadasIds((atuais) => (
      atuais.includes(Number(noteId)) ? atuais : [...atuais, Number(noteId)]
    ));

    window.clearTimeout(badgeTimeoutRef.current);
    badgeTimeoutRef.current = window.setTimeout(() => {
      setNotasAtualizadasIds([]);
    }, 6000);
  };

  const carregarNotas = async () => {
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    try {
      setCarregando(true);
      setErro('');
      const [notasRes, usuariosRes] = await Promise.all([
        api.get('/notes', { headers }),
        api.get('/chat/usuarios', { headers }),
      ]);
      setNotas(notasRes.data || []);
      setUsuariosCompartilhamento(usuariosRes.data || []);
    } catch (err) {
      console.error('Erro ao carregar notas rápidas:', err);

      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login', { replace: true });
        return;
      }

      setErro(err.response?.data?.error || 'Não foi possível carregar suas notas.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarNotas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!token || !usuarioAtual?.id) return undefined;

    if (!socket.connected) {
      socket.connect();
    }

    if (usuarioAtual.empresa_id) {
      socket.emit('user_connect', {
        usuario_id: usuarioAtual.id,
        empresa_id: usuarioAtual.empresa_id,
      });

      socket.emit('join_user_groups', {
        usuario_id: usuarioAtual.id,
        empresa_id: usuarioAtual.empresa_id,
      });
    }

    const handleNotaAlterada = async (payload = {}) => {
      const noteId = Number(payload.note_id);
      const editorNome = payload.edited_by?.nome || 'Alguém';
      const editadoPorMim = Number(payload.edited_by?.id) === Number(usuarioAtual.id);

      if (!noteId) return;

      if (payload.action === 'deleted') {
        removerNotaLocalmente(noteId);

        if (!editadoPorMim) {
          mostrarAvisoAtualizacao(`${editorNome} removeu uma nota compartilhada.`);
        }

        return;
      }

      try {
        const { data } = await api.get(`/notes/${noteId}`, { headers });
        aplicarNotaAtualizada(data);

        if (!editadoPorMim && payload.action === 'updated') {
          marcarNotaAtualizada(noteId);
          mostrarAvisoAtualizacao(`${editorNome} atualizou esta nota.`);
        }
      } catch (err) {
        if (err.response?.status === 404 || err.response?.status === 403) {
          removerNotaLocalmente(noteId);
          return;
        }

        console.error('Erro ao sincronizar nota rápida:', err);
      }
    };

    socket.on('quick_note_changed', handleNotaAlterada);

    return () => {
      socket.off('quick_note_changed', handleNotaAlterada);
      window.clearTimeout(avisoTimeoutRef.current);
      window.clearTimeout(badgeTimeoutRef.current);
    };
  }, [token, usuarioAtual?.id, usuarioAtual?.empresa_id, headers]);

  const usuariosPorId = useMemo(() => {
    const mapa = new Map();

    usuariosCompartilhamento.forEach((usuario) => {
      mapa.set(Number(usuario.id), usuario);
    });

    notas.forEach((nota) => {
      (nota.shared_users || []).forEach((usuario) => {
        if (!mapa.has(Number(usuario.id))) {
          mapa.set(Number(usuario.id), usuario);
        }
      });
    });

    return mapa;
  }, [notas, usuariosCompartilhamento]);

  const usuariosFiltrados = useMemo(() => {
    const termo = normalizarBusca(buscaUsuarios.trim());

    return usuariosCompartilhamento.filter((usuario) => (
      !termo ||
      normalizarBusca(`${usuario.nome} ${usuario.email || ''} ${usuario.setor_nome || ''}`).includes(termo)
    ));
  }, [buscaUsuarios, usuariosCompartilhamento]);

  const notasFiltradas = useMemo(() => {
    const termo = normalizarBusca(busca.trim());

    return [...notas]
      .filter((nota) => (
        !termo ||
        normalizarBusca(`${nota.title} ${nota.content} ${nota.owner?.nome || ''}`).includes(termo)
      ))
      .sort((a, b) => {
        const fixadaDiff = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));

        if (fixadaDiff !== 0) return fixadaDiff;

        return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
      });
  }, [busca, notas]);

  const abrirNovaNota = () => {
    setNotaEditando(null);
    setForm(criarFormularioVazio());
    setBuscaUsuarios('');
    setErro('');
    setModalAberto(true);
  };

  const abrirEdicao = (nota) => {
    if (!podeEditarNota(nota)) return;

    setNotaEditando(nota);
    setForm({
      title: nota.title || '',
      content: nota.content || '',
      pinned: Boolean(nota.pinned),
      sharedUsers: montarCompartilhamentosFormNota(nota),
    });
    setBuscaUsuarios('');
    setErro('');
    setModalAberto(true);
  };

  const fecharModal = () => {
    if (salvando) return;
    setModalAberto(false);
    setNotaEditando(null);
    setForm(criarFormularioVazio());
  };

  const atualizarForm = (campo, valor) => {
    setErro('');
    setForm((atual) => ({
      ...atual,
      [campo]: valor,
    }));
  };

  const salvarNota = async (event) => {
    event.preventDefault();

    const podeGerenciarCompartilhamento = !notaEditando || podeGerenciarNota(notaEditando);
    const payload = {
      title: form.title.trim(),
      content: form.content,
    };

    if (podeGerenciarCompartilhamento) {
      payload.pinned = form.pinned;
      payload.sharedUsers = form.sharedUsers;
    }

    if (!payload.title) {
      setErro('Informe um título para salvar a nota.');
      return;
    }

    try {
      setSalvando(true);
      setErro('');

      const { data } = notaEditando
        ? await api.put(`/notes/${notaEditando.id}`, payload, { headers })
        : await api.post('/notes', payload, { headers });

      setNotas((atuais) => {
        if (notaEditando) {
          return atuais.map((nota) => (nota.id === data.id ? data : nota));
        }

        return [data, ...atuais.filter((nota) => Number(nota.id) !== Number(data.id))];
      });
      setNotaAberta((atual) => (Number(atual?.id) === Number(data.id) ? data : atual));

      fecharModal();
    } catch (err) {
      console.error('Erro ao salvar nota rápida:', err);
      setErro(err.response?.data?.error || 'Não foi possível salvar a nota.');
    } finally {
      setSalvando(false);
    }
  };

  const alternarFixada = async (nota) => {
    if (!podeGerenciarNota(nota)) return;

    try {
      const { data } = await api.patch(
        `/notes/${nota.id}/pin`,
        { pinned: !nota.pinned },
        { headers }
      );

      setNotas((atuais) => atuais.map((item) => (item.id === data.id ? data : item)));
    } catch (err) {
      console.error('Erro ao fixar nota rápida:', err);
      setErro(err.response?.data?.error || 'Não foi possível alterar a fixação da nota.');
    }
  };

  const copiarConteudoNota = async (nota) => {
    try {
      await copiarTexto(nota.content || '');
      setCopiadoId(nota.id);
      window.setTimeout(() => setCopiadoId(null), 1600);
    } catch (err) {
      console.error('Erro ao copiar nota:', err);
      setErro('Não foi possível copiar o conteúdo da nota.');
    }
  };

  const podeGerenciarNota = (nota) => (
    Boolean(nota?.can_manage)
    || nota?.access_type === 'owner'
    || Number(nota?.owner_user_id || nota?.user_id) === Number(usuarioAtual?.id)
  );

  const podeEditarNota = (nota) => (
    podeGerenciarNota(nota)
    || Boolean(nota?.can_edit)
    || nota?.permission === 'edit'
  );

  const alternarUsuarioCompartilhado = (usuarioId) => {
    const idNormalizado = Number(usuarioId);

    setForm((atual) => {
      const compartilhamentosAtuais = atual.sharedUsers || [];
      const jaSelecionado = compartilhamentosAtuais.some((item) => Number(item.user_id) === idNormalizado);

      return {
        ...atual,
        sharedUsers: jaSelecionado
          ? compartilhamentosAtuais.filter((item) => Number(item.user_id) !== idNormalizado)
          : [...compartilhamentosAtuais, { user_id: idNormalizado, permission: 'view' }],
      };
    });
  };

  const alterarPermissaoCompartilhamento = (usuarioId, permissao) => {
    const idNormalizado = Number(usuarioId);

    setForm((atual) => ({
      ...atual,
      sharedUsers: (atual.sharedUsers || []).map((item) => (
        Number(item.user_id) === idNormalizado
          ? { ...item, permission: normalizarPermissao(permissao) }
          : item
      )),
    }));
  };

  const removerUsuarioCompartilhado = (usuarioId) => {
    setForm((atual) => ({
      ...atual,
      sharedUsers: (atual.sharedUsers || []).filter((item) => Number(item.user_id) !== Number(usuarioId)),
    }));
  };

  const resumoCompartilhamento = (nota) => {
    const usuarios = nota.shared_users || [];

    if (nota.access_type === 'shared') {
      return `Compartilhada por ${nota.owner?.nome || 'outro usuário'} - ${obterRotuloPermissao(nota.permission)}`;
    }

    if (!usuarios.length) return '';

    const nomes = usuarios.slice(0, 2).map((usuario) => usuario.nome).join(', ');
    const restante = usuarios.length - 2;

    return restante > 0 ? `Compartilhada com ${nomes} +${restante}` : `Compartilhada com ${nomes}`;
  };

  const confirmarExclusao = async () => {
    if (!notaParaExcluir) return;

    try {
      setExcluindo(true);
      await api.delete(`/notes/${notaParaExcluir.id}`, { headers });
      setNotas((atuais) => atuais.filter((nota) => nota.id !== notaParaExcluir.id));
      setNotaAberta((atual) => (atual?.id === notaParaExcluir.id ? null : atual));
      setNotaParaExcluir(null);
    } catch (err) {
      console.error('Erro ao excluir nota rápida:', err);
      setErro(err.response?.data?.error || 'Não foi possível excluir a nota.');
    } finally {
      setExcluindo(false);
    }
  };

  const renderNota = (nota) => {
    const gerenciavel = podeGerenciarNota(nota);
    const editavel = podeEditarNota(nota);
    const compartilhamento = resumoCompartilhamento(nota);
    const atualizada = notasAtualizadasIds.includes(Number(nota.id));

    return (
      <article
        key={nota.id}
        className={`${styles.noteCard} ${nota.pinned ? styles.noteCardPinned : ''} ${nota.access_type === 'shared' ? styles.noteCardShared : ''}`}
      >
        <div className={styles.noteCardTop}>
          <div className={styles.noteIcon}>
            {nota.access_type === 'shared' ? <Share2 size={20} /> : <StickyNote size={20} />}
          </div>
          <div className={styles.noteCardTitle}>
            <h2>{nota.title}</h2>
            <div className={styles.noteBadges}>
              {nota.pinned && <span>Fixada</span>}
              <span className={nota.access_type === 'shared' ? styles.sharedBadge : styles.ownerBadge}>
                {nota.access_type === 'shared' ? 'Compartilhada comigo' : 'Minha nota'}
              </span>
              {nota.access_type === 'shared' && (
                <span className={nota.permission === 'edit' ? styles.editBadge : styles.viewBadge}>
                  {obterRotuloPermissaoCurto(nota.permission)}
                </span>
              )}
              {atualizada && <span className={styles.updatedBadge}>Atualizada</span>}
            </div>
          </div>
        </div>

        {compartilhamento && (
          <div className={styles.shareSummary}>
            <Share2 size={14} />
            {compartilhamento}
          </div>
        )}

        <p className={styles.notePreview}>
          {nota.content?.trim() || 'Sem conteúdo ainda.'}
        </p>

        <div className={styles.noteDates}>
          <span>Criada: {formatarData(nota.created_at)}</span>
          <span>
            {nota.last_edited_by?.nome
              ? `Editado por ${nota.last_edited_by.nome} em ${formatarData(nota.updated_at)}`
              : `Editada: ${formatarData(nota.updated_at)}`}
          </span>
        </div>

        <div className={styles.noteActions}>
          {gerenciavel && (
            <button type="button" onClick={() => alternarFixada(nota)} title={nota.pinned ? 'Desfixar nota' : 'Fixar nota'}>
              <Pin size={16} />
              {nota.pinned ? 'Desfixar' : 'Fixar'}
            </button>
          )}
          <button type="button" onClick={() => setNotaAberta(nota)} title="Abrir nota">
            <Eye size={16} />
            Abrir
          </button>
          <button type="button" onClick={() => copiarConteudoNota(nota)} title="Copiar conteúdo">
            {copiadoId === nota.id ? <Check size={16} /> : <Copy size={16} />}
            {copiadoId === nota.id ? 'Conteúdo copiado!' : 'Copiar'}
          </button>
          {editavel && (
            <button type="button" onClick={() => abrirEdicao(nota)} title="Editar nota">
              <Pencil size={16} />
              Editar
            </button>
          )}
          {gerenciavel && (
            <>
              <button
                type="button"
                className={styles.dangerButton}
                onClick={() => setNotaParaExcluir(nota)}
                title="Excluir nota"
              >
                <Trash2 size={16} />
                Excluir
              </button>
            </>
          )}
        </div>
      </article>
    );
  };

  const usuariosSelecionadosForm = (form.sharedUsers || [])
    .map((item) => {
      const usuario = usuariosPorId.get(Number(item.user_id));

      if (!usuario) return null;

      return {
        ...usuario,
        permission: normalizarPermissao(item.permission),
      };
    })
    .filter(Boolean);
  const gerenciarCompartilhamentoNoModal = !notaEditando || podeGerenciarNota(notaEditando);
  const editandoNotaCompartilhada = Boolean(notaEditando && !podeGerenciarNota(notaEditando));

  return (
    <main className={styles.notesPage}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <button type="button" className={styles.backButton} onClick={voltarPaginaInterna}>
            <ArrowLeft size={18} />
            Voltar
          </button>

          <div className={styles.heroText}>
            <span>
              <StickyNote size={16} />
              Bloco pessoal e compartilhado
            </span>
            <h1>Notas Rápidas</h1>
            <p>Salve informações, procedimentos e lembretes do dia a dia, privados ou compartilhados com a equipe.</p>
          </div>
        </header>

        <section className={styles.toolbar}>
          <div className={styles.searchBox}>
            <Search size={18} />
            <input
              type="text"
              placeholder="Buscar nas notas..."
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
            />
          </div>

          <button type="button" className={styles.primaryButton} onClick={abrirNovaNota}>
            <Plus size={18} />
            Nova nota
          </button>
        </section>

        {erro && <div className={styles.errorBox}>{erro}</div>}
        {avisoAtualizacao && <div className={styles.syncNotice}>{avisoAtualizacao}</div>}

        {carregando ? (
          <div className={styles.loadingBox}>Carregando notas...</div>
        ) : notasFiltradas.length > 0 ? (
          <section className={styles.notesGrid}>
            {notasFiltradas.map(renderNota)}
          </section>
        ) : (
          <section className={styles.emptyState}>
            <StickyNote size={42} />
            <h2>Nenhuma nota disponível</h2>
            <p>Crie sua primeira nota ou aguarde uma nota compartilhada com você.</p>
            <button type="button" className={styles.primaryButton} onClick={abrirNovaNota}>
              <Plus size={18} />
              Criar primeira nota
            </button>
          </section>
        )}
      </div>

      {modalAberto && (
        <div className={styles.modalOverlay} onClick={fecharModal}>
          <form className={styles.noteModal} onSubmit={salvarNota} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2>{notaEditando ? 'Editar nota' : 'Nova nota'}</h2>
                <p>
                  {notaEditando
                    ? (editandoNotaCompartilhada
                      ? 'Atualize o conteúdo compartilhado com você.'
                      : 'Atualize sua informação salva.')
                    : 'Registre uma informação rápida.'}
                </p>
              </div>
              <button type="button" className={styles.iconButton} onClick={fecharModal} disabled={salvando}>
                <X size={20} />
              </button>
            </div>

            <label className={styles.field}>
              Título
              <input
                type="text"
                value={form.title}
                onChange={(event) => atualizarForm('title', event.target.value)}
                maxLength={180}
                autoFocus
              />
            </label>

            <label className={styles.field}>
              Conteúdo
              <textarea
                value={form.content}
                onChange={(event) => atualizarForm('content', event.target.value)}
                rows={10}
              />
            </label>

            {!gerenciarCompartilhamentoNoModal && (
              <div className={styles.readOnlyNotice}>
                Você pode editar o conteúdo desta nota, mas apenas o dono pode alterar fixação e compartilhamentos.
              </div>
            )}

            {gerenciarCompartilhamentoNoModal && (
              <>
                <div className={styles.shareField}>
                  <div className={styles.shareFieldHeader}>
                    <div>
                      <strong>Compartilhar com</strong>
                      <span>Selecione pessoas e defina quem pode visualizar ou editar esta nota.</span>
                    </div>
                    <Users size={18} />
                  </div>

                  <div className={styles.shareSearch}>
                    <Search size={16} />
                    <input
                      type="text"
                      value={buscaUsuarios}
                      onChange={(event) => setBuscaUsuarios(event.target.value)}
                      placeholder="Buscar usuário..."
                    />
                  </div>

                  {usuariosSelecionadosForm.length > 0 && (
                    <div className={styles.selectedUsers}>
                      {usuariosSelecionadosForm.map((usuario) => (
                        <div key={usuario.id} className={styles.selectedUserRow}>
                          <span className={styles.userAvatar}>{obterIniciais(usuario.nome)}</span>
                          <span className={styles.userOptionText}>
                            <strong>{usuario.nome}</strong>
                            <small>{obterRotuloPermissao(usuario.permission)}</small>
                          </span>
                          <div className={styles.permissionToggle}>
                            {PERMISSOES_COMPARTILHAMENTO.map((permissao) => (
                              <button
                                key={permissao.value}
                                type="button"
                                className={usuario.permission === permissao.value ? styles.permissionActive : ''}
                                onClick={() => alterarPermissaoCompartilhamento(usuario.id, permissao.value)}
                              >
                                {permissao.label}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            className={styles.removeUserButton}
                            onClick={() => removerUsuarioCompartilhado(usuario.id)}
                            title={`Remover ${usuario.nome}`}
                          >
                            <X size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className={styles.userSelectList}>
                    {usuariosFiltrados.length > 0 ? (
                      usuariosFiltrados.map((usuario) => {
                        const selecionado = (form.sharedUsers || [])
                          .some((item) => Number(item.user_id) === Number(usuario.id));

                        return (
                          <button
                            key={usuario.id}
                            type="button"
                            className={selecionado ? styles.userOptionSelected : ''}
                            onClick={() => alternarUsuarioCompartilhado(usuario.id)}
                          >
                            <span className={styles.userAvatar}>{obterIniciais(usuario.nome)}</span>
                            <span className={styles.userOptionText}>
                              <strong>{usuario.nome}</strong>
                              <small>{usuario.setor_nome || usuario.email || 'Usuário'}</small>
                            </span>
                            {selecionado ? <Check size={16} /> : <Plus size={16} />}
                          </button>
                        );
                      })
                    ) : (
                      <div className={styles.emptyUsers}>Nenhum usuário encontrado.</div>
                    )}
                  </div>
                </div>

                <label className={styles.pinField}>
                  <input
                    type="checkbox"
                    checked={form.pinned}
                    onChange={(event) => atualizarForm('pinned', event.target.checked)}
                  />
                  Fixar nota no topo
                </label>
              </>
            )}

            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={fecharModal} disabled={salvando}>
                Cancelar
              </button>
              <button type="submit" className={styles.primaryButton} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar nota'}
              </button>
            </div>
          </form>
        </div>
      )}

      {notaAberta && (
        <div className={styles.modalOverlay} onClick={() => setNotaAberta(null)}>
          <article className={styles.viewModal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2>{notaAberta.title}</h2>
                <p>
                  {notaAberta.access_type === 'shared'
                    ? `Compartilhada por ${notaAberta.owner?.nome || 'outro usuário'}`
                    : 'Nota criada por você'}
                </p>
              </div>
              <button type="button" className={styles.iconButton} onClick={() => setNotaAberta(null)}>
                <X size={20} />
              </button>
            </div>

            {resumoCompartilhamento(notaAberta) && (
              <div className={styles.shareSummary}>
                <Share2 size={14} />
                {resumoCompartilhamento(notaAberta)}
              </div>
            )}

            <div className={styles.viewMeta}>
              <span>Dono: {notaAberta.owner?.nome || 'Não informado'}</span>
              <span>
                Seu acesso: {notaAberta.access_type === 'owner'
                  ? 'Minha nota'
                  : obterRotuloPermissao(notaAberta.permission)}
              </span>
              <span>Criada: {formatarData(notaAberta.created_at)}</span>
              <span>
                {notaAberta.last_edited_by?.nome
                  ? `Editado por ${notaAberta.last_edited_by.nome} em ${formatarData(notaAberta.updated_at)}`
                  : `Editada: ${formatarData(notaAberta.updated_at)}`}
              </span>
            </div>

            {notaAberta.access_type === 'shared' && !podeEditarNota(notaAberta) && (
              <div className={styles.readOnlyNotice}>
                Você tem acesso apenas para visualizar esta nota.
              </div>
            )}

            <div className={styles.noteFullContent}>
              {notaAberta.content?.trim() || 'Sem conteúdo ainda.'}
            </div>

            {notaAberta.shared_users?.length > 0 && (
              <div className={styles.viewSharedUsers}>
                <strong>Pessoas com acesso</strong>
                <div>
                  {notaAberta.shared_users.map((usuario) => (
                    <span key={usuario.id}>
                      {usuario.nome} - {obterRotuloPermissaoCurto(usuario.permission)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.modalActions}>
              {podeEditarNota(notaAberta) && (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => {
                    const nota = notaAberta;
                    setNotaAberta(null);
                    abrirEdicao(nota);
                  }}
                >
                  <Pencil size={16} />
                  Editar
                </button>
              )}
              <button type="button" className={styles.primaryButton} onClick={() => copiarConteudoNota(notaAberta)}>
                {copiadoId === notaAberta.id ? <Check size={16} /> : <Copy size={16} />}
                {copiadoId === notaAberta.id ? 'Copiado!' : 'Copiar conteúdo'}
              </button>
            </div>
          </article>
        </div>
      )}

      {notaParaExcluir && (
        <div className={styles.modalOverlay} onClick={() => !excluindo && setNotaParaExcluir(null)}>
          <div className={styles.confirmModal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Excluir nota?</h2>
                <p>Essa ação remove a nota para todos que têm acesso.</p>
              </div>
            </div>

            <strong>{notaParaExcluir.title}</strong>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setNotaParaExcluir(null)}
                disabled={excluindo}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`${styles.primaryButton} ${styles.deleteConfirmButton}`}
                onClick={confirmarExclusao}
                disabled={excluindo}
              >
                {excluindo ? 'Excluindo...' : 'Excluir nota'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
