import { useEffect, useRef, useState } from 'react';
import styles from '../../styles/Chat.module.css';
import {
  formatarDataHoraListaChat,
  obterDataOrdenacaoChat,
  obterDataUltimaMensagemGrupo,
} from '../../utils/chatDatas';
import { formatarBadgeNaoLidas, normalizarTotalNaoLidas } from '../../utils/chatUnread';
import { renderIconeGrupo } from '../../utils/grupoIcones';

export default function Grupos({
  grupos,
  grupoSelecionado,
  onSelectGrupo,
  onToggleFavorito,
  busca = '',
}) {
  const [menuAbertoId, setMenuAbertoId] = useState(null);
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

  const gruposFiltrados = grupos
    .filter((grupo) => {
      const nome = grupo.nome || '';
      const descricao = grupo.descricao || '';
      const setor = grupo.setor_nome || '';
      const ultimaMensagem = grupo.ultima_mensagem || '';
      return `${nome} ${descricao} ${setor} ${ultimaMensagem}`
        .toLowerCase()
        .includes(termoBusca);
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

  const temAcessoGrupo = (grupo) => grupo?.tem_acesso !== false;
  const gruposComAcesso = gruposFiltrados.filter(temAcessoGrupo);
  const gruposFavoritos = gruposComAcesso.filter((grupo) => grupo.favorito);
  const gruposDeSetor = gruposComAcesso.filter((grupo) => !grupo.favorito && grupo.setor_id);
  const gruposGerais = gruposComAcesso.filter((grupo) => !grupo.favorito && !grupo.setor_id);
  const gruposSemAcesso = gruposFiltrados.filter((grupo) => !temAcessoGrupo(grupo));

  const selecionarGrupo = (grupo) => {
    setMenuAbertoId(null);
    onSelectGrupo(grupo);
  };

  const abrirMenu = (event, grupoId) => {
    event.stopPropagation();
    setMenuAbertoId((atual) => (atual === grupoId ? null : grupoId));
  };

  const alternarFavorito = (event, grupo) => {
    event.stopPropagation();
    setMenuAbertoId(null);

    onToggleFavorito?.({
      tipo: 'grupo',
      referenciaId: grupo.id,
      favorito: !grupo.favorito,
    });
  };

  const renderGrupo = (grupo) => {
    const bloqueado = !temAcessoGrupo(grupo);
    const dataUltimaMensagem = obterDataUltimaMensagemGrupo(grupo);
    const naoLidas = normalizarTotalNaoLidas(grupo.unreadCount ?? grupo.nao_lidas);

    return (
      <div
	        key={grupo.id}
	        className={`${styles.conversaItem} ${
	          grupoSelecionado === grupo.id ? styles.active : ''
	        } ${
	          naoLidas > 0 ? styles.temNaoLida : ''
	        } ${
	          bloqueado ? styles.conversaItemLocked : ''
	        }`}
	        onClick={() => selecionarGrupo(grupo)}
	        title={bloqueado ? 'Acesso restrito a usuários autorizados' : undefined}
	      >
	        <div className={`${styles.conversaAvatar} ${styles.grupoAvatar}`}>
	          {renderIconeGrupo(grupo, { bloqueado })}
	        </div>

	        <div className={styles.conversaInfo}>
	          <div className={styles.conversaNameRow}>
	            <p className={styles.conversaNome}>{grupo.nome}</p>
	            {grupo.favorito && (
	              <span className={styles.favoriteMark} title="Favorito">★</span>
	            )}
	          </div>
	          <p
	            className={`${styles.conversaPreview} ${
	              naoLidas > 0 ? styles.naoLida : ''
	            }`}
	          >
	            {bloqueado
	              ? 'Acesso restrito ao cargo/permissão do grupo'
	              : typeof grupo.membros_online === 'number'
	              ? `${grupo.membros_online} membros online`
	              : `${grupo.total_membros || 0} membros`}
	          </p>
	        </div>

	        <div className={styles.conversaMeta}>
	          <p
	            className={`${styles.conversaHora} ${
	              naoLidas > 0 ? styles.horaNaoLida : ''
	            }`}
	          >
	            {formatarDataHoraListaChat(dataUltimaMensagem)}
	          </p>
	          {naoLidas > 0 && (
	            <div className={styles.badgeNaoLido}>{formatarBadgeNaoLidas(naoLidas)}</div>
	          )}
	          {grupo.tem_mencao && (
	            <div className={styles.conversationMentionBadge} title="Você foi mencionado">
	              @
	            </div>
	          )}
	          {bloqueado && (
	            <span className={styles.restrictedBadge}>Restrito</span>
	          )}
	          {!bloqueado && (
	            <div className={styles.conversaMenuWrapper}>
	              <button
	                type="button"
	                className={`${styles.conversaMenuButton} ${
	                  menuAbertoId === grupo.id ? styles.conversaMenuButtonOpen : ''
	                }`}
	                aria-label={`Opções do grupo ${grupo.nome}`}
	                aria-expanded={menuAbertoId === grupo.id}
	                onClick={(event) => abrirMenu(event, grupo.id)}
	              >
	                <span className={styles.conversaMenuChevron} />
	              </button>

	              {menuAbertoId === grupo.id && (
	                <div
	                  className={styles.conversaOptionsMenu}
	                  role="menu"
	                  onClick={(event) => event.stopPropagation()}
	                >
	                  <button
	                    type="button"
	                    className={styles.conversaOptionsItem}
	                    role="menuitem"
	                    onClick={(event) => alternarFavorito(event, grupo)}
	                  >
	                    {grupo.favorito ? 'Remover dos favoritos' : 'Favoritar grupo'}
	                  </button>
	                </div>
	              )}
	            </div>
	          )}
	        </div>
	      </div>
    );
  };

  const renderSecao = (titulo, items) => {
    if (!items.length) return null;

    return (
      <>
        <div className={styles.searchSectionHeader}>
          <span>{titulo}</span>
          <strong>{items.length}</strong>
        </div>
        {items.map(renderGrupo)}
      </>
    );
  };

  return (
    <div ref={listaRef}>
      {gruposFiltrados.length === 0 ? (
        <div className={styles.emptyList}>
          <p>Nenhum grupo ainda</p>
          <p>
            Crie um novo grupo ou peça convite
          </p>
        </div>
      ) : (
	        <>
	          {renderSecao('Favoritos', gruposFavoritos)}
	          {renderSecao('Setores', gruposDeSetor)}
	          {renderSecao('Grupos', gruposGerais)}
	          {renderSecao('Sem acesso', gruposSemAcesso)}
	        </>
	      )}
    </div>
  );
}
