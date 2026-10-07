import { Fragment, useState, useEffect, useMemo, useRef } from 'react';
import api from '../../services/api';
import styles from '../../styles/Chat.module.css';
import NocDashboardResumo from './NocDashboardResumo';
import EmojiPickerButton from './EmojiPickerButton';
import ImageSendPreviewModal from './ImageSendPreviewModal';
import ImageViewerModal from './ImageViewerModal';
import LinkifiedText from './LinkifiedText';
import MessageFavoritesModal from './MessageFavoritesModal';
import MessageFormattingToolbar from './MessageFormattingToolbar';
import PendingAttachmentsPreview from './PendingAttachmentsPreview';
import RichMessageEditor from './RichMessageEditor';
import SharedFilesPanel from './SharedFilesPanel';
import StickerPickerButton from './StickerPickerButton';
import useChatFileDrop from './useChatFileDrop';
import ChatAppearanceModal from './ChatAppearanceModal';
import { CHAT_APPEARANCE_DEFAULTS, buildChatAppearanceCssVars, mergeAppearance } from './chatAppearance';
import {
  MESSAGE_REACTION_OPTIONS,
  copyTextToClipboard,
  getReactionUsersTitle,
} from './messageActions';
import {
  createPendingAttachments,
  revokePendingAttachmentPreviews,
} from './pendingAttachments';
import baixarArquivo from '../../utils/baixarArquivo';
import { removerFormatacaoMensagem } from '../../utils/formatacaoMensagem';
import { PERFIL_ADMIN } from '../../utils/perfis';
import {
  formatarDivisorDataMensagem,
  obterChaveDataMensagem,
} from '../../utils/chatDatas';
import { extrairGruposChat } from '../../utils/chatUnread';
import { normalizarGruposUsuario } from '../../utils/usuarioGrupos';

const MAX_UPLOAD_SIZE = 500 * 1024 * 1024;
const MAX_UPLOAD_SIZE_LABEL = '500 MB';
const DEFAULT_FILE_MIME = 'application/octet-stream';
const AUDIO_MIME_BY_EXTENSION = {
  '.aac': 'audio/aac',
  '.aif': 'audio/aiff',
  '.aiff': 'audio/aiff',
  '.amr': 'audio/amr',
  '.caf': 'audio/x-caf',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.mpeg': 'audio/mpeg',
  '.oga': 'audio/ogg',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.wav': 'audio/wav',
  '.weba': 'audio/webm',
  '.webm': 'audio/webm',
};
const FILE_MIME_BY_EXTENSION = {
  '.zip': 'application/zip',
};
const SEARCH_FILE_TERMS = 'arquivo documento pdf word psd photoshop excel planilha xls xlsx csv zip compactado comprimido';
const ATTACHMENT_ACCEPT = undefined;
const AUDIO_ACCEPT = [
  'audio/*',
  'audio/aac',
  'audio/aiff',
  'audio/amr',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/webm',
  'audio/wav',
  'audio/x-wav',
  '.aac',
  '.aif',
  '.aiff',
  '.amr',
  '.caf',
  '.m4a',
  '.mp3',
  '.mpeg',
  '.oga',
  '.ogg',
  '.opus',
  '.wav',
  '.weba',
  '.webm',
].join(',');

const normalizarNomeGrupo = (valor = '') => (
  valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
);

