import { HOME_BANNER_MODES, normalizeHomeBannerContent } from "../utils/homeBanner";
import "../styles/HomeBanner.css";

function openBannerLink(url) {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

function Benefit({ icon, title, detail }) {
  if (!title && !detail) return null;

  return (
    <div className="chat-offer-feature">
      <strong>{icon}</strong>
      {[title, detail].filter(Boolean).join(" ")}
    </div>
  );
}

function CodeBanner({ data, className, style }) {
  return (
    <section className={`chat-success-banner ${className}`.trim()} style={style}>
      <div className="chat-success-content">
        <div>
          <div className="chat-success-tag">✦ {data.selo}</div>

          <h2 className="chat-success-title">
            {data.titulo_linha_1}
            {data.titulo_linha_2 && <> {data.titulo_linha_2}</>}
            {data.titulo_destaque && <> <span>{data.titulo_destaque}</span></>}
          </h2>

          {(data.descricao_linha_1 || data.descricao_linha_2) && (
            <p className="chat-success-subtitle">
              {data.descricao_linha_1}
              {data.descricao_linha_2 && (
                <>
                  <br />
                  {data.descricao_linha_2}
                </>
              )}
            </p>
          )}
        </div>

        <div className="chat-success-visual">
          <div className="chat-offer-box">
            <h3 className="chat-offer-title">
              {data.oferta_titulo}
              {data.oferta_subtitulo && <span>{data.oferta_subtitulo}</span>}
            </h3>

            <div className="chat-offer-features">
              <Benefit icon="↯" title={data.beneficio_1_titulo} detail={data.beneficio_1_detalhe} />
              <Benefit icon="▣" title={data.beneficio_2_titulo} detail={data.beneficio_2_detalhe} />
              <Benefit icon="▯" title={data.beneficio_3_titulo} detail={data.beneficio_3_detalhe} />
            </div>

            <button
              type="button"
              className="chat-home-btn"
              onClick={() => openBannerLink(data.botao_url)}
              disabled={!data.botao_url}
            >
              {data.botao_texto}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ImageBanner({ data, className, style }) {
  return (
    <section
      className={`chat-home-image-banner ${className}`.trim()}
      style={style}
      aria-label={data.imagem_alt || "Banner principal da home"}
    >
      {data.imagem_url ? (
        <>
          <img
            src={data.imagem_url}
            alt={data.imagem_alt || "Banner principal da home"}
            className="chat-home-image-banner-media"
          />
          <button
            type="button"
            className="chat-home-image-offer-button"
            onClick={() => openBannerLink(data.botao_url)}
            disabled={!data.botao_url}
          >
            <span>Ver ofertas da campanha</span>
            <strong aria-hidden="true">→</strong>
          </button>
        </>
      ) : (
        <span className="chat-home-image-banner-empty">
          Envie uma imagem no painel administrativo.
        </span>
      )}
    </section>
  );
}

export default function HomeBanner({ content, className = "", style }) {
  const data = normalizeHomeBannerContent(content);

  if (data.modo === HOME_BANNER_MODES.IMAGE) {
    return <ImageBanner data={data} className={className} style={style} />;
  }

  return <CodeBanner data={data} className={className} style={style} />;
}
