// Regras de negócio do módulo Cursos, sem acesso a banco, para poderem ser testadas e reutilizadas.
import crypto from "crypto";

export const NIVEIS = ["basico", "intermediario", "avancado"];
export const TIPOS_BLOCO = [
  "paragrafo", "titulo", "lista", "tabela", "citacao", "destaque",
  "imagem", "galeria", "video", "audio", "pdf",
  "codigo", "terminal", "diagrama", "tabela_tecnica",
  "pergunta", "quiz", "checklist", "exercicio", "resposta_texto", "download",
];
export const TIPOS_QUESTAO = ["unica", "multipla", "vf", "associacao", "ordenacao", "curta", "discursiva"];
export const LINGUAGENS = ["texto", "bash", "powershell", "javascript", "typescript", "python", "sql", "json", "html", "css", "php", "java", "csharp", "go", "yaml", "cisco"];
const EMBED_HOSTS = ["www.youtube.com", "youtube.com", "www.youtube-nocookie.com", "player.vimeo.com", "vimeo.com", "youtu.be"];

const txt = (v, max = 5000) => String(v ?? "").slice(0, max);
const idCurto = (v) => {
  const s = String(v ?? "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
  return s || crypto.randomBytes(5).toString("hex");
};

/** Só http(s) é aceito em links; qualquer outra coisa (javascript:, data:) vira vazio. */
export function urlSegura(valor) {
  try {
    const u = new URL(String(valor || "").trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString().slice(0, 2000) : "";
  } catch {
    return "";
  }
}

/** Converte links de vídeo permitidos para o endereço de incorporação; outros hosts são recusados. */
export function urlEmbedPermitida(valor) {
  const url = urlSegura(valor);
  if (!url) return "";
  const u = new URL(url);
  if (!EMBED_HOSTS.includes(u.hostname)) return "";
  if (u.hostname === "youtu.be") return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1).replace(/[^\w-]/g, "")}`;
  if (u.hostname.endsWith("youtube.com") || u.hostname.endsWith("youtube-nocookie.com")) {
    const v = u.pathname.startsWith("/embed/") ? u.pathname.slice(7) : u.searchParams.get("v");
    return v ? `https://www.youtube-nocookie.com/embed/${v.replace(/[^\w-]/g, "")}` : "";
  }
  const m = /\/(\d+)/.exec(u.pathname);
  return m ? `https://player.vimeo.com/video/${m[1]}` : "";
}

const arquivoId = (v) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);

