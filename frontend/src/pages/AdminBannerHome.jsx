import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Home, Image, RotateCcw, Save, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import HomeBanner from "../components/HomeBanner";
import api from "../services/api";
import {
  DEFAULT_HOME_BANNER_CONTENT,
  HOME_BANNER_MODES,
  normalizeHomeBannerContent,
} from "../utils/homeBanner";
import adminStyles from "../styles/Admin.module.css";
import "../styles/AdminBannerHome.css";

const gruposCampos = [
  {
    titulo: "Chamada",
    descricao: "Texto exibido no banner em código.",
    campos: [
      ["selo", "Selo", 80],
      ["titulo_linha_1", "Título", 100],
      ["titulo_destaque", "Destaque azul", 100],
      ["descricao_linha_1", "Descrição", 220, true],
    ],
  },
  {
    titulo: "Oferta",
    descricao: "Card exibido à direita no banner em código.",
    campos: [
      ["oferta_titulo", "Título da oferta", 80],
      ["oferta_subtitulo", "Subtítulo verde", 80],
      ["beneficio_1_titulo", "Benefício 1 - título", 60],
      ["beneficio_1_detalhe", "Benefício 1 - detalhe", 60],
      ["beneficio_2_titulo", "Benefício 2 - título", 60],
      ["beneficio_2_detalhe", "Benefício 2 - detalhe", 60],
      ["beneficio_3_titulo", "Benefício 3 - título", 60],
      ["beneficio_3_detalhe", "Benefício 3 - detalhe", 60],
    ],
  },
  {
    titulo: "Botão",
    descricao: "Único elemento clicável do banner em modo imagem.",
    campos: [
      ["botao_texto", "Texto do botão", 100],
      ["botao_url", "Link do botão", 500, true, "url"],
    ],
  },
];

