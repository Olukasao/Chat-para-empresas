import { ArrowLeft, Pencil, RotateCcw } from "lucide-react";
import { normalizeAvisosContent } from "../utils/avisosInternos";
import { formatarPercentualMetaComercial } from "../utils/metaComercial";

export default function AvisosInternosContent({
  conteudo,
  logoSrc,
  onBack,
  onEdit,
  onResetMeta,
  resetMetaLoading = false,
  mostrarAcoes = false,
  preview = false,
}) {
  const data = normalizeAvisosContent(conteudo);
  const autorGeralAvisos = String(data.atualizado_por_nome || "").trim();
  const formatarAutorAviso = (nome = "") => String(nome || "")
    .trim()
    .toLocaleUpperCase("pt-BR");

  return (
    <div className={`avisos-page${preview ? " avisos-preview-surface" : ""}`}>
      <div className="avisos-background-glow" />

      <header className="avisos-header">
        {mostrarAcoes && (
          <div className="avisos-header-actions">
            <button type="button" className="avisos-header-button" onClick={onBack}>
              <ArrowLeft size={17} />
              Voltar
            </button>

            {onEdit && (
              <button
                type="button"
                className="avisos-header-button avisos-header-button-admin"
                onClick={onEdit}
              >
                <Pencil size={16} />
                Editar
              </button>
            )}
          </div>
        )}

        <img src={logoSrc} alt="Acessa Net" className="avisos-logo" />

        <div className="avisos-header-text">
          <span className="avisos-kicker">{data.kicker}</span>
          <h1 className="avisos-title">{data.titulo}</h1>
          <p className="avisos-subtitle">{data.subtitulo}</p>
        </div>
      </header>

      <section className="avisos-summary-grid">
        {data.resumo.map((item) => (
          <article key={item.id} className="avisos-summary-card">
            <span className="avisos-summary-icon">{item.icone}</span>
            <div>
              <strong>{item.valor}</strong>
              <p>{item.rotulo}</p>
            </div>
          </article>
        ))}
      </section>

      <main className="avisos-content">
        <section className="avisos-left-column">
          <div className="avisos-section-header">
            <div>
              <h2 className="avisos-section-title">{data.secao_comunicados.titulo}</h2>
              <p className="avisos-section-subtitle">{data.secao_comunicados.subtitulo}</p>
            </div>
          </div>

          <div className="avisos-notice-list">
            {data.comunicados.length > 0 ? (
              data.comunicados.map((item) => {
                const autorAviso = formatarAutorAviso(item.autor || autorGeralAvisos);

                return (
                  <article key={item.id} className="avisos-notice-card">
                    <div className="avisos-notice-icon">{item.icone}</div>

                    <div className="avisos-notice-content">
                      <div className="avisos-notice-top">
                        <span className="avisos-notice-type">{item.tipo}</span>
                        <span className="avisos-notice-date">{item.data}</span>
                      </div>

                      <h3 className="avisos-notice-title">{item.titulo}</h3>
                      <p className="avisos-notice-description">{item.descricao}</p>

                      <div className="avisos-notice-footer">
                        {item.status && <span className="avisos-status-badge">{item.status}</span>}
                        {autorAviso && <span className="avisos-notice-author">{autorAviso}</span>}
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="avisos-empty">Nenhum comunicado cadastrado.</div>
            )}
          </div>
        </section>

        <aside className="avisos-right-column">
          <section className="avisos-goal-card">
            <span className="avisos-goal-badge">{data.meta.selo}</span>
            <h2 className="avisos-goal-title">{data.meta.titulo}</h2>
            <p className="avisos-goal-text">{data.meta.texto}</p>

            <div className="avisos-progress-box">
              <div className="avisos-progress-info">
                <span>{data.meta.progresso_label}</span>
                <strong>{formatarPercentualMetaComercial(data.meta.progresso)}</strong>
              </div>
              <div className="avisos-progress-track">
                <div className="avisos-progress-fill" style={{ width: `${data.meta.progresso}%` }} />
              </div>
            </div>

            {onResetMeta && (
              <button
                type="button"
                className="avisos-goal-reset-button"
                onClick={onResetMeta}
                disabled={resetMetaLoading}
              >
                <RotateCcw size={15} />
                {resetMetaLoading ? "Resetando..." : "Resetar meta"}
              </button>
            )}
          </section>

          <section className="avisos-wiki-card">
            <div className="avisos-section-header-simple">
              <h2 className="avisos-section-title">{data.wiki.titulo}</h2>
              <p className="avisos-section-subtitle">{data.wiki.subtitulo}</p>
            </div>

            <div className="avisos-wiki-list">
              {data.wiki.itens.length > 0 ? (
                data.wiki.itens.map((item) => (
                  <article key={item.id} className="avisos-wiki-item">
                    <span className="avisos-wiki-icon">{item.icone}</span>
                    <div>
                      <strong>{item.titulo}</strong>
                      <p>{item.descricao}</p>
                      {item.categoria && <small>{item.categoria}</small>}
                    </div>
                  </article>
                ))
              ) : (
                <div className="avisos-empty">Nenhum tutorial cadastrado.</div>
              )}
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}