function blocoValido(b) {
  const tipo = String(b?.tipo || "");
  if (!TIPOS_BLOCO.includes(tipo)) throw new Error(`Tipo de bloco inválido: ${tipo || "(vazio)"}.`);
  const base = { id: idCurto(b.id), tipo };
  switch (tipo) {
    case "paragrafo":
    case "citacao":
      return { ...base, texto: txt(b.texto) };
    case "destaque":
      return { ...base, texto: txt(b.texto), tom: ["info", "aviso", "ok", "perigo"].includes(b.tom) ? b.tom : "info" };
    case "titulo":
      return { ...base, texto: txt(b.texto, 300), nivel: [1, 2, 3].includes(Number(b.nivel)) ? Number(b.nivel) : 2 };
    case "lista":
      return { ...base, ordenada: !!b.ordenada, itens: (Array.isArray(b.itens) ? b.itens : []).slice(0, 100).map((i) => txt(i, 1000)) };
    case "tabela":
    case "tabela_tecnica":
      return {
        ...base,
        cabecalho: (Array.isArray(b.cabecalho) ? b.cabecalho : []).slice(0, 12).map((c) => txt(c, 200)),
        linhas: (Array.isArray(b.linhas) ? b.linhas : []).slice(0, 200).map((l) => (Array.isArray(l) ? l : []).slice(0, 12).map((c) => txt(c, 500))),
      };
    case "imagem":
      return { ...base, arquivoId: arquivoId(b.arquivoId), legenda: txt(b.legenda, 300), alt: txt(b.alt, 300) };
    case "galeria":
      return { ...base, arquivos: (Array.isArray(b.arquivos) ? b.arquivos : []).slice(0, 30).map(arquivoId).filter(Boolean) };
    case "audio":
    case "pdf":
      return { ...base, arquivoId: arquivoId(b.arquivoId), legenda: txt(b.legenda, 300) };
    case "download":
      return { ...base, arquivoId: arquivoId(b.arquivoId), rotulo: txt(b.rotulo, 200) };
    case "video": {
      const embed = b.url ? urlEmbedPermitida(b.url) : "";
      if (b.url && !embed) throw new Error("Link de vídeo não permitido. Use YouTube ou Vimeo, ou envie o arquivo.");
      return { ...base, arquivoId: arquivoId(b.arquivoId), embed, legenda: txt(b.legenda, 300) };
    }
    case "codigo":
      return { ...base, linguagem: LINGUAGENS.includes(b.linguagem) ? b.linguagem : "texto", codigo: txt(b.codigo, 20000), legenda: txt(b.legenda, 200) };
    case "terminal":
      return { ...base, comandos: (Array.isArray(b.comandos) ? b.comandos : []).slice(0, 50).map((c) => txt(c, 500)) };
    case "diagrama":
      // Fluxograma simples: etapas ligadas em sequência; cada etapa pode ter uma decisão.
      return { ...base, etapas: (Array.isArray(b.etapas) ? b.etapas : []).slice(0, 30).map((e) => ({ texto: txt(e?.texto ?? e, 200), decisao: !!e?.decisao })) };
    case "pergunta":
      return { ...base, enunciado: txt(b.enunciado, 1000), resposta: txt(b.resposta, 2000) };
    case "quiz": {
      const opcoes = (Array.isArray(b.opcoes) ? b.opcoes : []).slice(0, 8).map((o) => ({ id: idCurto(o?.id), texto: txt(o?.texto, 300) }));
      const correta = opcoes.some((o) => o.id === b.correta) ? b.correta : opcoes[0]?.id ?? "";
      return { ...base, enunciado: txt(b.enunciado, 1000), opcoes, correta, explicacao: txt(b.explicacao, 1000) };
    }
    case "checklist":
      return { ...base, itens: (Array.isArray(b.itens) ? b.itens : []).slice(0, 50).map((i) => txt(i, 300)) };
    case "exercicio":
      return { ...base, titulo: txt(b.titulo, 200), instrucoes: txt(b.instrucoes, 5000) };
    case "resposta_texto":
      return { ...base, enunciado: txt(b.enunciado, 1000) };
    default:
      throw new Error("Bloco inválido.");
  }
}

export function validarBlocos(blocos) {
  if (!Array.isArray(blocos)) throw new Error("Os blocos devem ser uma lista.");
  if (blocos.length > 300) throw new Error("A aula tem blocos demais (máximo 300).");
  return blocos.map(blocoValido);
}

/** Remove do que vai para o aluno as respostas corretas dos quizzes embutidos nas aulas. */
export function blocosParaAluno(blocos) {
  return (blocos || []).map((b) => (b.tipo === "quiz" ? { ...b, correta: undefined, explicacao: undefined } : b));
}

export function corrigirQuizBloco(bloco, resposta) {
  const acertou = bloco?.tipo === "quiz" && String(resposta) === String(bloco.correta);
  return { acertou, correta: bloco.correta, explicacao: bloco.explicacao || "" };
}

// --- Provas -----------------------------------------------------------------------------

const num = (v, min, max, padrao) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : padrao;
};