export default function AdminBannerHome() {
  const navigate = useNavigate();
  const [conteudo, setConteudo] = useState(
    () => normalizeHomeBannerContent(DEFAULT_HOME_BANNER_CONTENT)
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [erro, setErro] = useState("");
  const [feedback, setFeedback] = useState("");
  const [atualizadoEm, setAtualizadoEm] = useState(null);

  const token = useMemo(() => localStorage.getItem("token"), []);
  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
  }), [token]);

  const carregarConteudo = useCallback(async () => {
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    try {
      setLoading(true);
      setErro("");

      const [{ data: usuario }, { data: banner }] = await Promise.all([
        api.get("/me", { headers }),
        api.get("/banner-home", { headers }),
      ]);

      if (usuario.perfil !== "admin") {
        setErro("Seu usuário não tem permissão para editar o banner da home.");
        return;
      }

      setConteudo(normalizeHomeBannerContent(banner));
      setAtualizadoEm(banner.atualizado_em || null);
    } catch (err) {
      console.error("Erro ao carregar editor do banner:", err);
      setErro(
        err.response?.status === 403
          ? "Seu usuário não tem permissão para editar o banner da home."
          : "Não foi possível carregar o editor do banner."
      );
    } finally {
      setLoading(false);
    }
  }, [headers, navigate, token]);

  useEffect(() => {
    carregarConteudo();
  }, [carregarConteudo]);

  const alterarCampo = (campo, valor) => {
    setFeedback("");
    setConteudo((atual) => ({
      ...atual,
      [campo]: valor,
    }));
  };

  const salvarConteudo = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setErro("");
      setFeedback("");

      const payload = normalizeHomeBannerContent(conteudo);

      if (payload.modo === HOME_BANNER_MODES.IMAGE && !payload.imagem_url) {
        setErro("Envie uma imagem antes de publicar o banner em modo imagem.");
        return;
      }

      const { data } = await api.put("/banner-home", payload, { headers });

      setConteudo(normalizeHomeBannerContent(data));
      setAtualizadoEm(data.atualizado_em || new Date().toISOString());
      setFeedback("Banner principal atualizado com sucesso.");
    } catch (err) {
      console.error("Erro ao salvar banner:", err);
      setErro(err.response?.data?.error || "Não foi possível salvar o banner.");
    } finally {
      setSaving(false);
    }
  };

  const restaurarModelo = () => {
    const confirmou = window.confirm(
      "Restaurar os textos padrão? Clique em salvar para publicar a restauração."
    );

    if (!confirmou) return;

    setConteudo(normalizeHomeBannerContent(DEFAULT_HOME_BANNER_CONTENT));
    setFeedback("Modelo padrão carregado. Clique em salvar para publicar.");
  };

  const alterarModo = (modo) => {
    setFeedback("");
    setErro("");
    setConteudo((atual) => normalizeHomeBannerContent({
      ...atual,
      modo,
    }));
  };

  const enviarImagem = async (event) => {
    const arquivo = event.target.files?.[0];
    event.target.value = "";

    if (!arquivo) return;

    try {
      setUploading(true);
      setErro("");
      setFeedback("");

      const formData = new FormData();
      formData.append("imagem", arquivo);

      const { data } = await api.post("/banner-home/upload", formData, { headers });

      setConteudo((atual) => normalizeHomeBannerContent({
        ...atual,
        modo: HOME_BANNER_MODES.IMAGE,
        imagem_url: data.url,
        imagem_alt: data.nome || atual.imagem_alt,
      }));
      setFeedback("Imagem enviada. Clique em salvar para publicar no banner.");
    } catch (err) {
      console.error("Erro ao enviar imagem do banner:", err);
      setErro(err.response?.data?.error || "Não foi possível enviar a imagem.");
    } finally {
      setUploading(false);
    }
  };

  const formatarData = (data) => {
    if (!data) return "Ainda não salvo";

    return new Date(data).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className={adminStyles.page}>
        <div className={adminStyles.loading}>Carregando editor do banner...</div>
      </div>
    );
  }

  return (
    <div className={adminStyles.page}>
      <header className={adminStyles.header}>
        <div>
          <p className={adminStyles.eyebrow}>Painel administrativo</p>
          <h1>Editar banner principal</h1>
          <p className={adminStyles.subtitle}>
            Escolha entre o banner em código ou uma imagem de fundo. Última atualização: {formatarData(atualizadoEm)}
          </p>
        </div>

        <div className={adminStyles.headerActions}>
          <button
            type="button"
            className={adminStyles.secondaryButton}
            onClick={() => navigate("/admin")}
          >
            <ArrowLeft size={16} />
            Admin
          </button>
          <button
            type="button"
            className={adminStyles.secondaryButton}
            onClick={() => navigate("/")}
          >
            <Home size={16} />
            Ver home
          </button>
        </div>
      </header>

      {erro && <div className={adminStyles.errorBox}>{erro}</div>}
      {feedback && <div className="admin-banner-success">{feedback}</div>}

      {!erro && (
        <form className="admin-banner-layout" onSubmit={salvarConteudo}>
          <section className={adminStyles.section}>
            <div className={adminStyles.sectionHeader}>
              <div>
                <h2>Informações do banner</h2>
                <p>Publique a versão em código ou envie uma imagem com o botão por cima.</p>
              </div>
              <div className={adminStyles.actionGroup}>
                <button
                  type="button"
                  className={adminStyles.secondaryButton}
                  onClick={restaurarModelo}
                >
                  <RotateCcw size={16} />
                  Modelo
                </button>
                <button
                  type="submit"
                  className={adminStyles.primaryButton}
                  disabled={saving}
                >
                  <Save size={16} />
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>

            <div className="admin-banner-fields">
              <section className="admin-banner-form-block">
                <div className="admin-banner-block-header">
                  <h3>Modo do banner</h3>
                  <p>O modo imagem mostra somente o botão sobre a arte enviada.</p>
                </div>

                <div className="admin-banner-mode-grid">
                  <button
                    type="button"
                    className={conteudo.modo === HOME_BANNER_MODES.CODE ? "admin-banner-mode-card admin-banner-mode-card-active" : "admin-banner-mode-card"}
                    onClick={() => alterarModo(HOME_BANNER_MODES.CODE)}
                    aria-pressed={conteudo.modo === HOME_BANNER_MODES.CODE}
                  >
                    <Image size={18} />
                    Banner em código
                  </button>
                  <button
                    type="button"
                    className={conteudo.modo === HOME_BANNER_MODES.IMAGE ? "admin-banner-mode-card admin-banner-mode-card-active" : "admin-banner-mode-card"}
                    onClick={() => alterarModo(HOME_BANNER_MODES.IMAGE)}
                    aria-pressed={conteudo.modo === HOME_BANNER_MODES.IMAGE}
                  >
                    <Upload size={18} />
                    Usar imagem
                  </button>
                </div>
              </section>

              {conteudo.modo === HOME_BANNER_MODES.IMAGE && (
                <section className="admin-banner-form-block">
                  <div className="admin-banner-block-header">
                    <h3>Imagem</h3>
                    <p>Use uma arte pronta para o banner principal da Home.</p>
                  </div>

                  <div className="admin-banner-image-editor">
                    <label className="admin-banner-upload-box">
                      <Upload size={18} />
                      <span>{uploading ? "Enviando..." : "Enviar imagem"}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={enviarImagem}
                        disabled={uploading || saving}
                      />
                    </label>

                    {conteudo.imagem_url && (
                      <div className="admin-banner-image-current">
                        <img src={conteudo.imagem_url} alt={conteudo.imagem_alt || "Banner principal"} />
                      </div>
                    )}

                    <div className="admin-banner-form-grid">
                      <label className="admin-banner-field-wide">
                        Descrição da imagem
                        <input
                          type="text"
                          value={conteudo.imagem_alt}
                          onChange={(event) => alterarCampo("imagem_alt", event.target.value)}
                          maxLength={120}
                        />
                      </label>
                    </div>
                  </div>
                </section>
              )}

              {conteudo.modo === HOME_BANNER_MODES.CODE && gruposCampos.map((grupo) => (
                <section key={grupo.titulo} className="admin-banner-form-block">
                  <div className="admin-banner-block-header">
                    <h3>{grupo.titulo}</h3>
                    <p>{grupo.descricao}</p>
                  </div>

                  <div className="admin-banner-form-grid">
                    {grupo.campos.map(([campo, label, maxLength, wide, type]) => (
                      <label
                        key={campo}
                        className={wide ? "admin-banner-field-wide" : undefined}
                      >
                        {label}
                        <input
                          type={type || "text"}
                          value={conteudo[campo]}
                          onChange={(event) => alterarCampo(campo, event.target.value)}
                          maxLength={maxLength}
                        />
                      </label>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>

          <aside className="admin-banner-preview-panel">
            <div className="admin-banner-preview-header">
              <strong>Preview ao vivo</strong>
              <span>As mudanças são publicadas somente ao salvar.</span>
            </div>
            <div className="admin-banner-preview">
              <HomeBanner content={conteudo} />
            </div>
          </aside>
        </form>
      )}
    </div>
  );
}
