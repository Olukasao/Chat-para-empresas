export const DEFAULT_AVISOS_CONTENT = {
  kicker: "Central interna",
  titulo: "Avisos, demandas e metas",
  subtitulo: "Acompanhe comunicados importantes, metas comerciais, demandas da equipe e conteúdos de apoio.",
  resumo: [
    {
      id: "avisos-ativos",
      icone: "📢",
      valor: "3",
      rotulo: "Avisos ativos",
    },
    {
      id: "demanda-pendente",
      icone: "📋",
      valor: "1",
      rotulo: "Demanda pendente",
    },
    {
      id: "foco-venda",
      icone: "🎯",
      valor: "800 Mega",
      rotulo: "Foco de venda",
    },
    {
      id: "wiki",
      icone: "📚",
      valor: "Wiki",
      rotulo: "Tutoriais internos",
    },
  ],
  secao_comunicados: {
    titulo: "Comunicados internos",
    subtitulo: "Avisos, demandas e metas para a equipe.",
  },
  comunicados: [
    {
      id: "atualizacao-atendimentos",
      tipo: "Aviso interno",
      titulo: "Atualização nos atendimentos",
      descricao: "A equipe deve priorizar chamados de clientes sem conexão antes das demais solicitações.",
      status: "Importante",
      data: "Hoje",
      icone: "📢",
    },
    {
      id: "revisar-planos-antigos",
      tipo: "Demanda",
      titulo: "Revisar clientes com planos antigos",
      descricao: "Separar lista de clientes elegíveis para upgrade de plano e enviar para o comercial.",
      status: "Pendente",
      data: "Esta semana",
      icone: "📋",
    },
    {
      id: "meta-novos-planos",
      tipo: "Meta de vendas",
      titulo: "Meta do mês: novos planos",
      descricao: "Objetivo comercial: aumentar vendas dos planos com 800 Mega + Premiere.",
      status: "Em andamento",
      data: "Mensal",
      icone: "🎯",
    },
  ],
  meta: {
    selo: "Meta comercial",
    titulo: "800 Mega + Premiere",
    texto: "Oferta principal para divulgação. Mantenha o argumento de venda simples, direto e focado no benefício para o cliente.",
    progresso_label: "Progresso da meta",
    progresso: 62,
    vendas_reset_base: 0,
  },
  wiki: {
    titulo: "Wiki interna",
    subtitulo: "Tutoriais e dicas rápidas.",
    itens: [
      {
        id: "consultar-plano",
        icone: "🖥️",
        titulo: "Como consultar plano do cliente",
        descricao: "Passo a passo para localizar contrato, plano ativo e histórico do cliente.",
        categoria: "Sistema",
      },
      {
        id: "apresentar-oferta",
        icone: "💬",
        titulo: "Como apresentar uma oferta",
        descricao: "Dicas rápidas para explicar benefícios e fechar vendas com mais segurança.",
        categoria: "Vendas",
      },
      {
        id: "novos-funcionarios",
        icone: "📚",
        titulo: "Informações úteis para novos funcionários",
        descricao: "Resumo dos processos internos, canais de suporte e boas práticas.",
        categoria: "Treinamento",
      },
    ],
  },
};

const textValue = (value, fallback = "", maxLength = 500) =>
  String(value ?? fallback).slice(0, maxLength);

const numberValue = (value, fallback = 0, min = 0, max = 100) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(number, min), max);
};

const normalizeList = (value, fallback, mapper, maxItems = 20) => {
  const source = Array.isArray(value) ? value : fallback;
  return source.slice(0, maxItems).map(mapper);
};

export const createAvisosId = (prefix = "item") =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const getAvisosSeenStorageKey = (user = {}) => (
  `avisosInternosVisto:${user.empresa_id || "empresa"}:${user.id || "usuario"}`
);

export const markAvisosInternosAsSeen = (user, atualizadoEm) => {
  if (!atualizadoEm) return;
  localStorage.setItem(getAvisosSeenStorageKey(user), String(atualizadoEm));
};

