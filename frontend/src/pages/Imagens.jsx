import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ImagePlus, Images, Trash2, Upload } from 'lucide-react';
import api from '../services/api';
import { useInternalBack } from '../utils/internalNavigation';
import ImageViewerModal from '../components/Chat/ImageViewerModal';
import styles from '../styles/Imagens.module.css';

const IMAGEM_TIPOS_ACEITOS = 'image/png,image/jpeg,image/webp,image/gif';

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

export default function Imagens() {
  const navigate = useNavigate();
  const voltarPaginaInterna = useInternalBack('/chat');
  const fileInputRef = useRef(null);

  const [imagens, setImagens] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const [novoTitulo, setNovoTitulo] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erroUpload, setErroUpload] = useState('');

  const [excluindoId, setExcluindoId] = useState(null);
  const [imagemAbertaId, setImagemAbertaId] = useState(null);

  const token = useMemo(() => localStorage.getItem('token'), []);
  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
  }), [token]);

  const carregarImagens = useCallback(async () => {
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    try {
      setErro('');
      setLoading(true);

      const { data } = await api.get('/imagens', { headers });
      setImagens(Array.isArray(data.images) ? data.images : []);
      setCanManage(Boolean(data.can_manage));
    } catch (err) {
      console.error('Erro ao carregar imagens:', err);
      setErro('Não foi possível carregar as imagens.');
    } finally {
      setLoading(false);
    }
  }, [headers, navigate, token]);

  useEffect(() => {
    carregarImagens();
  }, [carregarImagens]);

  const enviarImagem = async (event) => {
    const arquivo = event.target.files?.[0];
    event.target.value = '';

    if (!arquivo) return;

    try {
      setEnviando(true);
      setErroUpload('');

      const formData = new FormData();
      formData.append('imagem', arquivo);
      formData.append('titulo', novoTitulo.trim());
      formData.append('descricao', novaDescricao.trim());

      const { data } = await api.post('/admin/imagens', formData, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' },
      });

      setImagens((atuais) => [data, ...atuais]);
      setNovoTitulo('');
      setNovaDescricao('');
    } catch (err) {
      console.error('Erro ao enviar imagem:', err);
      setErroUpload(err.response?.data?.error || 'Não foi possível enviar a imagem.');
    } finally {
      setEnviando(false);
    }
  };

  const excluirImagem = async (imagem) => {
    const ok = window.confirm(`Excluir a imagem "${imagem.titulo || 'sem título'}"? Esta ação não pode ser desfeita.`);
    if (!ok) return;

    try {
      setExcluindoId(imagem.id);
      await api.delete(`/admin/imagens/${imagem.id}`, { headers });
      setImagens((atuais) => atuais.filter((item) => item.id !== imagem.id));

      if (imagemAbertaId === imagem.id) {
        setImagemAbertaId(null);
      }
    } catch (err) {
      console.error('Erro ao excluir imagem:', err);
      alert(err.response?.data?.error || 'Não foi possível excluir a imagem.');
    } finally {
      setExcluindoId(null);
    }
  };

  const imagensParaVisualizador = useMemo(() => (
    imagens.map((imagem) => ({
      id: imagem.id,
      url: imagem.imagem_url,
      alt: imagem.titulo || 'Imagem',
      caption: imagem.titulo || '',
      name: imagem.titulo || `imagem-${imagem.id}`,
    }))
  ), [imagens]);

  const imagemAberta = imagens.find((imagem) => imagem.id === imagemAbertaId) || null;

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <button type="button" className={styles.backButton} onClick={voltarPaginaInterna}>
            <ArrowLeft size={16} />
            Voltar
          </button>

          <div className={styles.heroText}>
            <span>
              <Images size={16} />
              Galeria da equipe
            </span>
            <h1>Imagens</h1>
            <p>
              {canManage
                ? 'Publique imagens para que todos os funcionários possam acessar.'
                : 'Imagens compartilhadas pela administração para toda a equipe.'}
            </p>
          </div>
        </header>

        {erro && <div className={styles.errorBox}>{erro}</div>}

        {canManage && (
          <section className={styles.uploadCard}>
            <div className={styles.uploadFields}>
              <label className={styles.uploadField}>
                Título (opcional)
                <input
                  type="text"
                  value={novoTitulo}
                  onChange={(event) => setNovoTitulo(event.target.value)}
                  maxLength={255}
                  placeholder="Ex.: Convenção 2026"
                  disabled={enviando}
                />
              </label>

              <label className={styles.uploadFieldWide}>
                Descrição (opcional)
                <textarea
                  value={novaDescricao}
                  onChange={(event) => setNovaDescricao(event.target.value)}
                  maxLength={2000}
                  rows={2}
                  placeholder="Detalhes sobre a imagem"
                  disabled={enviando}
                />
              </label>
            </div>

            <div className={styles.uploadActions}>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => fileInputRef.current?.click()}
                disabled={enviando}
              >
                <Upload size={16} />
                {enviando ? 'Enviando...' : 'Enviar imagem'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={IMAGEM_TIPOS_ACEITOS}
                onChange={enviarImagem}
                disabled={enviando}
                hidden
              />
              <span className={styles.uploadHint}>PNG, JPG, WEBP ou GIF · até 20 MB</span>
            </div>

            {erroUpload && <div className={styles.errorBox}>{erroUpload}</div>}
          </section>
        )}

        {loading && <div className={styles.loadingBox}>Carregando imagens...</div>}

        {!loading && imagens.length === 0 && (
          <div className={styles.emptyState}>
            <ImagePlus size={32} strokeWidth={1.6} />
            <p>Nenhuma imagem publicada ainda.</p>
          </div>
        )}

        {!loading && imagens.length > 0 && (
          <div className={styles.grid}>
            {imagens.map((imagem) => (
              <div key={imagem.id} className={styles.card}>
                <button
                  type="button"
                  className={styles.cardImageButton}
                  onClick={() => setImagemAbertaId(imagem.id)}
                >
                  <img src={imagem.imagem_url} alt={imagem.titulo || 'Imagem'} loading="lazy" />
                </button>

                <div className={styles.cardBody}>
                  <strong>{imagem.titulo || 'Sem título'}</strong>
                  {imagem.descricao && <p>{imagem.descricao}</p>}
                  <span className={styles.cardMeta}>
                    {imagem.criado_por_nome || 'Administração'} · {formatarData(imagem.criado_em)}
                  </span>
                </div>

                {canManage && (
                  <button
                    type="button"
                    className={styles.deleteButton}
                    onClick={() => excluirImagem(imagem)}
                    disabled={excluindoId === imagem.id}
                    title="Excluir imagem"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {imagemAberta && (
        <ImageViewerModal
          imageUrl={imagemAberta.imagem_url}
          alt={imagemAberta.titulo || 'Imagem'}
          caption={imagemAberta.titulo || ''}
          images={imagensParaVisualizador}
          currentImageId={imagemAberta.id}
          onNavigateImage={(imagem) => setImagemAbertaId(imagem.id)}
          onClose={() => setImagemAbertaId(null)}
        />
      )}
    </div>
  );
}
