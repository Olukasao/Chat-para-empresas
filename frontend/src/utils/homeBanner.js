export const HOME_BANNER_MODES = {
  CODE: "codigo",
  IMAGE: "imagem",
};

export const DEFAULT_HOME_BANNER_CONTENT = {
  modo: HOME_BANNER_MODES.CODE,
  selo: "Dica de sucesso",
  titulo_linha_1: "Um bom vendedor sempre tem seu",
  titulo_linha_2: "",
  titulo_destaque: "produto em mãos.",
  descricao_linha_1: "Tenha sempre as ofertas da Acessa Net prontas para apresentar ao cliente.",
  descricao_linha_2: "",
  time_label: "",
  time_valor: "",
  time_detalhe: "",
  meta_label: "",
  meta_valor: "",
  meta_detalhe: "",
  rodada_label: "",
  rodada_valor: "",
  rodada_detalhe: "",
  oferta_titulo: "800 Mega",
  oferta_subtitulo: "+ Premiere",
  beneficio_1_titulo: "Internet ultrarrápida",
  beneficio_1_detalhe: "",
  beneficio_2_titulo: "Mais de 80 canais",
  beneficio_2_detalhe: "",
  beneficio_3_titulo: "App incluso",
  beneficio_3_detalhe: "",
  botao_texto: "Saiba mais",
  botao_url: "https://acessanet.com.br/planos#ofertas-tema",
  imagem_url: "",
  imagem_alt: "Banner principal da home",
};

const CAMPOS_HOME_BANNER = {
  modo: 20,
  selo: 80,
  titulo_linha_1: 100,
  titulo_linha_2: 80,
  titulo_destaque: 100,
  descricao_linha_1: 220,
  descricao_linha_2: 220,
  time_label: 60,
  time_valor: 30,
  time_detalhe: 80,
  meta_label: 60,
  meta_valor: 30,
  meta_detalhe: 80,
  rodada_label: 60,
  rodada_valor: 30,
  rodada_detalhe: 80,
  oferta_titulo: 80,
  oferta_subtitulo: 80,
  beneficio_1_titulo: 60,
  beneficio_1_detalhe: 60,
  beneficio_2_titulo: 60,
  beneficio_2_detalhe: 60,
  beneficio_3_titulo: 60,
  beneficio_3_detalhe: 60,
  botao_texto: 100,
  botao_url: 500,
  imagem_url: 500,
  imagem_alt: 120,
};

const normalizarCampoTexto = (valor, fallback, limite) => {
  const texto = typeof valor === "string" ? valor : fallback;
  return String(texto || "").trim().slice(0, limite);
};

export const normalizeHomeBannerContent = (
  content = {},
  defaults = DEFAULT_HOME_BANNER_CONTENT
) => {
  const contentSafe = content && typeof content === "object" ? content : {};
  const hasMode = Object.prototype.hasOwnProperty.call(contentSafe, "modo");
  const source = hasMode ? contentSafe : defaults;

  const normalized = Object.fromEntries(
    Object.entries(CAMPOS_HOME_BANNER).map(([field, limit]) => [
      field,
      normalizarCampoTexto(source[field], defaults[field], limit),
    ])
  );

  normalized.modo = Object.values(HOME_BANNER_MODES).includes(normalized.modo)
    ? normalized.modo
    : defaults.modo;

  return normalized;
};
