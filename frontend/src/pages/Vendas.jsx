import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  HelpCircle,
  Image,
  Loader2,
  Moon,
  Pencil,
  Plus,
  Presentation,
  RefreshCw,
  ShoppingCart,
  Sun,
  ToggleLeft,
  ToggleRight,
  UploadCloud,
  X,
} from 'lucide-react';
import api from '../services/api';
import baixarArquivo from '../utils/baixarArquivo';
import { useInternalBack } from '../utils/internalNavigation';
import useTheme from '../utils/useTheme';
import { THEME_DARK, THEME_LIGHT } from '../utils/theme';
import styles from '../styles/Vendas.module.css';

const MATERIAL_TYPES = [
  { value: 'imagem', label: 'Imagem' },
  { value: 'pdf', label: 'PDF' },
  { value: 'docx', label: 'DOCX' },
  { value: 'pptx', label: 'PPTX' },
  { value: 'link', label: 'Link' },
  { value: 'outro', label: 'Outro' },
];

const MATERIAL_TYPE_ICONS = {
  imagem: Image,
  pdf: FileText,
  docx: FileText,
  pptx: Presentation,
  link: ExternalLink,
  outro: BookOpen,
};

const criarFormularioVazio = () => ({
  title: '',
  description: '',
  category: '',
  material_type: 'pdf',
  external_url: '',
  display_order: 0,
  is_active: true,
  cover_image: null,
  material_file: null,
});

const formatarTamanho = (bytes = 0) => {
  const tamanho = Number(bytes || 0);

  if (!tamanho) return '';
  if (tamanho >= 1024 * 1024) return `${(tamanho / (1024 * 1024)).toFixed(1)} MB`;
  if (tamanho >= 1024) return `${Math.round(tamanho / 1024)} KB`;

  return `${tamanho} B`;
};

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

const obterCapaMaterial = (material = {}) => (
  material.cover_image_url || (material.material_type === 'imagem' ? material.file_url : '')
);

function MaterialCard({
  material,
  canManage,
  imageFailed,
  onImageError,
  onOpen,
  onEdit,
  onChangeCover,
  onChangeFile,
  onDeactivate,
  onActivate,
}) {
  const IconeMaterial = MATERIAL_TYPE_ICONS[material.material_type] || HelpCircle;
  const capa = obterCapaMaterial(material);
  const semDestino = !material.file_url && !material.external_url;

  return (
    <article className={`${styles.materialCard} ${!material.is_active ? styles.inactiveCard : ''}`}>
      <button
        type="button"
        className={styles.cardOpenButton}
        onClick={() => onOpen(material)}
        disabled={semDestino}
        title={semDestino ? 'Material ainda sem arquivo ou link cadastrado' : 'Abrir material'}
      >
        <div className={styles.previewFrame}>
          {capa && !imageFailed ? (
            <>
              <img
                src={capa}
                alt=""
                className={styles.previewImageBg}
                loading="lazy"
                aria-hidden="true"
              />
              <img
                src={capa}
                alt={`Capa de ${material.title}`}
                className={styles.previewImage}
                loading="lazy"
                onError={() => onImageError(material.id)}
              />
            </>
          ) : (
            <div className={styles.previewFallback}>
              <Image size={30} />
              <span>Sem imagem de capa</span>
            </div>
          )}
        </div>

        <div className={styles.cardBody}>
          <div className={styles.cardTopline}>
            <span className={styles.categoryTag}>{material.category || 'Material'}</span>
            <span className={styles.typeIcon} aria-hidden="true">
              <IconeMaterial size={17} />
            </span>
          </div>

          <h2>{material.title}</h2>
          <p>{material.description || 'Material comercial para consulta da equipe.'}</p>
        </div>

        <div className={styles.cardAction}>
          <span>
            {semDestino ? 'Aguardando arquivo ou link' : 'Abrir material'}
          </span>
          {semDestino ? <UploadCloud size={15} /> : <ExternalLink size={15} />}
        </div>
      </button>

      {canManage && (
        <div className={styles.adminActions}>
          <button type="button" onClick={() => onEdit(material)}>
            <Pencil size={14} />
            Editar
          </button>
          <button type="button" onClick={() => onChangeCover(material)}>
            <Image size={14} />
            Trocar imagem
          </button>
          <button type="button" onClick={() => onChangeFile(material)}>
            <RefreshCw size={14} />
            Trocar arquivo
          </button>
          {material.is_active ? (
            <button type="button" className={styles.dangerAction} onClick={() => onDeactivate(material)}>
              <ToggleLeft size={14} />
              Desativar
            </button>
          ) : (
            <button type="button" className={styles.successAction} onClick={() => onActivate(material)}>
              <ToggleRight size={14} />
              Ativar
            </button>
          )}
        </div>
      )}

      {canManage && (
        <div className={styles.adminMeta}>
          <span>{material.is_active ? 'Ativo' : 'Inativo'}</span>
          <span>Ordem {material.display_order}</span>
          {formatarData(material.updated_at) && <span>Atualizado {formatarData(material.updated_at)}</span>}
        </div>
      )}
    </article>
  );
}

