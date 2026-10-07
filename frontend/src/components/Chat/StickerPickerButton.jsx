import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ImagePlus,
  Loader2,
  Plus,
  Star,
  Sticker,
  Trash2,
} from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/Chat.module.css';
import StickerEditorModal from './StickerEditorModal';

const TABS = [
  { id: 'recents', label: 'Recentes' },
  { id: 'favorites', label: 'Favoritas' },
  { id: 'mine', label: 'Minhas' },
];

const EMPTY_STATE = {
  recents: [],
  favorites: [],
  mine: [],
  limits: {
    max_upload_mb: 8,
    max_per_user: 500,
    recents: 30,
    max_frames: 120,
  },
};

const ACCEPTED_STICKER_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
];

const ACCEPTED_STICKER_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
];

const obterExtensaoArquivo = (nome = '') => {
  const indice = String(nome).lastIndexOf('.');
  return indice >= 0 ? String(nome).slice(indice).toLowerCase() : '';
};

const arquivoStickerValido = (file) => {
  const type = String(file?.type || '').toLowerCase();
  const extensao = obterExtensaoArquivo(file?.name);
  return ACCEPTED_STICKER_TYPES.includes(type) || ACCEPTED_STICKER_EXTENSIONS.includes(extensao);
};

const bytesParaAscii = (bytes) => {
  let texto = '';

  for (let index = 0; index < bytes.length; index += 8192) {
    texto += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }

  return texto;
};

const arquivoWebpAnimado = async (file) => {
  const bytes = new Uint8Array(await file.slice(0, 65536).arrayBuffer());
  const texto = bytesParaAscii(bytes);

  return texto.slice(0, 4) === 'RIFF' && texto.slice(8, 12) === 'WEBP' && texto.includes('ANIM');
};

const deveEnviarArquivoAnimadoDireto = async (file) => {
  const type = String(file?.type || '').toLowerCase();
  const extensao = obterExtensaoArquivo(file?.name);

  if (type === 'image/gif' || extensao === '.gif') {
    return true;
  }

  if (type === 'image/webp' || extensao === '.webp') {
    return arquivoWebpAnimado(file);
  }

  return false;
};

const normalizarResposta = (data = {}) => ({
  recents: Array.isArray(data.recents) ? data.recents : [],
  favorites: Array.isArray(data.favorites) ? data.favorites : [],
  mine: Array.isArray(data.mine) ? data.mine : [],
  limits: {
    ...EMPTY_STATE.limits,
    ...(data.limits || {}),
  },
});

const atualizarStickerNasListas = (listas, stickerId, updater) => {
  const id = Number(stickerId);

  return {
    ...listas,
    recents: listas.recents.map((item) => (
      Number(item.id) === id ? updater(item) : item
    )),
    favorites: listas.favorites.map((item) => (
      Number(item.id) === id ? updater(item) : item
    )),
    mine: listas.mine.map((item) => (
      Number(item.id) === id ? updater(item) : item
    )),
  };
};

