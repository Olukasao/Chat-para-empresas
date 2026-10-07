import { useMemo, useState } from 'react';
import styles from '../../styles/Chat.module.css';
import baixarArquivo from '../../utils/baixarArquivo';

const LINK_REGEX = /\b((?:https?:\/\/|www\.)[^\s<>"']+)/gi;

const TABS = [
  { id: 'arquivos', label: 'Arquivos' },
  { id: 'imagens', label: 'Imagens' },
  { id: 'audios', label: 'Áudios' },
  { id: 'links', label: 'Links' },
];

const limparUrl = (url = '') => (
  String(url).replace(/[),.;!?]+$/g, '')
);

const normalizarUrl = (url = '') => {
  const limpa = limparUrl(url);
  return limpa.startsWith('http://') || limpa.startsWith('https://')
    ? limpa
    : `https://${limpa}`;
};

const nomeDownload = (item) => {
  if (item?.anexo_nome) return item.anexo_nome;
  if (item?.tipo_mensagem === 'imagem') return 'imagem';
  if (item?.tipo_mensagem === 'audio') return 'audio';
  return 'arquivo';
};

const isZipFile = (item = {}) => {
  const mime = String(item.anexo_mime || '').toLowerCase();
  const nome = String(item.anexo_nome || '').toLowerCase();

  return mime.includes('zip') || nome.endsWith('.zip');
};

const obterIconeArquivo = (item) => (isZipFile(item) ? '🗜️' : '📄');

const formatarData = (data) => {
  if (!data) return '';

  return new Date(data).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const obterDominio = (url = '') => {
  try {
    return new URL(normalizarUrl(url)).hostname.replace(/^www\./, '');
  } catch {
    return limparUrl(url);
  }
};

export default function SharedFilesPanel({
  mensagens = [],
  onPreviewImage,
  onJumpToMessage,
}) {
  const [abaAtiva, setAbaAtiva] = useState('arquivos');

  const compartilhados = useMemo(() => {
    const arquivos = [];
    const imagens = [];
    const audios = [];
    const links = [];

    mensagens.forEach((msg) => {
      if (msg?.deletada_em) return;

      if (msg.tipo_mensagem === 'arquivo') {
        arquivos.push(msg);
      }

      if (msg.tipo_mensagem === 'imagem') {
        imagens.push(msg);
      }

      if (msg.tipo_mensagem === 'audio') {
        audios.push(msg);
      }

      if (msg.tipo_mensagem === 'texto' && msg.mensagem) {
        const encontrados = String(msg.mensagem).match(LINK_REGEX) || [];

        encontrados.forEach((url) => {
          links.push({
            id: `${msg.id}-${url}`,
            mensagem_id: msg.id,
            url: limparUrl(url),
            remetente_nome: msg.remetente_nome,
            criada_em: msg.criada_em,
          });
        });
      }
    });

    const ordenarRecentes = (a, b) => new Date(b.criada_em || 0) - new Date(a.criada_em || 0);

    return {
      arquivos: arquivos.sort(ordenarRecentes),
      imagens: imagens.sort(ordenarRecentes),
      audios: audios.sort(ordenarRecentes),
      links: links.sort(ordenarRecentes),
    };
  }, [mensagens]);

  const totalAtual = compartilhados[abaAtiva]?.length || 0;

  const renderMeta = (item) => (
    <span>
      {item.remetente_nome || 'Mensagem'} · {formatarData(item.criada_em)}
    </span>
  );

  const renderAcoesMensagem = (messageId) => (
    <button
      type="button"
      className={styles.sharedFilesGhostButton}
      onClick={() => onJumpToMessage?.(messageId)}
    >
      Ver mensagem
    </button>
  );

  const renderArquivos = () => (
    <div className={styles.sharedFilesList}>
      {compartilhados.arquivos.map((item) => (
        <div key={item.id} className={styles.sharedFileItem}>
          <div className={styles.sharedFileIcon}>{obterIconeArquivo(item)}</div>
          <div className={styles.sharedFileInfo}>
            <strong>{item.anexo_nome || 'Arquivo anexado'}</strong>
            {renderMeta(item)}
          </div>
          <div className={styles.sharedFileActions}>
            {renderAcoesMensagem(item.id)}
            <button
              type="button"
              className={styles.sharedFilesPrimaryButton}
              onClick={() => baixarArquivo(item.mensagem, nomeDownload(item))}
            >
              Baixar
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const renderImagens = () => (
    <div className={styles.sharedImagesGrid}>
      {compartilhados.imagens.map((item) => (
        <div key={item.id} className={styles.sharedImageItem}>
          <button
            type="button"
            className={styles.sharedImagePreview}
            onClick={() => onPreviewImage?.(item.mensagem)}
          >
            <img src={item.mensagem} alt={item.anexo_nome || 'Imagem compartilhada'} />
          </button>
          <div className={styles.sharedImageMeta}>
            {renderMeta(item)}
            <div className={styles.sharedFileActions}>
              {renderAcoesMensagem(item.id)}
              <button
                type="button"
                className={styles.sharedFilesPrimaryButton}
                onClick={() => baixarArquivo(item.mensagem, nomeDownload(item))}
              >
                Baixar
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderAudios = () => (
    <div className={styles.sharedFilesList}>
      {compartilhados.audios.map((item) => (
        <div key={item.id} className={styles.sharedAudioItem}>
          <div className={styles.sharedFileInfo}>
            <strong>{item.anexo_nome || 'Áudio compartilhado'}</strong>
            {renderMeta(item)}
            <audio controls src={item.mensagem} preload="metadata">
              Seu navegador não suporta áudio.
            </audio>
          </div>
          <div className={styles.sharedFileActions}>
            {renderAcoesMensagem(item.id)}
            <button
              type="button"
              className={styles.sharedFilesPrimaryButton}
              onClick={() => baixarArquivo(item.mensagem, nomeDownload(item))}
            >
              Baixar
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const renderLinks = () => (
    <div className={styles.sharedFilesList}>
      {compartilhados.links.map((item) => (
        <div key={item.id} className={styles.sharedFileItem}>
          <div className={styles.sharedFileIcon}>↗</div>
          <div className={styles.sharedFileInfo}>
            <strong>{obterDominio(item.url)}</strong>
            <a href={normalizarUrl(item.url)} target="_blank" rel="noreferrer">
              {item.url}
            </a>
            {renderMeta(item)}
          </div>
          <div className={styles.sharedFileActions}>
            {renderAcoesMensagem(item.mensagem_id)}
          </div>
        </div>
      ))}
    </div>
  );

  const renderConteudo = () => {
    if (totalAtual === 0) {
      return (
        <div className={styles.sharedFilesEmpty}>
          <p>Nada compartilhado ainda</p>
          <span>Quando houver conteúdo nesta categoria, ele aparecerá aqui.</span>
        </div>
      );
    }

    if (abaAtiva === 'imagens') return renderImagens();
    if (abaAtiva === 'audios') return renderAudios();
    if (abaAtiva === 'links') return renderLinks();
    return renderArquivos();
  };

  return (
    <section className={styles.sharedFilesPanel}>
      <div className={styles.sharedFilesHeader}>
        <div>
          <h2>Arquivos compartilhados</h2>
          <p>Conteúdos enviados nesta conversa.</p>
        </div>
      </div>

      <div className={styles.sharedFilesTabs}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`${styles.sharedFilesTab} ${
              abaAtiva === tab.id ? styles.sharedFilesTabActive : ''
            }`}
            onClick={() => setAbaAtiva(tab.id)}
          >
            <span>{tab.label}</span>
            <strong>{compartilhados[tab.id]?.length || 0}</strong>
          </button>
        ))}
      </div>

      <div className={styles.sharedFilesContent}>
        {renderConteudo()}
      </div>
    </section>
  );
}