export function validarProva(p) {
  if (!p || typeof p !== "object") throw new Error("Prova inválida.");
  const questoes = (Array.isArray(p.questoes) ? p.questoes : []).slice(0, 200).map((q, i) => {
    if (!TIPOS_QUESTAO.includes(q?.tipo)) throw new Error(`Questão ${i + 1}: tipo inválido.`);
    const base = { id: idCurto(q.id), tipo: q.tipo, enunciado: txt(q.enunciado, 3000), pontos: num(q.pontos, 1, 1000, 10), obrigatoria: !!q.obrigatoria };
    if (!base.enunciado.trim()) throw new Error(`Questão ${i + 1}: escreva o enunciado.`);
    if (q.tipo === "unica" || q.tipo === "multipla") {
      const opcoes = (Array.isArray(q.opcoes) ? q.opcoes : []).slice(0, 10).map((o) => ({ id: idCurto(o?.id), texto: txt(o?.texto, 500) }));
      const corretas = (Array.isArray(q.correta) ? q.correta : [q.correta]).filter((c) => opcoes.some((o) => o.id === c));
      if (opcoes.length < 2) throw new Error(`Questão ${i + 1}: informe ao menos 2 alternativas.`);
      if (!corretas.length) throw new Error(`Questão ${i + 1}: marque a alternativa correta.`);
      if (q.tipo === "unica" && corretas.length !== 1) throw new Error(`Questão ${i + 1}: marque apenas uma alternativa.`);
      return { ...base, opcoes, correta: corretas };
    }
    if (q.tipo === "vf") return { ...base, correta: q.correta === true || q.correta === "true" };
    if (q.tipo === "associacao") {
      const pares = (Array.isArray(q.pares) ? q.pares : []).slice(0, 12).map((p2) => ({ id: idCurto(p2?.id), esq: txt(p2?.esq, 300), dir: txt(p2?.dir, 300) }));
      if (pares.length < 2) throw new Error(`Questão ${i + 1}: informe ao menos 2 pares.`);
      return { ...base, pares };
    }
    if (q.tipo === "ordenacao") {
      const itens = (Array.isArray(q.itens) ? q.itens : []).slice(0, 12).map((it) => ({ id: idCurto(it?.id), texto: txt(it?.texto, 300) }));
      if (itens.length < 2) throw new Error(`Questão ${i + 1}: informe ao menos 2 etapas, na ordem correta.`);
      return { ...base, itens };
    }
    if (q.tipo === "curta") {
      const aceitas = (Array.isArray(q.aceitas) ? q.aceitas : []).map((a) => txt(a, 300)).filter((a) => a.trim());
      if (!aceitas.length) throw new Error(`Questão ${i + 1}: informe ao menos uma resposta aceita.`);
      return { ...base, aceitas };
    }
    return { ...base, criterio: txt(q.criterio, 2000) }; // discursiva
  });
  return {
    titulo: txt(p.titulo, 200),
    notaMinima: num(p.notaMinima, 0, 100, 70),
    maxTentativas: num(p.maxTentativas, 0, 100, 0), // 0 = ilimitadas
    tempoLimiteMin: num(p.tempoLimiteMin, 0, 600, 0), // 0 = sem limite
    embaralharQuestoes: !!p.embaralharQuestoes,
    embaralharAlternativas: !!p.embaralharAlternativas,
    feedback: ["imediato", "final", "nunca"].includes(p.feedback) ? p.feedback : "final",
    liberaProxima: p.liberaProxima !== false,
    peso: num(p.peso, 1, 100, 1),
    questoes,
  };
}