const normalizarHandleUsuario = (valor = '') => (
  String(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
);

const montarHandlesUsuario = (nome = '') => {
  const partes = String(nome).trim().split(/\s+/).filter(Boolean);

  return [
    normalizarHandleUsuario(nome),
    normalizarHandleUsuario(partes[0] || ''),
  ].filter(Boolean);
};

const normalizarMensagens = (items = []) => {
  const porChave = new Map();

  items.forEach((item, index) => {
    const chave = item?.id
      ? `id:${Number(item.id)}`
      : `tmp:${item?.remetente_id || ''}:${item?.criada_em || ''}:${item?.mensagem || ''}:${index}`;

    porChave.set(chave, {
      ...item,
      reacoes: Array.isArray(item?.reacoes) ? item.reacoes : [],
    });
  });

  return Array.from(porChave.values()).sort((a, b) => {
    const dataA = new Date(a?.criada_em || 0).getTime();
    const dataB = new Date(b?.criada_em || 0).getTime();

    if (dataA !== dataB) return dataA - dataB;

    return Number(a?.id || 0) - Number(b?.id || 0);
  });
};

const isZipFileMessage = (msg = {}) => {
  const mime = String(msg.anexo_mime || '').toLowerCase();
  const nome = String(msg.anexo_nome || '').toLowerCase();

  return mime.includes('zip') || nome.endsWith('.zip');
};

const isPendingImageAttachment = (attachment = {}) => (
  attachment.kind === 'imagem' && Boolean(attachment.previewUrl)
);

export default function MensagensGrupo({
  grupo_id,
  usuario_atual,
  socket,
  token,
  appearance = CHAT_APPEARANCE_DEFAULTS,
  onGlobalAppearanceSaved,
  onClearConversation,
  onViewProfile,
  onOpenFavoriteOrigin,
  onVoltarMobile,
  focusMessageId = null,
  onFocusMessageHandled,
}) {
  const usuarioAtualEhAdmin = usuario_atual?.perfil === PERFIL_ADMIN;
  const [conversationAppearance, setConversationAppearance] = useState(null);
  const [apariciaAberta, setApariciaAberta] = useState(false);
  const [mensagens, setMensagens] = useState([]);
  const [grupoInfo, setGrupoInfo] = useState(null);
  const [novaMsg, setNovaMsg] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState('');
  const [usuarios_digitando, setUsuariosDigitando] = useState(new Set());
  const [pesquisa, setPesquisa] = useState('');
  const [buscaAtiva, setBuscaAtiva] = useState(false);
  const [mensagemEditando, setMensagemEditando] = useState(null);
  const [mensagemRespondendo, setMensagemRespondendo] = useState(null);
  const [menuMensagemAbertoId, setMenuMensagemAbertoId] = useState(null);
  const [menuConversaAberto, setMenuConversaAberto] = useState(false);
  const [imagemPreview, setImagemPreview] = useState(null);
  const [abaChatAtiva, setAbaChatAtiva] = useState('mensagens');
  const [favoritosModalAberto, setFavoritosModalAberto] = useState(false);
  const [favoritosMensagens, setFavoritosMensagens] = useState([]);
  const [carregandoFavoritos, setCarregandoFavoritos] = useState(false);
  const [erroFavoritos, setErroFavoritos] = useState('');
  const [favoritoFeedback, setFavoritoFeedback] = useState('');
  const [favoritoAtualizandoId, setFavoritoAtualizandoId] = useState(null);
  const [reacaoAtualizandoId, setReacaoAtualizandoId] = useState(null);
  const [mensagemFixada, setMensagemFixada] = useState(null);
  const [fixandoMensagemId, setFixandoMensagemId] = useState(null);
  const [modalMembrosAberto, setModalMembrosAberto] = useState(false);
  const [membrosGrupo, setMembrosGrupo] = useState([]);
  const [carregandoMembros, setCarregandoMembros] = useState(false);
  const [erroMembros, setErroMembros] = useState('');
  const [visualizacoesMensagem, setVisualizacoesMensagem] = useState(null);
  const [visualizacoesDados, setVisualizacoesDados] = useState(null);
  const [carregandoVisualizacoes, setCarregandoVisualizacoes] = useState(false);
  const [erroVisualizacoes, setErroVisualizacoes] = useState('');
  const [termoMencao, setTermoMencao] = useState(null);
  const [indiceMencao, setIndiceMencao] = useState(0);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [selectedPendingImageId, setSelectedPendingImageId] = useState(null);
  const [newMessagesNotice, setNewMessagesNotice] = useState(null);
  const [menuAnexosMobileAberto, setMenuAnexosMobileAberto] = useState(false);
  const [enviandoMensagem, setEnviandoMensagem] = useState(false);
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messageRefs = useRef(new Map());
  const typingTimeoutRef = useRef(null);
  const imageInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const searchInputRef = useRef(null);
  const messageInputRef = useRef(null);
  const loadRequestIdRef = useRef(0);
  const favoritoFeedbackTimeoutRef = useRef(null);
  const pendingAttachmentsRef = useRef([]);

  const limparAnexosPendentes = () => {
    setPendingAttachments((atuais) => {
      revokePendingAttachmentPreviews(atuais);
      return [];
    });
    setSelectedPendingImageId(null);
  };

  const removerAnexoPendente = (attachmentId) => {
    setPendingAttachments((atuais) => {
      const removidos = atuais.filter((attachment) => attachment.id === attachmentId);
      revokePendingAttachmentPreviews(removidos);
      return atuais.filter((attachment) => attachment.id !== attachmentId);
    });
  };

  const adicionarAnexosPendentes = (files, tipoPreferido = 'auto') => {
    if (mensagemEditando) {
      alert('Conclua ou cancele a edição da mensagem antes de anexar arquivos.');
      return;
    }

    const entradas = Array.from(files || []).reduce((lista, arquivo) => {
      if (!arquivo) return lista;

      if (arquivo.size > MAX_UPLOAD_SIZE) {
        alert(`Arquivo muito grande. Envie arquivos de até ${MAX_UPLOAD_SIZE_LABEL}.`);
        return lista;
      }

      const audioMime = obterMimeAudio(arquivo);
      const isImagem = String(arquivo.type || '').toLowerCase().startsWith('image/');
      const deveEnviarAudio = tipoPreferido === 'audio' || (tipoPreferido === 'auto' && audioMime);

      if (tipoPreferido === 'audio' && !audioMime) {
        alert('Selecione apenas arquivos de áudio.');
        return lista;
      }

      lista.push({
        file: arquivo,
        kind: deveEnviarAudio ? 'audio' : (isImagem ? 'imagem' : 'arquivo'),
        mime: deveEnviarAudio ? audioMime : obterMimeArquivo(arquivo),
      });

      return lista;
    }, []);

    const anexos = createPendingAttachments(entradas);

    if (!anexos.length) return;

    setPendingAttachments((atuais) => [...atuais, ...anexos]);

    const novasImagens = anexos.filter(isPendingImageAttachment);
    if (novasImagens.length) {
      setSelectedPendingImageId((atual) => atual || novasImagens[0].id);
    }
  };

  const pendingImageAttachments = useMemo(
    () => pendingAttachments.filter(isPendingImageAttachment),
    [pendingAttachments]
  );
  const pendingNonImageAttachments = useMemo(
    () => pendingAttachments.filter((attachment) => !isPendingImageAttachment(attachment)),
    [pendingAttachments]
  );
  const viewerImages = useMemo(
    () => mensagens
      .filter((msg) => msg.tipo_mensagem === 'imagem' && msg.mensagem)
      .map((msg) => ({
        id: msg.id,
        url: msg.mensagem,
        name: msg.anexo_nome || 'imagem',
        caption: msg.legenda || '',
      })),
    [mensagens]
  );

  useEffect(() => {
    if (!pendingImageAttachments.length) {
      if (selectedPendingImageId) setSelectedPendingImageId(null);
      return;
    }

    if (!pendingImageAttachments.some((attachment) => attachment.id === selectedPendingImageId)) {
      setSelectedPendingImageId(pendingImageAttachments[0].id);
    }
  }, [pendingImageAttachments, selectedPendingImageId]);

  useEffect(() => {
    if (!grupo_id || !token) {
      setConversationAppearance(null);
      return;
    }

    let cancelado = false;

    api.get(`/chat/appearance/conversations/grupo/${grupo_id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(({ data }) => {
        if (!cancelado) setConversationAppearance(data?.preferences || null);
      })
      .catch((err) => {
        console.error('Erro ao carregar personalização da conversa:', err);
        if (!cancelado) setConversationAppearance(null);
      });

    return () => { cancelado = true; };
  }, [grupo_id, token]);

  const efeitoAparencia = useMemo(
    () => mergeAppearance(appearance, conversationAppearance),
    [appearance, conversationAppearance],
  );
  const estiloAparencia = useMemo(
    () => buildChatAppearanceCssVars(efeitoAparencia),
    [efeitoAparencia],
  );

  useEffect(() => {
    setNewMessagesNotice(null);
  }, [grupo_id]);

  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments;
  }, [pendingAttachments]);

  useEffect(() => () => {
    revokePendingAttachmentPreviews(pendingAttachmentsRef.current);
  }, []);

  const carregarMensagens = async ({ mostrarLoading = true } = {}) => {
    if (!grupo_id || !token) return;

    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    try {
      if (mostrarLoading) {
        setCarregando(true);
      }

      setErroCarregamento('');

      const headers = { Authorization: `Bearer ${token}` };
      const rotaMensagens = `/chat/grupo/${grupo_id}`;
      console.count(`[CHAT_DEBUG] GET ${rotaMensagens}`);
      console.log('[CHAT_DEBUG] carregar mensagens do grupo', {
        grupo_id,
        requestId,
        mostrarLoading,
      });

      const res = await api.get(rotaMensagens, {
        headers,
        params: { limit: 100 },
      });

      if (requestId !== loadRequestIdRef.current) return;

      setMensagens(normalizarMensagens(res.data.mensagens || []));
      setMensagemFixada(res.data.pinned_message || null);

      if (socket) {
        if (!socket.connected) {
          socket.connect();
        }

        socket.emit('join_group', { grupo_id });
        socket.emit('mark_group_read', {
          grupo_id,
          usuario_id: usuario_atual.id,
        });
      }

      const [gruposRes, membrosRes] = await Promise.all([
        api.get('/chat/grupos', { headers }),
        api.get(`/chat/grupo/${grupo_id}/membros`, { headers }),
      ]);

      if (requestId !== loadRequestIdRef.current) return;

      const grupo = extrairGruposChat(gruposRes.data).find((g) => Number(g.id) === Number(grupo_id));
      setGrupoInfo(grupo);
      setMembrosGrupo(membrosRes.data.membros || []);
    } catch (err) {
      if (requestId !== loadRequestIdRef.current) return;

      console.error('Erro ao carregar mensagens do grupo:', err);
      setErroCarregamento(
        err.response?.data?.error ||
          'Não foi possível carregar as mensagens deste grupo.'
      );
    } finally {
      console.log('[CHAT_DEBUG] finalizar mensagens do grupo', {
        grupo_id,
        requestId,
        requestAtual: requestId === loadRequestIdRef.current,
      });

      if (requestId === loadRequestIdRef.current) {
        setCarregando(false);
      }
    }
  };

  // CARREGAR MENSAGENS
  useEffect(() => {
    if (grupo_id) {
      carregarMensagens({ mostrarLoading: true });
    }
    // A conversa aberta deve buscar mensagens só quando o ID do grupo mudar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupo_id]);

  useEffect(() => () => {
    window.clearTimeout(favoritoFeedbackTimeoutRef.current);
  }, []);

  useEffect(() => {
    setMensagemEditando(null);
    setMensagemRespondendo(null);
    setNovaMsg('');
    setAbaChatAtiva('mensagens');
    setTermoMencao(null);
    setIndiceMencao(0);
    setMensagemFixada(null);
    setVisualizacoesMensagem(null);
    setVisualizacoesDados(null);
    setErroVisualizacoes('');
    limparAnexosPendentes();
    messageRefs.current.clear();
  }, [grupo_id]);

  // SCROLL AUTOMÁTICO
  const scrollParaBaixo = (behavior = 'auto') => {
    const executarScroll = () => {
      const container = messagesContainerRef.current;

      if (container) {
        container.scrollTop = container.scrollHeight;
        return;
      }

      messagesEndRef.current?.scrollIntoView({
        behavior,
        block: 'end',
      });
    };

    requestAnimationFrame(executarScroll);
    setTimeout(executarScroll, 80);
  };

  useEffect(() => {
    if (!carregando && mensagens.length > 0) {
      scrollParaBaixo('auto');
    }
  }, [carregando, grupo_id, mensagens.length]);

  useEffect(() => {
    if (!socket || !grupo_id) return undefined;

    return () => {
      socket.emit('leave_group', { grupo_id });
    };
  }, [socket, grupo_id]);

  // LISTENERS DO SOCKET
  useEffect(() => {
    if (!socket) return;

    const mensagemPertenceGrupoAtual = (data) => (
      Number(data?.grupo_id) === Number(grupo_id)
    );

    const adicionarMensagemSeNova = (data) => {
      setMensagens((prev) => {
        if (data?.id && prev.some((msg) => Number(msg.id) === Number(data.id))) {
          return prev;
        }

        return normalizarMensagens([...prev, data]);
      });
    };

    const mensagemMencionaUsuarioAtual = (data) => {
      if (!data || Number(data.remetente_id) === Number(usuario_atual.id)) {
        return false;
      }

      const mencoes = Array.isArray(data.mencoes) ? data.mencoes : [];

      if (mencoes.some((mencao) => Number(mencao?.id ?? mencao) === Number(usuario_atual.id))) {
        return true;
      }

      if (data.tipo_mensagem && data.tipo_mensagem !== 'texto') {
        return false;
      }

      const handles = montarHandlesUsuario(usuario_atual.nome);
      if (!handles.length || !data.mensagem) return false;

      const texto = String(data.mensagem)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

      return handles.some((handle) => {
        const regex = new RegExp(`(^|[^a-z0-9_])@${handle}(?![a-z0-9_])`);
        return regex.test(texto);
      });
    };

    const handleNovaMsg = (data) => {
      if (!mensagemPertenceGrupoAtual(data)) return;
      const mensagemRecebida = Number(data.remetente_id) !== Number(usuario_atual.id);
      const mencionouUsuario = mensagemMencionaUsuarioAtual(data);

      adicionarMensagemSeNova(mensagemRecebida
        ? { ...data, __newMessage: true, __mentionedMe: mencionouUsuario }
        : data);

      if (mensagemRecebida) {
        setNewMessagesNotice({
          messageId: data.id,
          mentioned: mencionouUsuario,
        });
      }

      if (mensagemRecebida) {
        socket.emit('mark_group_read', {
          grupo_id,
          usuario_id: usuario_atual.id,
        });
      }
    };

    const handleUsuarioDigitando = (data) => {
      if (data?.grupo_id && Number(data.grupo_id) !== Number(grupo_id)) return;
      setUsuariosDigitando((prev) => new Set(prev).add(data.usuario_nome));
      setTimeout(() => {
        setUsuariosDigitando((prev) => {
          const novo = new Set(prev);
          novo.delete(data.usuario_nome);
          return novo;
        });
      }, 3000);
    };

    const handleParouDigitar = (data) => {
      if (data?.grupo_id && Number(data.grupo_id) !== Number(grupo_id)) return;
      setUsuariosDigitando((prev) => {
        const novo = new Set(prev);
        novo.delete(data.usuario_nome);
        return novo;
      });
    };

    const handleMensagemApagada = (data) => {
      if (data.escopo !== 'todos') return;
      if (data.grupo_id && Number(data.grupo_id) !== Number(grupo_id)) return;

      setMensagens((prev) =>
        prev.filter((msg) => Number(msg.id) !== Number(data.id))
      );
    };

    const handleMensagemAtualizada = (data) => {
      if (data.grupo_id && Number(data.grupo_id) !== Number(grupo_id)) return;

      setMensagens((prev) => prev.map((msg) => (
        Number(msg.id) === Number(data.message_id || data.id)
          ? { ...msg, mensagem: data.mensagem, editada_em: data.editada_em }
          : msg
      )));
    };

    const handleMensagemFixadaAtualizada = (data) => {
      if (Number(data?.grupo_id) !== Number(grupo_id)) return;

      setGrupoInfo((atual) => ({
        ...(atual || {}),
        ...data,
        mensagem_fixada_ativo: Boolean(data.mensagem_fixada_ativo),
      }));
    };

    const handleReacoesAtualizadas = (data) => {
      setMensagens((prev) => prev.map((msg) => (
        Number(msg.id) === Number(data.message_id)
          ? { ...msg, reacoes: Array.isArray(data.reacoes) ? data.reacoes : [] }
          : msg
      )));
    };

    const handleMensagemFixadaChatAtualizada = (data) => {
      if (data?.tipo !== 'grupo') return;
      if (Number(data.referencia_id) !== Number(grupo_id)) return;

      setMensagemFixada(data.pinned_message || null);
    };

    socket.on('receive_group_message', handleNovaMsg);
    socket.on('message_deleted', handleMensagemApagada);
    socket.on('message_updated', handleMensagemAtualizada);
    socket.on('group_pinned_message_updated', handleMensagemFixadaAtualizada);
    socket.on('message_reactions_updated', handleReacoesAtualizadas);
    socket.on('pinned_message_updated', handleMensagemFixadaChatAtualizada);
    socket.on('user_typing_group', handleUsuarioDigitando);
    socket.on('user_stop_typing_group', handleParouDigitar);

    return () => {
      socket.off('receive_group_message', handleNovaMsg);
      socket.off('message_deleted', handleMensagemApagada);
      socket.off('message_updated', handleMensagemAtualizada);
      socket.off('group_pinned_message_updated', handleMensagemFixadaAtualizada);
      socket.off('message_reactions_updated', handleReacoesAtualizadas);
      socket.off('pinned_message_updated', handleMensagemFixadaChatAtualizada);
      socket.off('user_typing_group', handleUsuarioDigitando);
      socket.off('user_stop_typing_group', handleParouDigitar);
    };
  }, [socket, usuario_atual.id, usuario_atual.nome, grupo_id]);

  // ENVIAR MENSAGEM
  const podeEditarMensagem = (msg) => {
    if (!msg || msg.tipo_mensagem !== 'texto') return false;
    if (usuarioAtualEhAdmin) return true;
    return Number(msg.remetente_id) === Number(usuario_atual.id);
  };

  const podeExibirEditarMensagem = (msg) => (
    msg?.tipo_mensagem === 'texto' &&
    (usuarioAtualEhAdmin || Number(msg?.remetente_id) === Number(usuario_atual.id))
  );

  const podeExibirApagarParaTodos = (msg) => (
    usuarioAtualEhAdmin || Number(msg?.remetente_id) === Number(usuario_atual.id)
  );

  const cancelarEdicaoMensagem = () => {
    setMensagemEditando(null);
    setNovaMsg('');
    setMenuMensagemAbertoId(null);
  };

  const toggleMenuMensagem = (id) => {
    setMenuMensagemAbertoId((prev) => (prev === id ? null : id));
  };

  const iniciarEdicaoMensagem = (msg) => {
    limparAnexosPendentes();
    setMensagemEditando(msg);
    setMensagemRespondendo(null);
    setNovaMsg(msg.mensagem || '');
    setMenuMensagemAbertoId(null);
  };

  const responderMensagem = (msg) => {
    setMensagemRespondendo(msg);
    setMensagemEditando(null);
    setMenuMensagemAbertoId(null);
    setTermoMencao(null);

    window.requestAnimationFrame(() => {
      messageInputRef.current?.focus();
    });
  };

  const atualizarMensagem = async (id, mensagem) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await api.put(`/chat/mensagens/${id}`, { mensagem }, { headers });

      setMensagens((prev) =>
        prev.map((msg) =>
          msg.id === id
            ? { ...msg, mensagem: res.data.mensagem, editada_em: res.data.editada_em }
            : msg
        )
      );
      setMensagemEditando(null);
      setNovaMsg('');
    } catch (err) {
      console.error('Erro ao atualizar mensagem:', err);
      alert(err.response?.data?.error || 'Erro ao atualizar mensagem');
    }
  };

  const apagarMensagem = async (msg, escopo) => {
    try {
      const { data } = await api.delete(`/chat/mensagens/${msg.id}`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { escopo },
      });

      setMensagens((prev) =>
        prev.filter((item) => Number(item.id) !== Number(msg.id))
      );
      setMenuMensagemAbertoId(null);

      if (escopo === 'todos' && socket) {
        socket.emit('message_deleted', {
          id: data.id,
          grupo_id: data.grupo_id || grupo_id,
          escopo,
        });
      }
    } catch (err) {
      console.error('Erro ao apagar mensagem:', err);
      alert(err.response?.data?.error || 'Não foi possível apagar a mensagem.');
    }
  };

  const mostrarFeedbackFavorito = (texto) => {
    setFavoritoFeedback(texto);
    window.clearTimeout(favoritoFeedbackTimeoutRef.current);
    favoritoFeedbackTimeoutRef.current = window.setTimeout(() => {
      setFavoritoFeedback('');
    }, 1800);
  };

  const atualizarFavoritoMensagemLocal = (messageId, favoritada) => {
    setMensagens((prev) => prev.map((item) => (
      Number(item.id) === Number(messageId)
        ? { ...item, favoritada }
        : item
    )));
  };

  const atualizarReacoesMensagemLocal = (messageId, reacoes) => {
    setMensagens((prev) => prev.map((item) => (
      Number(item.id) === Number(messageId)
        ? { ...item, reacoes: Array.isArray(reacoes) ? reacoes : [] }
        : item
    )));
  };

  const carregarFavoritos = async () => {
    try {
      setCarregandoFavoritos(true);
      setErroFavoritos('');

      const { data } = await api.get('/messages/favorites', {
        headers: { Authorization: `Bearer ${token}` },
      });

      setFavoritosMensagens(Array.isArray(data.favorites) ? data.favorites : []);
    } catch (err) {
      console.error('Erro ao carregar mensagens favoritas:', err);
      setErroFavoritos(err.response?.data?.error || 'Não foi possível carregar os favoritos.');
    } finally {
      setCarregandoFavoritos(false);
    }
  };

  const abrirFavoritos = () => {
    setMenuConversaAberto(false);
    setFavoritosModalAberto(true);
    carregarFavoritos();
  };

  const alternarFavoritoMensagem = async (msg) => {
    const messageId = Number(msg?.id);
    if (!messageId) return;

    const estavaFavoritada = Boolean(msg.favoritada);
    const proximoValor = !estavaFavoritada;

    setMenuMensagemAbertoId(null);
    setFavoritoAtualizandoId(messageId);
    atualizarFavoritoMensagemLocal(messageId, proximoValor);

    try {
      if (proximoValor) {
        await api.post(`/messages/${messageId}/favorite`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await api.delete(`/messages/${messageId}/favorite`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setFavoritosMensagens((prev) => prev.filter((item) => (
          Number(item.message_id) !== messageId
        )));
      }

      mostrarFeedbackFavorito(proximoValor ? 'Mensagem favoritada' : 'Removida dos favoritos');
    } catch (err) {
      console.error('Erro ao atualizar favorito da mensagem:', err);
      atualizarFavoritoMensagemLocal(messageId, estavaFavoritada);
      mostrarFeedbackFavorito(err.response?.data?.error || 'Não foi possível atualizar o favorito.');
    } finally {
      setFavoritoAtualizandoId(null);
    }
  };

  const obterStickerIdMensagem = (msg) => Number(msg?.sticker_id || 0);

  const adicionarStickerMensagemBiblioteca = async (msg) => {
    const stickerId = obterStickerIdMensagem(msg);

    if (!stickerId) {
      mostrarFeedbackFavorito('Figurinha sem identificador.');
      return;
    }

    setMenuMensagemAbertoId(null);

    try {
      await api.post(`/chat/stickers/${stickerId}/library`, {
        message_id: msg.id,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      mostrarFeedbackFavorito('Figurinha adicionada.');
    } catch (err) {
      console.error('Erro ao adicionar figurinha:', err);
      mostrarFeedbackFavorito(err.response?.data?.error || 'Nao foi possivel adicionar a figurinha.');
    }
  };

  const favoritarStickerMensagem = async (msg) => {
    const stickerId = obterStickerIdMensagem(msg);

    if (!stickerId) {
      mostrarFeedbackFavorito('Figurinha sem identificador.');
      return;
    }

    setMenuMensagemAbertoId(null);

    try {
      await api.post(`/chat/stickers/${stickerId}/favorite`, {
        message_id: msg.id,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      mostrarFeedbackFavorito('Figurinha favoritada.');
    } catch (err) {
      console.error('Erro ao favoritar figurinha:', err);
      mostrarFeedbackFavorito(err.response?.data?.error || 'Nao foi possivel favoritar a figurinha.');
    }
  };

  const copiarTextoMensagem = async (msg) => {
    const texto = removerFormatacaoMensagem(msg?.mensagem || '').trim();

    if (!texto) return;

    setMenuMensagemAbertoId(null);

    try {
      const copiado = await copyTextToClipboard(texto);
      mostrarFeedbackFavorito(copiado ? 'Texto copiado!' : 'Não foi possível copiar.');
    } catch (err) {
      console.error('Erro ao copiar texto:', err);
      mostrarFeedbackFavorito('Não foi possível copiar.');
    }
  };

  const alternarReacaoMensagem = async (msg, reaction) => {
    const messageId = Number(msg?.id);

    if (!messageId) return;

    setMenuMensagemAbertoId(null);
    setReacaoAtualizandoId(`${messageId}-${reaction}`);

    try {
      const { data } = await api.post(
        `/messages/${messageId}/reactions/toggle`,
        { reaction },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      atualizarReacoesMensagemLocal(messageId, data.reacoes || []);
    } catch (err) {
      console.error('Erro ao reagir à mensagem:', err);
      mostrarFeedbackFavorito(err.response?.data?.error || 'Não foi possível reagir.');
    } finally {
      setReacaoAtualizandoId(null);
    }
  };

  const fixarMensagem = async (msg) => {
    const messageId = Number(msg?.id);

    if (!messageId) return;

    setMenuMensagemAbertoId(null);
    setFixandoMensagemId(messageId);

    try {
      const { data } = await api.post(`/messages/${messageId}/pin`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setMensagemFixada(data.pinned_message || null);
      mostrarFeedbackFavorito('Mensagem fixada.');
    } catch (err) {
      console.error('Erro ao fixar mensagem:', err);
      mostrarFeedbackFavorito(err.response?.data?.error || 'Não foi possível fixar.');
    } finally {
      setFixandoMensagemId(null);
    }
  };

  const removerMensagemFixada = async () => {
    const messageId = Number(mensagemFixada?.message_id);

    if (!messageId) return;

    setFixandoMensagemId(messageId);

    try {
      await api.delete(`/messages/${messageId}/pin`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setMensagemFixada(null);
      mostrarFeedbackFavorito('Mensagem desafixada.');
    } catch (err) {
      console.error('Erro ao desafixar mensagem:', err);
      mostrarFeedbackFavorito(err.response?.data?.error || 'Não foi possível desafixar.');
    } finally {
      setFixandoMensagemId(null);
    }
  };

  const removerFavoritoPeloModal = async (favorito) => {
    const messageId = Number(favorito?.message_id);
    if (!messageId) return;

    setFavoritoAtualizandoId(messageId);

    try {
      await api.delete(`/messages/${messageId}/favorite`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      atualizarFavoritoMensagemLocal(messageId, false);
      setFavoritosMensagens((prev) => prev.filter((item) => (
        Number(item.message_id) !== messageId
      )));
      mostrarFeedbackFavorito('Removida dos favoritos');
    } catch (err) {
      console.error('Erro ao remover favorito:', err);
      setErroFavoritos(err.response?.data?.error || 'Não foi possível remover dos favoritos.');
    } finally {
      setFavoritoAtualizandoId(null);
    }
  };

  const abrirMensagemFavorita = (favorito) => {
    setFavoritosModalAberto(false);

    const origem = favorito?.origem || {};
    const mesmoGrupo = origem.tipo === 'grupo' && Number(origem.grupo_id) === Number(grupo_id);

    if (mesmoGrupo) {
      abrirMensagemCompartilhada(favorito.message_id);
      return;
    }

    onOpenFavoriteOrigin?.(favorito);
  };

  const limparConversa = async () => {
    const confirmar = window.confirm(
      'Apagar esta conversa do grupo somente para você? O histórico continuará disponível para o administrador.'
    );

    if (!confirmar) return;

    try {
      await api.delete(`/chat/grupo/${grupo_id}/conversa`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setMensagens([]);
      setPesquisa('');
      setBuscaAtiva(false);
      setMenuConversaAberto(false);
      onClearConversation?.();
    } catch (err) {
      console.error('Erro ao limpar conversa do grupo:', err);
      alert(err.response?.data?.error || 'Não foi possível apagar a conversa.');
    }
  };

  const enviarMensagem = async () => {
    const textoMensagem = novaMsg.trim();

    if ((!textoMensagem && pendingAttachments.length === 0) || enviandoMensagem) return;

    if (mensagemEditando) {
      if (pendingAttachments.length > 0) {
        alert('Conclua ou cancele a edição da mensagem antes de enviar imagens.');
        return;
      }

      await atualizarMensagem(mensagemEditando.id, novaMsg);
      return;
    }

    setEnviandoMensagem(true);

    try {
      if (pendingAttachments.length > 0) {
        const respostaMensagemId = mensagemRespondendo?.id || null;

        for (const attachment of pendingAttachments) {
          const upload = await enviarArquivoParaServidor(attachment.file);

          await enviarConteudo({
            mensagem: upload.url,
            tipo_mensagem: attachment.kind || 'arquivo',
            anexo_nome: upload.nome || attachment.file.name || attachment.name,
            anexo_mime: upload.mime || attachment.mime || attachment.file.type,
            resposta_mensagem_id: respostaMensagemId,
            limparResposta: false,
          });
        }

        if (textoMensagem) {
          await enviarConteudo({
            mensagem: textoMensagem,
            tipo_mensagem: 'texto',
            resposta_mensagem_id: respostaMensagemId,
            limparResposta: false,
          });
        }

        setMensagemRespondendo(null);
        setNovaMsg('');
        limparAnexosPendentes();
        return;
      }

      await enviarConteudo({
        mensagem: novaMsg,
        tipo_mensagem: 'texto',
      });
      setNovaMsg('');
    } catch (err) {
      console.error('Erro ao enviar imagem colada:', err);
      alert(err.response?.data?.error || 'Erro ao enviar mensagem');
    } finally {
      setEnviandoMensagem(false);
    }
  };

  const enviarConteudo = async ({
    mensagem,
    tipo_mensagem,
    anexo_nome = null,
    anexo_mime = null,
    sticker_id = null,
    resposta_mensagem_id = mensagemRespondendo?.id || null,
    limparResposta = true,
  }) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await api.post(
        '/chat/enviar-grupo',
        {
          grupo_id,
          mensagem,
          tipo_mensagem,
          anexo_nome,
          anexo_mime,
          sticker_id,
          resposta_mensagem_id,
        },
        { headers }
      );

      // Emitir via socket
      if (socket) {
        socket.emit('send_group_message', {
          id: res.data.id,
          remetente_id: usuario_atual.id,
          grupo_id,
          grupo_nome: grupoInfo?.nome || res.data.grupo_nome || null,
          mensagem: res.data.mensagem || mensagem,
          tipo_mensagem: res.data.tipo_mensagem || tipo_mensagem,
          anexo_nome: res.data.anexo_nome ?? anexo_nome,
          anexo_mime: res.data.anexo_mime ?? anexo_mime,
          sticker_id: res.data.sticker_id || sticker_id || null,
          resposta_mensagem_id: res.data.resposta_mensagem_id || null,
          resposta_remetente_id: res.data.resposta_remetente_id || null,
          resposta_remetente_nome: res.data.resposta_remetente_nome || null,
          resposta_tipo_mensagem: res.data.resposta_tipo_mensagem || null,
          resposta_mensagem: res.data.resposta_mensagem || null,
          resposta_anexo_nome: res.data.resposta_anexo_nome || null,
          resposta_sticker_id: res.data.resposta_sticker_id || null,
          resposta_previa: res.data.resposta_previa || null,
          mencoes: res.data.mencoes || [],
          remetente_nome: usuario_atual.nome,
          remetente_avatar: usuario_atual.avatar,
          criada_em: res.data.criada_em,
        });
      }

      setMensagens((prev) => normalizarMensagens([...prev, res.data]));
      if (limparResposta) {
        setMensagemRespondendo(null);
      }

      return res.data;
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
      throw err;
    }
  };

  const enviarSticker = async (sticker) => {
    if (!sticker?.id || !grupo_id || enviandoMensagem) return;

    if (mensagemEditando) {
      alert('Conclua ou cancele a edição da mensagem antes de enviar figurinhas.');
      return;
    }

    setEnviandoMensagem(true);

    try {
      await enviarConteudo({
        mensagem: sticker.file_url || sticker.url,
        tipo_mensagem: 'sticker',
        anexo_nome: 'Figurinha',
        anexo_mime: sticker.mime || 'image/webp',
        sticker_id: sticker.id,
      });
    } finally {
      setEnviandoMensagem(false);
    }
  };

  const abrirSeletorArquivo = () => {
    setMenuAnexosMobileAberto(false);
    imageInputRef.current?.click();
  };

  const abrirSeletorAudio = () => {
    setMenuAnexosMobileAberto(false);
    audioInputRef.current?.click();
  };

  const obterExtensaoArquivo = (nome = '') => {
    const match = String(nome).toLowerCase().match(/\.[a-z0-9]+$/);
    return match?.[0] || '';
  };

  const obterMimeAudio = (arquivo) => {
    const mime = String(arquivo.type || '').toLowerCase();
    if (mime.startsWith('audio/')) return mime;
    return AUDIO_MIME_BY_EXTENSION[obterExtensaoArquivo(arquivo.name)] || '';
  };

  const obterMimeArquivo = (arquivo) => {
    const mime = String(arquivo.type || '').trim();
    const mimePorExtensao = FILE_MIME_BY_EXTENSION[obterExtensaoArquivo(arquivo.name)];

    if ((!mime || mime === DEFAULT_FILE_MIME) && mimePorExtensao) {
      return mimePorExtensao;
    }

    return mime || DEFAULT_FILE_MIME;
  };

  const substituirAnexoPendente = (attachmentId, arquivo) => {
    if (!arquivo) return;

    if (arquivo.size > MAX_UPLOAD_SIZE) {
      alert(`Arquivo muito grande. Envie arquivos de até ${MAX_UPLOAD_SIZE_LABEL}.`);
      return;
    }

    const isImagem = String(arquivo.type || '').toLowerCase().startsWith('image/');

    if (!isImagem) {
      alert('Selecione uma imagem válida.');
      return;
    }

    const [novoAnexo] = createPendingAttachments([{
      file: arquivo,
      kind: 'imagem',
      mime: obterMimeArquivo(arquivo),
    }]);

    if (!novoAnexo) return;

    setPendingAttachments((atuais) => atuais.map((attachment) => {
      if (attachment.id !== attachmentId) return attachment;

      revokePendingAttachmentPreviews([attachment]);
      return {
        ...novoAnexo,
        id: attachmentId,
      };
    }));
    setSelectedPendingImageId(attachmentId);
  };

  const cancelarEnvioImagens = () => {
    setPendingAttachments((atuais) => {
      const removidos = atuais.filter(isPendingImageAttachment);
      revokePendingAttachmentPreviews(removidos);
      return atuais.filter((attachment) => !isPendingImageAttachment(attachment));
    });
    setSelectedPendingImageId(null);
    setNovaMsg('');
  };

  const enviarArquivoParaServidor = async (arquivo) => {
    const formData = new FormData();
    formData.append('arquivo', arquivo);

    const { data } = await api.post('/chat/upload', formData, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return data;
  };

  const processarArquivos = (fileList, tipoPreferido = 'auto') => {
    const arquivos = Array.from(fileList || []);

    if (!arquivos.length) return;

    adicionarAnexosPendentes(arquivos, tipoPreferido);
  };

  const enviarArquivo = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    processarArquivos(files, 'arquivo');
  };

  const enviarAudio = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    processarArquivos(files, 'audio');
  };

  const { isDraggingFiles, dropHandlers } = useChatFileDrop((files) => {
    processarArquivos(files, 'auto');
  });

  const statusClasse = (status) => {
    if (status === 'online') return styles.online;
    if (status === 'away') return styles.away;
    return styles.offline;
  };

  const statusTexto = (status) => {
    if (status === 'online') return 'Online';
    if (status === 'away') return 'Ausente';
    return 'Offline';
  };

  const renderResumoGruposMembro = (membro) => {
    const grupos = normalizarGruposUsuario(membro);
    const gruposVisiveis = grupos.slice(0, 2);
    const gruposRestantes = Math.max(grupos.length - gruposVisiveis.length, 0);

    if (!membro?.setor_nome && !grupos.length) {
      return <span>{membro?.email}</span>;
    }

    return (
      <div className={`${styles.userGroupChips} ${styles.memberGroupChips}`}>
        {membro?.setor_nome && (
          <span className={styles.conversaCategory} title={`Categoria principal: ${membro.setor_nome}`}>
            {membro.setor_nome}
          </span>
        )}
        {gruposVisiveis.map((grupo) => (
          <span
            key={`${membro?.id || 'membro'}-grupo-${grupo.id || grupo.nome}`}
            className={styles.conversaGroupChip}
            title={grupo.nome}
          >
            {grupo.nome}
          </span>
        ))}
        {gruposRestantes > 0 && (
          <button
            type="button"
            className={styles.conversaMoreGroups}
            title="Ver todos os grupos"
            onClick={() => onViewProfile?.(membro)}
          >
            +{gruposRestantes}
          </button>
        )}
      </div>
    );
  };

  const abrirMembrosGrupo = async () => {
    setModalMembrosAberto(true);
    setCarregandoMembros(true);
    setErroMembros('');

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const { data } = await api.get(`/chat/grupo/${grupo_id}/membros`, { headers });
      setMembrosGrupo(data.membros || []);
    } catch (err) {
      console.error('Erro ao buscar membros do grupo:', err);
      setErroMembros(err.response?.data?.error || 'Não foi possível carregar os membros.');
    } finally {
      setCarregandoMembros(false);
    }
  };

  const sugestoesMencao = useMemo(() => {
    if (termoMencao === null || mensagemEditando) return [];

    const termo = normalizarHandleUsuario(termoMencao);

    return membrosGrupo
      .filter((membro) => Number(membro.id) !== Number(usuario_atual.id))
      .map((membro) => ({
        ...membro,
        handle: normalizarHandleUsuario(membro.nome),
      }))
      .filter((membro) => (
        membro.handle &&
        (!termo || membro.handle.includes(termo) || normalizarHandleUsuario(membro.email).includes(termo))
      ))
      .slice(0, 6);
  }, [membrosGrupo, mensagemEditando, termoMencao, usuario_atual.id]);

  useEffect(() => {
    if (indiceMencao >= sugestoesMencao.length) {
      setIndiceMencao(0);
    }
  }, [indiceMencao, sugestoesMencao.length]);

  const atualizarTermoMencao = (valor, cursor) => {
    const textoAntesCursor = valor.slice(0, cursor);
    const match = textoAntesCursor.match(/(^|\s)@([^\s@]*)$/);

    if (!match || /[.,;:!?()[\]{}]/.test(match[2])) {
      setTermoMencao(null);
      setIndiceMencao(0);
      return;
    }

    setTermoMencao(match[2]);
    setIndiceMencao(0);
  };

  const inserirMencao = (membro) => {
    const input = messageInputRef.current;
    const textoAntesCursor = input?.getTextBeforeCursor() || '';
    const cursor = textoAntesCursor.length;
    const match = textoAntesCursor.match(/(^|\s)@([^\s@]*)$/);
    const inicioMencao = match
      ? cursor - match[2].length - 1
      : cursor;
    const handle = normalizarHandleUsuario(membro.nome);

    setTermoMencao(null);
    setIndiceMencao(0);
    input?.replaceTextRange(inicioMencao, cursor, `@${handle} `);
  };

  // DIGITANDO
  const handleDigitar = (e) => {
    const valor = e.target.value;
    const valorPlano = e.target.plainValue ?? valor;

    setNovaMsg(valor);
    atualizarTermoMencao(
      valorPlano,
      e.target.selectionStart ?? valorPlano.length
    );

    if (socket) {
      socket.emit('typing_group', {
        grupo_id,
        usuario_id: usuario_atual.id,
        usuario_nome: usuario_atual.nome,
      });

      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stop_typing_group', {
          grupo_id,
          usuario_id: usuario_atual.id,
        });
      }, 2000);
    }
  };

  const inserirEmoji = (emoji) => {
    messageInputRef.current?.insertText(emoji);
  };

  const formatarHora = (data) => {
    return new Date(data).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const registrarMensagemRef = (id, element) => {
    const key = Number(id);
    if (!key) return;

    if (element) {
      messageRefs.current.set(key, element);
      return;
    }

    messageRefs.current.delete(key);
  };

  const focarMensagem = (id) => {
    const element = messageRefs.current.get(Number(id));

    if (!element) return;

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.classList.add(styles.messageHighlight);
    window.setTimeout(() => {
      element.classList.remove(styles.messageHighlight);
    }, 1400);
  };

  const abrirMensagemCompartilhada = (id) => {
    setAbaChatAtiva('mensagens');

    window.setTimeout(() => {
      focarMensagem(id);
    }, 120);
  };

  const abrirAvisoNovaMensagem = () => {
    if (!newMessagesNotice?.messageId) return;

    abrirMensagemCompartilhada(newMessagesNotice.messageId);
    setNewMessagesNotice(null);
  };

  useEffect(() => {
    if (!focusMessageId || carregando) return undefined;

    setAbaChatAtiva('mensagens');

    const timeoutId = window.setTimeout(() => {
      focarMensagem(focusMessageId);
      onFocusMessageHandled?.();
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [focusMessageId, carregando, mensagens.length, onFocusMessageHandled]);

  const mensagemTemDownload = (msg) => (
    Boolean(msg?.mensagem) && ['imagem', 'audio', 'arquivo'].includes(msg.tipo_mensagem)
  );

  const nomePadraoDownload = (msg) => {
    if (msg?.anexo_nome) return msg.anexo_nome;
    if (msg?.tipo_mensagem === 'imagem') return 'imagem';
    if (msg?.tipo_mensagem === 'audio') return 'audio';
    if (msg?.tipo_mensagem === 'sticker') return 'figurinha.webp';
    return 'arquivo';
  };

  const salvarMensagemNoComputador = async (msg) => {
    setMenuMensagemAbertoId(null);
    await baixarArquivo(msg.mensagem, nomePadraoDownload(msg));
  };

  const abrirVisualizadorImagem = (msg) => {
    setImagemPreview({
      id: msg.id,
      url: msg.mensagem,
      name: msg.anexo_nome || 'imagem',
      caption: msg.legenda || '',
    });
  };

  const abrirVisualizacoesMensagem = async (msg) => {
    setMenuMensagemAbertoId(null);
    setVisualizacoesMensagem(msg);
    setVisualizacoesDados(null);
    setErroVisualizacoes('');
    setCarregandoVisualizacoes(true);

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const { data } = await api.get(
        `/chat/grupo/${grupo_id}/mensagens/${msg.id}/visualizacoes`,
        { headers }
      );

      setVisualizacoesDados(data);
    } catch (err) {
      console.error('Erro ao buscar visualizações:', err);
      setErroVisualizacoes(err.response?.data?.error || 'Não foi possível carregar as visualizações.');
    } finally {
      setCarregandoVisualizacoes(false);
    }
  };

  const fecharVisualizacoesMensagem = () => {
    setVisualizacoesMensagem(null);
    setVisualizacoesDados(null);
    setErroVisualizacoes('');
    setCarregandoVisualizacoes(false);
  };

  const formatarDataHoraVisualizacao = (data) => {
    if (!data) return '';

    return new Date(data).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const textoSituacaoVisualizacao = (situacao) => {
    if (situacao === 'lido') return 'Leu';
    if (situacao === 'recebido') return 'Recebeu';
    return 'Pendente';
  };

  const classeSituacaoVisualizacao = (situacao) => {
    if (situacao === 'lido') return styles.messageViewBadgeRead;
    if (situacao === 'recebido') return styles.messageViewBadgeReceived;
    return styles.messageViewBadgePending;
  };

  const descricaoSituacaoVisualizacao = (item) => {
    if (item.lido_em) {
      return `Leu em ${formatarDataHoraVisualizacao(item.lido_em)}`;
    }

    if (item.recebido_em) {
      return `Recebeu em ${formatarDataHoraVisualizacao(item.recebido_em)}`;
    }

    return 'Ainda não recebeu';
  };

  const obterPreviaMensagem = (msg) => {
    if (!msg) return '';
    if (msg.tipo_mensagem === 'imagem') return '[Imagem]';
    if (msg.tipo_mensagem === 'audio') return '[Áudio]';
    if (msg.tipo_mensagem === 'arquivo') return '[Arquivo]';
    if (msg.tipo_mensagem === 'sticker') return 'Figurinha';
    return removerFormatacaoMensagem(msg.mensagem);
  };

  const obterAutorMensagem = (remetenteId, remetenteNome) => (
    Number(remetenteId) === Number(usuario_atual.id)
      ? 'Você'
      : remetenteNome || 'Mensagem'
  );

  const renderReacoesMensagem = (msg) => {
    if (!Array.isArray(msg?.reacoes) || msg.reacoes.length === 0) return null;

    return (
      <div className={styles.messageReactions}>
        {msg.reacoes.map((reaction) => (
          <button
            key={reaction.reaction}
            type="button"
            className={`${styles.messageReactionChip} ${
              reaction.reacted_by_me ? styles.messageReactionChipActive : ''
            }`}
            title={getReactionUsersTitle(reaction)}
            onClick={() => alternarReacaoMensagem(msg, reaction.reaction)}
            disabled={reacaoAtualizandoId === `${msg.id}-${reaction.reaction}`}
          >
            <span>{reaction.reaction}</span>
            <strong>{reaction.total}</strong>
          </button>
        ))}
      </div>
    );
  };

  const renderMensagemFixada = () => {
    if (!mensagemFixada) return null;

    return (
      <section className={styles.pinnedChatMessage}>
        <button
          type="button"
          className={styles.pinnedChatContent}
          onClick={() => abrirMensagemCompartilhada(mensagemFixada.message_id)}
          title="Ir para a mensagem fixada"
        >
          <span className={styles.pinnedGroupIcon}>📌</span>
          <span>
            <strong>Mensagem fixada</strong>
            <small>
              {obterAutorMensagem(mensagemFixada.remetente_id, mensagemFixada.remetente_nome)}
              {' · '}
              {removerFormatacaoMensagem(mensagemFixada.previa) || mensagemFixada.anexo_nome || 'Mensagem'}
            </small>
          </span>
        </button>
        <button
          type="button"
          className={styles.pinnedChatRemove}
          onClick={removerMensagemFixada}
          disabled={Number(fixandoMensagemId) === Number(mensagemFixada.message_id)}
        >
          Remover
        </button>
      </section>
    );
  };

  const renderResumoResposta = (msg) => {
    if (!msg?.resposta_mensagem_id) return null;

    const respostaEhSticker = msg.resposta_tipo_mensagem === 'sticker' && msg.resposta_mensagem;

    return (
      <button
        type="button"
        className={styles.messageReplyPreview}
        title="Ir para a mensagem respondida"
        onClick={() => abrirMensagemCompartilhada(msg.resposta_mensagem_id)}
      >
        <strong>{obterAutorMensagem(msg.resposta_remetente_id, msg.resposta_remetente_nome)}</strong>
        <span className={styles.messageReplyPreviewBody}>
          {respostaEhSticker && (
            <img
              className={styles.replyStickerThumb}
              src={msg.resposta_mensagem}
              alt="Figurinha respondida"
            />
          )}
          <span>
            {removerFormatacaoMensagem(msg.resposta_previa)
              || msg.resposta_anexo_nome
              || 'Mensagem'}
          </span>
        </span>
      </button>
    );
  };

  const renderRespostaSelecionada = () => {
    if (!mensagemRespondendo) return null;
    const respondendoSticker = mensagemRespondendo.tipo_mensagem === 'sticker';

    return (
      <div className={styles.replyComposerPreview}>
        {respondendoSticker && mensagemRespondendo.mensagem && (
          <img
            className={styles.replyStickerThumb}
            src={mensagemRespondendo.mensagem}
            alt="Figurinha selecionada"
          />
        )}
        <div className={styles.replyComposerText}>
          <strong>
            Respondendo {obterAutorMensagem(
              mensagemRespondendo.remetente_id,
              obterDadosRemetenteMensagem(mensagemRespondendo).nome
            )}
          </strong>
          <span>{obterPreviaMensagem(mensagemRespondendo)}</span>
        </div>
        <button
          type="button"
          className={styles.replyCancelButton}
          title="Cancelar resposta"
          onClick={() => setMensagemRespondendo(null)}
        >
          ×
        </button>
      </div>
    );
  };

  const renderTextoComMencoes = (texto = '') => (
    String(texto).split(/(@[a-z0-9]+)/gi).map((parte, index) => {
      if (!/^@[a-z0-9]+$/i.test(parte)) {
        return parte;
      }

      const handle = normalizarHandleUsuario(parte);
      const membro = membrosGrupo.find((item) => montarHandlesUsuario(item.nome).includes(handle));

      if (!membro) {
        return parte;
      }

      const mencionouUsuarioAtual = Number(membro.id) === Number(usuario_atual.id);

      return (
        <span
          key={`${parte}-${index}`}
          className={`${styles.mentionText} ${mencionouUsuarioAtual ? styles.mentionTextMe : ''}`}
          title={membro.nome}
        >
          {parte}
        </span>
      );
    })
  );

  const normalizarTexto = (valor = '') => (
    String(valor)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
  );

  const renderConteudoMensagem = (msg) => {
    if (msg.tipo_mensagem === 'sticker') {
      return (
        <div className={styles.stickerMessage}>
          <button
            type="button"
            className={styles.stickerMessageButton}
            title="Abrir figurinha"
            onClick={() => abrirVisualizadorImagem({
              ...msg,
              anexo_nome: msg.anexo_nome || 'Figurinha',
            })}
          >
            <img
              className={styles.stickerMessageImage}
              src={msg.mensagem}
              alt="Figurinha enviada"
              loading="lazy"
            />
          </button>
        </div>
      );
    }

    if (msg.tipo_mensagem === 'imagem') {
      return (
        <div className={styles.imageMessage}>
          <button
            type="button"
            className={styles.imagePreviewButton}
            title="Abrir imagem"
            onClick={() => abrirVisualizadorImagem(msg)}
          >
            <img src={msg.mensagem} alt="Imagem enviada" />
          </button>
        </div>
      );
    }

    if (msg.tipo_mensagem === 'audio') {
      return (
        <div className={styles.audioMessage}>
          <audio controls src={msg.mensagem} preload="metadata">
            Seu navegador não suporta áudio.
          </audio>
        </div>
      );
    }

    if (msg.tipo_mensagem === 'arquivo') {
      return (
        <a
          className={styles.documentMessage}
          href={msg.mensagem}
          download={msg.anexo_nome || 'arquivo'}
          target="_blank"
          rel="noreferrer"
        >
          <span className={styles.documentIcon}>
            {isZipFileMessage(msg) ? '🗜️' : '📄'}
          </span>
          <span>
            <strong>{msg.anexo_nome || 'Arquivo anexado'}</strong>
            <small>{isZipFileMessage(msg) ? 'Arquivo ZIP - clique para baixar' : 'Clique para baixar'}</small>
          </span>
        </a>
      );
    }

    return (
      <div>
        <LinkifiedText
          text={msg.mensagem}
          linkClassName={styles.messageLink}
          renderTextSegment={renderTextoComMencoes}
        />
      </div>
    );
  };

  const renderMensagemEditada = (msg) => {
    if (!msg.editada_em) return null;
    return <span className={styles.messageEdited}>Editado</span>;
  };

  const obterDadosRemetenteMensagem = (msg) => {
    const remetenteId = Number(msg?.remetente_id);
    const mensagemDoUsuarioAtual = remetenteId === Number(usuario_atual.id);
    const membroGrupo = membrosGrupo.find((membro) => Number(membro.id) === remetenteId);

    return {
      nome: msg?.remetente_nome || membroGrupo?.nome || usuario_atual.nome || 'Usuário',
      avatar: msg?.remetente_avatar || membroGrupo?.avatar || (
        mensagemDoUsuarioAtual ? usuario_atual.avatar : ''
      ),
    };
  };

  const renderAvatarMensagemGrupo = (msg) => {
    const remetente = obterDadosRemetenteMensagem(msg);
    const inicial = remetente.nome?.charAt(0)?.toUpperCase() || '?';

    return (
      <div
        style={{
          width: '30px',
          height: '30px',
          minWidth: '30px',
          borderRadius: '50%',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #0ea5e9, #1d4ed8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#eaf7ff',
          fontSize: '12px',
          fontWeight: 800,
          boxShadow: '0 0 0 2px rgba(15, 23, 42, 0.92)',
          marginBottom: '2px',
        }}
        title={remetente.nome}
      >
        {remetente.avatar ? (
          <img
            src={remetente.avatar}
            alt={remetente.nome || 'Avatar'}
            className={styles.avatarImage}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <span>{inicial}</span>
        )}
      </div>
    );
  };

  const mensagensFiltradas = pesquisa.trim()
    ? mensagens.filter((msg) => {
        const termo = normalizarTexto(pesquisa);
        const texto = `${msg.mensagem || ''} ${msg.anexo_nome || ''} ${msg.remetente_nome || ''}`;

        return normalizarTexto(texto).includes(termo) ||
          (msg.tipo_mensagem === 'imagem' && 'imagem'.includes(termo)) ||
          (msg.tipo_mensagem === 'audio' && 'audio áudio'.includes(termo)) ||
          (msg.tipo_mensagem === 'sticker' && 'figurinha sticker stickers'.includes(termo)) ||
          (msg.tipo_mensagem === 'arquivo' && SEARCH_FILE_TERMS.includes(termo));
      })
    : mensagens;

  const renderDivisorData = (msg, index) => {
    if (efeitoAparencia.showDateSeparator === false) return null;

    const chaveAtual = obterChaveDataMensagem(msg?.criada_em);
    const chaveAnterior = obterChaveDataMensagem(mensagensFiltradas[index - 1]?.criada_em);

    if (!chaveAtual || chaveAtual === chaveAnterior) return null;

    const rotulo = formatarDivisorDataMensagem(msg.criada_em);
    if (!rotulo) return null;

    return (
      <div className={styles.messageDateDivider} role="separator" aria-label={`Mensagens de ${rotulo}`}>
        <span>{rotulo}</span>
      </div>
    );
  };

  useEffect(() => {
    if (buscaAtiva) {
      searchInputRef.current?.focus();
    }
  }, [buscaAtiva]);

  const grupoNocAberto = normalizarNomeGrupo(grupoInfo?.nome) === 'noc';
  const temMensagemFixada = Boolean(
    grupoInfo?.mensagem_fixada_ativo && grupoInfo?.mensagem_fixada_conteudo
  );

  if (carregando) {
    return (
      <div className={styles.emptyChat}>
        <p>Carregando mensagens...</p>
      </div>
    );
  }

  if (erroCarregamento && mensagens.length === 0) {
    return (
      <div className={styles.emptyChat}>
        <p>{erroCarregamento}</p>
        <button
          type="button"
          className={styles.retryButton}
          onClick={() => carregarMensagens({ mostrarLoading: true })}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className={styles.chatConversationDropArea} style={estiloAparencia} {...dropHandlers}>
      {isDraggingFiles && (
        <div className={styles.chatDropOverlay} aria-hidden="true">
          <div className={styles.chatDropCard}>
            <span className={styles.chatDropIcon}>⇧</span>
            <strong>Solte o arquivo para anexar</strong>
            <p>Qualquer tipo de arquivo até {MAX_UPLOAD_SIZE_LABEL}.</p>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className={styles.chatHeader}>
        <div className={styles.chatHeaderLeft}>
          {onVoltarMobile && (
            <button
              type="button"
              className={styles.mobileBackButton}
              title="Voltar para a lista de conversas"
              aria-label="Voltar para a lista de conversas"
              onClick={onVoltarMobile}
            >
              ←
            </button>
          )}
          <div className={`${styles.conversaAvatar} ${styles.grupo}`}>
            👥
          </div>
          <div className={styles.chatHeaderInfo}>
            <p className={styles.chatHeaderTitle}>{grupoInfo?.nome}</p>
            <p className={styles.chatHeaderStatus}>
              {grupoInfo?.total_membros} membros
            </p>
          </div>
        </div>
        <div className={styles.chatHeaderActions}>
          {buscaAtiva ? (
            <div className={styles.searchBox} style={{ width: '100%', maxWidth: '360px' }}>
              <span>🔍</span>
              <input
                ref={searchInputRef}
                type="text"
                className={styles.searchInput}
                placeholder="Buscar mensagens..."
                value={pesquisa}
                onChange={(event) => setPesquisa(event.target.value)}
              />
              <button
                className={styles.iconButton}
                title="Fechar busca"
                onClick={() => {
                  setBuscaAtiva(false);
                  setPesquisa('');
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              className={styles.iconButton}
              title="Pesquisar no grupo"
              onClick={() => setBuscaAtiva(true)}
            >
              🔍
            </button>
          )}
          <button
            className={styles.iconButton}
            title="Informações do grupo"
            onClick={abrirMembrosGrupo}
          >
            ⓘ
          </button>
          <div className={styles.headerMenuWrapper}>
            <button
              type="button"
              className={styles.headerMenuButton}
              title="Opções do grupo"
              aria-label="Opções do grupo"
              onClick={() => setMenuConversaAberto((atual) => !atual)}
            >
              ▾
            </button>
            {menuConversaAberto && (
              <div className={styles.headerMoreMenu}>
                <button
                  type="button"
                  className={styles.moreMenuItem}
                  onClick={abrirFavoritos}
                >
                  Ver favoritos
                </button>
                <button
                  type="button"
                  className={styles.moreMenuItem}
                  onClick={() => {
                    setMenuConversaAberto(false);
                    setApariciaAberta(true);
                  }}
                >
                  🎨 Personalizar esta conversa
                </button>
                <button
                  type="button"
                  className={styles.moreMenuItem}
                  onClick={limparConversa}
                >
                  Apagar conversa para mim
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.chatViewTabs}>
        <button
          type="button"
          className={`${styles.chatViewTab} ${
            abaChatAtiva === 'mensagens' ? styles.chatViewTabActive : ''
          }`}
          onClick={() => setAbaChatAtiva('mensagens')}
        >
          Mensagens
        </button>
        <button
          type="button"
          className={`${styles.chatViewTab} ${
            abaChatAtiva === 'arquivos' ? styles.chatViewTabActive : ''
          }`}
          onClick={() => setAbaChatAtiva('arquivos')}
        >
          Arquivos compartilhados
        </button>
      </div>

      {abaChatAtiva === 'mensagens' && temMensagemFixada && (
        <section className={styles.pinnedGroupMessage}>
          <div className={styles.pinnedGroupIcon}>📌</div>
          <div>
            <strong>{grupoInfo.mensagem_fixada_titulo || 'Mensagem fixada'}</strong>
            <p>{grupoInfo.mensagem_fixada_conteudo}</p>
          </div>
        </section>
      )}

      {favoritosModalAberto && (
        <MessageFavoritesModal
          favorites={favoritosMensagens}
          loading={carregandoFavoritos}
          error={erroFavoritos}
          removingId={favoritoAtualizandoId}
          onClose={() => setFavoritosModalAberto(false)}
          onOpenFavorite={abrirMensagemFavorita}
          onRemoveFavorite={removerFavoritoPeloModal}
        />
      )}

      {favoritoFeedback && (
        <div className={styles.messageFavoriteToast}>
          {favoritoFeedback}
        </div>
      )}

      {modalMembrosAberto && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-label={`Membros do grupo ${grupoInfo?.nome || ''}`}
          onClick={() => setModalMembrosAberto(false)}
        >
          <div
            className={styles.groupMembersModal}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.profileHeader}>
              <div>
                <h2>Membros do grupo</h2>
                <p>{grupoInfo?.nome} · {membrosGrupo.length || grupoInfo?.total_membros || 0} membros</p>
              </div>
              <button
                type="button"
                className={styles.iconButton}
                title="Fechar"
                onClick={() => setModalMembrosAberto(false)}
              >
                ×
              </button>
            </div>

            <div className={styles.groupMembersList}>
              {carregandoMembros ? (
                <div className={styles.emptyList}>
                  <p>Carregando membros...</p>
                </div>
              ) : erroMembros ? (
                <div className={styles.emptyList}>
                  <p>{erroMembros}</p>
                </div>
              ) : membrosGrupo.length === 0 ? (
                <div className={styles.emptyList}>
                  <p>Nenhum membro encontrado.</p>
                </div>
              ) : (
                membrosGrupo.map((membro) => (
                  <div key={membro.id} className={styles.groupMemberItem}>
                    <div className={styles.conversaAvatar}>
                      {membro.avatar ? (
                        <img
                          src={membro.avatar}
                          alt={membro.nome || 'Avatar'}
                          className={styles.avatarImage}
                        />
                      ) : (
                        <span>{membro.nome?.charAt(0)?.toUpperCase()}</span>
                      )}
                      <span className={`${styles.statusIndicator} ${statusClasse(membro.status)}`} />
                    </div>
                    <div className={styles.groupMemberInfo}>
                      <strong>{membro.nome}</strong>
                      {renderResumoGruposMembro(membro)}
                    </div>
                    <span className={styles.groupMemberStatus}>
                      {statusTexto(membro.status)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {visualizacoesMensagem && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Visualizações da mensagem"
          onClick={fecharVisualizacoesMensagem}
        >
          <div
            className={styles.groupMembersModal}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.profileHeader}>
              <div>
                <h2>Visualizações</h2>
                <p>{obterPreviaMensagem(visualizacoesMensagem)}</p>
              </div>
              <button
                type="button"
                className={styles.iconButton}
                title="Fechar"
                onClick={fecharVisualizacoesMensagem}
              >
                ×
              </button>
            </div>

            {visualizacoesDados?.totais && (
              <div className={styles.messageViewsSummary}>
                <div className={styles.messageViewsSummaryItem}>
                  <strong>{visualizacoesDados.totais.recebidos}</strong>
                  <span>Receberam</span>
                </div>
                <div className={styles.messageViewsSummaryItem}>
                  <strong>{visualizacoesDados.totais.lidos}</strong>
                  <span>Leram</span>
                </div>
                <div className={styles.messageViewsSummaryItem}>
                  <strong>{visualizacoesDados.totais.pendentes}</strong>
                  <span>Pendentes</span>
                </div>
              </div>
            )}

            <div className={styles.groupMembersList}>
              {carregandoVisualizacoes ? (
                <div className={styles.emptyList}>
                  <p>Carregando visualizações...</p>
                </div>
              ) : erroVisualizacoes ? (
                <div className={styles.emptyList}>
                  <p>{erroVisualizacoes}</p>
                </div>
              ) : !visualizacoesDados?.visualizacoes?.length ? (
                <div className={styles.emptyList}>
                  <p>Nenhuma visualização encontrada.</p>
                </div>
              ) : (
                visualizacoesDados.visualizacoes.map((item) => (
                  <div key={item.id} className={styles.groupMemberItem}>
                    <div className={styles.conversaAvatar}>
                      {item.avatar ? (
                        <img
                          src={item.avatar}
                          alt={item.nome || 'Avatar'}
                          className={styles.avatarImage}
                        />
                      ) : (
                        <span>{item.nome?.charAt(0)?.toUpperCase()}</span>
                      )}
                      <span className={`${styles.statusIndicator} ${statusClasse(item.status)}`} />
                    </div>
                    <div className={styles.groupMemberInfo}>
                      <strong>
                        {item.nome}
                        {item.autor ? ' · autor' : ''}
                      </strong>
                      <span>{descricaoSituacaoVisualizacao(item)}</span>
                    </div>
                    <span className={`${styles.messageViewBadge} ${classeSituacaoVisualizacao(item.situacao)}`}>
                      {textoSituacaoVisualizacao(item.situacao)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {abaChatAtiva === 'mensagens' && grupoNocAberto && <NocDashboardResumo />}

      {imagemPreview && (
        <ImageViewerModal
          imageUrl={imagemPreview.url || imagemPreview}
          currentImageId={imagemPreview.id || null}
          caption={imagemPreview.caption || ''}
          images={viewerImages}
          onNavigateImage={setImagemPreview}
          onClose={() => setImagemPreview(null)}
        />
      )}

      {pendingImageAttachments.length > 0 && (
        <ImageSendPreviewModal
          attachments={pendingImageAttachments}
          selectedAttachmentId={selectedPendingImageId}
          caption={novaMsg}
          onCaptionChange={setNovaMsg}
          onSelectAttachment={setSelectedPendingImageId}
          onRemoveAttachment={removerAnexoPendente}
          onAddAttachments={(files) => adicionarAnexosPendentes(files, 'auto')}
          onReplaceAttachment={substituirAnexoPendente}
          onCancel={cancelarEnvioImagens}
          onSend={enviarMensagem}
          isSending={enviandoMensagem}
        />
      )}

      {abaChatAtiva === 'arquivos' ? (
        <SharedFilesPanel
          mensagens={mensagens}
          onPreviewImage={setImagemPreview}
          onJumpToMessage={abrirMensagemCompartilhada}
        />
      ) : (
        <>
      {/* MENSAGENS */}
      {erroCarregamento && (
        <div className={styles.errorBanner}>
          {erroCarregamento}
          <button
            type="button"
            className={styles.inlineRetryButton}
            onClick={() => carregarMensagens({ mostrarLoading: false })}
          >
            Tentar novamente
          </button>
        </div>
      )}
      {renderMensagemFixada()}
      <div className={styles.messagesWrapper}>
        <div className={styles.chatWallpaperLayer} aria-hidden="true" />
        <div className={styles.messagesContainer} ref={messagesContainerRef}>
        {mensagensFiltradas.length === 0 ? (
          <div className={styles.emptyChat}>
            <p>Nenhuma mensagem encontrada</p>
            <p>Tente buscar por texto ou remetente</p>
          </div>
        ) : (
          mensagensFiltradas.map((msg, idx) => {
            const mensagemDoUsuarioAtual = Number(msg.remetente_id) === Number(usuario_atual.id);

            return (
              <Fragment key={msg.id || idx}>
                {renderDivisorData(msg, idx)}
                <div
                  ref={(element) => registrarMensagemRef(msg.id, element)}
                  className={
                    mensagemDoUsuarioAtual
                      ? styles.messageSent
                      : styles.messageReceived
                  }
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-end',
                      gap: '8px',
                      maxWidth: '78%',
                      alignSelf: mensagemDoUsuarioAtual ? 'flex-end' : 'flex-start',
                      flexDirection: mensagemDoUsuarioAtual ? 'row-reverse' : 'row',
                    }}
                  >
                    {efeitoAparencia.showAvatar !== false && renderAvatarMensagemGrupo(msg)}

                    <div className={styles.messageGroup}>
                      {!mensagemDoUsuarioAtual && (
                        <p className={styles.messageSenderName}>
                          {obterDadosRemetenteMensagem(msg).nome}
                        </p>
                      )}

                      <div
                        className={`${styles.messageBubble} ${
                          mensagemDoUsuarioAtual
                            ? styles.sent
                            : styles.received
                        } ${msg.tipo_mensagem === 'sticker' ? styles.messageBubbleSticker : ''} ${
                          msg.__newMessage ? styles.newMessage : ''
                        } ${
                          msg.__mentionedMe ? styles.mentionedMe : ''
                        }`}
                      >
                        {renderResumoResposta(msg)}
                        {renderConteudoMensagem(msg)}
                        {renderReacoesMensagem(msg)}
                        <div className={styles.messageFooter}>
                          {efeitoAparencia.showTimestamp !== false && (
                            <span className={styles.messageTime}>
                              {formatarHora(msg.criada_em)}
                            </span>
                          )}
                          {Boolean(msg.favoritada) && (
                            <span className={styles.messageFavoriteIndicator} title="Mensagem favoritada">
                              ★
                            </span>
                          )}
                          {renderMensagemEditada(msg)}
                          {!mensagemEditando && (
                            <div className={styles.menuWrapper}>
                              <button
                                type="button"
                                className={`${styles.moreMenuButton} ${
                                  menuMensagemAbertoId === msg.id ? styles.moreMenuButtonOpen : ''
                                }`}
                                onClick={() => toggleMenuMensagem(msg.id)}
                                title="Mais opções"
                                aria-label="Abrir opções da mensagem"
                              >
                                ▾
                              </button>
                              {menuMensagemAbertoId === msg.id && (
                                <div className={styles.moreMenu}>
                                  <button
                                    type="button"
                                    className={styles.moreMenuItem}
                                    onClick={() => responderMensagem(msg)}
                                  >
                                    Responder
                                  </button>
                                  <div className={styles.reactionMenuRow} aria-label="Reações rápidas">
                                    {MESSAGE_REACTION_OPTIONS.map((reaction) => (
                                      <button
                                        key={reaction}
                                        type="button"
                                        className={styles.reactionMenuButton}
                                        title={`Reagir com ${reaction}`}
                                        onClick={() => alternarReacaoMensagem(msg, reaction)}
                                        disabled={reacaoAtualizandoId === `${msg.id}-${reaction}`}
                                      >
                                        {reaction}
                                      </button>
                                    ))}
                                  </div>
                                  {msg.tipo_mensagem === 'sticker' && (
                                    <>
                                      <button
                                        type="button"
                                        className={styles.moreMenuItem}
                                        onClick={() => adicionarStickerMensagemBiblioteca(msg)}
                                      >
                                        Adicionar às minhas figurinhas
                                      </button>
                                      <button
                                        type="button"
                                        className={styles.moreMenuItem}
                                        onClick={() => favoritarStickerMensagem(msg)}
                                      >
                                        Favoritar figurinha
                                      </button>
                                    </>
                                  )}
                                  {msg.tipo_mensagem === 'texto' && removerFormatacaoMensagem(msg.mensagem || '').trim() && (
                                    <button
                                      type="button"
                                      className={styles.moreMenuItem}
                                      onClick={() => copiarTextoMensagem(msg)}
                                    >
                                      Copiar texto
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className={styles.moreMenuItem}
                                    onClick={() => fixarMensagem(msg)}
                                    disabled={Number(fixandoMensagemId) === Number(msg.id)}
                                  >
                                    {Number(mensagemFixada?.message_id) === Number(msg.id)
                                      ? 'Atualizar fixação'
                                      : 'Fixar no topo'}
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.moreMenuItem}
                                    onClick={() => abrirVisualizacoesMensagem(msg)}
                                  >
                                    Visualizações
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.moreMenuItem}
                                    onClick={() => alternarFavoritoMensagem(msg)}
                                    disabled={Number(favoritoAtualizandoId) === Number(msg.id)}
                                  >
                                    {msg.favoritada ? '★ Remover dos favoritos' : '☆ Favoritar mensagem'}
                                  </button>
                                  {mensagemTemDownload(msg) && (
                                    <button
                                      type="button"
                                      className={styles.moreMenuItem}
                                      onClick={() => salvarMensagemNoComputador(msg)}
                                    >
                                      Salvar no computador
                                    </button>
                                  )}
                                  {podeExibirEditarMensagem(msg) && (
                                    <button
                                      type="button"
                                      className={styles.moreMenuItem}
                                      onClick={() => iniciarEdicaoMensagem(msg)}
                                      disabled={!podeEditarMensagem(msg)}
                                    >
                                      {podeEditarMensagem(msg) ? 'Editar' : 'Editar indisponível'}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className={styles.moreMenuItem}
                                    onClick={() => apagarMensagem(msg, 'mim')}
                                  >
                                    Apagar para mim
                                  </button>
                                  {podeExibirApagarParaTodos(msg) && (
                                    <button
                                      type="button"
                                      className={styles.moreMenuItem}
                                      onClick={() => apagarMensagem(msg, 'todos')}
                                    >
                                      Apagar para todos
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Fragment>
            );
          })
        )}

        {usuarios_digitando.size > 0 && (
          <div className={styles.messageReceived}>
            <div className={styles.typingIndicator}>
              <span>
                {Array.from(usuarios_digitando).join(', ')}{' '}
                {usuarios_digitando.size > 1
                  ? 'estão digitando'
                  : 'está digitando'}
              </span>
              <div className={styles.typingDot} />
              <div className={styles.typingDot} />
              <div className={styles.typingDot} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* INPUT */}
      <div className={styles.inputArea}>
        {newMessagesNotice && (
          <button
            type="button"
            className={`${styles.newMessagesJump} ${
              newMessagesNotice.mentioned ? styles.newMessagesJumpMention : ''
            }`}
            onClick={abrirAvisoNovaMensagem}
          >
            {newMessagesNotice.mentioned ? 'Você foi mencionado' : 'Novas mensagens'}
          </button>
        )}
        {renderRespostaSelecionada()}
        <PendingAttachmentsPreview
          attachments={pendingNonImageAttachments}
          sending={enviandoMensagem}
          onRemove={removerAnexoPendente}
        />
        {sugestoesMencao.length > 0 && (
          <div className={styles.mentionSuggestions}>
            {sugestoesMencao.map((membro, index) => (
              <button
                key={membro.id}
                type="button"
                className={`${styles.mentionSuggestionItem} ${
                  index === indiceMencao ? styles.mentionSuggestionActive : ''
                }`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  inserirMencao(membro);
                }}
              >
                <span className={styles.mentionSuggestionAvatar}>
                  {membro.avatar ? (
                    <img src={membro.avatar} alt={membro.nome || 'Avatar'} />
                  ) : (
                    membro.nome?.charAt(0)?.toUpperCase()
                  )}
                </span>
                <span className={styles.mentionSuggestionInfo}>
                  <strong>{membro.nome}</strong>
                  <span>@{membro.handle}</span>
                </span>
              </button>
            ))}
          </div>
        )}
        <MessageFormattingToolbar inputRef={messageInputRef} />
        <div className={styles.inputWrapper}>
          <button
            type="button"
            className={styles.attachMenuToggle}
            title="Mais opções de envio"
            aria-label="Mais opções de envio"
            onClick={() => setMenuAnexosMobileAberto((atual) => !atual)}
          >
            +
          </button>
          <div
            className={`${styles.attachMenuGroup} ${
              menuAnexosMobileAberto ? styles.attachMenuGroupOpen : ''
            }`}
          >
            <EmojiPickerButton onEmojiSelect={inserirEmoji} />
            <StickerPickerButton
              token={token}
              onStickerSend={enviarSticker}
              disabled={Boolean(mensagemEditando) || enviandoMensagem || !grupo_id}
            />
            <button
              className={styles.attachButton}
              title="Anexar arquivo"
              onClick={abrirSeletorArquivo}
              disabled={Boolean(mensagemEditando) || enviandoMensagem}
            >
              📎
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept={ATTACHMENT_ACCEPT}
              multiple
              className={styles.hiddenFileInput}
              onChange={enviarArquivo}
              disabled={Boolean(mensagemEditando) || enviandoMensagem}
            />
            <button
              className={styles.attachButton}
              title="Anexar áudio"
              onClick={abrirSeletorAudio}
              disabled={Boolean(mensagemEditando) || enviandoMensagem}
            >
              🎵
            </button>
            <input
              ref={audioInputRef}
              type="file"
              accept={AUDIO_ACCEPT}
              multiple
              className={styles.hiddenFileInput}
              onChange={enviarAudio}
              disabled={Boolean(mensagemEditando) || enviandoMensagem}
            />
          </div>
          <RichMessageEditor
            ref={messageInputRef}
            className={styles.messageInput}
            placeholder={mensagemEditando ? 'Editando mensagem...' : 'Mensagem...'}
            value={novaMsg}
            onChange={handleDigitar}
            onPasteFiles={adicionarAnexosPendentes}
            onKeyDown={(e) => {
              if (sugestoesMencao.length > 0) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setIndiceMencao((atual) => (atual + 1) % sugestoesMencao.length);
                  return;
                }

                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setIndiceMencao((atual) => (
                    atual === 0 ? sugestoesMencao.length - 1 : atual - 1
                  ));
                  return;
                }

                if (e.key === 'Enter' || e.key === 'Tab') {
                  e.preventDefault();
                  inserirMencao(sugestoesMencao[indiceMencao] || sugestoesMencao[0]);
                  return;
                }

                if (e.key === 'Escape') {
                  setTermoMencao(null);
                  return;
                }
              }

              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (pendingAttachments.length === 0) {
                  enviarMensagem();
                }
              }
            }}
          />
        </div>
        {mensagemEditando && (
          <button
            type="button"
            className={styles.cancelButton}
            onClick={cancelarEdicaoMensagem}
          >
            Cancelar
          </button>
        )}
        <button
          className={styles.sendButton}
          onClick={enviarMensagem}
          disabled={enviandoMensagem || (!novaMsg.trim() && pendingAttachments.length === 0)}
        >
          {enviandoMensagem ? '...' : '➤'}
        </button>
      </div>
        </>
      )}
      <ChatAppearanceModal
        open={apariciaAberta}
        onClose={() => setApariciaAberta(false)}
        token={token}
        conversationContext={grupo_id ? { tipo: 'grupo', referenciaId: grupo_id, label: grupoInfo?.nome } : null}
        onSaved={({ scope, preferences }) => {
          if (scope === 'conversation') {
            setConversationAppearance(preferences);
          } else {
            onGlobalAppearanceSaved?.(preferences);
          }
        }}
      />
    </div>
  );
}
