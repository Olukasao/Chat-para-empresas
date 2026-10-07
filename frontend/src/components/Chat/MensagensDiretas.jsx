import { Fragment, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import api from '../../services/api';
import styles from '../../styles/Chat.module.css';
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
const SYNC_CONVERSA_ATIVA_DEBOUNCE_MS = 180;
const SYNC_CONVERSA_ATIVA_MIN_INTERVAL_MS = 1200;
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

const obterPreviewNotificacaoDireta = (item = {}) => {
  if (item.preview) return item.preview;
  if (item.tipo_mensagem === 'imagem') return '[Imagem]';
  if (item.tipo_mensagem === 'audio') return '[Áudio]';
  if (item.tipo_mensagem === 'arquivo') return '[Arquivo]';
  if (item.tipo_mensagem === 'sticker') return 'Figurinha';
  return 'Nova mensagem';
};

const normalizarMensagemSocketDireta = (item = {}, options = {}) => {
  const { usarPreviewComoConteudo = false } = options;
  const temMensagemCompleta = item.mensagem !== undefined && item.mensagem !== null && item.mensagem !== '';

  if (temMensagemCompleta || !usarPreviewComoConteudo) {
    return {
      ...item,
      reacoes: Array.isArray(item.reacoes) ? item.reacoes : [],
    };
  }

  return {
    ...item,
    mensagem: obterPreviewNotificacaoDireta(item),
    tipo_mensagem: 'texto',
    reacoes: Array.isArray(item.reacoes) ? item.reacoes : [],
    __previewOnly: true,
  };
};

const isZipFileMessage = (msg = {}) => {
  const mime = String(msg.anexo_mime || '').toLowerCase();
  const nome = String(msg.anexo_nome || '').toLowerCase();

  return mime.includes('zip') || nome.endsWith('.zip');
};

const isPendingImageAttachment = (attachment = {}) => (
  attachment.kind === 'imagem' && Boolean(attachment.previewUrl)
);

export default function MensagensDiretas({
  usuario_id,
  usuario_atual,
  socket,
  token,
  appearance = CHAT_APPEARANCE_DEFAULTS,
  onGlobalAppearanceSaved,
  usuarioInfoAtualizada = null,
  onClearConversation,
  onOpenFavoriteOrigin,
  onVoltarMobile,
  focusMessageId = null,
  onFocusMessageHandled,
}) {
  const usuarioAtualEhAdmin = usuario_atual?.perfil === PERFIL_ADMIN;
  const [conversationAppearance, setConversationAppearance] = useState(null);
  const [apariciaAberta, setApariciaAberta] = useState(false);
  const [mensagens, setMensagens] = useState([]);
  const [usuarioInfo, setUsuarioInfo] = useState(null);
  const [novaMsg, setNovaMsg] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState('');
  const [usuario_digitando, setUsuarioDigitando] = useState(null);
  const [pesquisa, setPesquisa] = useState('');
  const [buscaAtiva, setBuscaAtiva] = useState(false);
  const [mensagemEditando, setMensagemEditando] = useState(null);
  const [mensagemRespondendo, setMensagemRespondendo] = useState(null);
  const [menuMensagemAbertoId, setMenuMensagemAbertoId] = useState(null);
  const [menuConversaAberto, setMenuConversaAberto] = useState(false);
  const [fotoPerfilAberta, setFotoPerfilAberta] = useState(false);
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
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [selectedPendingImageId, setSelectedPendingImageId] = useState(null);
  const [newMessagesNotice, setNewMessagesNotice] = useState(null);
  const [menuAnexosMobileAberto, setMenuAnexosMobileAberto] = useState(false);
  const [enviandoMensagem, setEnviandoMensagem] = useState(false);
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messageRefs = useRef(new Map());
  const carregarMensagensRef = useRef(null);
  const syncConversationTimeoutRef = useRef(null);
  const syncConversationInFlightRef = useRef(false);
  const lastSyncConversationAtRef = useRef(0);
  const typingTimeoutRef = useRef(null);
  const imageInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const searchInputRef = useRef(null);
  const messageInputRef = useRef(null);
  const loadRequestIdRef = useRef(0);
  const favoritoFeedbackTimeoutRef = useRef(null);
  const pendingAttachmentsRef = useRef([]);
  const [conversa_id, setConversaId] = useState(null);

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
    if (!conversa_id || !token) {
      setConversationAppearance(null);
      return;
    }

    let cancelado = false;

    api.get(`/chat/appearance/conversations/direta/${conversa_id}`, {
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
  }, [conversa_id, token]);

  const efeitoAparencia = useMemo(
    () => mergeAppearance(appearance, conversationAppearance),
    [appearance, conversationAppearance],
  );
  const estiloAparencia = useMemo(
    () => buildChatAppearanceCssVars(efeitoAparencia),
    [efeitoAparencia],
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
    setNewMessagesNotice(null);
  }, [conversa_id]);

  const getStatusInfo = (status, ultimoAcesso) => {
    if (status === 'online') {
      return {
        label: 'Online',
        title: 'Online no chat',
        className: styles.online,
      };
    }

    if (status === 'away') {
      return {
        label: 'Ausente',
        title: 'Ausente no chat',
        className: styles.away,
      };
    }

    const dataUltimoAcesso = ultimoAcesso ? new Date(ultimoAcesso) : null;
    const ultimoAcessoValido =
      dataUltimoAcesso && !Number.isNaN(dataUltimoAcesso.getTime());
    const label = ultimoAcessoValido
      ? `Offline desde ${dataUltimoAcesso.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })}`
      : 'Offline';

    return {
      label,
      title: label,
      className: styles.offline,
    };
  };

  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments;
  }, [pendingAttachments]);

  useEffect(() => () => {
    revokePendingAttachmentPreviews(pendingAttachmentsRef.current);
  }, []);

  useEffect(() => {
    if (!usuarioInfoAtualizada) return;

    setUsuarioInfo((prev) => ({
      ...(prev || {}),
      ...usuarioInfoAtualizada,
    }));
  }, [usuarioInfoAtualizada]);

  useEffect(() => {
    setMensagemRespondendo(null);
    setMensagemFixada(null);
    setAbaChatAtiva('mensagens');
    limparAnexosPendentes();
    messageRefs.current.clear();
  }, [usuario_id]);

  const carregarMensagens = async ({ mostrarLoading = true } = {}) => {
    if (!usuario_id || !token) return;

    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    try {
      if (mostrarLoading) {
        setCarregando(true);
      }

      setErroCarregamento('');

      const headers = { Authorization: `Bearer ${token}` };
      const rotaMensagens = `/chat/conversa-direta/${usuario_id}`;
      console.count(`[CHAT_DEBUG] GET ${rotaMensagens}`);
      console.log('[CHAT_DEBUG] carregar mensagens diretas', {
        usuario_id,
        requestId,
        mostrarLoading,
      });

      const res = await api.get(rotaMensagens, {
        headers,
        params: { limit: 100 },
      });

      if (requestId !== loadRequestIdRef.current) return;

      setConversaId(res.data.conversa_id);
      setMensagens(normalizarMensagens(res.data.mensagens || []));
      setMensagemFixada(res.data.pinned_message || null);

      if (socket) {
        if (!socket.connected) {
          socket.connect();
        }

        socket.emit('join_direct_chat', { conversa_id: res.data.conversa_id });
        socket.emit('mark_conversa_read', {
          conversa_id: res.data.conversa_id,
          usuario_id: usuario_atual.id,
        });
      }

      const usuariosRes = await api.get('/chat/usuarios', { headers });

      if (requestId !== loadRequestIdRef.current) return;

      const usuario = usuariosRes.data.find((u) => Number(u.id) === Number(usuario_id));
      setUsuarioInfo(usuario);
    } catch (err) {
      if (requestId !== loadRequestIdRef.current) return;

      console.error('Erro ao carregar mensagens diretas:', err);
      setErroCarregamento(
        err.response?.data?.error ||
          'Não foi possível carregar esta conversa.'
      );
    } finally {
      console.log('[CHAT_DEBUG] finalizar mensagens diretas', {
        usuario_id,
        requestId,
        requestAtual: requestId === loadRequestIdRef.current,
      });

      if (requestId === loadRequestIdRef.current) {
        setCarregando(false);
      }
    }
  };

  useEffect(() => {
    carregarMensagensRef.current = carregarMensagens;
  });

  const sincronizarConversaAtual = useCallback(({ force = false } = {}) => {
    if (!usuario_id || !token) return;
    if (syncConversationInFlightRef.current) return;

    const agora = Date.now();
    if (!force && agora - lastSyncConversationAtRef.current < SYNC_CONVERSA_ATIVA_MIN_INTERVAL_MS) {
      return;
    }

    lastSyncConversationAtRef.current = agora;
    syncConversationInFlightRef.current = true;

    Promise.resolve(carregarMensagensRef.current?.({ mostrarLoading: false }))
      .finally(() => {
        syncConversationInFlightRef.current = false;
      });
  }, [token, usuario_id]);

  const agendarSincronizacaoConversaAtual = useCallback((options = {}) => {
    window.clearTimeout(syncConversationTimeoutRef.current);
    syncConversationTimeoutRef.current = window.setTimeout(() => {
      sincronizarConversaAtual(options);
    }, SYNC_CONVERSA_ATIVA_DEBOUNCE_MS);
  }, [sincronizarConversaAtual]);

  // CARREGAR MENSAGENS
  useEffect(() => {
    if (usuario_id) {
      carregarMensagens({ mostrarLoading: true });
    }
    // A conversa aberta deve buscar mensagens só quando o ID da conversa mudar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario_id]);

  useEffect(() => () => {
    window.clearTimeout(favoritoFeedbackTimeoutRef.current);
  }, []);

  useEffect(() => () => {
    window.clearTimeout(syncConversationTimeoutRef.current);
  }, []);

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
  }, [carregando, usuario_id, conversa_id, mensagens.length]);

  useEffect(() => {
    if (!socket || !conversa_id) return undefined;

    return () => {
      socket.emit('leave_direct_chat', { conversa_id });
    };
  }, [socket, conversa_id]);

  // LISTENERS DO SOCKET
  useEffect(() => {
    if (!socket) return;

    const mensagemPertenceConversaAtual = (data) => {
      const mensagemConversaId = Number(data?.conversa_id);
      const conversaAtualId = Number(conversa_id);
      const remetenteId = Number(data?.remetente_id);
      const destinatarioId = Number(data?.usuario_id);
      const usuarioAtualId = Number(usuario_atual.id);
      const contatoAtualId = Number(usuario_id);
      const mesmaConversa = conversaAtualId && mensagemConversaId === conversaAtualId;
      const envolveUsuarios =
        (remetenteId === usuarioAtualId && destinatarioId === contatoAtualId) ||
        (remetenteId === contatoAtualId && destinatarioId === usuarioAtualId);

      return Boolean(mesmaConversa && envolveUsuarios);
    };

    const adicionarMensagemSeNova = (data) => {
      const mensagemNormalizada = normalizarMensagemSocketDireta(data);

      setMensagens((prev) => {
        if (data?.id) {
          const indiceExistente = prev.findIndex((msg) => Number(msg.id) === Number(data.id));

          if (indiceExistente >= 0) {
            const mensagemExistente = prev[indiceExistente];

            if (mensagemExistente.__previewOnly && !mensagemNormalizada.__previewOnly) {
              const atualizadas = [...prev];
              atualizadas[indiceExistente] = {
                ...mensagemExistente,
                ...mensagemNormalizada,
                __newMessage: mensagemExistente.__newMessage || mensagemNormalizada.__newMessage,
                __previewOnly: false,
              };

              return normalizarMensagens(atualizadas);
            }

            return prev;
          }
        }

        return normalizarMensagens([...prev, mensagemNormalizada]);
      });
    };

    const processarMensagemDireta = (data, options = {}) => {
      const { usarPreviewComoConteudo = false, recarregarSeIncompleta = false } = options;
      if (!mensagemPertenceConversaAtual(data)) return;

      const mensagemRecebida = Number(data.remetente_id) !== Number(usuario_atual.id);
      const mensagemNormalizada = normalizarMensagemSocketDireta(data, { usarPreviewComoConteudo });

      adicionarMensagemSeNova(mensagemRecebida ? { ...mensagemNormalizada, __newMessage: true } : mensagemNormalizada);

      if (recarregarSeIncompleta) {
        carregarMensagensRef.current?.({ mostrarLoading: false });
      }

      if (mensagemRecebida) {
        setNewMessagesNotice({
          messageId: data.id,
          mentioned: false,
        });
      }

      if (mensagemRecebida && data.conversa_id) {
        socket.emit('mark_conversa_read', {
          conversa_id: data.conversa_id,
          usuario_id: usuario_atual.id,
        });
      }
    };

    const handleNovaMsg = (data) => {
      processarMensagemDireta(data);
    };

    const handleNovaNotificacao = (data) => {
      const temMensagemCompleta = data?.mensagem !== undefined && data?.mensagem !== null && data?.mensagem !== '';

      processarMensagemDireta(data, {
        usarPreviewComoConteudo: !temMensagemCompleta,
        recarregarSeIncompleta: !temMensagemCompleta,
      });
    };

    const handleStatusMensagem = (data) => {
      if (data.conversa_id && Number(data.conversa_id) !== Number(conversa_id)) {
        return;
      }

      const ids = (data.ids || [data.id]).filter(Boolean).map(Number);

      if (!ids.length) return;

      setMensagens((prev) =>
        prev.map((msg) => {
          if (!ids.includes(Number(msg.id))) {
            return msg;
          }

          return {
            ...msg,
            entregue_em:
              data.entregue_em || msg.entregue_em || new Date().toISOString(),
            lida: data.status === 'lida' ? true : msg.lida,
            lida_em:
              data.status === 'lida'
                ? data.lida_em || msg.lida_em || new Date().toISOString()
                : msg.lida_em,
          };
        })
      );
    };

    const handleUsuarioDigitando = (data) => {
      if (Number(data.usuario_id) !== Number(usuario_id)) return;
      setUsuarioDigitando(data.usuario_nome);
      setTimeout(() => setUsuarioDigitando(null), 3000);
    };

    const handleParouDigitar = (data) => {
      if (Number(data?.usuario_id) !== Number(usuario_id)) return;
      setUsuarioDigitando(null);
    };

    const handleStatusUsuario = (data) => {
      if (Number(data.usuario_id) !== Number(usuario_id)) return;

      setUsuarioInfo((prev) => ({
        ...(prev || { id: usuario_id }),
        status: data.status,
        ultimo_acesso: data.ultimo_acesso || prev?.ultimo_acesso,
      }));
    };

    const handleMensagemApagada = (data) => {
      if (data.escopo !== 'todos') return;
      if (data.conversa_id && Number(data.conversa_id) !== Number(conversa_id)) return;

      setMensagens((prev) =>
        prev.filter((msg) => Number(msg.id) !== Number(data.id))
      );
    };

    const handleMensagemAtualizada = (data) => {
      if (data.conversa_direta_id && Number(data.conversa_direta_id) !== Number(conversa_id)) return;

      setMensagens((prev) => prev.map((msg) => (
        Number(msg.id) === Number(data.message_id || data.id)
          ? { ...msg, mensagem: data.mensagem, editada_em: data.editada_em }
          : msg
      )));
    };

    const handleReacoesAtualizadas = (data) => {
      setMensagens((prev) => prev.map((msg) => (
        Number(msg.id) === Number(data.message_id)
          ? { ...msg, reacoes: Array.isArray(data.reacoes) ? data.reacoes : [] }
          : msg
      )));
    };

    const handleMensagemFixadaAtualizada = (data) => {
      if (data?.tipo !== 'direta') return;
      if (Number(data.referencia_id) !== Number(conversa_id)) return;

      setMensagemFixada(data.pinned_message || null);
    };

    const ressincronizarAoReconectar = () => {
      if (!conversa_id) return;

      socket.emit('join_direct_chat', { conversa_id });
      agendarSincronizacaoConversaAtual({ force: true });
    };

    socket.on('connect', ressincronizarAoReconectar);
    socket.io.on('reconnect', ressincronizarAoReconectar);
    socket.on('receive_direct_message', handleNovaMsg);
    socket.on('new_direct_message_notification', handleNovaNotificacao);
    socket.on('direct_message_status', handleStatusMensagem);
    socket.on('message_deleted', handleMensagemApagada);
    socket.on('message_updated', handleMensagemAtualizada);
    socket.on('message_reactions_updated', handleReacoesAtualizadas);
    socket.on('pinned_message_updated', handleMensagemFixadaAtualizada);
    socket.on('user_typing_direct', handleUsuarioDigitando);
    socket.on('user_stop_typing_direct', handleParouDigitar);
    socket.on('user_status_changed', handleStatusUsuario);

    return () => {
      socket.off('connect', ressincronizarAoReconectar);
      socket.io.off('reconnect', ressincronizarAoReconectar);
      socket.off('receive_direct_message', handleNovaMsg);
      socket.off('new_direct_message_notification', handleNovaNotificacao);
      socket.off('direct_message_status', handleStatusMensagem);
      socket.off('message_deleted', handleMensagemApagada);
      socket.off('message_updated', handleMensagemAtualizada);
      socket.off('message_reactions_updated', handleReacoesAtualizadas);
      socket.off('pinned_message_updated', handleMensagemFixadaAtualizada);
      socket.off('user_typing_direct', handleUsuarioDigitando);
      socket.off('user_stop_typing_direct', handleParouDigitar);
      socket.off('user_status_changed', handleStatusUsuario);
    };
  }, [agendarSincronizacaoConversaAtual, conversa_id, socket, usuario_atual.id, usuario_id]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        agendarSincronizacaoConversaAtual();
      }
    };

    const handleWindowFocus = () => {
      agendarSincronizacaoConversaAtual();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [agendarSincronizacaoConversaAtual]);

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
          conversa_id: data.conversa_direta_id || conversa_id,
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
    const mesmaConversa = origem.tipo === 'direta' && (
      Number(origem.conversa_id) === Number(conversa_id) ||
      Number(origem.destinatario_id) === Number(usuario_id)
    );

    if (mesmaConversa) {
      abrirMensagemCompartilhada(favorito.message_id);
      return;
    }

    onOpenFavoriteOrigin?.(favorito);
  };

  const limparConversa = async () => {
    const confirmar = window.confirm(
      'Apagar esta conversa somente para você? O histórico continuará disponível para o administrador.'
    );

    if (!confirmar) return;

    try {
      await api.delete(`/chat/conversa-direta/${usuario_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setMensagens([]);
      setPesquisa('');
      setBuscaAtiva(false);
      setMenuConversaAberto(false);
      onClearConversation?.();
    } catch (err) {
      console.error('Erro ao limpar conversa:', err);
      alert(err.response?.data?.error || 'Não foi possível apagar a conversa.');
    }
  };

  const enviarMensagem = async () => {
    const textoMensagem = novaMsg.trim();

    if ((!textoMensagem && pendingAttachments.length === 0) || !conversa_id || enviandoMensagem) return;

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
        '/chat/enviar-direto',
        {
          usuario_id,
          mensagem,
          tipo_mensagem,
          anexo_nome,
          anexo_mime,
          sticker_id,
          resposta_mensagem_id,
        },
        { headers }
      );

      setMensagens((prev) => normalizarMensagens([...prev, res.data]));

      // Emitir via socket
      if (socket) {
        socket.emit('send_direct_message', {
          id: res.data.id,
          remetente_id: usuario_atual.id,
          usuario_id,
          conversa_id,
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
          remetente_nome: usuario_atual.nome,
          remetente_avatar: usuario_atual.avatar,
          criada_em: res.data.criada_em,
        });
      }

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
    if (!sticker?.id || !conversa_id || enviandoMensagem) return;

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

  // DIGITANDO
  const handleDigitar = (e) => {
    setNovaMsg(e.target.value);

    if (socket && conversa_id) {
      socket.emit('typing_direct', {
        conversa_id,
        usuario_id: usuario_atual.id,
        usuario_nome: usuario_atual.nome,
      });

      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stop_typing_direct', {
          conversa_id,
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
              mensagemRespondendo.remetente_nome
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
        <LinkifiedText text={msg.mensagem} linkClassName={styles.messageLink} />
      </div>
    );
  };

  const renderMensagemEditada = (msg) => {
    if (!msg.editada_em) return null;
    return <span className={styles.messageEdited}>Editado</span>;
  };

  const renderStatusMensagem = (msg) => {
    if (msg.remetente_id !== usuario_atual.id) return null;

    const lida = Boolean(msg.lida || msg.lida_em);
    const entregue = Boolean(msg.entregue_em || lida);

    return (
      <span
        className={`${styles.messageStatus} ${
          lida ? styles.messageStatusRead : ''
        } ${entregue ? '' : styles.messageStatusPending}`}
        title={lida ? 'Lida' : entregue ? 'Entregue' : 'Aguardando entrega'}
      >
        {lida ? '✓✓' : entregue ? '✓' : '◷'}
      </span>
    );
  };

  const abrirFotoPerfil = () => {
    if (!usuarioInfo?.avatar) return;
    setFotoPerfilAberta(true);
  };

  const normalizarTexto = (valor = '') => (
    String(valor)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
  );

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

  const statusInfo = getStatusInfo(usuarioInfo?.status, usuarioInfo?.ultimo_acesso);
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
          <button
            type="button"
            className={`${styles.avatarPreviewButton} ${styles.conversaAvatar}`}
            title={usuarioInfo?.avatar ? 'Abrir foto de perfil' : 'Sem foto de perfil'}
            onClick={abrirFotoPerfil}
            disabled={!usuarioInfo?.avatar}
          >
            {usuarioInfo?.avatar ? (
              <img
                src={usuarioInfo.avatar}
                alt={usuarioInfo.nome || 'Avatar'}
                className={styles.avatarImage}
              />
            ) : (
              <span>{usuarioInfo?.nome?.charAt(0)?.toUpperCase()}</span>
            )}
          </button>
          <div className={styles.chatHeaderInfo}>
            <p className={styles.chatHeaderTitle}>{usuarioInfo?.nome}</p>
            <p className={styles.chatHeaderStatus} title={statusInfo.title}>
              <span className={`${styles.inlineStatusDot} ${statusInfo.className}`} />
              {statusInfo.label}
            </p>
            {usuarioInfo?.setor_nome && (
              <div className={styles.chatHeaderGroups}>
                <span className={styles.conversaCategory} title={`Categoria principal: ${usuarioInfo.setor_nome}`}>
                  {usuarioInfo.setor_nome}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className={styles.chatHeaderActions}>
          <button
            className={styles.iconButton}
            title="Ligação"
            onClick={() => alert('Ligação ainda não está disponível neste chat.')}
          >
            ☎️
          </button>
          <button
            className={styles.iconButton}
            title="Chamada de vídeo"
            onClick={() => alert('Chamada de vídeo ainda não está disponível neste chat.')}
          >
            📹
          </button>
          {buscaAtiva ? (
          <div className={styles.searchBox} style={{ width: '100%', maxWidth: '380px' }}>
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
            title="Pesquisar na conversa"
            onClick={() => setBuscaAtiva(true)}
          >
            🔍
          </button>
        )}
        <div className={styles.headerMenuWrapper}>
          <button
            type="button"
            className={styles.headerMenuButton}
            title="Opções da conversa"
            aria-label="Opções da conversa"
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

      {fotoPerfilAberta && usuarioInfo?.avatar && (
        <div
          className={styles.photoPreviewOverlay}
          role="dialog"
          aria-modal="true"
          aria-label={`Foto de perfil de ${usuarioInfo.nome || 'usuario'}`}
          onClick={() => setFotoPerfilAberta(false)}
        >
          <div
            className={styles.photoPreviewModal}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.photoPreviewHeader}>
              <strong>{usuarioInfo.nome || 'Foto de perfil'}</strong>
              <button
                type="button"
                className={styles.photoPreviewClose}
                title="Fechar foto"
                onClick={() => setFotoPerfilAberta(false)}
              >
                ×
              </button>
            </div>
            <img
              src={usuarioInfo.avatar}
              alt={usuarioInfo.nome || 'Foto de perfil'}
              className={styles.photoPreviewImage}
            />
          </div>
        </div>
      )}

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
          mensagensFiltradas.map((msg, idx) => (
            <Fragment key={msg.id || idx}>
              {renderDivisorData(msg, idx)}
              <div
                ref={(element) => registrarMensagemRef(msg.id, element)}
                className={
                  msg.remetente_id === usuario_atual.id
                    ? styles.messageSent
                    : styles.messageReceived
                }
              >
                <div className={styles.messageGroup}>
                  <div
                    className={`${styles.messageBubble} ${
                      msg.remetente_id === usuario_atual.id
                        ? styles.sent
                        : styles.received
                    } ${msg.tipo_mensagem === 'sticker' ? styles.messageBubbleSticker : ''} ${
                      msg.__newMessage ? styles.newMessage : ''
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
                      {renderStatusMensagem(msg)}
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
                              {mensagemTemDownload(msg) && (
                                <button
                                  type="button"
                                  className={styles.moreMenuItem}
                                  onClick={() => salvarMensagemNoComputador(msg)}
                                >
                                  Salvar no computador
                                </button>
                              )}
                              <button
                                type="button"
                                className={styles.moreMenuItem}
                                onClick={() => alternarFavoritoMensagem(msg)}
                                disabled={Number(favoritoAtualizandoId) === Number(msg.id)}
                              >
                                {msg.favoritada ? '★ Remover dos favoritos' : '☆ Favoritar mensagem'}
                              </button>
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
            </Fragment>
          ))
        )}

        {usuario_digitando && (
          <div className={styles.messageReceived}>
            <div className={styles.typingIndicator}>
              <span>{usuario_digitando} está digitando</span>
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
            className={styles.newMessagesJump}
            onClick={abrirAvisoNovaMensagem}
          >
            Novas mensagens
          </button>
        )}
        {renderRespostaSelecionada()}
        <PendingAttachmentsPreview
          attachments={pendingNonImageAttachments}
          sending={enviandoMensagem}
          onRemove={removerAnexoPendente}
        />
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
              disabled={Boolean(mensagemEditando) || enviandoMensagem || !conversa_id}
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
        conversationContext={conversa_id ? { tipo: 'direta', referenciaId: conversa_id, label: usuarioInfo?.nome } : null}
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
