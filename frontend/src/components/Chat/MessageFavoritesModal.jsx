import { removerFormatacaoMensagem } from '../../utils/formatacaoMensagem';
import styles from '../../styles/Chat.module.css';

const obterPreviaMensagem = (favorito) => {
  if (!favorito) return '';

  if (favorito.tipo_mensagem === 'imagem') {
    return favorito.anexo_nome ? `[Imagem] ${favorito.anexo_nome}` : '[Imagem]';
  }

  if (favorito.tipo_mensagem === 'audio') {
    return favorito.anexo_nome ? `[Áudio] ${favorito.anexo_nome}` : '[Áudio]';
  }

  if (favorito.tipo_mensagem === 'arquivo') {
    return favorito.anexo_nome ? `[Arquivo] ${favorito.anexo_nome}` : '[Arquivo]';
  }

  if (favorito.tipo_mensagem === 'sticker') {
    return 'Figurinha';
  }

  return removerFormatacaoMensagem(favorito.mensagem || '');
};

const formatarDataHora = (valor) => {
  if (!valor) return '';

  return new Date(valor).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function MessageFavoritesModal({
  favorites = [],
  loading = false,
  error = '',
  onClose,
  onOpenFavorite,
  onRemoveFavorite,
  removingId = null,
}) {
  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-label="Mensagens favoritas"
      onClick={onClose}
    >
      <div
        className={styles.messageFavoritesModal}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.messageFavoritesHeader}>
          <div>
            <h2>Mensagens favoritas</h2>
            <p>{favorites.length} mensagem{favorites.length === 1 ? '' : 's'}</p>
          </div>
          <button
            type="button"
            className={styles.iconButton}
            title="Fechar favoritos"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {error && <div className={styles.messageFavoritesError}>{error}</div>}

        <div className={styles.messageFavoritesList}>
          {loading ? (
            <div className={styles.messageFavoritesEmpty}>
              <p>Carregando favoritas...</p>
            </div>
          ) : favorites.length === 0 ? (
            <div className={styles.messageFavoritesEmpty}>
              <strong>Nenhuma mensagem favorita</strong>
              <p>Use o menu de uma mensagem para favoritar.</p>
            </div>
          ) : (
            favorites.map((favorito) => (
              <article key={favorito.favorite_id || favorito.message_id} className={styles.messageFavoriteItem}>
                <button
                  type="button"
                  className={styles.messageFavoriteOpenButton}
                  onClick={() => onOpenFavorite?.(favorito)}
                >
                  <span className={styles.messageFavoriteItemMeta}>
                    <strong>{favorito.autor?.nome || 'Usuário'}</strong>
                    <span>{formatarDataHora(favorito.criada_em)}</span>
                  </span>
                  <span className={styles.messageFavoriteText}>
                    {obterPreviaMensagem(favorito)}
                  </span>
                  <span className={styles.messageFavoriteOrigin}>
                    {favorito.origem?.tipo === 'grupo' ? 'Grupo' : 'Conversa'}: {favorito.origem?.nome || 'Origem'}
                  </span>
                </button>

                <button
                  type="button"
                  className={styles.messageFavoriteRemoveButton}
                  onClick={() => onRemoveFavorite?.(favorito)}
                  disabled={Number(removingId) === Number(favorito.message_id)}
                >
                  Remover
                </button>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