export const hasAvisosInternosUpdate = (user, atualizadoEm) => {
  if (!atualizadoEm) return false;

  const vistoEm = localStorage.getItem(getAvisosSeenStorageKey(user));
  if (!vistoEm) return true;

  const atualizadoTime = new Date(atualizadoEm).getTime();
  const vistoTime = new Date(vistoEm).getTime();

  if (!Number.isFinite(atualizadoTime)) return false;
  if (!Number.isFinite(vistoTime)) return true;

  return atualizadoTime > vistoTime;
};

export const normalizeAvisosContent = (content = {}) => ({
  atualizado_em: content.atualizado_em || null,
  atualizado_por: content.atualizado_por || null,
  atualizado_por_nome: textValue(content.atualizado_por_nome, "", 160),
  kicker: textValue(content.kicker, DEFAULT_AVISOS_CONTENT.kicker, 80),
  titulo: textValue(content.titulo, DEFAULT_AVISOS_CONTENT.titulo, 140),
  subtitulo: textValue(content.subtitulo, DEFAULT_AVISOS_CONTENT.subtitulo, 320),
  resumo: normalizeList(
    content.resumo,
    DEFAULT_AVISOS_CONTENT.resumo,
    (item, index) => ({
      id: textValue(item?.id, `resumo-${index}`, 80),
      icone: textValue(item?.icone, "📌", 12),
      valor: textValue(item?.valor, "", 80),
      rotulo: textValue(item?.rotulo, "", 120),
    }),
    8
  ),
  secao_comunicados: {
    titulo: textValue(
      content.secao_comunicados?.titulo,
      DEFAULT_AVISOS_CONTENT.secao_comunicados.titulo,
      120
    ),
    subtitulo: textValue(
      content.secao_comunicados?.subtitulo,
      DEFAULT_AVISOS_CONTENT.secao_comunicados.subtitulo,
      220
    ),
  },
  comunicados: normalizeList(
    content.comunicados,
    DEFAULT_AVISOS_CONTENT.comunicados,
    (item, index) => ({
      id: textValue(item?.id, `comunicado-${index}`, 80),
      tipo: textValue(item?.tipo, "Aviso", 80),
      titulo: textValue(item?.titulo, "", 160),
      descricao: textValue(item?.descricao, "", 500),
      status: textValue(item?.status, "", 80),
      data: textValue(item?.data, "", 80),
      icone: textValue(item?.icone, "📢", 12),
      autor: textValue(item?.autor || item?.criado_por_nome || item?.atualizado_por_nome, "", 160),
    }),
    30
  ),
  meta: {
    selo: textValue(content.meta?.selo, DEFAULT_AVISOS_CONTENT.meta.selo, 80),
    titulo: textValue(content.meta?.titulo, DEFAULT_AVISOS_CONTENT.meta.titulo, 140),
    texto: textValue(content.meta?.texto, DEFAULT_AVISOS_CONTENT.meta.texto, 500),
    progresso_label: textValue(
      content.meta?.progresso_label,
      DEFAULT_AVISOS_CONTENT.meta.progresso_label,
      100
    ),
    progresso: numberValue(content.meta?.progresso, DEFAULT_AVISOS_CONTENT.meta.progresso),
    vendas_reset_base: numberValue(
      content.meta?.vendas_reset_base,
      DEFAULT_AVISOS_CONTENT.meta.vendas_reset_base,
      0,
      Number.MAX_SAFE_INTEGER
    ),
  },
  wiki: {
    titulo: textValue(content.wiki?.titulo, DEFAULT_AVISOS_CONTENT.wiki.titulo, 120),
    subtitulo: textValue(content.wiki?.subtitulo, DEFAULT_AVISOS_CONTENT.wiki.subtitulo, 220),
    itens: normalizeList(
      content.wiki?.itens,
      DEFAULT_AVISOS_CONTENT.wiki.itens,
      (item, index) => ({
        id: textValue(item?.id, `tutorial-${index}`, 80),
        icone: textValue(item?.icone, "📚", 12),
        titulo: textValue(item?.titulo, "", 160),
        descricao: textValue(item?.descricao, "", 400),
        categoria: textValue(item?.categoria, "", 80),
      }),
      20
    ),
  },
});