export default function Vendas({ embedded = false }) {
  const navigate = useNavigate();
  const {
    isLightTheme: temaClaro,
    setTheme: definirTema,
  } = useTheme();
  const voltarPaginaInterna = useInternalBack('/chat');
  const token = useMemo(() => localStorage.getItem('token'), []);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [materials, setMaterials] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [feedback, setFeedback] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [materialEditando, setMaterialEditando] = useState(null);
  const [form, setForm] = useState(criarFormularioVazio);
  const [salvando, setSalvando] = useState(false);
  const [imagemAberta, setImagemAberta] = useState(null);
  const [imagensComErro, setImagensComErro] = useState({});

  const carregarMateriais = useCallback(async () => {
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    try {
      setCarregando(true);
      setErro('');

      const { data } = await api.get('/vendas/materiais?include_inactive=1', { headers });

      setMaterials(Array.isArray(data.materials) ? data.materials : []);
      setCanManage(Boolean(data.can_manage));
    } catch (err) {
      console.error('Erro ao carregar materiais de vendas:', err);

      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login', { replace: true });
        return;
      }

      setErro(err.response?.data?.error || 'Não foi possível carregar os materiais de vendas.');
    } finally {
      setCarregando(false);
    }
  }, [headers, navigate, token]);

  useEffect(() => {
    carregarMateriais();
  }, [carregarMateriais]);

  const abrirNovoMaterial = () => {
    if (!canManage) return;

    const proximaOrdem = materials.reduce(
      (maior, material) => Math.max(maior, Number(material.display_order || 0)),
      0
    ) + 10;

    setMaterialEditando(null);
    setForm({ ...criarFormularioVazio(), display_order: proximaOrdem });
    setErro('');
    setFeedback('');
    setModalAberto(true);
  };

  const abrirEdicao = (material) => {
    if (!canManage) return;

    setMaterialEditando(material);
    setForm({
      title: material.title || '',
      description: material.description || '',
      category: material.category || '',
      material_type: material.material_type || 'outro',
      external_url: material.external_url || '',
      display_order: Number(material.display_order || 0),
      is_active: Boolean(material.is_active),
      cover_image: null,
      material_file: null,
    });
    setErro('');
    setFeedback('');
    setModalAberto(true);
  };

  const fecharModal = () => {
    if (salvando) return;

    setModalAberto(false);
    setMaterialEditando(null);
    setForm(criarFormularioVazio());
  };

  const atualizarForm = (campo, valor) => {
    setErro('');
    setFeedback('');
    setForm((atual) => ({
      ...atual,
      [campo]: valor,
    }));
  };

  const montarPayload = () => {
    const payload = new FormData();

    payload.append('title', form.title.trim());
    payload.append('description', form.description.trim());
    payload.append('category', form.category.trim());
    payload.append('material_type', form.material_type);
    payload.append('external_url', form.external_url.trim());
    payload.append('display_order', String(Number(form.display_order || 0)));
    payload.append('is_active', form.is_active ? '1' : '0');

    if (form.cover_image) {
      payload.append('cover_image', form.cover_image);
    }

    if (form.material_file) {
      payload.append('material_file', form.material_file);
    }

    return payload;
  };

  const salvarMaterial = async (event) => {
    event.preventDefault();
    if (!canManage) return;

    if (!form.title.trim()) {
      setErro('Informe o título do material.');
      return;
    }

    try {
      setSalvando(true);
      setErro('');
      setFeedback('');

      const payload = montarPayload();
      const { data } = materialEditando
        ? await api.put(`/vendas/materiais/${materialEditando.id}`, payload, { headers })
        : await api.post('/vendas/materiais', payload, { headers });

      setMaterials((atuais) => {
        const atualizados = materialEditando
          ? atuais.map((material) => (material.id === data.id ? data : material))
          : [...atuais, data];

        return atualizados.sort((a, b) => (
          Number(a.display_order || 0) - Number(b.display_order || 0) ||
          String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR')
        ));
      });

      setFeedback(materialEditando ? 'Material atualizado.' : 'Material cadastrado.');
      setModalAberto(false);
      setMaterialEditando(null);
      setForm(criarFormularioVazio());
    } catch (err) {
      console.error('Erro ao salvar material de vendas:', err);
      setErro(err.response?.data?.error || 'Não foi possível salvar o material.');
    } finally {
      setSalvando(false);
    }
  };

  const atualizarStatus = async (material, isActive) => {
    if (!canManage) return;

    try {
      setErro('');
      setFeedback('');

      const payload = new FormData();
      payload.append('title', material.title || '');
      payload.append('description', material.description || '');
      payload.append('category', material.category || '');
      payload.append('material_type', material.material_type || 'outro');
      payload.append('external_url', material.external_url || '');
      payload.append('display_order', String(Number(material.display_order || 0)));
      payload.append('is_active', isActive ? '1' : '0');

      const { data } = await api.put(`/vendas/materiais/${material.id}`, payload, { headers });

      setMaterials((atuais) => atuais.map((item) => (item.id === material.id ? data : item)));
      setFeedback(isActive ? 'Material ativado.' : 'Material desativado.');
    } catch (err) {
      console.error('Erro ao alterar status do material:', err);
      setErro(err.response?.data?.error || 'Não foi possível alterar o status do material.');
    }
  };

  const desativarMaterial = async (material) => {
    if (!canManage) return;

    const confirmar = window.confirm(`Desativar "${material.title}" da página de Vendas?`);
    if (!confirmar) return;

    try {
      setErro('');
      setFeedback('');

      const { data } = await api.delete(`/vendas/materiais/${material.id}`, { headers });

      setMaterials((atuais) => atuais.map((item) => (item.id === material.id ? data : item)));
      setFeedback('Material desativado.');
    } catch (err) {
      console.error('Erro ao desativar material:', err);
      setErro(err.response?.data?.error || 'Não foi possível desativar o material.');
    }
  };

  const abrirMaterial = async (material) => {
    const destino = material.material_type === 'link'
      ? material.external_url
      : material.file_url || material.external_url;

    if (!destino) {
      setErro('Este material ainda não tem arquivo ou link cadastrado.');
      return;
    }

    if (material.material_type === 'imagem' && material.file_url) {
      setImagemAberta({
        title: material.title,
        url: material.file_url,
      });
      return;
    }

    if (['docx', 'pptx'].includes(material.material_type)) {
      await baixarArquivo(destino, material.file_name || material.title);
      return;
    }

    window.open(destino, '_blank', 'noopener,noreferrer');
  };

  const marcarImagemComErro = (materialId) => {
    setImagensComErro((atuais) => ({
      ...atuais,
      [materialId]: true,
    }));
  };

  const pageClasses = [
    styles.page,
    embedded ? styles.embeddedPage : '',
    temaClaro ? styles.lightMode : styles.darkMode,
  ].filter(Boolean).join(' ');

  return (
    <main className={pageClasses}>
      <div className={styles.shell}>
        <button type="button" className={styles.backButton} onClick={voltarPaginaInterna}>
          <ArrowLeft size={16} />
          Voltar
        </button>

        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <span className={styles.kicker}>
              <ShoppingCart size={15} />
              Acesso Rápido
            </span>
            <h1>Vendas</h1>
            <p>Materiais, tutoriais e imagens prontas para a equipe comercial.</p>
          </div>

          <div className={styles.headerActions}>
            <div className={styles.themeSwitch} role="group" aria-label="Escolher modo da página">
              <button
                type="button"
                className={`${styles.themeOption} ${temaClaro ? styles.themeOptionActive : ''}`}
                onClick={() => definirTema(THEME_LIGHT)}
                aria-pressed={temaClaro}
                title="Ativar modo dia"
              >
                <Sun size={15} />
                Dia
              </button>
              <button
                type="button"
                className={`${styles.themeOption} ${!temaClaro ? styles.themeOptionActive : ''}`}
                onClick={() => definirTema(THEME_DARK)}
                aria-pressed={!temaClaro}
                title="Ativar modo noite"
              >
                <Moon size={15} />
                Noite
              </button>
            </div>

            <div className={styles.headerPanel} aria-label="Resumo dos materiais">
              <strong>{materials.filter((material) => material.is_active).length}</strong>
              <span>materiais ativos</span>
            </div>

            {canManage && (
              <button type="button" className={styles.primaryButton} onClick={abrirNovoMaterial}>
                <Plus size={17} />
                Novo material
              </button>
            )}
          </div>
        </header>

        {erro && <div className={styles.errorBox}>{erro}</div>}
        {feedback && <div className={styles.successBox}>{feedback}</div>}

        {carregando ? (
          <div className={styles.loadingBox}>
            <Loader2 size={20} />
            Carregando materiais de vendas...
          </div>
        ) : materials.length ? (
          <section className={styles.materialGrid} aria-label="Materiais de vendas">
            {materials.map((material) => (
              <MaterialCard
                key={material.id}
                material={material}
                canManage={canManage}
                imageFailed={Boolean(imagensComErro[material.id])}
                onImageError={marcarImagemComErro}
                onOpen={abrirMaterial}
                onEdit={abrirEdicao}
                onChangeCover={abrirEdicao}
                onChangeFile={abrirEdicao}
                onDeactivate={desativarMaterial}
                onActivate={(item) => atualizarStatus(item, true)}
              />
            ))}
          </section>
        ) : (
          <div className={styles.emptyBox}>
            <BookOpen size={22} />
            <strong>Nenhum material cadastrado.</strong>
            {canManage && <button type="button" onClick={abrirNovoMaterial}>Cadastrar primeiro material</button>}
          </div>
        )}
      </div>

      {modalAberto && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <form className={styles.modal} onSubmit={salvarMaterial}>
            <div className={styles.modalHeader}>
              <div>
                <h2>{materialEditando ? 'Editar material' : 'Novo material'}</h2>
                <p>Cadastre a capa, arquivo ou link que aparece no card de Vendas.</p>
              </div>
              <button type="button" onClick={fecharModal} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            <div className={styles.formGrid}>
              <label className={styles.fieldWide}>
                Título
                <input
                  type="text"
                  value={form.title}
                  onChange={(event) => atualizarForm('title', event.target.value)}
                  maxLength={255}
                  required
                />
              </label>

              <label className={styles.fieldWide}>
                Descrição
                <textarea
                  value={form.description}
                  onChange={(event) => atualizarForm('description', event.target.value)}
                  rows={3}
                />
              </label>

              <label>
                Categoria
                <input
                  type="text"
                  value={form.category}
                  onChange={(event) => atualizarForm('category', event.target.value)}
                  maxLength={100}
                  placeholder="Tutorial, Documento, FAQ..."
                />
              </label>

              <label>
                Tipo de material
                <select
                  value={form.material_type}
                  onChange={(event) => atualizarForm('material_type', event.target.value)}
                >
                  {MATERIAL_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </label>

              <label>
                Ordem
                <input
                  type="number"
                  value={form.display_order}
                  onChange={(event) => atualizarForm('display_order', event.target.value)}
                />
              </label>

              <label className={styles.toggleField}>
                <span>Ativo</span>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => atualizarForm('is_active', event.target.checked)}
                />
              </label>

              <label className={styles.fieldWide}>
                URL externa
                <input
                  type="url"
                  value={form.external_url}
                  onChange={(event) => atualizarForm('external_url', event.target.value)}
                  placeholder="https://..."
                />
              </label>

              <label className={styles.uploadBox}>
                <UploadCloud size={18} />
                <span>
                  {form.cover_image
                    ? form.cover_image.name
                    : 'Upload da imagem de capa (.png, .jpg, .jpeg, .webp)'}
                </span>
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                  onChange={(event) => atualizarForm('cover_image', event.target.files?.[0] || null)}
                />
              </label>

              <label className={styles.uploadBox}>
                <UploadCloud size={18} />
                <span>
                  {form.material_file
                    ? form.material_file.name
                    : 'Upload do arquivo do material (.pdf, .doc, .docx, .ppt, .pptx, imagens)'}
                </span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.webp"
                  onChange={(event) => atualizarForm('material_file', event.target.files?.[0] || null)}
                />
              </label>
            </div>

            {materialEditando?.file_name && (
              <div className={styles.currentFile}>
                <Download size={15} />
                Arquivo atual: {materialEditando.file_name}
                {formatarTamanho(materialEditando.file_size) && ` (${formatarTamanho(materialEditando.file_size)})`}
              </div>
            )}

            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={fecharModal}>
                Cancelar
              </button>
              <button type="submit" className={styles.primaryButton} disabled={salvando}>
                {salvando ? <Loader2 size={16} /> : <CheckCircle2 size={16} />}
                {salvando ? 'Salvando...' : 'Salvar material'}
              </button>
            </div>
          </form>
        </div>
      )}

      {imagemAberta && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.imageModal}>
            <div className={styles.modalHeader}>
              <strong>{imagemAberta.title}</strong>
              <button type="button" onClick={() => setImagemAberta(null)} aria-label="Fechar imagem">
                <X size={18} />
              </button>
            </div>
            <img src={imagemAberta.url} alt={imagemAberta.title} />
          </div>
        </div>
      )}
    </main>
  );
}
