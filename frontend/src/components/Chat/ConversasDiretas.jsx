import { useEffect, useRef, useState } from 'react';
import styles from '../../styles/Chat.module.css';
import {
  formatarDataHoraListaChat,
  obterDataOrdenacaoChat,
} from '../../utils/chatDatas';
import { removerFormatacaoMensagem } from '../../utils/formatacaoMensagem';
import { nomesGruposUsuario } from '../../utils/usuarioGrupos';

export default function ConversasDiretas({
  conversas,
  usuarios,
  conversaSelecionada,
  onSelectConversa,
  onOcultarConversa,
  onToggleFavorito,
  onViewProfile,
  mostrarUsuarios = false,
  busca = '',
}) {
  const [menuAbertoId, setMenuAbertoId] = useState(null);
  const [conversaParaRemover, setConversaParaRemover] = useState(null);
  const [removendoId, setRemovendoId] = useState(null);
  const listaRef = useRef(null);
  const termoBusca = busca.trim().toLowerCase();

  useEffect(() => {
    const fecharMenuFora = (event) => {
      if (!listaRef.current?.contains(event.target)) {
        setMenuAbertoId(null);
      }
    };

    document.addEventListener('pointerdown', fecharMenuFora);
    return () => document.removeEventListener('pointerdown', fecharMenuFora);
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'online':
        return styles.online;
      case 'away':
        return styles.away;
      default:
        return styles.offline;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'online':
        return 'Online';
      case 'away':
        return 'Ausente';
      default:
        return 'Offline';
    }
  };

  const usuariosFiltrados = usuarios
    .filter((usuario) => {
      const nome = usuario.nome || '';
      const email = usuario.email || '';
      const setor = usuario.setor_nome || '';
      const grupos = nomesGruposUsuario(usuario).join(' ');
      return `${nome} ${email} ${setor} ${grupos}`.toLowerCase().includes(termoBusca);
    })
    .sort((a, b) => (
      String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', {
        sensitivity: 'base',
      })
    ));

  const conversasFiltradas = conversas
    .filter((conversa) => {
      const usuarioRelacionado = usuarios.find(
        (usuario) => Number(usuario.id) === Number(conversa.usuario_outro_id)
      );
      const nome = conversa.usuario_outro_nome || usuarioRelacionado?.nome || '';
      const mensagem = conversa.ultima_mensagem || '';
      const email = usuarioRelacionado?.email || '';
      const setor = usuarioRelacionado?.setor_nome || '';
      const grupos = nomesGruposUsuario(usuarioRelacionado).join(' ');
      return `${nome} ${mensagem} ${email} ${setor} ${grupos}`.toLowerCase().includes(termoBusca);
    })
    .sort((a, b) => {
      const favoritoDiff = Number(Boolean(b.favorito)) - Number(Boolean(a.favorito));

      if (favoritoDiff !== 0) {
        return favoritoDiff;
      }

      return (
        new Date(obterDataOrdenacaoChat(b) || 0) -
        new Date(obterDataOrdenacaoChat(a) || 0)
      );
    });

  const renderAvatar = (usuario, nomeFallback) => (
    <>
      {usuario?.avatar ? (
        <img
          src={usuario.avatar}
          alt={usuario.nome || nomeFallback || 'Avatar'}
          className={styles.avatarImage}
        />
      ) : (
        <span>{(usuario?.nome || nomeFallback)?.charAt(0)?.toUpperCase()}</span>
      )}
    </>
  );

  const getUsuarioCategory = (usuario) => usuario?.setor_nome || '';

  const renderResumoGruposUsuario = (usuario) => {
    const categoria = getUsuarioCategory(usuario);

    if (!categoria) return null;

    return (
      <div className={styles.userGroupChips}>
        <span className={styles.conversaCategory} title={`Categoria principal: ${categoria}`}>
          {categoria}
        </span>
      </div>
    );
  };

  const selecionarConversa = (usuarioId) => {
    setMenuAbertoId(null);
    onSelectConversa(usuarioId);
  };

  const abrirMenu = (event, conversaId) => {
    event.stopPropagation();
    setMenuAbertoId((atual) => (atual === conversaId ? null : conversaId));
  };

  const pedirConfirmacaoRemocao = (event, conversa) => {
    event.stopPropagation();
    setMenuAbertoId(null);
    setConversaParaRemover(conversa);
  };

  const alternarFavorito = (event, conversa) => {
    event.stopPropagation();
    setMenuAbertoId(null);

    onToggleFavorito?.({
      tipo: 'direta',
      referenciaId: conversa.id,
      favorito: !conversa.favorito,
    });
  };

  const cancelarRemocao = () => {
    if (removendoId) return;
    setConversaParaRemover(null);
  };

  const confirmarRemocao = async () => {
    if (!conversaParaRemover || !onOcultarConversa) return;

    setRemovendoId(conversaParaRemover.id);
    const removida = await onOcultarConversa(conversaParaRemover);
    setRemovendoId(null);

    if (removida) {
      setConversaParaRemover(null);
    }
  };

  const renderListaUsuarios = () => (
    <div ref={listaRef}>
      {usuariosFiltrados.length === 0 ? (
        <div className={styles.emptyList}>
          <p>Nenhum usuário encontrado</p>
          <p>Cadastre outro usuário na mesma empresa para iniciar uma conversa</p>
        </div>
      ) : (
        usuariosFiltrados.map((usuario) => {
          return (
            <div
              key={usuario.id}
              className={`${styles.conversaItem} ${
                conversaSelecionada === usuario.id ? styles.active : ''
              }`}
              onClick={() => selecionarConversa(usuario.id)}
            >
              <div className={`${styles.conversaAvatar} ${usuario.status === 'online' ? styles.onlineAvatar : ''}`}>
                {renderAvatar(usuario)}
                <div
                  className={`${styles.statusIndicator} ${getStatusColor(usuario.status)}`}
                  title={`${usuario.nome} está ${getStatusLabel(usuario.status).toLowerCase()}`}
                />
              </div>

              <div className={styles.conversaInfo}>
                <div className={styles.conversaNameRow}>
                  <p className={styles.conversaNome}>{usuario.nome}</p>
                  {renderResumoGruposUsuario(usuario)}
                </div>
                <p className={styles.conversaPreview}>
                  <span className={`${styles.inlineStatusDot} ${
                    usuario.status === 'online' ? styles.online : ''
                  }`}
                  /> {getStatusLabel(usuario.status)}
                </p>
              </div>

              <div className={styles.conversaMeta}>
                <p className={styles.startChatText}>Abrir</p>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  if (mostrarUsuarios) {
    return renderListaUsuarios();
  }

  return (
    <div ref={listaRef}>
      {conversasFiltradas.length === 0 ? (
        <div className={styles.emptyList}>
          <p>Nenhuma conversa iniciada</p>
          <p>Comece uma nova conversa clicando em 💬</p>
        </div>
      ) : (
        conversasFiltradas.map((conversa) => {
          const usuarioRelacionado = usuarios.find(
            (usuario) => Number(usuario.id) === Number(conversa.usuario_outro_id)
          );
          const status = usuarioRelacionado?.status || conversa.usuario_outro_status;
          const nome = usuarioRelacionado?.nome || conversa.usuario_outro_nome;
          const avatar = usuarioRelacionado?.avatar || conversa.usuario_outro_avatar;
          const dataUltimaMensagem = obterDataOrdenacaoChat(conversa);

          return (
            <div
              key={conversa.id}
              className={`${styles.conversaItem} ${
                conversaSelecionada === conversa.usuario_outro_id ? styles.active : ''
              } ${
                conversa.nao_lidas > 0 ? styles.temNaoLida : ''
              }`}
              onClick={() => selecionarConversa(conversa.usuario_outro_id)}
            >
              <div className={`${styles.conversaAvatar} ${status === 'online' ? styles.onlineAvatar : ''}`}>
                {renderAvatar({ avatar, nome }, nome)}
                <div
                  className={`${styles.statusIndicator} ${getStatusColor(status)}`}
                  title={`${nome} está ${getStatusLabel(status).toLowerCase()}`}
                />
              </div>

              <div className={styles.conversaInfo}>
                <div className={styles.conversaNameRow}>
                  <p className={styles.conversaNome}>{nome}</p>
                  {conversa.favorito && (
                    <span className={styles.favoriteMark} title="Favorito">★</span>
                  )}
                  {renderResumoGruposUsuario(usuarioRelacionado)}
                </div>
                <p
                  className={`${styles.conversaPreview} ${
                    conversa.nao_lidas > 0 ? styles.naoLida : ''
                  }`}
                >
                  {removerFormatacaoMensagem(conversa.ultima_mensagem) || 'Sem mensagens'}
                </p>
              </div>

              <div className={styles.conversaMeta}>
                <p
                  className={`${styles.conversaHora} ${
                    conversa.nao_lidas > 0 ? styles.horaNaoLida : ''
                  }`}
                >
                  {formatarDataHoraListaChat(dataUltimaMensagem)}
                </p>
                {conversa.nao_lidas > 0 && (
                  <div className={styles.badgeNaoLido}>{conversa.nao_lidas}</div>
                )}
                <div className={styles.conversaMenuWrapper}>
                  <button
                    type="button"
                    className={`${styles.conversaMenuButton} ${
                      menuAbertoId === conversa.id ? styles.conversaMenuButtonOpen : ''
                    }`}
                    aria-label={`Opções da conversa com ${nome}`}
                    aria-expanded={menuAbertoId === conversa.id}
                    onClick={(event) => abrirMenu(event, conversa.id)}
                  >
                    <span className={styles.conversaMenuChevron} />
                  </button>

                  {menuAbertoId === conversa.id && (
                    <div
                      className={styles.conversaOptionsMenu}
                      role="menu"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        className={styles.conversaOptionsItem}
                        role="menuitem"
                        onClick={() => onViewProfile?.(usuarioRelacionado)}
                      >
                        Visualizar perfil
                      </button>
                      <button
                        type="button"
                        className={styles.conversaOptionsItem}
                        role="menuitem"
                        onClick={(event) => alternarFavorito(event, conversa)}
                      >
                        {conversa.favorito ? 'Remover dos favoritos' : 'Favoritar conversa'}
                      </button>
                      <button
                        type="button"
                        className={`${styles.conversaOptionsItem} ${styles.conversaOptionsDanger}`}
                        role="menuitem"
                        onClick={(event) => pedirConfirmacaoRemocao(event, conversa)}
                      >
                        Remover da lista
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}

      {conversaParaRemover && (
        <div
          className={styles.modalOverlay}
          onClick={cancelarRemocao}
        >
          <div
            className={styles.confirmRemoveModal}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.confirmRemoveBody}>
              <h2>Remover conversa?</h2>
              <p>
                Remover esta conversa da sua lista? As mensagens continuam salvas
                para consulta do administrador.
              </p>
            </div>
            <div className={styles.confirmRemoveActions}>
              <button
                type="button"
                className={styles.secondaryProfileButton}
                onClick={cancelarRemocao}
                disabled={Boolean(removendoId)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`${styles.primaryProfileButton} ${styles.dangerButton}`}
                onClick={confirmarRemocao}
                disabled={Boolean(removendoId)}
              >
                {removendoId ? 'Removendo...' : 'Remover'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