function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function embaralhar(lista, seed) {
  const r = prng(seed);
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Ordem das questões (e das alternativas) sorteada uma vez por tentativa e guardada no servidor. */
export function sortearOrdem(prova, seed) {
  const ids = prova.questoes.map((q) => q.id);
  return {
    seed,
    questoes: prova.embaralharQuestoes ? embaralhar(ids, seed) : ids,
  };
}

/** Versão da prova para o aluno: sem gabarito e na ordem sorteada. */
export function provaParaAluno(prova, ordem) {
  const porId = new Map(prova.questoes.map((q) => [q.id, q]));
  const questoes = (ordem?.questoes || prova.questoes.map((q) => q.id)).map((id) => porId.get(id)).filter(Boolean).map((q, i) => {
    const s = { id: q.id, tipo: q.tipo, enunciado: q.enunciado, pontos: q.pontos, obrigatoria: q.obrigatoria };
    const seed = (ordem?.seed || 1) + i * 7919;
    if (q.tipo === "unica" || q.tipo === "multipla") s.opcoes = prova.embaralharAlternativas ? embaralhar(q.opcoes, seed) : q.opcoes;
    if (q.tipo === "associacao") {
      s.esquerda = q.pares.map((p) => ({ id: p.id, texto: p.esq }));
      s.direita = embaralhar(q.pares.map((p) => ({ id: p.id, texto: p.dir })), seed);
    }
    if (q.tipo === "ordenacao") s.itens = embaralhar(q.itens, seed);
    return s;
  });
  return {
    titulo: prova.titulo, notaMinima: prova.notaMinima, tempoLimiteMin: prova.tempoLimiteMin,
    feedback: prova.feedback, maxTentativas: prova.maxTentativas, questoes,
  };
}

export const normalizarTexto = (s) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Fração (0 a 1) de acerto da questão, ou null quando precisa de correção manual. */
export function corrigirQuestao(q, resposta) {
  switch (q.tipo) {
    case "unica":
      return q.correta.includes(String(resposta)) ? 1 : 0;
    case "multipla": {
      const marcadas = new Set((Array.isArray(resposta) ? resposta : []).map(String));
      const certas = new Set(q.correta);
      let acertos = 0, erros = 0;
      for (const m of marcadas) certas.has(m) ? acertos++ : erros++;
      return Math.max(0, (acertos - erros) / certas.size);
    }
    case "vf":
      return resposta === true || resposta === false ? (resposta === q.correta ? 1 : 0) : 0;
    case "associacao": {
      const r = resposta && typeof resposta === "object" ? resposta : {};
      return q.pares.filter((p) => r[p.id] === p.id).length / q.pares.length;
    }
    case "ordenacao": {
      const r = Array.isArray(resposta) ? resposta : [];
      return q.itens.filter((it, i) => r[i] === it.id).length / q.itens.length;
    }
    case "curta": {
      const n = normalizarTexto(resposta);
      return n && q.aceitas.some((a) => normalizarTexto(a) === n) ? 1 : 0;
    }
    case "discursiva":
      return null;
    default:
      return 0;
  }
}

/**
 * Correção completa. `manuais` traz as notas dadas pelo professor às discursivas ({ [id]: { pontos } }).
 * Enquanto houver discursiva sem nota, o resultado fica pendente e não há nota nem aprovação.
 */
export function corrigirTentativa(prova, respostas = {}, manuais = {}) {
  const itens = {};
  let total = 0, obtido = 0, pendente = false;
  for (const q of prova.questoes) {
    total += q.pontos;
    let fracao = corrigirQuestao(q, respostas[q.id]);
    let pontos = null;
    if (fracao === null) {
      const m = manuais[q.id];
      if (m && Number.isFinite(Number(m.pontos))) pontos = Math.min(q.pontos, Math.max(0, Number(m.pontos)));
      else pendente = true;
    } else pontos = fracao * q.pontos;
    if (pontos !== null) obtido += pontos;
    itens[q.id] = { pontos, maximo: q.pontos, acertou: fracao === null ? null : fracao === 1, parcial: fracao !== null && fracao > 0 && fracao < 1 };
  }
  const naoRespondidaObrigatoria = prova.questoes.some((q) => q.obrigatoria && !respondida(respostas[q.id]));
  const nota = pendente || total === 0 ? null : Math.round((obtido / total) * 10000) / 100;
  return {
    itens, pendente, nota, naoRespondidaObrigatoria,
    aprovado: nota === null ? null : nota >= prova.notaMinima && !naoRespondidaObrigatoria,
  };
}

export const respondida = (r) =>
  r !== undefined && r !== null && r !== "" && !(Array.isArray(r) && !r.length) && !(typeof r === "object" && !Array.isArray(r) && !Object.keys(r).length);

/** O que o aluno pode ver do gabarito, segundo a configuração do administrador. */
export function gabaritoVisivel(prova, correcao) {
  if (prova.feedback === "nunca") return null;
  return Object.fromEntries(prova.questoes.map((q) => {
    const base = { ...correcao.itens[q.id] };
    if (q.tipo === "unica" || q.tipo === "multipla") base.correta = q.correta;
    else if (q.tipo === "vf") base.correta = q.correta;
    else if (q.tipo === "ordenacao") base.correta = q.itens.map((i) => i.id);
    else if (q.tipo === "associacao") base.correta = q.pares.map((p) => p.id);
    else if (q.tipo === "curta") base.correta = q.aceitas;
    return [q.id, base];
  }));
}

/** Estado da prova segundo as tentativas já feitas. */
export function podeIniciarTentativa(prova, tentativas, agora = new Date()) {
  const abertas = tentativas.find((t) => t.status === "em_andamento");
  if (abertas) {
    const expirou = abertas.expira_em && new Date(abertas.expira_em) <= agora;
    return { ok: !expirou, retomar: abertas, motivo: expirou ? "expirada" : undefined };
  }
  if (prova.maxTentativas > 0 && tentativas.length >= prova.maxTentativas) return { ok: false, motivo: "limite" };
  return { ok: true };
}

// --- Progresso, bloqueios e certificado -------------------------------------------------

/** `aulas` em ordem do curso (módulo, depois aula). `concluidas` é um Set de ids. */
export function calcularProgresso(aulas, concluidas) {
  const total = aulas.length;
  const feitas = aulas.filter((a) => concluidas.has(a.id)).length;
  return { total, feitas, percentual: total ? Math.round((feitas / total) * 100) : 0, concluido: total > 0 && feitas === total };
}

/** Uma aula com exige_anterior só abre quando a imediatamente anterior estiver concluída. */
export function aulaBloqueada(aulas, concluidas, aulaId) {
  const i = aulas.findIndex((a) => a.id === aulaId);
  if (i <= 0) return false;
  return !!aulas[i].exige_anterior && !concluidas.has(aulas[i - 1].id);
}

export function proximaAula(aulas, concluidas) {
  return aulas.find((a) => !concluidas.has(a.id) && !aulaBloqueada(aulas, concluidas, a.id)) || null;
}

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function gerarCodigoCertificado() {
  const bytes = crypto.randomBytes(12);
  const c = [...bytes].map((b) => ALFABETO[b % ALFABETO.length]).join("");
  return `ACN-${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8, 12)}`;
}
export const CODIGO_CERTIFICADO = /^ACN-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/;

/** Nome parcial para a página pública de verificação: "Lucas S." sem expor o nome completo. */
export function nomeReduzido(nome) {
  const p = String(nome || "").trim().split(/\s+/);
  return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0] || "";
}

export function saudacaoPorHora(hora) {
  return hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
}

/** Pontos de gamificação: derivados do que já está gravado, nunca de um contador editável. */
export function calcularPontos({ aulasConcluidas = 0, cursosConcluidos = 0, provasAprovadas = 0 }) {
  return aulasConcluidas * 10 + provasAprovadas * 50 + cursosConcluidos * 100;
}

/** Sequência de dias seguidos de estudo terminando hoje (ou ontem). `dias` são strings AAAA-MM-DD. */
export function sequenciaDias(dias, hoje = new Date()) {
  const set = new Set(dias);
  const fmt = (d) => d.toISOString().slice(0, 10);
  const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()));
  if (!set.has(fmt(d))) d.setUTCDate(d.getUTCDate() - 1);
  let n = 0;
  while (set.has(fmt(d))) { n++; d.setUTCDate(d.getUTCDate() - 1); }
  return n;
}
