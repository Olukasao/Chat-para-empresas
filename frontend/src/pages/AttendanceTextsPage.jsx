import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  FileText,
  Pencil,
  Plus,
  Search,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from 'lucide-react';
import api from '../services/api';
import { useInternalBack } from '../utils/internalNavigation';
import { PERFIL_ADMIN, PERFIL_ADMIN_COMERCIAL } from '../utils/perfis';
import styles from '../styles/AttendanceTextsPage.module.css';
import { DEFAULT_ATTENDANCE_TEXTS_PAGE_CONFIG } from './attendanceTextsPageConfig';

const criarFormularioVazio = () => ({
  title: '',
  content: '',
  is_active: true,
  sort_order: 0,
});

const obterUsuarioLocal = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

const normalizarBusca = (valor = '') => (
  String(valor)
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

export default function AttendanceTextsPage({ config = DEFAULT_ATTENDANCE_TEXTS_PAGE_CONFIG }) {
  const pageConfig = { ...DEFAULT_ATTENDANCE_TEXTS_PAGE_CONFIG, ...config };
  const navigate = useNavigate();
  const location = useLocation();
  const voltarPaginaInterna = useInternalBack('/chat');
  const parametrosIniciais = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const usuarioAtual = useMemo(() => obterUsuarioLocal(), []);
  const podeGerenciar = [PERFIL_ADMIN, PERFIL_ADMIN_COMERCIAL].includes(usuarioAtual?.perfil);
  const token = useMemo(() => localStorage.getItem('token'), []);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [textos, setTextos] = useState([]);
  const [busca, setBusca] = useState(() => (
    parametrosIniciais.get('busca') || parametrosIniciais.get('q') || ''
  ));
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [textoAbertoId, setTextoAbertoId] = useState(null);
  const [copiadoId, setCopiadoId] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [textoEditando, setTextoEditando] = useState(null);
  const [form, setForm] = useState(criarFormularioVazio);
  const [salvando, setSalvando] = useState(false);
  const [textoParaExcluir, setTextoParaExcluir] = useState(null);
  const [excluindo, setExcluindo] = useState(false);

  const endpointListagem = podeGerenciar ? pageConfig.adminEndpoint : pageConfig.userEndpoint;

  const carregarTextos = async () => {
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    try {
      setCarregando(true);
      setErro('');
      const { data } = await api.get(endpointListagem, { headers });
      setTextos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(`Erro ao carregar ${pageConfig.title}:`, err);

      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login', { replace: true });
        return;
      }

      setErro(err.response?.data?.error || pageConfig.loadError);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarTextos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const termo = params.get('busca') || params.get('q');
    const itemId = Number(params.get('item'));

    if (termo !== null) {
      setBusca(termo);
    }

    if (Number.isInteger(itemId) && itemId > 0) {
      setTextoAbertoId(itemId);
    }
  }, [location.search]);

  useEffect(() => {
    if (!textoAbertoId) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      document
        .getElementById(`attendance-text-${textoAbertoId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [textoAbertoId, textos.length]);

  const textosFiltrados = useMemo(() => {
    const termo = normalizarBusca(busca.trim());

    return textos.filter((texto) => (
      !termo ||
      normalizarBusca(`${texto.title} ${texto.content}`).includes(termo)
    ));
  }, [busca, textos]);

  const atualizarForm = (campo, valor) => {
    setErro('');
    setForm((atual) => ({
      ...atual,
      [campo]: valor,
    }));
  };

  const abrirNovoTexto = () => {
    if (!podeGerenciar) return;

    const proximaOrdem = textos.reduce(
      (maior, texto) => Math.max(maior, Number(texto.sort_order || 0)),
      0
    ) + 10;

    setTextoEditando(null);
    setForm({ ...criarFormularioVazio(), sort_order: proximaOrdem });
    setErro('');
    setModalAberto(true);
  };

  const abrirEdicao = (texto) => {
    if (!podeGerenciar) return;

    setTextoEditando(texto);
    setForm({
      title: texto.title || '',
      content: texto.content || '',
      is_active: Boolean(texto.is_active),
      sort_order: Number(texto.sort_order || 0),
    });
    setErro('');
    setModalAberto(true);
  };

  const fecharModal = () => {
    if (salvando) return;
    setModalAberto(false);
    setTextoEditando(null);
    setForm(criarFormularioVazio());
  };

  const salvarTexto = async (event) => {
    event.preventDefault();

    if (!podeGerenciar) return;

    const payload = {
      title: form.title.trim(),
      content: form.content,
      is_active: form.is_active,
      sort_order: Number(form.sort_order || 0),
    };

    if (!payload.title) {
      setErro(pageConfig.titleRequiredError);
      return;
    }

    if (!payload.content.trim()) {
      setErro(pageConfig.contentRequiredError);
      return;
    }

    try {
      setSalvando(true);
      setErro('');

      const { data } = textoEditando
        ? await api.put(`${pageConfig.adminEndpoint}/${textoEditando.id}`, payload, { headers })
        : await api.post(pageConfig.adminEndpoint, payload, { headers });

      setTextos((atuais) => {
        if (textoEditando) {
          return atuais.map((texto) => (texto.id === data.id ? data : texto));
        }

        return [...atuais, data].sort((a, b) => (
          Number(a.sort_order || 0) - Number(b.sort_order || 0) ||
          String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR')
        ));
      });

      setTextoAbertoId(data.id);
      fecharModal();
    } catch (err) {
      console.error(`Erro ao salvar ${pageConfig.title}:`, err);
      setErro(err.response?.data?.error || pageConfig.saveError);
    } finally {
      setSalvando(false);
    }
  };

  const alternarStatus = async (texto) => {
    if (!podeGerenciar) return;

    try {
      setErro('');
      const { data } = await api.patch(
        `${pageConfig.adminEndpoint}/${texto.id}/toggle`,
        { is_active: !texto.is_active },
        { headers }
      );

      setTextos((atuais) => atuais.map((item) => (item.id === data.id ? data : item)));
    } catch (err) {
      console.error('Erro ao ativar/desativar texto:', err);
      setErro(err.response?.data?.error || pageConfig.statusError);
    }
  };

  const copiarConteudo = async (texto) => {
    try {
      await copiarTexto(texto.content || '');
      setCopiadoId(texto.id);
      window.setTimeout(() => setCopiadoId(null), 1600);
    } catch (err) {
      console.error('Erro ao copiar texto:', err);
      setErro('Não foi possível copiar o texto.');
    }
  };

  const confirmarExclusao = async () => {
    if (!textoParaExcluir || !podeGerenciar) return;

    try {
      setExcluindo(true);
      await api.delete(`${pageConfig.adminEndpoint}/${textoParaExcluir.id}`, { headers });
      setTextos((atuais) => atuais.filter((texto) => texto.id !== textoParaExcluir.id));
      setTextoAbertoId((atual) => (atual === textoParaExcluir.id ? null : atual));
      setTextoParaExcluir(null);
    } catch (err) {
      console.error('Erro ao excluir texto:', err);
      setErro(err.response?.data?.error || pageConfig.deleteError);
    } finally {
      setExcluindo(false);
    }
  };

  const renderTexto = (texto) => {
    const aberto = textoAbertoId === texto.id;

    return (
      <article
        id={`attendance-text-${texto.id}`}
        key={texto.id}
        className={`${styles.textCard} ${aberto ? styles.textCardOpen : ''} ${!texto.is_active ? styles.textCardInactive : ''}`}
      >
        <button
          type="button"
          className={styles.accordionButton}
          onClick={() => setTextoAbertoId((atual) => (atual === texto.id ? null : texto.id))}
          aria-expanded={aberto}
        >
          <span className={styles.textIcon}>
            <FileText size={20} />
          </span>
          <span className={styles.textTitle}>
            <strong>{texto.title}</strong>
            <small>
              {podeGerenciar && !texto.is_active ? 'Inativo' : pageConfig.itemStatus}
              {texto.updated_at ? ` · Atualizado em ${formatarData(texto.updated_at)}` : ''}
            </small>
          </span>
          <ChevronDown className={aberto ? styles.chevronOpen : ''} size={20} />
        </button>

        {aberto && (
          <div className={styles.textContentPanel}>
            <div className={styles.textContent}>
              {texto.content || 'Sem conteúdo cadastrado.'}
            </div>

            <div className={styles.textActions}>
              <button type="button" className={styles.primaryButton} onClick={() => copiarConteudo(texto)}>
                {copiadoId === texto.id ? <Check size={16} /> : <Copy size={16} />}
                {copiadoId === texto.id ? pageConfig.copiedButtonLabel : pageConfig.copyButtonLabel}
              </button>

              {podeGerenciar && (
                <>
                  <button type="button" className={styles.secondaryButton} onClick={() => abrirEdicao(texto)}>
                    <Pencil size={16} />
                    Editar
                  </button>
                  <button type="button" className={styles.secondaryButton} onClick={() => alternarStatus(texto)}>
                    {texto.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                    {texto.is_active ? 'Desativar' : 'Ativar'}
                  </button>
                  <button
                    type="button"
                    className={`${styles.secondaryButton} ${styles.dangerButton}`}
                    onClick={() => setTextoParaExcluir(texto)}
                  >
                    <Trash2 size={16} />
                    Excluir
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </article>
    );
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <button type="button" className={styles.backButton} onClick={voltarPaginaInterna}>
            <ArrowLeft size={18} />
            Voltar
          </button>

          <section className={styles.hero}>
            <span>
              <FileText size={16} />
              {pageConfig.heroKicker}
            </span>
            <h1>{pageConfig.title}</h1>
            <p>{pageConfig.subtitle}</p>
          </section>
        </header>

        <section className={styles.toolbar}>
          <label className={styles.searchBox}>
            <Search size={18} />
            <input
              type="search"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar por título ou conteúdo"
            />
          </label>

          {podeGerenciar && (
            <button type="button" className={styles.primaryButton} onClick={abrirNovoTexto}>
              <Plus size={18} />
              {pageConfig.newButtonLabel}
            </button>
          )}
        </section>

        {erro && <div className={styles.errorBox}>{erro}</div>}

        {carregando ? (
          <div className={styles.loadingBox}>{pageConfig.loadingLabel}</div>
        ) : textosFiltrados.length > 0 ? (
          <section className={styles.textList}>
            {textosFiltrados.map(renderTexto)}
          </section>
        ) : (
          <section className={styles.emptyState}>
            <FileText size={40} />
            <h2>{pageConfig.emptyTitle}</h2>
            <p>{busca ? pageConfig.searchEmptyMessage : pageConfig.emptyMessage}</p>
            {podeGerenciar && (
              <button type="button" className={styles.primaryButton} onClick={abrirNovoTexto}>
                <Plus size={18} />
                {pageConfig.newButtonLabel}
              </button>
            )}
          </section>
        )}
      </div>

      {modalAberto && (
        <div className={styles.modalOverlay} onClick={fecharModal}>
          <form className={styles.formModal} onSubmit={salvarTexto} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2>{textoEditando ? pageConfig.editModalTitle : pageConfig.newModalTitle}</h2>
                <p>{textoEditando ? pageConfig.editModalDescription : pageConfig.newModalDescription}</p>
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
                rows={14}
              />
            </label>

            <div className={styles.formGrid}>
              <label className={styles.field}>
                Ordem
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(event) => atualizarForm('sort_order', event.target.value)}
                />
              </label>

              <label className={styles.toggleField}>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => atualizarForm('is_active', event.target.checked)}
                />
                Ativo
              </label>
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={fecharModal} disabled={salvando}>
                Cancelar
              </button>
              <button type="submit" className={styles.primaryButton} disabled={salvando}>
                {salvando ? pageConfig.savingButtonLabel : pageConfig.saveButtonLabel}
              </button>
            </div>
          </form>
        </div>
      )}

      {textoParaExcluir && (
        <div className={styles.modalOverlay} onClick={() => !excluindo && setTextoParaExcluir(null)}>
          <section className={styles.confirmModal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2>{pageConfig.deleteTitle}</h2>
                <p>{pageConfig.deleteDescription}</p>
              </div>
            </div>

            <strong>{textoParaExcluir.title}</strong>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setTextoParaExcluir(null)}
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
                {excluindo ? pageConfig.deletingButtonLabel : pageConfig.deleteButtonLabel}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
