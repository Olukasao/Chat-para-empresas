export const DEFAULT_HERO_COPA_CONTENT = {
  selo: "Campanha da semana",
  titulo_linha_1: "Entre em campo",
  titulo_linha_2: "com as",
  titulo_destaque: "melhores ofertas.",
  descricao_linha_1: "Juntos somos mais fortes! Foque no cliente, jogue em equipe",
  descricao_linha_2: "e marque muitos gols na campanha da Copa.",
  time_label: "Nosso time",
  time_valor: "28",
  time_detalhe: "colaboradores",
  meta_label: "Meta do time",
  meta_valor: "20%",
  meta_detalhe: "da meta mensal",
  rodada_label: "Rodada atual",
  rodada_valor: "5ª",
  rodada_detalhe: "semana da campanha",
  oferta_titulo: "800 Mega",
  oferta_subtitulo: "+ Premiere",
  beneficio_1_titulo: "Internet",
  beneficio_1_detalhe: "ultrarrápida",
  beneficio_2_titulo: "Mais de 80",
  beneficio_2_detalhe: "canais",
  beneficio_3_titulo: "App incluso",
  beneficio_3_detalhe: "",
  botao_texto: "Ver oferta da campanha",
  botao_url: "https://acessanet.com.br/planos#ofertas-tema",
};

export const DEFAULT_HERO_COPA_PREVIEW_CONTENT = {
  ...DEFAULT_HERO_COPA_CONTENT,
  meta_valor: "85%",
};

export const normalizeHeroCopaContent = (
  content = {},
  defaults = DEFAULT_HERO_COPA_CONTENT
) => Object.fromEntries(
  Object.entries(defaults).map(([key, fallback]) => [
    key,
    typeof content?.[key] === "string" ? content[key] : fallback,
  ])
);