export default function StickerPickerButton({
  token,
  disabled = false,
  onStickerSend,
}) {
  const [aberto, setAberto] = useState(false);
  const [tabAtiva, setTabAtiva] = useState('recents');
  const [stickers, setStickers] = useState(EMPTY_STATE);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [editorImage, setEditorImage] = useState(null);
  const [creating, setCreating] = useState(false);
  const [sendingId, setSendingId] = useState(null);
  const [favoriteUpdatingId, setFavoriteUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const pickerRef = useRef(null);
  const fileInputRef = useRef(null);
  const feedbackTimeoutRef = useRef(null);

  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
  }), [token]);

  const mostrarFeedback = (mensagem) => {
    window.clearTimeout(feedbackTimeoutRef.current);
    setFeedback(mensagem);
    feedbackTimeoutRef.current = window.setTimeout(() => setFeedback(''), 1800);
  };

  const carregarStickers = async ({ force = false } = {}) => {
    if (!token || (loaded && !force)) return;

    try {
      setLoading(true);
      setError('');
      const { data } = await api.get('/chat/stickers', { headers });
      setStickers(normalizarResposta(data));
      setLoaded(true);
    } catch (err) {
      console.error('Erro ao carregar figurinhas:', err);
      setError(err.response?.data?.error || 'Nao foi possivel carregar as figurinhas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!aberto) return undefined;

    carregarStickers();

    const fecharAoClicarFora = (event) => {
      if (pickerRef.current?.contains(event.target)) return;
      setAberto(false);
    };

    const fecharComEsc = (event) => {
      if (event.key === 'Escape') {
        setAberto(false);
      }
    };

    document.addEventListener('mousedown', fecharAoClicarFora);
    document.addEventListener('keydown', fecharComEsc);

    return () => {
      document.removeEventListener('mousedown', fecharAoClicarFora);
      document.removeEventListener('keydown', fecharComEsc);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  useEffect(() => () => {
    window.clearTimeout(feedbackTimeoutRef.current);
    if (editorImage?.src) {
      URL.revokeObjectURL(editorImage.src);
    }
  }, [editorImage]);

  const abrirCriacao = () => {
    if (disabled || creating) return;
    fileInputRef.current?.click();
  };

  const selecionarImagem = async (event) => {
    const [file] = Array.from(event.target.files || []);
    event.target.value = '';

    if (!file) return;

    const maxBytes = Number(stickers.limits.max_upload_mb || 8) * 1024 * 1024;

    if (!arquivoStickerValido(file)) {
      mostrarFeedback('Envie PNG, JPG, JPEG, WEBP ou GIF.');
      return;
    }

    if (file.size > maxBytes) {
      mostrarFeedback(`Imagem muito grande. Limite de ${stickers.limits.max_upload_mb} MB.`);
      return;
    }

    let enviarDireto = false;

    try {
      enviarDireto = await deveEnviarArquivoAnimadoDireto(file);
    } catch (err) {
      console.error('Erro ao detectar animacao da figurinha:', err);
      mostrarFeedback('Nao foi possivel ler este arquivo.');
      return;
    }

    if (enviarDireto) {
      await criarSticker({
        blob: file,
        name: file.name || 'figurinha-animada.gif',
        animated: true,
      });
      return;
    }

    if (editorImage?.src) {
      URL.revokeObjectURL(editorImage.src);
    }

    setEditorImage({
      file,
      name: file.name,
      src: URL.createObjectURL(file),
    });
  };

  const fecharEditor = () => {
    if (editorImage?.src) {
      URL.revokeObjectURL(editorImage.src);
    }

    setEditorImage(null);
  };

  const criarSticker = async ({ blob, name, animated = false }) => {
    try {
      setCreating(true);
      const formData = new FormData();
      formData.append('sticker', blob, name || 'figurinha.webp');

      const { data } = await api.post('/chat/stickers', formData, { headers });
      const sticker = data.sticker;

      setStickers((atuais) => ({
        ...atuais,
        mine: [sticker, ...atuais.mine.filter((item) => Number(item.id) !== Number(sticker.id))],
        limits: {
          ...atuais.limits,
          ...(data.limits || {}),
        },
      }));
      setTabAtiva('mine');
      setLoaded(true);
      fecharEditor();
      mostrarFeedback(sticker?.animated || animated ? 'Figurinha animada criada.' : 'Figurinha criada.');
    } catch (err) {
      console.error('Erro ao criar figurinha:', err);
      mostrarFeedback(err.response?.data?.error || 'Nao foi possivel criar a figurinha.');
    } finally {
      setCreating(false);
    }
  };

  const enviarSticker = async (sticker) => {
    if (!sticker?.id || sendingId) return;

    try {
      setSendingId(sticker.id);
      await onStickerSend?.(sticker);
      setAberto(false);
    } catch (err) {
      console.error('Erro ao enviar figurinha:', err);
      mostrarFeedback(err.response?.data?.error || 'Nao foi possivel enviar a figurinha.');
    } finally {
      setSendingId(null);
    }
  };

  const alternarFavorito = async (event, sticker) => {
    event.stopPropagation();
    const stickerId = Number(sticker?.id);
    if (!stickerId || favoriteUpdatingId) return;

    const favorited = !sticker.favorited;

    try {
      setFavoriteUpdatingId(stickerId);
      if (favorited) {
        await api.post(`/chat/stickers/${stickerId}/favorite`, {}, { headers });
      } else {
        await api.delete(`/chat/stickers/${stickerId}/favorite`, { headers });
      }

      setStickers((atuais) => {
        const atualizados = atualizarStickerNasListas(
          atuais,
          stickerId,
          (item) => ({ ...item, favorited })
        );

        return {
          ...atualizados,
          favorites: favorited
            ? [{ ...sticker, favorited: true }, ...atualizados.favorites.filter((item) => Number(item.id) !== stickerId)]
            : atualizados.favorites.filter((item) => Number(item.id) !== stickerId),
        };
      });
    } catch (err) {
      console.error('Erro ao atualizar favorito da figurinha:', err);
      mostrarFeedback(err.response?.data?.error || 'Nao foi possivel atualizar o favorito.');
    } finally {
      setFavoriteUpdatingId(null);
    }
  };

  const removerDaBiblioteca = async (event, sticker) => {
    event.stopPropagation();
    const stickerId = Number(sticker?.id);
    if (!stickerId || deletingId) return;

    const confirmar = window.confirm('Remover esta figurinha das suas figurinhas?');
    if (!confirmar) return;

    try {
      setDeletingId(stickerId);
      await api.delete(`/chat/stickers/${stickerId}/library`, { headers });
      setStickers((atuais) => ({
        ...atualizarStickerNasListas(
          atuais,
          stickerId,
          (item) => ({ ...item, in_library: false })
        ),
        mine: atuais.mine.filter((item) => Number(item.id) !== stickerId),
      }));
      mostrarFeedback('Figurinha removida.');
    } catch (err) {
      console.error('Erro ao remover figurinha:', err);
      mostrarFeedback(err.response?.data?.error || 'Nao foi possivel remover a figurinha.');
    } finally {
      setDeletingId(null);
    }
  };

  const stickersAtuais = stickers[tabAtiva] || [];

  const renderGrid = () => {
    if (loading) {
      return (
        <div className={styles.stickerGrid}>
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className={styles.stickerSkeleton} />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className={styles.stickerEmptyState}>
          <strong>{error}</strong>
          <button type="button" onClick={() => carregarStickers({ force: true })}>
            Tentar novamente
          </button>
        </div>
      );
    }

    if (!stickersAtuais.length) {
      return (
        <div className={styles.stickerEmptyState}>
          <ImagePlus size={28} />
          <strong>Nenhuma figurinha</strong>
          <button type="button" onClick={abrirCriacao}>
            Criar figurinha
          </button>
        </div>
      );
    }

    return (
      <div className={styles.stickerGrid}>
        {stickersAtuais.map((sticker) => (
          <div
            key={`${tabAtiva}-${sticker.id}`}
            className={styles.stickerItemShell}
          >
            <button
              type="button"
              className={styles.stickerItem}
              title="Enviar figurinha"
              onClick={() => enviarSticker(sticker)}
              disabled={Boolean(sendingId)}
            >
              <img src={sticker.file_url || sticker.url} alt="Figurinha" loading="lazy" />
              {sendingId === sticker.id && (
                <span className={styles.stickerItemLoading}>
                  <Loader2 size={16} />
                </span>
              )}
            </button>
            <span className={styles.stickerItemActions}>
              <button
                type="button"
                className={`${styles.stickerMiniAction} ${
                  sticker.favorited ? styles.stickerMiniActionActive : ''
                }`}
                title={sticker.favorited ? 'Remover dos favoritos' : 'Favoritar'}
                onClick={(event) => alternarFavorito(event, sticker)}
              >
                <Star size={13} />
              </button>
              {tabAtiva === 'mine' && (
                <button
                  type="button"
                  className={styles.stickerMiniAction}
                  title="Remover das minhas figurinhas"
                  onClick={(event) => removerDaBiblioteca(event, sticker)}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={styles.stickerPickerWrapper} ref={pickerRef}>
      <button
        type="button"
        className={styles.attachButton}
        title="Figurinhas"
        onClick={() => setAberto((atual) => !atual)}
        disabled={disabled}
      >
        <Sticker size={17} />
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        className={styles.hiddenFileInput}
        onChange={selecionarImagem}
      />

      {aberto && (
        <div className={styles.stickerPickerPopover}>
          <div className={styles.stickerPickerHeader}>
            <div className={styles.stickerTabs} role="tablist" aria-label="Categorias de figurinhas">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`${styles.stickerTab} ${
                    tabAtiva === tab.id ? styles.stickerTabActive : ''
                  }`}
                  onClick={() => setTabAtiva(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={styles.stickerCreateButton}
              title="Criar figurinha"
              onClick={abrirCriacao}
              disabled={creating}
            >
              <Plus size={16} />
              Criar
            </button>
          </div>

          {renderGrid()}

          {feedback && (
            <div className={styles.stickerPickerFeedback}>{feedback}</div>
          )}
        </div>
      )}

      {editorImage && (
        <StickerEditorModal
          image={editorImage}
          saving={creating}
          onCancel={fecharEditor}
          onConfirm={criarSticker}
        />
      )}
    </div>
  );
}
