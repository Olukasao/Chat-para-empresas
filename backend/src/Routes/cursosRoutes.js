// Módulo Cursos (LMS). Montado em /api/cursos. Todas as permissões são conferidas aqui, no servidor.
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Router } from "express";
import multer from "multer";
import db from "../db/db.js";
import authMiddleware from "../middlewares/middleware.js";
import { getJwtSecret } from "../config/authSecrets.js";
import * as L from "../services/cursosLogic.js";
import { conversar, criarLimitador } from "../services/assistenteIa.js";
import { fontesDoUsuario, registrarProvedor, registrarUso } from "../services/iaAdminService.js";
import { quizDaResposta, sistemaDuvida, sistemaQuiz, sistemaResumo, textoDaAula } from "../services/cursosIa.js";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = path.resolve(__dirname, "../../../uploads/cursos");
const MIGRATION = path.resolve(__dirname, "../../migrations/20261023_create_cursos_lms.sql");

const CATEGORIAS_INICIAIS = [
  "Programação e Desenvolvimento", "Redes, Infraestrutura e NOC", "Atendimento ao Cliente", "Vendas e Comercial",
  "Marketing", "Design e Criatividade", "Segurança da Informação", "Treinamentos Internos AcessaNet",
];

// --- infraestrutura ---------------------------------------------------------------------

let schemaPronto = null;
function garantirSchema() {
  schemaPronto ??= (async () => {
    const sql = fs.readFileSync(MIGRATION, "utf8").replace(/^--.*$/gm, "");
    for (const comando of sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) await db.query(comando);
  })().catch((e) => { schemaPronto = null; throw e; });
  return schemaPronto;
}

class Erro extends Error {
  constructor(status, mensagem) { super(mensagem); this.status = status; }
}
const falha = (status, msg) => { throw new Erro(status, msg); };
const rota = (fn) => async (req, res) => {
  try {
    await garantirSchema();
    await fn(req, res);
  } catch (e) {
    if (e instanceof Erro) return res.status(e.status).json({ error: e.message });
    if (e instanceof multer.MulterError) return res.status(400).json({ error: e.code === "LIMIT_FILE_SIZE" ? "Arquivo grande demais." : "Falha no envio do arquivo." });
    if (/^(Tipo de bloco|Link de vídeo|Questão|Prova inválida|Os blocos|A aula tem)/.test(e.message)) return res.status(400).json({ error: e.message });
    console.error("[cursos]", e);
    res.status(500).json({ error: "Não foi possível concluir a operação." });
  }
};

const json = (v, padrao = null) => { try { return v ? JSON.parse(v) : padrao; } catch { return padrao; } };
const inteiro = (v, padrao = 0) => (Number.isInteger(Number(v)) && v !== "" && v !== null ? Number(v) : padrao);
const idParam = (v) => { const n = Number(v); if (!Number.isInteger(n) || n <= 0) falha(400, "Identificador inválido."); return n; };
const texto = (v, max, obrigatorio = false, rotulo = "Campo") => {
  const s = String(v ?? "").trim().slice(0, max);
  if (obrigatorio && !s) falha(400, `${rotulo} é obrigatório.`);
  return s;
};
// Link do responsável/instrutor do curso (ex.: perfil do GitHub de quem criou).
const linkHttp = (v, max, rotulo = "Link") => {
  const s = String(v ?? "").trim().slice(0, max);
  if (!s) return "";
  try {
    const u = new URL(s);
    if (!["http:", "https:"].includes(u.protocol)) throw new Error();
  } catch {
    falha(400, `${rotulo} precisa ser um link válido (http ou https).`);
  }
  return s;
};
const agora = () => new Date();
const dia = (d) => d.toISOString().slice(0, 10);

const ehAdmin = (u) => u.perfil === "admin";
async function ehGestor(u) {
  if (ehAdmin(u)) return true;
  const [r] = await db.query("SELECT 1 FROM cursos_gestores WHERE usuario_id = ?", [u.id]);
  return r.length > 0;
}
const exigirGestor = async (req) => { if (!(await ehGestor(req.user))) falha(403, "Você não tem permissão para gerenciar cursos."); };

async function auditar(req, acao, entidade, entidadeId, detalhes) {
  await db.query("INSERT INTO cursos_auditoria (usuario_id, acao, entidade, entidade_id, detalhes) VALUES (?,?,?,?,?)",
    [req.user.id, acao, entidade, entidadeId ?? null, detalhes ? JSON.stringify(detalhes).slice(0, 4000) : null]);
}

// --- arquivos privados (URLs assinadas por usuário) -------------------------------------

const assinar = (arquivoId, usuarioId, exp) =>
  crypto.createHmac("sha256", getJwtSecret()).update(`cursos:${arquivoId}:${usuarioId}:${exp}`).digest("base64url");
export function urlArquivo(arquivoId, usuarioId) {
  const exp = Math.floor(Date.now() / 1000) + 4 * 3600;
  return `/api/cursos/arquivos/${arquivoId}?u=${usuarioId}&e=${exp}&t=${assinar(arquivoId, usuarioId, exp)}`;
}
async function resolverArquivos(ids, usuarioId) {
  const unicos = [...new Set(ids.filter(Boolean))];
  if (!unicos.length) return {};
  const [rows] = await db.query("SELECT id, nome_original, mime, tamanho FROM cursos_arquivos WHERE id IN (?)", [unicos]);
  return Object.fromEntries(rows.map((a) => [a.id, { id: a.id, nome: a.nome_original, mime: a.mime, tamanho: a.tamanho, url: urlArquivo(a.id, usuarioId) }]));
}
const idsDeArquivos = (blocos) => (blocos || []).flatMap((b) => [b.arquivoId, ...(b.arquivos || [])]).filter(Boolean);

const TIPOS_ARQUIVO = {
  ".jpg": ["image/jpeg", 10], ".jpeg": ["image/jpeg", 10], ".png": ["image/png", 10], ".webp": ["image/webp", 10], ".gif": ["image/gif", 10],
  ".pdf": ["application/pdf", 50],
  ".mp4": ["video/mp4", 500], ".webm": ["video/webm", 500],
  ".mp3": ["audio/mpeg", 50], ".ogg": ["audio/ogg", 50], ".wav": ["audio/wav", 50],
  ".txt": ["text/plain", 5], ".csv": ["text/csv", 10],
  ".zip": ["application/zip", 100], ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", 50],
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 50], ".pptx": ["application/vnd.openxmlformats-officedocument.presentationml.presentation", 50],
};
const INLINE = /^(image|audio|video)\/|^application\/pdf$/;
/** Confere os primeiros bytes: a extensão sozinha não prova que o arquivo é do tipo informado. */
function assinaturaCombina(ext, b) {
  const h = (...v) => v.every((x, i) => b[i] === x);
  switch (ext) {
    case ".jpg": case ".jpeg": return h(0xff, 0xd8, 0xff);
    case ".png": return h(0x89, 0x50, 0x4e, 0x47);
    case ".gif": return h(0x47, 0x49, 0x46, 0x38);
    case ".webp": return b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP";
    case ".pdf": return b.slice(0, 5).toString() === "%PDF-";
    case ".mp4": return b.slice(4, 8).toString() === "ftyp";
    case ".webm": return h(0x1a, 0x45, 0xdf, 0xa3);
    case ".mp3": return b.slice(0, 3).toString() === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0);
    case ".ogg": return b.slice(0, 4).toString() === "OggS";
    case ".wav": return b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WAVE";
    case ".zip": case ".docx": case ".xlsx": case ".pptx": return h(0x50, 0x4b);
    case ".txt": case ".csv": return !b.includes(0);
    default: return false;
  }
}
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _f, cb) => { const d = path.join(UPLOAD_ROOT, String(new Date().getFullYear())); fs.mkdirSync(d, { recursive: true }); cb(null, d); },
    filename: (_req, f, cb) => cb(null, `${crypto.randomBytes(16).toString("hex")}${path.extname(f.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 500 * 1024 * 1024, files: 1 },
});

router.get("/arquivos/:id", rota(async (req, res) => {
  const id = idParam(req.params.id);
  const u = inteiro(req.query.u), e = inteiro(req.query.e);
  const t = String(req.query.t || "");
  const esperado = assinar(id, u, e);
  if (e < Date.now() / 1000 || t.length !== esperado.length || !crypto.timingSafeEqual(Buffer.from(t), Buffer.from(esperado))) falha(403, "Link expirado.");
  const [[a]] = await db.query("SELECT * FROM cursos_arquivos WHERE id = ?", [id]);
  if (!a) falha(404, "Arquivo não encontrado.");
  const caminho = path.resolve(UPLOAD_ROOT, a.caminho);
  if (!caminho.startsWith(UPLOAD_ROOT + path.sep) || !fs.existsSync(caminho)) falha(404, "Arquivo não encontrado.");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Type", a.mime);
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.setHeader("Content-Disposition", `${INLINE.test(a.mime) ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(a.nome_original)}`);
  res.sendFile(caminho);
}));

// --- verificação pública de certificado (sem login, sem dados privados) ------------------

const limitePublico = new Map();
router.get("/verificar/:codigo", rota(async (req, res) => {
  const chave = req.ip, janela = Math.floor(Date.now() / 60000);
  const reg = limitePublico.get(chave);
  const n = reg?.janela === janela ? reg.n + 1 : 1;
  limitePublico.set(chave, { janela, n });
  if (limitePublico.size > 5000) limitePublico.clear();
  if (n > 30) falha(429, "Muitas consultas. Tente novamente em instantes.");
  const codigo = String(req.params.codigo || "").toUpperCase();
  const [[c]] = L.CODIGO_CERTIFICADO.test(codigo)
    ? await db.query("SELECT codigo, nome_aluno, curso_titulo, carga_horaria_min, emitido_em FROM cursos_certificados WHERE codigo = ?", [codigo])
    : [[null]];
  if (req.accepts(["json", "html"]) === "html") {
    const esc = (v) => String(v).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
    res.status(c ? 200 : 404).type("html").send(`<!doctype html><meta charset="utf-8"><title>Verificação de certificado</title><body style="font-family:system-ui;max-width:520px;margin:12vh auto;padding:0 20px;color:#0b1630">${
      c ? `<h1 style="color:#0f9f5c">Certificado autêntico</h1><p><b>${esc(L.nomeReduzido(c.nome_aluno))}</b> concluiu <b>${esc(c.curso_titulo)}</b> (${Math.round(c.carga_horaria_min / 60 * 10) / 10} h).</p><p>Emitido pela AcessaNet em ${esc(new Date(c.emitido_em).toLocaleDateString("pt-BR"))}.<br>Código ${esc(c.codigo)}</p>`
        : `<h1 style="color:#d23a40">Certificado não encontrado</h1><p>Confira o código impresso no documento.</p>`}</body>`);
    return;
  }
  if (!c) return res.status(404).json({ valido: false });
  res.json({ valido: true, codigo: c.codigo, aluno: L.nomeReduzido(c.nome_aluno), curso: c.curso_titulo, cargaHorariaMin: c.carga_horaria_min, emitidoEm: c.emitido_em, emissor: "AcessaNet" });
}));

router.use(authMiddleware);

// --- consultas comuns -------------------------------------------------------------------

async function aulasDoCurso(cursoId) {
  const [rows] = await db.query(
    `SELECT a.id, a.modulo_id, a.titulo, a.tipo, a.duracao_min, a.exige_anterior, a.ordem, m.ordem AS m_ordem
       FROM cursos_aulas a JOIN cursos_modulos m ON m.id = a.modulo_id
      WHERE a.curso_id = ? ORDER BY m.ordem, m.id, a.ordem, a.id`, [cursoId]);
  return rows;
}
async function concluidasDe(usuarioId, cursoId) {
  const [rows] = await db.query("SELECT aula_id FROM cursos_progresso WHERE usuario_id = ? AND curso_id = ? AND concluida_em IS NOT NULL", [usuarioId, cursoId]);
  return new Set(rows.map((r) => r.aula_id));
}
async function carregarCurso(id, user, { exigirPublicado = true } = {}) {
  const [[curso]] = await db.query("SELECT * FROM cursos WHERE id = ? AND empresa_id = ?", [id, user.empresa_id]);
  if (!curso) falha(404, "Curso não encontrado.");
  const gestor = await ehGestor(user);
  if (exigirPublicado && curso.status !== "publicado" && !gestor) falha(404, "Curso não encontrado.");
  return { curso, gestor };
}
async function sincronizarAtribuicoes(user) {
  await db.query(
    `INSERT IGNORE INTO cursos_matriculas (curso_id, usuario_id, origem, obrigatorio, prazo_em)
     SELECT a.curso_id, ?, 'atribuido', MAX(a.obrigatorio), MIN(COALESCE(a.prazo_em, IF(c.prazo_dias IS NULL, NULL, DATE_ADD(CURDATE(), INTERVAL c.prazo_dias DAY))))
       FROM cursos_atribuicoes a JOIN cursos c ON c.id = a.curso_id AND c.status = 'publicado' AND c.empresa_id = ?
      WHERE (a.tipo = 'todos') OR (a.tipo = 'setor' AND a.alvo_id = ?) OR (a.tipo = 'usuario' AND a.alvo_id = ?)
      GROUP BY a.curso_id`, [user.id, user.empresa_id, user.setor_id ?? -1, user.id]);
}

/** Resumo de cursos publicados com o progresso do usuário. */
async function resumoCursos(user, filtro = {}) {
  const where = ["c.empresa_id = ?", "c.status = 'publicado'"];
  const args = [user.empresa_id];
  if (filtro.q) { where.push("(c.titulo LIKE ? OR c.descricao LIKE ? OR c.instrutor LIKE ?)"); const q = `%${filtro.q.replace(/[%_]/g, "\\$&")}%`; args.push(q, q, q); }
  if (filtro.categoria) { where.push("c.categoria_id = ?"); args.push(filtro.categoria); }
  if (NIVEIS_OK(filtro.nivel)) { where.push("c.nivel = ?"); args.push(filtro.nivel); }
  if (filtro.ids) { where.push("c.id IN (?)"); args.push(filtro.ids.length ? filtro.ids : [0]); }
  const ordem = { recentes: "c.criado_em DESC", acessados: "c.acessos DESC", titulo: "c.titulo ASC", duracao: "c.carga_horaria_min ASC" }[filtro.ordem] || "c.criado_em DESC";
  const [cursos] = await db.query(
    `SELECT c.id, c.titulo, c.descricao, c.instrutor, c.instrutor_url, c.nivel, c.categoria_id, cat.nome AS categoria, c.capa_arquivo_id, c.carga_horaria_min,
            c.emite_certificado, c.obrigatorio, c.acessos, c.criado_em,
            (SELECT COUNT(*) FROM cursos_modulos m WHERE m.curso_id = c.id) AS modulos,
            (SELECT COUNT(*) FROM cursos_aulas a WHERE a.curso_id = c.id) AS aulas
       FROM cursos c LEFT JOIN cursos_categorias cat ON cat.id = c.categoria_id
      WHERE ${where.join(" AND ")} ORDER BY ${ordem} LIMIT ? OFFSET ?`, [...args, filtro.limite ?? 48, filtro.offset ?? 0]);
  if (!cursos.length) return [];
  const ids = cursos.map((c) => c.id);
  const [mats] = await db.query("SELECT curso_id, concluido_em, obrigatorio, prazo_em, ultima_aula_id, ultimo_acesso FROM cursos_matriculas WHERE usuario_id = ? AND curso_id IN (?)", [user.id, ids]);
  const [feitas] = await db.query("SELECT curso_id, COUNT(*) n FROM cursos_progresso WHERE usuario_id = ? AND concluida_em IS NOT NULL AND curso_id IN (?) GROUP BY curso_id", [user.id, ids]);
  const [favs] = await db.query("SELECT curso_id FROM cursos_favoritos WHERE usuario_id = ? AND curso_id IN (?)", [user.id, ids]);
  const [certs] = await db.query("SELECT curso_id, codigo FROM cursos_certificados WHERE usuario_id = ? AND curso_id IN (?)", [user.id, ids]);
  const m = new Map(mats.map((x) => [x.curso_id, x])), f = new Map(feitas.map((x) => [x.curso_id, x.n]));
  const fav = new Set(favs.map((x) => x.curso_id)), cert = new Map(certs.map((x) => [x.curso_id, x.codigo]));
  const capas = await resolverArquivos(cursos.map((c) => c.capa_arquivo_id), user.id);
  return cursos.map((c) => {
    const mat = m.get(c.id);
    const n = f.get(c.id) || 0;
    return {
      ...c, capa: capas[c.capa_arquivo_id]?.url ?? null, capa_arquivo_id: undefined,
      matriculado: !!mat, obrigatorio: !!(mat?.obrigatorio || c.obrigatorio), prazoEm: mat?.prazo_em ?? null,
      ultimaAulaId: mat?.ultima_aula_id ?? null, ultimoAcesso: mat?.ultimo_acesso ?? null,
      concluido: !!mat?.concluido_em, progresso: c.aulas ? Math.round((n / c.aulas) * 100) : 0,
      favorito: fav.has(c.id), certificado: cert.get(c.id) ?? null,
    };
  });
}
function NIVEIS_OK(n) { return L.NIVEIS.includes(n); }

async function estatisticasUsuario(userId) {
  const [[a]] = await db.query("SELECT COUNT(*) aulas, COALESCE(SUM(segundos),0) segundos FROM cursos_progresso WHERE usuario_id = ? AND concluida_em IS NOT NULL", [userId]);
  const [[s]] = await db.query("SELECT COALESCE(SUM(segundos),0) segundos FROM cursos_progresso WHERE usuario_id = ?", [userId]);
  const [[c]] = await db.query("SELECT COUNT(*) n FROM cursos_matriculas WHERE usuario_id = ? AND concluido_em IS NOT NULL", [userId]);
  const [[p]] = await db.query("SELECT COUNT(DISTINCT aula_id) n FROM cursos_tentativas WHERE usuario_id = ? AND aprovado = 1", [userId]);
  const [[ct]] = await db.query("SELECT COUNT(*) n FROM cursos_certificados WHERE usuario_id = ?", [userId]);
  const [dias] = await db.query("SELECT DISTINCT DATE(atualizado_em) d FROM cursos_progresso WHERE usuario_id = ? AND atualizado_em > DATE_SUB(NOW(), INTERVAL 120 DAY)", [userId]);
  return {
    aulasConcluidas: a.aulas, segundos: Number(s.segundos), cursosConcluidos: c.n, provasAprovadas: p.n, certificados: ct.n,
    pontos: L.calcularPontos({ aulasConcluidas: a.aulas, cursosConcluidos: c.n, provasAprovadas: p.n }),
    sequencia: L.sequenciaDias(dias.map((r) => (r.d instanceof Date ? dia(new Date(r.d.getTime() - r.d.getTimezoneOffset() * 60000)) : String(r.d)))),
  };
}

async function conquistasDe(userId, est) {
  const lista = [];
  if (est.cursosConcluidos >= 1) lista.push({ id: "primeiros-passos", titulo: "Primeiros Passos", descricao: "Concluiu o primeiro curso." });
  const [[ob]] = await db.query("SELECT COUNT(*) total, SUM(concluido_em IS NOT NULL) feitos FROM cursos_matriculas WHERE usuario_id = ? AND obrigatorio = 1", [userId]);
  if (ob.total > 0 && Number(ob.feitos) === ob.total) lista.push({ id: "conhecimento-em-dia", titulo: "Conhecimento em Dia", descricao: "Concluiu todos os treinamentos obrigatórios." });
  const [trilhas] = await db.query(
    `SELECT t.titulo FROM cursos_trilhas t JOIN cursos_trilha_itens i ON i.trilha_id = t.id
       LEFT JOIN cursos_matriculas m ON m.curso_id = i.curso_id AND m.usuario_id = ? AND m.concluido_em IS NOT NULL
      WHERE t.publicada = 1 GROUP BY t.id HAVING COUNT(*) = COUNT(m.id)`, [userId]);
  for (const t of trilhas) lista.push({ id: `trilha-${t.titulo}`, titulo: `Trilha concluída: ${t.titulo}`, descricao: "Concluiu todos os cursos da trilha." });
  if (est.sequencia >= 7) lista.push({ id: "sequencia-7", titulo: "Uma semana de estudos", descricao: "7 dias seguidos aprendendo." });
  if (est.aulasConcluidas >= 25) lista.push({ id: "25-aulas", titulo: "Maratonista", descricao: "25 aulas concluídas." });
  return lista;
}

// --- aluno: painel, catálogo, curso ------------------------------------------------------

router.get("/categorias", rota(async (req, res) => {
  await semearCategorias(req.user.empresa_id);
  const [rows] = await db.query("SELECT id, nome, ordem FROM cursos_categorias WHERE empresa_id = ? ORDER BY ordem, nome", [req.user.empresa_id]);
  res.json({ categorias: rows });
}));
async function semearCategorias(empresaId) {
  const [[{ n }]] = await db.query("SELECT COUNT(*) n FROM cursos_categorias WHERE empresa_id = ?", [empresaId]);
  if (n) return;
  for (const [i, nome] of CATEGORIAS_INICIAIS.entries()) await db.query("INSERT IGNORE INTO cursos_categorias (empresa_id, nome, ordem) VALUES (?,?,?)", [empresaId, nome, i]);
}

router.get("/permissoes", rota(async (req, res) => res.json({ gestor: await ehGestor(req.user), admin: ehAdmin(req.user) })));

router.get("/painel", rota(async (req, res) => {
  await sincronizarAtribuicoes(req.user);
  const todos = (await resumoCursos(req.user, { limite: 200 }));
  const emAndamento = todos.filter((c) => c.matriculado && !c.concluido).sort((a, b) => String(b.ultimoAcesso ?? "").localeCompare(String(a.ultimoAcesso ?? "")));
  const est = await estatisticasUsuario(req.user.id);
  const matriculados = todos.filter((c) => c.matriculado);
  const geral = matriculados.length ? Math.round(matriculados.reduce((s, c) => s + c.progresso, 0) / matriculados.length) : 0;
  const proximas = matriculados.filter((c) => !c.concluido && c.prazoEm).sort((a, b) => String(a.prazoEm).localeCompare(String(b.prazoEm))).slice(0, 6)
    .map((c) => ({ tipo: "prazo", cursoId: c.id, titulo: c.titulo, prazoEm: c.prazoEm, obrigatorio: c.obrigatorio }));
  const [pend] = await db.query(
    `SELECT t.id, t.aula_id, t.curso_id, c.titulo FROM cursos_tentativas t JOIN cursos c ON c.id = t.curso_id
      WHERE t.usuario_id = ? AND t.status = 'aguardando_correcao'`, [req.user.id]);
  for (const p of pend) proximas.push({ tipo: "correcao", cursoId: p.curso_id, titulo: `${p.titulo}: prova aguardando correção` });
  const naoIniciados = todos.filter((c) => !c.matriculado);
  const [[{ nome_setor }]] = (await db.query("SELECT (SELECT nome FROM setores WHERE id = ?) nome_setor", [req.user.setor_id ?? -1]));
  res.json({
    usuario: { nome: req.user.nome, setor: nome_setor },
    destaque: emAndamento[0] ?? null,
    continuar: emAndamento.slice(0, 6),
    estatisticas: { progressoGeral: geral, horas: Math.round((est.segundos / 3600) * 10) / 10, cursosConcluidos: est.cursosConcluidos, certificados: est.certificados, pontos: est.pontos, sequencia: est.sequencia },
    proximas,
    recomendados: naoIniciados.filter((c) => c.obrigatorio).concat(naoIniciados.filter((c) => !c.obrigatorio)).slice(0, 6),
    novos: [...todos].sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em))).slice(0, 6),
    maisAcessados: [...todos].sort((a, b) => b.acessos - a.acessos).filter((c) => c.acessos > 0).slice(0, 6),
    conquistas: await conquistasDe(req.user.id, est),
  });
}));

router.get("/catalogo", rota(async (req, res) => {
  await sincronizarAtribuicoes(req.user);
  const limite = Math.min(60, Math.max(1, inteiro(req.query.limite, 24)));
  const pagina = Math.max(1, inteiro(req.query.pagina, 1));
  let ids;
  if (req.query.favoritos === "1") ids = (await db.query("SELECT curso_id FROM cursos_favoritos WHERE usuario_id = ?", [req.user.id]))[0].map((r) => r.curso_id);
  const cursos = await resumoCursos(req.user, {
    q: texto(req.query.q, 80), categoria: inteiro(req.query.categoria) || undefined, nivel: req.query.nivel, ordem: req.query.ordem,
    ids, limite: limite + 1, offset: (pagina - 1) * limite,
  });
  res.json({ cursos: cursos.slice(0, limite), temMais: cursos.length > limite, pagina });
}));

router.get("/busca", rota(async (req, res) => {
  const q = texto(req.query.q, 80);
  if (q.length < 2) return res.json({ cursos: [], aulas: [] });
  const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
  const [cursos] = await db.query("SELECT id, titulo FROM cursos WHERE empresa_id = ? AND status = 'publicado' AND titulo LIKE ? LIMIT 8", [req.user.empresa_id, like]);
  const [aulas] = await db.query(
    `SELECT a.id, a.titulo, a.curso_id, c.titulo AS curso, m.titulo AS modulo FROM cursos_aulas a JOIN cursos c ON c.id = a.curso_id
       JOIN cursos_modulos m ON m.id = a.modulo_id
      WHERE c.empresa_id = ? AND c.status = 'publicado' AND (a.titulo LIKE ? OR m.titulo LIKE ?) LIMIT 12`, [req.user.empresa_id, like, like]);
  res.json({ cursos, aulas });
}));

router.get("/curso/:id", rota(async (req, res) => {
  const id = idParam(req.params.id);
  const { curso, gestor } = await carregarCurso(id, req.user);
  const [modulos] = await db.query("SELECT id, titulo, ordem FROM cursos_modulos WHERE curso_id = ? ORDER BY ordem, id", [id]);
  const aulas = await aulasDoCurso(id);
  const concluidas = await concluidasDe(req.user.id, id);
  const [[mat]] = await db.query("SELECT * FROM cursos_matriculas WHERE curso_id = ? AND usuario_id = ?", [id, req.user.id]);
  const [[cert]] = await db.query("SELECT codigo FROM cursos_certificados WHERE curso_id = ? AND usuario_id = ?", [id, req.user.id]);
  const [[fav]] = await db.query("SELECT 1 f FROM cursos_favoritos WHERE curso_id = ? AND usuario_id = ?", [id, req.user.id]);
  const [[fb]] = await db.query("SELECT nota, comentario FROM cursos_feedback WHERE curso_id = ? AND usuario_id = ?", [id, req.user.id]);
  const [[cat]] = await db.query("SELECT nome FROM cursos_categorias WHERE id = ?", [curso.categoria_id ?? 0]);
  const [[req_]] = curso.curso_requisito_id ? await db.query("SELECT id, titulo FROM cursos WHERE id = ?", [curso.curso_requisito_id]) : [[null]];
  const requisitoOk = !curso.curso_requisito_id || !!(await db.query("SELECT 1 FROM cursos_matriculas WHERE curso_id = ? AND usuario_id = ? AND concluido_em IS NOT NULL", [curso.curso_requisito_id, req.user.id]))[0].length;
  const capas = await resolverArquivos([curso.capa_arquivo_id], req.user.id);
  const prog = L.calcularProgresso(aulas, concluidas);
  const proxima = L.proximaAula(aulas, concluidas);
  res.json({
    curso: {
      id: curso.id, titulo: curso.titulo, descricao: curso.descricao, objetivos: curso.objetivos, prerequisitos: curso.prerequisitos, instrutor: curso.instrutor, instrutorUrl: curso.instrutor_url,
      nivel: curso.nivel, categoria: cat?.nome ?? null, capa: capas[curso.capa_arquivo_id]?.url ?? null, cargaHorariaMin: curso.carga_horaria_min,
      status: curso.status, emiteCertificado: !!curso.emite_certificado, obrigatorio: !!(curso.obrigatorio || mat?.obrigatorio), notaFinalMinima: curso.nota_final_minima,
      cursoRequisito: req_ ?? null, requisitoCumprido: requisitoOk,
    },
    modulos: modulos.map((m) => ({
      ...m, aulas: aulas.filter((a) => a.modulo_id === m.id).map((a) => ({
        id: a.id, titulo: a.titulo, tipo: a.tipo, duracaoMin: a.duracao_min,
        estado: concluidas.has(a.id) ? "concluida" : L.aulaBloqueada(aulas, concluidas, a.id) ? "bloqueada" : a.id === mat?.ultima_aula_id ? "andamento" : "nao_iniciada",
      })),
    })),
    progresso: prog, matriculado: !!mat, concluidoEm: mat?.concluido_em ?? null, prazoEm: mat?.prazo_em ?? null,
    proximaAulaId: proxima?.id ?? null, ultimaAulaId: mat?.ultima_aula_id ?? null, ultimaPosicao: mat?.ultima_posicao ?? 0,
    certificado: cert?.codigo ?? null, favorito: !!fav, feedback: fb ?? null, previa: gestor && curso.status !== "publicado",
  });
}));

router.post("/curso/:id/matricular", rota(async (req, res) => {
  const id = idParam(req.params.id);
  const { curso } = await carregarCurso(id, req.user);
  if (curso.curso_requisito_id) {
    const [r] = await db.query("SELECT 1 FROM cursos_matriculas WHERE curso_id = ? AND usuario_id = ? AND concluido_em IS NOT NULL", [curso.curso_requisito_id, req.user.id]);
    if (!r.length) falha(409, "Conclua o curso pré-requisito antes de começar este.");
  }
  await db.query("INSERT IGNORE INTO cursos_matriculas (curso_id, usuario_id, origem, ultimo_acesso) VALUES (?,?,'livre',NOW())", [id, req.user.id]);
  res.json({ ok: true });
}));

router.put("/curso/:id/favorito", rota(async (req, res) => {
  const id = idParam(req.params.id);
  await carregarCurso(id, req.user);
  if (req.body?.favorito) await db.query("INSERT IGNORE INTO cursos_favoritos (usuario_id, curso_id) VALUES (?,?)", [req.user.id, id]);
  else await db.query("DELETE FROM cursos_favoritos WHERE usuario_id = ? AND curso_id = ?", [req.user.id, id]);
  res.json({ ok: true });
}));

router.put("/curso/:id/feedback", rota(async (req, res) => {
  const id = idParam(req.params.id);
  await carregarCurso(id, req.user);
  const nota = inteiro(req.body?.nota);
  if (nota < 1 || nota > 5) falha(400, "Escolha uma nota de 1 a 5.");
  await db.query("INSERT INTO cursos_feedback (usuario_id, curso_id, nota, comentario) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE nota = VALUES(nota), comentario = VALUES(comentario)",
    [req.user.id, id, nota, texto(req.body?.comentario, 2000) || null]);
  res.json({ ok: true });
}));

// --- aula, progresso, anotações ---------------------------------------------------------

async function carregarAula(aulaId, user, { editar = false } = {}) {
  const [[aula]] = await db.query("SELECT * FROM cursos_aulas WHERE id = ?", [aulaId]);
  if (!aula) falha(404, "Aula não encontrada.");
  const { curso, gestor } = await carregarCurso(aula.curso_id, user);
  return { aula, curso, gestor };
}

router.get("/aula/:id", rota(async (req, res) => {
  const { aula, curso, gestor } = await carregarAula(idParam(req.params.id), req.user);
  const aulas = await aulasDoCurso(curso.id);
  const concluidas = await concluidasDe(req.user.id, curso.id);
  if (!gestor && L.aulaBloqueada(aulas, concluidas, aula.id)) falha(423, "Conclua a aula anterior para liberar esta.");
  if (!gestor && curso.curso_requisito_id) {
    const [r] = await db.query("SELECT 1 FROM cursos_matriculas WHERE curso_id = ? AND usuario_id = ? AND concluido_em IS NOT NULL", [curso.curso_requisito_id, req.user.id]);
    if (!r.length) falha(423, "Conclua o curso pré-requisito para acessar esta aula.");
  }
  if (curso.status === "publicado") {
    const [ins] = await db.query("INSERT IGNORE INTO cursos_matriculas (curso_id, usuario_id, origem, ultimo_acesso) VALUES (?,?,'livre',NOW())", [curso.id, req.user.id]);
    if (ins.affectedRows) await db.query("UPDATE cursos SET acessos = acessos + 1 WHERE id = ?", [curso.id]);
    await db.query("UPDATE cursos_matriculas SET ultima_aula_id = ?, ultimo_acesso = NOW() WHERE curso_id = ? AND usuario_id = ?", [aula.id, curso.id, req.user.id]);
  }
  const blocos = json(aula.blocos, []);
  const [[prog]] = await db.query("SELECT posicao, segundos, concluida_em FROM cursos_progresso WHERE usuario_id = ? AND aula_id = ?", [req.user.id, aula.id]);
  const [[nota]] = await db.query("SELECT texto FROM cursos_anotacoes WHERE usuario_id = ? AND aula_id = ?", [req.user.id, aula.id]);
  const i = aulas.findIndex((a) => a.id === aula.id);
  res.json({
    aula: { id: aula.id, cursoId: curso.id, titulo: aula.titulo, tipo: aula.tipo, duracaoMin: aula.duracao_min, moduloId: aula.modulo_id },
    blocos: aula.tipo === "conteudo" ? L.blocosParaAluno(blocos) : [],
    arquivos: await resolverArquivos(idsDeArquivos(blocos), req.user.id),
    progresso: { posicao: prog?.posicao ?? 0, concluida: !!prog?.concluida_em },
    anotacao: nota?.texto ?? "",
    anterior: aulas[i - 1]?.id ?? null, proxima: aulas[i + 1]?.id ?? null,
    previa: gestor && curso.status !== "publicado",
  });
}));

router.post("/aula/:id/progresso", rota(async (req, res) => {
  const { aula, curso } = await carregarAula(idParam(req.params.id), req.user);
  if (curso.status !== "publicado") return res.json({ ok: true });
  // O tempo estudado só cresce em pequenos passos por chamada: não dá para inflar horas por requisição direta.
  const passo = Math.min(120, Math.max(0, inteiro(req.body?.segundos)));
  const posicao = Math.max(0, Math.min(1_000_000, inteiro(req.body?.posicao)));
  await db.query(
    `INSERT INTO cursos_progresso (usuario_id, curso_id, aula_id, segundos, posicao) VALUES (?,?,?,?,?)
     ON DUPLICATE KEY UPDATE segundos = segundos + VALUES(segundos), posicao = VALUES(posicao)`, [req.user.id, curso.id, aula.id, passo, posicao]);
  await db.query("UPDATE cursos_matriculas SET ultima_aula_id = ?, ultima_posicao = ?, ultimo_acesso = NOW() WHERE curso_id = ? AND usuario_id = ?", [aula.id, posicao, curso.id, req.user.id]);
  res.json({ ok: true });
}));

async function concluirAula(userId, curso, aulaId) {
  await db.query(
    `INSERT INTO cursos_progresso (usuario_id, curso_id, aula_id, concluida_em) VALUES (?,?,?,NOW())
     ON DUPLICATE KEY UPDATE concluida_em = COALESCE(concluida_em, NOW())`, [userId, curso.id, aulaId]);
  return verificarConclusaoCurso(userId, curso);
}
async function verificarConclusaoCurso(userId, curso) {
  const aulas = await aulasDoCurso(curso.id);
  const prog = L.calcularProgresso(aulas, await concluidasDe(userId, curso.id));
  if (!prog.concluido) return { concluido: false, certificado: null };
  await db.query("INSERT IGNORE INTO cursos_matriculas (curso_id, usuario_id, origem) VALUES (?,?, 'livre')", [curso.id, userId]);
  const [[mat]] = await db.query("SELECT concluido_em FROM cursos_matriculas WHERE curso_id = ? AND usuario_id = ?", [curso.id, userId]);
  const [[prova]] = await db.query(
    `SELECT AVG(melhor) media FROM (SELECT MAX(nota) melhor FROM cursos_tentativas WHERE usuario_id = ? AND curso_id = ? AND status = 'finalizada' AND nota IS NOT NULL GROUP BY aula_id) x`, [userId, curso.id]);
  if (prova.media !== null && Number(prova.media) < curso.nota_final_minima) return { concluido: false, certificado: null, notaInsuficiente: true };
  if (!mat.concluido_em) await db.query("UPDATE cursos_matriculas SET concluido_em = NOW() WHERE curso_id = ? AND usuario_id = ?", [curso.id, userId]);
  let codigo = null;
  if (curso.emite_certificado) {
    const [[existente]] = await db.query("SELECT codigo FROM cursos_certificados WHERE curso_id = ? AND usuario_id = ?", [curso.id, userId]);
    if (existente) codigo = existente.codigo;
    else {
      const [[u]] = await db.query("SELECT nome FROM usuarios WHERE id = ?", [userId]);
      codigo = L.gerarCodigoCertificado();
      await db.query(
        "INSERT INTO cursos_certificados (codigo, curso_id, usuario_id, nome_aluno, curso_titulo, carga_horaria_min, nota, emitido_em) VALUES (?,?,?,?,?,?,?,NOW())",
        [codigo, curso.id, userId, u.nome, curso.titulo, curso.carga_horaria_min, prova.media]);
    }
  }
  return { concluido: true, certificado: codigo };
}

router.post("/aula/:id/concluir", rota(async (req, res) => {
  const { aula, curso, gestor } = await carregarAula(idParam(req.params.id), req.user);
  if (aula.tipo !== "conteudo") falha(400, "Esta aula é uma avaliação: ela é concluída com a aprovação.");
  if (curso.status !== "publicado") return res.json({ ok: true, previa: true });
  const aulas = await aulasDoCurso(curso.id);
  if (!gestor && L.aulaBloqueada(aulas, await concluidasDe(req.user.id, curso.id), aula.id)) falha(423, "Conclua a aula anterior.");
  res.json({ ok: true, ...(await concluirAula(req.user.id, curso, aula.id)) });
}));

router.put("/aula/:id/anotacao", rota(async (req, res) => {
  const { aula } = await carregarAula(idParam(req.params.id), req.user);
  const t = texto(req.body?.texto, 20000);
  if (!t) await db.query("DELETE FROM cursos_anotacoes WHERE usuario_id = ? AND aula_id = ?", [req.user.id, aula.id]);
  else await db.query("INSERT INTO cursos_anotacoes (usuario_id, aula_id, texto) VALUES (?,?,?) ON DUPLICATE KEY UPDATE texto = VALUES(texto)", [req.user.id, aula.id, t]);
  res.json({ ok: true });
}));

router.get("/anotacoes", rota(async (req, res) => {
  const [rows] = await db.query(
    `SELECT n.aula_id, n.texto, n.atualizado_em, a.titulo, a.curso_id, c.titulo AS curso FROM cursos_anotacoes n
       JOIN cursos_aulas a ON a.id = n.aula_id JOIN cursos c ON c.id = a.curso_id WHERE n.usuario_id = ? ORDER BY n.atualizado_em DESC LIMIT 200`, [req.user.id]);
  res.json({ anotacoes: rows });
}));

// --- IA nos Cursos ----------------------------------------------------------------------

const limiteIaCursos = criarLimitador({ max: Number(process.env.CURSOS_IA_LIMITE_HORA) || 30 });
/** Confere permissão do setor e limite por hora; devolve o texto da aula para a IA. */
async function prepararIa(req) {
  if (!(await fontesDoUsuario(req.user).catch(() => ["cursos"])).includes("cursos")) falha(403, "O seu setor não pode usar a IA nos Cursos.");
  const p = limiteIaCursos(`${req.user.empresa_id}:${req.user.id}`);
  if (!p.ok) falha(429, `Muitos pedidos à IA seguidos. Tente de novo em ${Math.ceil(p.tentarEmSeg / 60)} min.`);
  const ctx = await carregarAula(idParam(req.params.id), req.user);
  if (!ctx.gestor && L.aulaBloqueada(await aulasDoCurso(ctx.curso.id), await concluidasDe(req.user.id, ctx.curso.id), ctx.aula.id)) falha(423, "Conclua a aula anterior para liberar esta.");
  const conteudo = textoDaAula(json(ctx.aula.blocos, []));
  if (ctx.aula.tipo !== "conteudo" || conteudo.length < 40) falha(400, "Esta aula tem pouco texto para a IA trabalhar.");
  return { ...ctx, conteudo };
}
async function perguntarIa(req, sistema, mensagens, extra = {}) {
  const observar = (e) => { registrarProvedor({ empresaId: req.user.empresa_id, provedor: e.provedor, ok: e.ok, erro: e.erro }).catch(() => {}); };
  try {
    const r = await conversar(mensagens, { sistema, observar, ...extra });
    registrarUso({ empresaId: req.user.empresa_id, usuarioId: req.user.id, campo: "perguntas" }).catch(() => {});
    return r;
  } catch (e) {
    registrarUso({ empresaId: req.user.empresa_id, usuarioId: req.user.id, campo: "falhas" }).catch(() => {});
    if (e.status === 400) falha(400, e.message);
    console.error("[cursos] IA falhou:", e.message, e.detalhe || "");
    falha(502, "A IA não respondeu agora. Tente de novo em instantes.");
  }
}

router.post("/aula/:id/duvida", rota(async (req, res) => {
  const { aula, conteudo } = await prepararIa(req);
  const pergunta = texto(req.body?.pergunta, 600);
  if (pergunta.length < 3) falha(400, "Escreva a sua dúvida.");
  const anteriores = (Array.isArray(req.body?.historico) ? req.body.historico : []).slice(-6)
    .filter((m) => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1200) }));
  const r = await perguntarIa(req, sistemaDuvida(aula.titulo, conteudo), [...anteriores, { role: "user", content: pergunta }]);
  res.json({ resposta: r.resposta });
}));

router.post("/aula/:id/resumo", rota(async (req, res) => {
  const { aula, conteudo } = await prepararIa(req);
  const r = await perguntarIa(req, sistemaResumo(aula.titulo, conteudo), [{ role: "user", content: "Faça o resumo da aula." }]);
  res.json({ resumo: r.resposta });
}));

router.post("/aula/:id/quiz", rota(async (req, res) => {
  const { aula } = await carregarAula(idParam(req.params.id), req.user);
  const bloco = json(aula.blocos, []).find((b) => b.id === req.body?.blocoId && b.tipo === "quiz");
  if (!bloco) falha(404, "Pergunta não encontrada.");
  res.json(L.corrigirQuizBloco(bloco, req.body?.resposta));
}));

// --- provas -----------------------------------------------------------------------------

async function provaDaAula(aulaId, user) {
  const ctx = await carregarAula(aulaId, user);
  if (ctx.aula.tipo !== "prova") falha(400, "Esta aula não é uma avaliação.");
  const prova = json(ctx.aula.prova);
  if (!prova?.questoes?.length) falha(409, "Esta avaliação ainda não tem questões.");
  const aulas = await aulasDoCurso(ctx.curso.id);
  if (!ctx.gestor && L.aulaBloqueada(aulas, await concluidasDe(user.id, ctx.curso.id), ctx.aula.id)) falha(423, "Conclua a aula anterior para liberar a avaliação.");
  return { ...ctx, prova };
}
const resumoTentativa = (t, prova) => {
  const final = t.status === "finalizada";
  return {
    id: t.id, numero: t.numero, status: t.status, iniciadaEm: t.iniciada_em, finalizadaEm: t.finalizada_em, tempoSegundos: t.tempo_segundos,
    nota: final && t.nota !== null ? Number(t.nota) : null, aprovado: final ? !!t.aprovado : null,
  };
};

router.get("/aula/:id/prova", rota(async (req, res) => {
  const { aula, prova } = await provaDaAula(idParam(req.params.id), req.user);
  const [tent] = await db.query("SELECT * FROM cursos_tentativas WHERE usuario_id = ? AND aula_id = ? ORDER BY numero", [req.user.id, aula.id]);
  const estado = L.podeIniciarTentativa(prova, tent);
  res.json({
    aula: { id: aula.id, titulo: aula.titulo },
    config: { titulo: prova.titulo || aula.titulo, questoes: prova.questoes.length, notaMinima: prova.notaMinima, maxTentativas: prova.maxTentativas, tempoLimiteMin: prova.tempoLimiteMin, feedback: prova.feedback },
    tentativas: tent.map((t) => resumoTentativa(t, prova)),
    podeIniciar: estado.ok, motivo: estado.motivo ?? null, emAndamento: estado.retomar?.id ?? null,
    aprovada: tent.some((t) => t.aprovado === 1),
  });
}));

router.post("/aula/:id/prova/iniciar", rota(async (req, res) => {
  const { aula, curso, prova } = await provaDaAula(idParam(req.params.id), req.user);
  if (curso.status !== "publicado") falha(400, "A prova só pode ser feita com o curso publicado. Use a prévia para conferir o conteúdo.");
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    // Trava as tentativas do aluno nesta prova: duas requisições simultâneas não furam o limite.
    const [tent] = await conn.query("SELECT * FROM cursos_tentativas WHERE usuario_id = ? AND aula_id = ? ORDER BY numero FOR UPDATE", [req.user.id, aula.id]);
    const estado = L.podeIniciarTentativa(prova, tent);
    let tentativa = estado.ok ? estado.retomar : undefined;
    if (!tentativa) {
      if (!estado.ok && estado.motivo === "limite") falha(409, "Você usou todas as tentativas desta avaliação.");
      // Tentativa aberta e expirada: encerra com o que foi salvo antes de abrir outra.
      const expirada = tent.find((t) => t.status === "em_andamento");
      if (expirada) { await finalizarTentativa(conn, expirada, prova, json(expirada.respostas, {})); tent.splice(0, tent.length, ...(await conn.query("SELECT * FROM cursos_tentativas WHERE usuario_id = ? AND aula_id = ? ORDER BY numero", [req.user.id, aula.id]))[0]); }
      if (prova.maxTentativas > 0 && tent.length >= prova.maxTentativas) falha(409, "Você usou todas as tentativas desta avaliação.");
      const seed = crypto.randomInt(1, 2 ** 31);
      const expira = prova.tempoLimiteMin ? new Date(Date.now() + prova.tempoLimiteMin * 60000) : null;
      const [ins] = await conn.query("INSERT INTO cursos_tentativas (usuario_id, curso_id, aula_id, numero, iniciada_em, expira_em, ordem, respostas) VALUES (?,?,?,?,NOW(),?,?,?)",
        [req.user.id, curso.id, aula.id, tent.length + 1, expira, JSON.stringify(L.sortearOrdem(prova, seed)), "{}"]);
      [[tentativa]] = await conn.query("SELECT * FROM cursos_tentativas WHERE id = ?", [ins.insertId]);
    }
    await conn.commit();
    res.json(vistaTentativa(tentativa, prova));
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}));
const vistaTentativa = (t, prova) => ({
  id: t.id, numero: t.numero, expiraEm: t.expira_em, iniciadaEm: t.iniciada_em,
  prova: L.provaParaAluno(prova, json(t.ordem)), respostas: json(t.respostas, {}), agora: new Date().toISOString(),
  conferidas: json(t.correcoes, {})?.conferidas ?? {},
});

async function minhaTentativa(id, user) {
  const [[t]] = await db.query("SELECT * FROM cursos_tentativas WHERE id = ? AND usuario_id = ?", [id, user.id]);
  if (!t) falha(404, "Tentativa não encontrada.");
  const [[aula]] = await db.query("SELECT prova FROM cursos_aulas WHERE id = ?", [t.aula_id]);
  return { t, prova: json(aula.prova) };
}
/** Só aceita respostas de questões que existem na prova, com formato esperado. */
function limparRespostas(prova, bruto) {
  const saida = {};
  if (!bruto || typeof bruto !== "object") return saida;
  for (const q of prova.questoes) {
    const r = bruto[q.id];
    if (r === undefined) continue;
    if (q.tipo === "multipla" || q.tipo === "ordenacao") saida[q.id] = Array.isArray(r) ? r.slice(0, 20).map((x) => String(x).slice(0, 60)) : [];
    else if (q.tipo === "associacao") saida[q.id] = Object.fromEntries(Object.entries(r && typeof r === "object" ? r : {}).slice(0, 20).map(([k, v]) => [String(k).slice(0, 60), String(v).slice(0, 60)]));
    else if (q.tipo === "vf") saida[q.id] = r === true || r === false ? r : undefined;
    else saida[q.id] = String(r).slice(0, q.tipo === "discursiva" ? 10000 : 500);
  }
  return saida;
}

router.put("/tentativa/:id/respostas", rota(async (req, res) => {
  const { t, prova } = await minhaTentativa(idParam(req.params.id), req.user);
  if (t.status !== "em_andamento") falha(409, "Esta tentativa já foi finalizada.");
  if (t.expira_em && new Date(t.expira_em).getTime() + 15000 < Date.now()) falha(409, "O tempo desta avaliação acabou.");
  await db.query("UPDATE cursos_tentativas SET respostas = ? WHERE id = ?", [JSON.stringify(preservarConferidas(t, limparRespostas(prova, req.body?.respostas))), t.id]);
  res.json({ ok: true });
}));

/** No modo "a cada resposta", questões já conferidas ficam travadas: o aluno não troca a resposta depois de ver o gabarito. */
function preservarConferidas(t, novas) {
  const conferidas = json(t.correcoes, {})?.conferidas ?? {};
  const antigas = json(t.respostas, {});
  const saida = { ...novas };
  for (const qid of Object.keys(conferidas)) {
    if (qid in antigas) saida[qid] = antigas[qid];
    else delete saida[qid];
  }
  return saida;
}

router.post("/tentativa/:id/conferir", rota(async (req, res) => {
  const { t, prova } = await minhaTentativa(idParam(req.params.id), req.user);
  if (prova.feedback !== "imediato") falha(400, "Esta avaliação só mostra o resultado ao final.");
  if (t.status !== "em_andamento") falha(409, "Esta tentativa já foi finalizada.");
  if (t.expira_em && new Date(t.expira_em).getTime() + 15000 < Date.now()) falha(409, "O tempo desta avaliação acabou.");
  const q = prova.questoes.find((x) => x.id === req.body?.questaoId);
  if (!q) falha(404, "Questão não encontrada.");
  if (q.tipo === "discursiva") falha(400, "Respostas discursivas são corrigidas pelo responsável.");
  const estado = json(t.correcoes, {}) ?? {};
  const conferidas = estado.conferidas ?? {};
  if (conferidas[q.id]) return res.json(conferidas[q.id]); // já conferida: repete o resultado, não aceita outra resposta
  const respostas = { ...json(t.respostas, {}), ...limparRespostas(prova, { [q.id]: req.body?.resposta }) };
  const fracao = L.corrigirQuestao(q, respostas[q.id]);
  const gab = L.gabaritoVisivel({ ...prova, questoes: [q] }, { itens: { [q.id]: {} } })?.[q.id] ?? {};
  const resultado = { acertou: fracao === 1, parcial: fracao > 0 && fracao < 1, correta: gab.correta };
  conferidas[q.id] = resultado;
  await db.query("UPDATE cursos_tentativas SET respostas = ?, correcoes = ? WHERE id = ?", [JSON.stringify(respostas), JSON.stringify({ ...estado, conferidas }), t.id]);
  res.json(resultado);
}));

async function finalizarTentativa(conn, t, prova, respostas) {
  const cor = L.corrigirTentativa(prova, respostas);
  const tempo = Math.max(0, Math.round((Date.now() - new Date(t.iniciada_em).getTime()) / 1000));
  await conn.query(
    `UPDATE cursos_tentativas SET respostas = ?, correcoes = ?, nota = ?, aprovado = ?, status = ?, finalizada_em = NOW(), tempo_segundos = ? WHERE id = ?`,
    [JSON.stringify(respostas), JSON.stringify({ itens: cor.itens, manuais: {} }), cor.nota, cor.aprovado === null ? null : cor.aprovado ? 1 : 0, cor.pendente ? "aguardando_correcao" : "finalizada", tempo, t.id]);
  return cor;
}
async function aplicarResultadoNaAula(userId, curso, aulaId, prova, aprovado) {
  if (aprovado || prova.liberaProxima === false) return concluirAula(userId, curso, aulaId);
  return { concluido: false, certificado: null };
}

router.post("/tentativa/:id/finalizar", rota(async (req, res) => {
  const { t, prova } = await minhaTentativa(idParam(req.params.id), req.user);
  if (t.status !== "em_andamento") return res.json(await resultadoTentativa(t, prova, req.user));
  // Passou do prazo (com 15 s de tolerância de rede): vale só o que já estava salvo no servidor.
  const atrasada = t.expira_em && new Date(t.expira_em).getTime() + 15000 < Date.now();
  const respostas = atrasada ? json(t.respostas, {}) : preservarConferidas(t, limparRespostas(prova, req.body?.respostas ?? json(t.respostas, {})));
  const cor = await finalizarTentativa(db, t, prova, respostas);
  const [[curso]] = await db.query("SELECT * FROM cursos WHERE id = ?", [t.curso_id]);
  const fim = cor.pendente ? { concluido: false, certificado: null } : await aplicarResultadoNaAula(req.user.id, curso, t.aula_id, prova, cor.aprovado);
  const [[nova]] = await db.query("SELECT * FROM cursos_tentativas WHERE id = ?", [t.id]);
  res.json({ ...(await resultadoTentativa(nova, prova, req.user)), curso: fim });
}));

async function resultadoTentativa(t, prova, user) {
  const base = { id: t.id, numero: t.numero, status: t.status, notaMinima: prova.notaMinima, tempoSegundos: t.tempo_segundos, feedback: prova.feedback };
  if (t.status === "em_andamento") return base;
  if (t.status === "aguardando_correcao") return { ...base, nota: null, aprovado: null, mensagem: "Suas respostas discursivas serão corrigidas pelo responsável. Você será avisado do resultado." };
  const resultado = { ...base, nota: Number(t.nota), aprovado: !!t.aprovado };
  if (prova.feedback !== "nunca") {
    const cor = L.corrigirTentativa(prova, json(t.respostas, {}), json(t.correcoes, {})?.manuais ?? {});
    resultado.questoes = L.gabaritoVisivel(prova, cor);
    resultado.respostas = json(t.respostas, {});
    resultado.enunciados = Object.fromEntries(prova.questoes.map((q) => [q.id, q.enunciado]));
  }
  return resultado;
}
router.get("/tentativa/:id", rota(async (req, res) => {
  const { t, prova } = await minhaTentativa(idParam(req.params.id), req.user);
  res.json(await resultadoTentativa(t, prova, req.user));
}));

// --- certificados, jornada, ranking -----------------------------------------------------

router.get("/certificados", rota(async (req, res) => {
  const [rows] = await db.query("SELECT codigo, nome_aluno, curso_id, curso_titulo, carga_horaria_min, nota, emitido_em FROM cursos_certificados WHERE usuario_id = ? ORDER BY emitido_em DESC", [req.user.id]);
  res.json({ certificados: rows.map((c) => ({ ...c, nota: c.nota === null ? null : Number(c.nota) })) });
}));
router.get("/certificados/:codigo", rota(async (req, res) => {
  const [[c]] = await db.query("SELECT * FROM cursos_certificados WHERE codigo = ?", [String(req.params.codigo).toUpperCase()]);
  if (!c || (c.usuario_id !== req.user.id && !(await ehGestor(req.user)))) falha(404, "Certificado não encontrado.");
  res.json({ certificado: { codigo: c.codigo, aluno: c.nome_aluno, curso: c.curso_titulo, cargaHorariaMin: c.carga_horaria_min, nota: c.nota === null ? null : Number(c.nota), emitidoEm: c.emitido_em } });
}));

router.get("/jornada", rota(async (req, res) => {
  const est = await estatisticasUsuario(req.user.id);
  const [historico] = await db.query(
    `SELECT m.curso_id, c.titulo, m.criado_em AS iniciado_em, m.concluido_em, m.ultimo_acesso FROM cursos_matriculas m JOIN cursos c ON c.id = m.curso_id
      WHERE m.usuario_id = ? ORDER BY COALESCE(m.ultimo_acesso, m.criado_em) DESC LIMIT 100`, [req.user.id]);
  const [pref] = await db.query("SELECT ranking_opt_in, meta_semanal_min FROM cursos_preferencias WHERE usuario_id = ?", [req.user.id]);
  const [[sem]] = await db.query("SELECT COALESCE(SUM(segundos),0) s FROM cursos_progresso WHERE usuario_id = ? AND atualizado_em >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)", [req.user.id]);
  res.json({ estatisticas: est, conquistas: await conquistasDe(req.user.id, est), historico, rankingOptIn: !!pref[0]?.ranking_opt_in, metaSemanalMin: pref[0]?.meta_semanal_min ?? 60, estudadoSemanaMin: Math.round(Number(sem.s) / 60) });
}));
router.put("/preferencias", rota(async (req, res) => {
  const meta = Math.min(2000, Math.max(10, inteiro(req.body?.metaSemanalMin, 60)));
  await db.query("INSERT INTO cursos_preferencias (usuario_id, ranking_opt_in, meta_semanal_min) VALUES (?,?,?) ON DUPLICATE KEY UPDATE ranking_opt_in = VALUES(ranking_opt_in), meta_semanal_min = VALUES(meta_semanal_min)", [req.user.id, req.body?.rankingOptIn ? 1 : 0, meta]);
  res.json({ ok: true });
}));
router.get("/ranking", rota(async (req, res) => {
  const [rows] = await db.query(
    `SELECT u.id, u.nome,
       (SELECT COUNT(*) FROM cursos_progresso p WHERE p.usuario_id = u.id AND p.concluida_em IS NOT NULL) aulas,
       (SELECT COUNT(*) FROM cursos_matriculas m WHERE m.usuario_id = u.id AND m.concluido_em IS NOT NULL) cursos,
       (SELECT COUNT(DISTINCT t.aula_id) FROM cursos_tentativas t WHERE t.usuario_id = u.id AND t.aprovado = 1) provas
       FROM cursos_preferencias f JOIN usuarios u ON u.id = f.usuario_id AND u.deletado_em IS NULL
      WHERE f.ranking_opt_in = 1 AND u.empresa_id = ?`, [req.user.empresa_id]);
  const lista = rows.map((r) => ({ id: r.id, nome: r.nome, pontos: L.calcularPontos({ aulasConcluidas: r.aulas, cursosConcluidos: r.cursos, provasAprovadas: r.provas }), cursos: r.cursos }))
    .sort((a, b) => b.pontos - a.pontos).slice(0, 20);
  res.json({ ranking: lista.map((r, i) => ({ posicao: i + 1, nome: r.nome, pontos: r.pontos, cursos: r.cursos, voce: r.id === req.user.id })) });
}));

router.get("/trilhas", rota(async (req, res) => {
  const [trilhas] = await db.query("SELECT id, titulo, descricao FROM cursos_trilhas WHERE empresa_id = ? AND publicada = 1 ORDER BY titulo", [req.user.empresa_id]);
  const [itens] = await db.query(
    `SELECT i.trilha_id, i.curso_id, i.ordem, c.titulo, c.status FROM cursos_trilha_itens i JOIN cursos c ON c.id = i.curso_id
      WHERE c.status = 'publicado' AND i.trilha_id IN (?) ORDER BY i.ordem`, [trilhas.length ? trilhas.map((t) => t.id) : [0]]);
  const cursos = await resumoCursos(req.user, { ids: [...new Set(itens.map((i) => i.curso_id))], limite: 500 });
  const porId = new Map(cursos.map((c) => [c.id, c]));
  res.json({ trilhas: trilhas.map((t) => {
    const lista = itens.filter((i) => i.trilha_id === t.id).map((i) => porId.get(i.curso_id)).filter(Boolean);
    return { ...t, cursos: lista, progresso: lista.length ? Math.round(lista.reduce((s, c) => s + c.progresso, 0) / lista.length) : 0 };
  }) });
}));

router.get("/biblioteca", rota(async (req, res) => {
  const [rows] = await db.query(
    `SELECT DISTINCT f.id, f.nome_original, f.mime, f.tamanho, c.id AS curso_id, c.titulo AS curso FROM cursos_arquivos f JOIN cursos c ON c.id = f.curso_id
      WHERE c.empresa_id = ? AND c.status = 'publicado' AND f.mime NOT LIKE 'image/%' ORDER BY c.titulo, f.nome_original LIMIT 300`, [req.user.empresa_id]);
  res.json({ materiais: rows.map((f) => ({ id: f.id, nome: f.nome_original, mime: f.mime, tamanho: f.tamanho, cursoId: f.curso_id, curso: f.curso, url: urlArquivo(f.id, req.user.id) })) });
}));

// ======================================================================================
// Administração
// ======================================================================================

const admin = Router();
admin.use(async (req, res, next) => {
  try { await garantirSchema(); await exigirGestor(req); next(); }
  catch (e) { res.status(e instanceof Erro ? e.status : 500).json({ error: e instanceof Erro ? e.message : "Não foi possível concluir a operação." }); }
});
router.use("/admin", admin);

admin.get("/dados-base", rota(async (req, res) => {
  await semearCategorias(req.user.empresa_id);
  const [setores] = await db.query("SELECT id, nome FROM setores WHERE empresa_id = ? ORDER BY nome", [req.user.empresa_id]);
  const [usuarios] = await db.query("SELECT u.id, u.nome, u.setor_id, s.nome AS setor FROM usuarios u LEFT JOIN setores s ON s.id = u.setor_id WHERE u.empresa_id = ? AND u.deletado_em IS NULL ORDER BY u.nome", [req.user.empresa_id]);
  const [categorias] = await db.query("SELECT id, nome, ordem FROM cursos_categorias WHERE empresa_id = ? ORDER BY ordem, nome", [req.user.empresa_id]);
  res.json({ setores, usuarios, categorias, linguagens: L.LINGUAGENS });
}));

// categorias
admin.post("/categorias", rota(async (req, res) => {
  const nome = texto(req.body?.nome, 120, true, "O nome");
  const [[{ m }]] = await db.query("SELECT COALESCE(MAX(ordem),0)+1 m FROM cursos_categorias WHERE empresa_id = ?", [req.user.empresa_id]);
  try {
    const [r] = await db.query("INSERT INTO cursos_categorias (empresa_id, nome, ordem) VALUES (?,?,?)", [req.user.empresa_id, nome, m]);
    await auditar(req, "criar", "categoria", r.insertId, { nome });
    res.json({ id: r.insertId });
  } catch (e) { if (e.code === "ER_DUP_ENTRY") falha(409, "Já existe uma categoria com esse nome."); throw e; }
}));
admin.put("/categorias/:id", rota(async (req, res) => {
  const id = idParam(req.params.id);
  try { await db.query("UPDATE cursos_categorias SET nome = ? WHERE id = ? AND empresa_id = ?", [texto(req.body?.nome, 120, true, "O nome"), id, req.user.empresa_id]); }
  catch (e) { if (e.code === "ER_DUP_ENTRY") falha(409, "Já existe uma categoria com esse nome."); throw e; }
  await auditar(req, "renomear", "categoria", id, { nome: req.body?.nome });
  res.json({ ok: true });
}));
admin.put("/categorias-ordem", rota(async (req, res) => {
  const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number).filter(Number.isInteger);
  for (const [i, id] of ids.entries()) await db.query("UPDATE cursos_categorias SET ordem = ? WHERE id = ? AND empresa_id = ?", [i, id, req.user.empresa_id]);
  res.json({ ok: true });
}));
admin.delete("/categorias/:id", rota(async (req, res) => {
  const id = idParam(req.params.id);
  await db.query("DELETE FROM cursos_categorias WHERE id = ? AND empresa_id = ?", [id, req.user.empresa_id]); // cursos ficam sem categoria
  await auditar(req, "excluir", "categoria", id);
  res.json({ ok: true });
}));

// cursos
admin.get("/cursos", rota(async (req, res) => {
  const limite = Math.min(100, Math.max(1, inteiro(req.query.limite, 30))), offset = (Math.max(1, inteiro(req.query.pagina, 1)) - 1) * limite;
  const where = ["c.empresa_id = ?"], args = [req.user.empresa_id];
  if (["rascunho", "publicado", "arquivado"].includes(req.query.status)) { where.push("c.status = ?"); args.push(req.query.status); } else where.push("c.status <> 'arquivado'");
  if (req.query.q) { where.push("c.titulo LIKE ?"); args.push(`%${texto(req.query.q, 80).replace(/[%_]/g, "\\$&")}%`); }
  const [rows] = await db.query(
    `SELECT c.id, c.titulo, c.status, c.nivel, c.obrigatorio, c.atualizado_em, c.categoria_id, cat.nome AS categoria,
            (SELECT COUNT(*) FROM cursos_aulas a WHERE a.curso_id = c.id) aulas,
            (SELECT COUNT(*) FROM cursos_matriculas m WHERE m.curso_id = c.id) matriculas,
            (SELECT COUNT(*) FROM cursos_matriculas m WHERE m.curso_id = c.id AND m.concluido_em IS NOT NULL) concluidos
       FROM cursos c LEFT JOIN cursos_categorias cat ON cat.id = c.categoria_id WHERE ${where.join(" AND ")} ORDER BY c.atualizado_em DESC LIMIT ? OFFSET ?`, [...args, limite + 1, offset]);
  res.json({ cursos: rows.slice(0, limite), temMais: rows.length > limite });
}));

function camposCurso(b) {
  const nivel = L.NIVEIS.includes(b?.nivel) ? b.nivel : "basico";
  return {
    titulo: texto(b?.titulo, 200, true, "O título"), descricao: texto(b?.descricao, 10000) || null, objetivos: texto(b?.objetivos, 5000) || null,
    prerequisitos: texto(b?.prerequisitos, 5000) || null, instrutor: texto(b?.instrutor, 160) || null,
    instrutor_url: linkHttp(b?.instrutorUrl, 300, "O link do instrutor") || null, nivel,
    categoria_id: inteiro(b?.categoriaId) || null, carga_horaria_min: Math.min(100000, Math.max(0, inteiro(b?.cargaHorariaMin))),
    obrigatorio: b?.obrigatorio ? 1 : 0, prazo_dias: inteiro(b?.prazoDias) > 0 ? inteiro(b.prazoDias) : null,
    emite_certificado: b?.emiteCertificado === false ? 0 : 1, nota_final_minima: Math.min(100, Math.max(0, inteiro(b?.notaFinalMinima, 70))),
    curso_requisito_id: inteiro(b?.cursoRequisitoId) || null, capa_arquivo_id: inteiro(b?.capaArquivoId) || null,
  };
}
admin.post("/cursos", rota(async (req, res) => {
  const c = camposCurso(req.body);
  const cols = Object.keys(c);
  const [r] = await db.query(`INSERT INTO cursos (empresa_id, criado_por, ${cols.join(",")}) VALUES (?,?,${cols.map(() => "?").join(",")})`, [req.user.empresa_id, req.user.id, ...cols.map((k) => c[k])]);
  const [m] = await db.query("INSERT INTO cursos_modulos (curso_id, titulo, ordem) VALUES (?,?,0)", [r.insertId, "Módulo 1"]);
  await auditar(req, "criar", "curso", r.insertId, { titulo: c.titulo });
  res.json({ id: r.insertId, moduloId: m.insertId });
}));

async function cursoEditavel(req) {
  const id = idParam(req.params.id);
  const [[c]] = await db.query("SELECT * FROM cursos WHERE id = ? AND empresa_id = ?", [id, req.user.empresa_id]);
  if (!c) falha(404, "Curso não encontrado.");
  return c;
}
admin.get("/cursos/:id", rota(async (req, res) => {
  const c = await cursoEditavel(req);
  const [modulos] = await db.query("SELECT id, titulo, ordem FROM cursos_modulos WHERE curso_id = ? ORDER BY ordem, id", [c.id]);
  const [aulas] = await db.query("SELECT id, modulo_id, titulo, tipo, duracao_min, exige_anterior, ordem, versao FROM cursos_aulas WHERE curso_id = ? ORDER BY ordem, id", [c.id]);
  const [atrib] = await db.query("SELECT tipo, alvo_id, obrigatorio, prazo_em FROM cursos_atribuicoes WHERE curso_id = ?", [c.id]);
  const capas = await resolverArquivos([c.capa_arquivo_id], req.user.id);
  const [outros] = await db.query("SELECT id, titulo FROM cursos WHERE empresa_id = ? AND id <> ? AND status <> 'arquivado' ORDER BY titulo", [req.user.empresa_id, c.id]);
  res.json({
    curso: { id: c.id, titulo: c.titulo, descricao: c.descricao, objetivos: c.objetivos, prerequisitos: c.prerequisitos, instrutor: c.instrutor, instrutorUrl: c.instrutor_url, nivel: c.nivel, categoriaId: c.categoria_id,
      cargaHorariaMin: c.carga_horaria_min, status: c.status, obrigatorio: !!c.obrigatorio, prazoDias: c.prazo_dias, emiteCertificado: !!c.emite_certificado, notaFinalMinima: c.nota_final_minima,
      cursoRequisitoId: c.curso_requisito_id, capaArquivoId: c.capa_arquivo_id, capa: capas[c.capa_arquivo_id]?.url ?? null },
    modulos: modulos.map((m) => ({ ...m, aulas: aulas.filter((a) => a.modulo_id === m.id) })),
    atribuicoes: atrib, outrosCursos: outros,
  });
}));
admin.put("/cursos/:id", rota(async (req, res) => {
  const c = await cursoEditavel(req);
  const campos = camposCurso(req.body);
  const cols = Object.keys(campos);
  await db.query(`UPDATE cursos SET ${cols.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`, [...cols.map((k) => campos[k]), c.id]);
  await auditar(req, "editar", "curso", c.id, { titulo: campos.titulo });
  res.json({ ok: true });
}));
admin.put("/cursos/:id/status", rota(async (req, res) => {
  const c = await cursoEditavel(req);
  const status = req.body?.status;
  if (!["rascunho", "publicado", "arquivado"].includes(status)) falha(400, "Situação inválida.");
  if (status === "publicado") {
    const [[{ n }]] = await db.query("SELECT COUNT(*) n FROM cursos_aulas WHERE curso_id = ?", [c.id]);
    if (!n) falha(409, "Adicione ao menos uma aula antes de publicar.");
    const [provas] = await db.query("SELECT titulo, prova FROM cursos_aulas WHERE curso_id = ? AND tipo = 'prova'", [c.id]);
    const vazia = provas.find((p) => !json(p.prova)?.questoes?.length);
    if (vazia) falha(409, `A avaliação "${vazia.titulo}" ainda não tem questões.`);
  }
  await db.query("UPDATE cursos SET status = ? WHERE id = ?", [status, c.id]);
  await auditar(req, status === "publicado" ? "publicar" : status === "arquivado" ? "arquivar" : "despublicar", "curso", c.id);
  res.json({ ok: true });
}));
admin.post("/cursos/:id/duplicar", rota(async (req, res) => {
  const c = await cursoEditavel(req);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(
      `INSERT INTO cursos (empresa_id, categoria_id, titulo, descricao, objetivos, prerequisitos, instrutor, nivel, capa_arquivo_id, carga_horaria_min, status, obrigatorio, prazo_dias, emite_certificado, nota_final_minima, criado_por)
       SELECT empresa_id, categoria_id, CONCAT(LEFT(titulo, 180), ' (cópia)'), descricao, objetivos, prerequisitos, instrutor, nivel, capa_arquivo_id, carga_horaria_min, 'rascunho', obrigatorio, prazo_dias, emite_certificado, nota_final_minima, ? FROM cursos WHERE id = ?`, [req.user.id, c.id]);
    const [mods] = await conn.query("SELECT * FROM cursos_modulos WHERE curso_id = ? ORDER BY ordem, id", [c.id]);
    for (const m of mods) {
      const [nm] = await conn.query("INSERT INTO cursos_modulos (curso_id, titulo, ordem) VALUES (?,?,?)", [r.insertId, m.titulo, m.ordem]);
      await conn.query("INSERT INTO cursos_aulas (curso_id, modulo_id, titulo, tipo, ordem, duracao_min, blocos, prova, exige_anterior) SELECT ?, ?, titulo, tipo, ordem, duracao_min, blocos, prova, exige_anterior FROM cursos_aulas WHERE modulo_id = ?", [r.insertId, nm.insertId, m.id]);
    }
    await conn.commit();
    await auditar(req, "duplicar", "curso", c.id, { novo: r.insertId });
    res.json({ id: r.insertId });
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}));
admin.delete("/cursos/:id", rota(async (req, res) => {
  const c = await cursoEditavel(req);
  const [[{ n }]] = await db.query("SELECT COUNT(*) n FROM cursos_matriculas WHERE curso_id = ?", [c.id]);
  if (n && c.status === "publicado") falha(409, "Este curso tem alunos matriculados. Arquive-o em vez de excluir.");
  if (n && req.query.forcar !== "1") falha(409, `Este curso tem ${n} matrícula(s). Confirme para excluir tudo, ou arquive o curso.`);
  await db.query("DELETE FROM cursos WHERE id = ?", [c.id]);
  await auditar(req, "excluir", "curso", c.id, { titulo: c.titulo, matriculas: n });
  res.json({ ok: true });
}));

// módulos e aulas
admin.post("/cursos/:id/modulos", rota(async (req, res) => {
  const c = await cursoEditavel(req);
  const [[{ m }]] = await db.query("SELECT COALESCE(MAX(ordem),-1)+1 m FROM cursos_modulos WHERE curso_id = ?", [c.id]);
  const [r] = await db.query("INSERT INTO cursos_modulos (curso_id, titulo, ordem) VALUES (?,?,?)", [c.id, texto(req.body?.titulo, 200) || `Módulo ${m + 1}`, m]);
  res.json({ id: r.insertId });
}));
admin.put("/modulos/:mid", rota(async (req, res) => {
  const mid = idParam(req.params.mid);
  await db.query("UPDATE cursos_modulos m JOIN cursos c ON c.id = m.curso_id SET m.titulo = ? WHERE m.id = ? AND c.empresa_id = ?", [texto(req.body?.titulo, 200, true, "O título"), mid, req.user.empresa_id]);
  res.json({ ok: true });
}));
admin.delete("/modulos/:mid", rota(async (req, res) => {
  const mid = idParam(req.params.mid);
  const [[m]] = await db.query("SELECT m.id, m.curso_id, m.titulo FROM cursos_modulos m JOIN cursos c ON c.id = m.curso_id WHERE m.id = ? AND c.empresa_id = ?", [mid, req.user.empresa_id]);
  if (!m) falha(404, "Módulo não encontrado.");
  await db.query("DELETE FROM cursos_modulos WHERE id = ?", [mid]);
  await auditar(req, "excluir", "modulo", mid, { titulo: m.titulo, curso: m.curso_id });
  res.json({ ok: true });
}));
admin.post("/modulos/:mid/aulas", rota(async (req, res) => {
  const mid = idParam(req.params.mid);
  const [[m]] = await db.query("SELECT m.id, m.curso_id FROM cursos_modulos m JOIN cursos c ON c.id = m.curso_id WHERE m.id = ? AND c.empresa_id = ?", [mid, req.user.empresa_id]);
  if (!m) falha(404, "Módulo não encontrado.");
  const tipo = req.body?.tipo === "prova" ? "prova" : "conteudo";
  const [[{ o }]] = await db.query("SELECT COALESCE(MAX(ordem),-1)+1 o FROM cursos_aulas WHERE modulo_id = ?", [mid]);
  const prova = tipo === "prova" ? JSON.stringify(L.validarProva({ titulo: "", questoes: [] })) : null;
  const [r] = await db.query("INSERT INTO cursos_aulas (curso_id, modulo_id, titulo, tipo, ordem, blocos, prova) VALUES (?,?,?,?,?,?,?)",
    [m.curso_id, mid, texto(req.body?.titulo, 200) || (tipo === "prova" ? "Nova avaliação" : "Nova aula"), tipo, o, tipo === "conteudo" ? "[]" : null, prova]);
  res.json({ id: r.insertId });
}));
admin.put("/cursos/:id/ordem", rota(async (req, res) => {
  const c = await cursoEditavel(req);
  const mods = Array.isArray(req.body?.modulos) ? req.body.modulos : [];
  const [validos] = await db.query("SELECT id FROM cursos_modulos WHERE curso_id = ?", [c.id]);
  const idsMod = new Set(validos.map((m) => m.id));
  const [aulasC] = await db.query("SELECT id FROM cursos_aulas WHERE curso_id = ?", [c.id]);
  const idsAula = new Set(aulasC.map((a) => a.id));
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (const [i, m] of mods.entries()) {
      if (!idsMod.has(Number(m.id))) continue;
      await conn.query("UPDATE cursos_modulos SET ordem = ? WHERE id = ?", [i, m.id]);
      for (const [j, aid] of (Array.isArray(m.aulas) ? m.aulas : []).entries())
        if (idsAula.has(Number(aid))) await conn.query("UPDATE cursos_aulas SET modulo_id = ?, ordem = ? WHERE id = ?", [m.id, j, aid]);
    }
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  res.json({ ok: true });
}));

async function aulaEditavel(req) {
  const id = idParam(req.params.aid);
  const [[a]] = await db.query("SELECT a.*, c.status AS curso_status FROM cursos_aulas a JOIN cursos c ON c.id = a.curso_id WHERE a.id = ? AND c.empresa_id = ?", [id, req.user.empresa_id]);
  if (!a) falha(404, "Aula não encontrada.");
  return a;
}
// Rascunho de perguntas a partir do que está no editor (mesmo sem salvar). Nada é gravado: quem edita revisa e fica com as que quiser.
admin.post("/ia/quiz", rota(async (req, res) => {
  if (!(await fontesDoUsuario(req.user).catch(() => ["cursos"])).includes("cursos")) falha(403, "O seu setor não pode usar a IA nos Cursos.");
  const p = limiteIaCursos(`${req.user.empresa_id}:${req.user.id}`);
  if (!p.ok) falha(429, `Muitos pedidos à IA seguidos. Tente de novo em ${Math.ceil(p.tentarEmSeg / 60)} min.`);
  const quantidade = Math.min(8, Math.max(1, inteiro(req.body?.quantidade, 4)));
  const conteudo = textoDaAula(Array.isArray(req.body?.blocos) ? req.body.blocos.slice(0, 300) : []);
  if (conteudo.length < 80) falha(400, "Escreva mais conteúdo na aula antes de gerar perguntas.");
  const r = await perguntarIa(req, sistemaQuiz(texto(req.body?.titulo, 200), conteudo, quantidade), [{ role: "user", content: `Gere as ${quantidade} perguntas.` }]);
  const blocos = quizDaResposta(r.resposta, quantidade);
  if (!blocos.length) falha(502, "A IA não conseguiu montar as perguntas desta vez. Tente de novo.");
  res.json({ blocos });
}));

admin.get("/aulas/:aid", rota(async (req, res) => {
  const a = await aulaEditavel(req);
  const blocos = json(a.blocos, []);
  res.json({
    aula: { id: a.id, cursoId: a.curso_id, titulo: a.titulo, tipo: a.tipo, duracaoMin: a.duracao_min, exigeAnterior: !!a.exige_anterior, versao: a.versao },
    blocos, prova: json(a.prova), arquivos: await resolverArquivos(idsDeArquivos(blocos), req.user.id),
  });
}));
admin.put("/aulas/:aid", rota(async (req, res) => {
  const a = await aulaEditavel(req);
  // Controle de versão otimista: dois editores não se sobrescrevem sem perceber.
  if (req.body?.versao !== undefined && Number(req.body.versao) !== a.versao) falha(409, "Esta aula foi alterada por outra pessoa. Recarregue para ver a versão mais recente.");
  const titulo = texto(req.body?.titulo ?? a.titulo, 200, true, "O título");
  const blocos = a.tipo === "conteudo" && req.body?.blocos ? JSON.stringify(L.validarBlocos(req.body.blocos)) : a.blocos;
  const prova = a.tipo === "prova" && req.body?.prova ? JSON.stringify(L.validarProva(req.body.prova)) : a.prova;
  const mudouConteudo = blocos !== a.blocos || prova !== a.prova || titulo !== a.titulo;
  if (mudouConteudo) await db.query("INSERT INTO cursos_aulas_versoes (aula_id, versao, titulo, blocos, prova, autor_id) VALUES (?,?,?,?,?,?)", [a.id, a.versao, a.titulo, a.blocos, a.prova, req.user.id]);
  await db.query("UPDATE cursos_aulas SET titulo = ?, blocos = ?, prova = ?, duracao_min = ?, exige_anterior = ?, versao = versao + ? WHERE id = ?",
    [titulo, blocos, prova, Math.min(10000, Math.max(0, inteiro(req.body?.duracaoMin, a.duracao_min))), req.body?.exigeAnterior ? 1 : 0, mudouConteudo ? 1 : 0, a.id]);
  // Mantém só as 30 versões mais recentes de cada aula.
  await db.query("DELETE FROM cursos_aulas_versoes WHERE aula_id = ? AND id NOT IN (SELECT id FROM (SELECT id FROM cursos_aulas_versoes WHERE aula_id = ? ORDER BY id DESC LIMIT 30) x)", [a.id, a.id]);
  if (a.curso_status === "publicado" && mudouConteudo) await auditar(req, "editar", "aula", a.id, { titulo, publicado: true });
  res.json({ ok: true, versao: a.versao + (mudouConteudo ? 1 : 0) });
}));
admin.get("/aulas/:aid/versoes", rota(async (req, res) => {
  const a = await aulaEditavel(req);
  const [rows] = await db.query("SELECT v.id, v.versao, v.titulo, v.criado_em, u.nome AS autor FROM cursos_aulas_versoes v LEFT JOIN usuarios u ON u.id = v.autor_id WHERE v.aula_id = ? ORDER BY v.id DESC", [a.id]);
  res.json({ versoes: rows });
}));
admin.post("/aulas/:aid/restaurar/:vid", rota(async (req, res) => {
  const a = await aulaEditavel(req);
  const [[v]] = await db.query("SELECT * FROM cursos_aulas_versoes WHERE id = ? AND aula_id = ?", [idParam(req.params.vid), a.id]);
  if (!v) falha(404, "Versão não encontrada.");
  await db.query("INSERT INTO cursos_aulas_versoes (aula_id, versao, titulo, blocos, prova, autor_id) VALUES (?,?,?,?,?,?)", [a.id, a.versao, a.titulo, a.blocos, a.prova, req.user.id]);
  await db.query("UPDATE cursos_aulas SET titulo = ?, blocos = ?, prova = ?, versao = versao + 1 WHERE id = ?", [v.titulo, v.blocos, v.prova, a.id]);
  await auditar(req, "restaurar_versao", "aula", a.id, { versao: v.versao });
  res.json({ ok: true });
}));
admin.delete("/aulas/:aid", rota(async (req, res) => {
  const a = await aulaEditavel(req);
  await db.query("DELETE FROM cursos_aulas WHERE id = ?", [a.id]);
  await auditar(req, "excluir", "aula", a.id, { titulo: a.titulo, curso: a.curso_id });
  res.json({ ok: true });
}));

// envio de arquivos
admin.post("/arquivos", upload.single("arquivo"), rota(async (req, res) => {
  const f = req.file;
  if (!f) falha(400, "Nenhum arquivo enviado.");
  const apagar = () => fs.promises.unlink(f.path).catch(() => {});
  const ext = path.extname(f.originalname).toLowerCase();
  const tipo = TIPOS_ARQUIVO[ext];
  if (!tipo) { await apagar(); falha(400, "Tipo de arquivo não permitido."); }
  if (f.size > tipo[1] * 1024 * 1024) { await apagar(); falha(400, `Arquivo grande demais (máximo ${tipo[1]} MB para este tipo).`); }
  const fd = await fs.promises.open(f.path, "r");
  const cab = Buffer.alloc(16);
  await fd.read(cab, 0, 16, 0); await fd.close();
  if (!assinaturaCombina(ext, cab)) { await apagar(); falha(400, "O conteúdo do arquivo não corresponde ao tipo informado."); }
  const cursoId = inteiro(req.body?.cursoId) || null;
  const [r] = await db.query("INSERT INTO cursos_arquivos (curso_id, nome_original, mime, caminho, tamanho, enviado_por) VALUES (?,?,?,?,?,?)",
    [cursoId, path.basename(f.originalname).slice(0, 255), tipo[0], path.relative(UPLOAD_ROOT, f.path), f.size, req.user.id]);
  res.json({ id: r.insertId, nome: f.originalname, mime: tipo[0], tamanho: f.size, url: urlArquivo(r.insertId, req.user.id) });
}));

// matrículas e atribuições
admin.put("/cursos/:id/atribuicoes", rota(async (req, res) => {
  const c = await cursoEditavel(req);
  const lista = (Array.isArray(req.body?.atribuicoes) ? req.body.atribuicoes : []).slice(0, 500);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM cursos_atribuicoes WHERE curso_id = ?", [c.id]);
    for (const a of lista) {
      if (!["todos", "setor", "usuario"].includes(a.tipo)) continue;
      const prazo = /^\d{4}-\d{2}-\d{2}$/.test(a.prazoEm || "") ? a.prazoEm : null;
      await conn.query("INSERT IGNORE INTO cursos_atribuicoes (curso_id, tipo, alvo_id, obrigatorio, prazo_em, criado_por) VALUES (?,?,?,?,?,?)", [c.id, a.tipo, a.tipo === "todos" ? 0 : inteiro(a.alvoId), a.obrigatorio ? 1 : 0, prazo, req.user.id]);
    }
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  // Quem já usa o app recebe a matrícula na próxima abertura; aqui só materializamos a de usuários individuais.
  if (c.status === "publicado") await materializarAtribuicoes(c);
  await auditar(req, "atribuir", "curso", c.id, { total: lista.length });
  res.json({ ok: true });
}));
async function materializarAtribuicoes(c) {
  await db.query(
    `INSERT IGNORE INTO cursos_matriculas (curso_id, usuario_id, origem, obrigatorio, prazo_em)
     SELECT a.curso_id, u.id, 'atribuido', a.obrigatorio, COALESCE(a.prazo_em, IF(?, DATE_ADD(CURDATE(), INTERVAL ? DAY), NULL))
       FROM cursos_atribuicoes a JOIN usuarios u ON u.deletado_em IS NULL AND u.empresa_id = ?
        AND (a.tipo = 'todos' OR (a.tipo = 'setor' AND u.setor_id = a.alvo_id) OR (a.tipo = 'usuario' AND u.id = a.alvo_id))
      WHERE a.curso_id = ?`, [c.prazo_dias ? 1 : 0, c.prazo_dias || 0, c.empresa_id, c.id]);
}
admin.get("/cursos/:id/alunos", rota(async (req, res) => {
  const c = await cursoEditavel(req);
  const [total] = await db.query("SELECT COUNT(*) n FROM cursos_aulas WHERE curso_id = ?", [c.id]);
  const [rows] = await db.query(
    `SELECT m.usuario_id, u.nome, s.nome AS setor, m.obrigatorio, m.prazo_em, m.concluido_em, m.ultimo_acesso,
            (SELECT COUNT(*) FROM cursos_progresso p WHERE p.usuario_id = m.usuario_id AND p.curso_id = m.curso_id AND p.concluida_em IS NOT NULL) feitas,
            (SELECT MAX(nota) FROM cursos_tentativas t WHERE t.usuario_id = m.usuario_id AND t.curso_id = m.curso_id) melhor_nota
       FROM cursos_matriculas m JOIN usuarios u ON u.id = m.usuario_id LEFT JOIN setores s ON s.id = u.setor_id WHERE m.curso_id = ? ORDER BY u.nome`, [c.id]);
  res.json({ alunos: rows.map((r) => ({ ...r, progresso: total[0].n ? Math.round((r.feitas / total[0].n) * 100) : 0, atrasado: !r.concluido_em && !!r.prazo_em && new Date(r.prazo_em) < new Date(dia(agora())) })) });
}));
admin.post("/cursos/:id/matriculas", rota(async (req, res) => {
  const c = await cursoEditavel(req);
  const ids = (Array.isArray(req.body?.usuarioIds) ? req.body.usuarioIds : []).map(Number).filter(Number.isInteger).slice(0, 500);
  const prazo = /^\d{4}-\d{2}-\d{2}$/.test(req.body?.prazoEm || "") ? req.body.prazoEm : null;
  for (const uid of ids) await db.query("INSERT INTO cursos_matriculas (curso_id, usuario_id, origem, obrigatorio, prazo_em) SELECT ?, id, 'atribuido', ?, ? FROM usuarios WHERE id = ? AND empresa_id = ? ON DUPLICATE KEY UPDATE obrigatorio = VALUES(obrigatorio), prazo_em = VALUES(prazo_em)", [c.id, req.body?.obrigatorio ? 1 : 0, prazo, uid, req.user.empresa_id]);
  await auditar(req, "matricular", "curso", c.id, { usuarios: ids });
  res.json({ ok: true });
}));
admin.delete("/cursos/:id/matriculas/:uid", rota(async (req, res) => {
  const c = await cursoEditavel(req);
  await db.query("DELETE FROM cursos_matriculas WHERE curso_id = ? AND usuario_id = ?", [c.id, idParam(req.params.uid)]);
  await auditar(req, "remover_matricula", "curso", c.id, { usuario: req.params.uid });
  res.json({ ok: true });
}));

admin.get("/alunos", rota(async (req, res) => {
  const where = ["u.empresa_id = ?", "u.deletado_em IS NULL"], args = [req.user.empresa_id];
  if (req.query.q) { where.push("u.nome LIKE ?"); args.push(`%${texto(req.query.q, 60).replace(/[%_]/g, "\\$&")}%`); }
  if (inteiro(req.query.setor)) { where.push("u.setor_id = ?"); args.push(inteiro(req.query.setor)); }
  const [rows] = await db.query(
    `SELECT u.id, u.nome, s.nome AS setor,
       (SELECT COUNT(*) FROM cursos_matriculas m WHERE m.usuario_id = u.id) matriculas,
       (SELECT COUNT(*) FROM cursos_matriculas m WHERE m.usuario_id = u.id AND m.concluido_em IS NOT NULL) concluidos,
       (SELECT COUNT(*) FROM cursos_matriculas m WHERE m.usuario_id = u.id AND m.obrigatorio = 1 AND m.concluido_em IS NULL) obrigatorios_pendentes,
       (SELECT COUNT(*) FROM cursos_matriculas m WHERE m.usuario_id = u.id AND m.concluido_em IS NULL AND m.prazo_em < CURDATE()) atrasados,
       (SELECT COALESCE(SUM(segundos),0) FROM cursos_progresso p WHERE p.usuario_id = u.id) segundos
       FROM usuarios u LEFT JOIN setores s ON s.id = u.setor_id WHERE ${where.join(" AND ")} ORDER BY u.nome LIMIT 300`, args);
  res.json({ alunos: rows.map((r) => ({ ...r, horas: Math.round((Number(r.segundos) / 3600) * 10) / 10, segundos: undefined })) });
}));
admin.get("/alunos/:uid", rota(async (req, res) => {
  const uid = idParam(req.params.uid);
  const [[u]] = await db.query("SELECT u.id, u.nome, s.nome AS setor FROM usuarios u LEFT JOIN setores s ON s.id = u.setor_id WHERE u.id = ? AND u.empresa_id = ?", [uid, req.user.empresa_id]);
  if (!u) falha(404, "Funcionário não encontrado.");
  const [cursos] = await db.query(
    `SELECT m.curso_id, c.titulo, m.obrigatorio, m.prazo_em, m.concluido_em, m.ultimo_acesso,
       (SELECT COUNT(*) FROM cursos_aulas a WHERE a.curso_id = c.id) total,
       (SELECT COUNT(*) FROM cursos_progresso p WHERE p.usuario_id = m.usuario_id AND p.curso_id = c.id AND p.concluida_em IS NOT NULL) feitas
       FROM cursos_matriculas m JOIN cursos c ON c.id = m.curso_id WHERE m.usuario_id = ? ORDER BY m.criado_em DESC`, [uid]);
  const [tentativas] = await db.query(
    `SELECT t.id, t.numero, t.nota, t.aprovado, t.status, t.finalizada_em, t.tempo_segundos, a.titulo AS prova, c.titulo AS curso FROM cursos_tentativas t
       JOIN cursos_aulas a ON a.id = t.aula_id JOIN cursos c ON c.id = t.curso_id WHERE t.usuario_id = ? ORDER BY t.id DESC LIMIT 100`, [uid]);
  const [certs] = await db.query("SELECT codigo, curso_titulo, emitido_em FROM cursos_certificados WHERE usuario_id = ? ORDER BY emitido_em DESC", [uid]);
  res.json({ aluno: u, cursos: cursos.map((c) => ({ ...c, progresso: c.total ? Math.round((c.feitas / c.total) * 100) : 0 })), tentativas, certificados: certs, estatisticas: await estatisticasUsuario(uid) });
}));

// correção manual
admin.get("/correcoes", rota(async (req, res) => {
  const [rows] = await db.query(
    `SELECT t.id, t.numero, t.finalizada_em, u.nome AS aluno, a.titulo AS prova, c.titulo AS curso FROM cursos_tentativas t
       JOIN usuarios u ON u.id = t.usuario_id JOIN cursos_aulas a ON a.id = t.aula_id JOIN cursos c ON c.id = t.curso_id
      WHERE t.status = 'aguardando_correcao' AND c.empresa_id = ? ORDER BY t.finalizada_em`, [req.user.empresa_id]);
  res.json({ correcoes: rows });
}));
admin.get("/tentativas/:tid", rota(async (req, res) => {
  const [[t]] = await db.query("SELECT t.*, u.nome AS aluno, a.prova, a.titulo FROM cursos_tentativas t JOIN usuarios u ON u.id = t.usuario_id JOIN cursos_aulas a ON a.id = t.aula_id JOIN cursos c ON c.id = t.curso_id WHERE t.id = ? AND c.empresa_id = ?", [idParam(req.params.tid), req.user.empresa_id]);
  if (!t) falha(404, "Tentativa não encontrada.");
  const prova = json(t.prova);
  res.json({ tentativa: { id: t.id, aluno: t.aluno, prova: t.titulo, status: t.status, nota: t.nota === null ? null : Number(t.nota) }, questoes: prova.questoes, respostas: json(t.respostas, {}), manuais: json(t.correcoes, {})?.manuais ?? {} });
}));
admin.put("/tentativas/:tid/corrigir", rota(async (req, res) => {
  const [[t]] = await db.query("SELECT t.*, a.prova FROM cursos_tentativas t JOIN cursos_aulas a ON a.id = t.aula_id JOIN cursos c ON c.id = t.curso_id WHERE t.id = ? AND c.empresa_id = ?", [idParam(req.params.tid), req.user.empresa_id]);
  if (!t) falha(404, "Tentativa não encontrada.");
  if (t.status === "em_andamento") falha(409, "O aluno ainda não finalizou esta prova.");
  const prova = json(t.prova);
  const manuais = {};
  for (const q of prova.questoes.filter((x) => x.tipo === "discursiva")) {
    const m = req.body?.manuais?.[q.id];
    if (m && Number.isFinite(Number(m.pontos))) manuais[q.id] = { pontos: Math.min(q.pontos, Math.max(0, Number(m.pontos))), comentario: texto(m.comentario, 2000) };
  }
  const cor = L.corrigirTentativa(prova, json(t.respostas, {}), manuais);
  await db.query("UPDATE cursos_tentativas SET correcoes = ?, nota = ?, aprovado = ?, status = ? WHERE id = ?",
    [JSON.stringify({ itens: cor.itens, manuais }), cor.nota, cor.aprovado === null ? null : cor.aprovado ? 1 : 0, cor.pendente ? "aguardando_correcao" : "finalizada", t.id]);
  if (!cor.pendente) {
    const [[curso]] = await db.query("SELECT * FROM cursos WHERE id = ?", [t.curso_id]);
    await aplicarResultadoNaAula(t.usuario_id, curso, t.aula_id, prova, cor.aprovado);
  }
  await auditar(req, "corrigir", "tentativa", t.id, { nota: cor.nota });
  res.json({ ok: true, nota: cor.nota, aprovado: cor.aprovado });
}));

// trilhas
admin.get("/trilhas", rota(async (req, res) => {
  const [trilhas] = await db.query("SELECT id, titulo, descricao, publicada FROM cursos_trilhas WHERE empresa_id = ? ORDER BY titulo", [req.user.empresa_id]);
  const [itens] = await db.query("SELECT i.trilha_id, i.curso_id, c.titulo FROM cursos_trilha_itens i JOIN cursos c ON c.id = i.curso_id ORDER BY i.ordem");
  res.json({ trilhas: trilhas.map((t) => ({ ...t, publicada: !!t.publicada, cursos: itens.filter((i) => i.trilha_id === t.id) })) });
}));
admin.put("/trilhas{/:id}", rota(async (req, res) => {
  const titulo = texto(req.body?.titulo, 200, true, "O título");
  let id = req.params.id ? idParam(req.params.id) : null;
  if (id) await db.query("UPDATE cursos_trilhas SET titulo = ?, descricao = ?, publicada = ? WHERE id = ? AND empresa_id = ?", [titulo, texto(req.body?.descricao, 3000) || null, req.body?.publicada ? 1 : 0, id, req.user.empresa_id]);
  else id = (await db.query("INSERT INTO cursos_trilhas (empresa_id, titulo, descricao, publicada) VALUES (?,?,?,?)", [req.user.empresa_id, titulo, texto(req.body?.descricao, 3000) || null, req.body?.publicada ? 1 : 0]))[0].insertId;
  const cursoIds = (Array.isArray(req.body?.cursoIds) ? req.body.cursoIds : []).map(Number).filter(Number.isInteger);
  await db.query("DELETE FROM cursos_trilha_itens WHERE trilha_id = ?", [id]);
  for (const [i, cid] of cursoIds.entries()) await db.query("INSERT IGNORE INTO cursos_trilha_itens (trilha_id, curso_id, ordem) SELECT ?, id, ? FROM cursos WHERE id = ? AND empresa_id = ?", [id, i, cid, req.user.empresa_id]);
  await auditar(req, "salvar", "trilha", id, { titulo });
  res.json({ id });
}));
admin.delete("/trilhas/:id", rota(async (req, res) => {
  await db.query("DELETE FROM cursos_trilhas WHERE id = ? AND empresa_id = ?", [idParam(req.params.id), req.user.empresa_id]);
  await auditar(req, "excluir", "trilha", idParam(req.params.id));
  res.json({ ok: true });
}));

// gestores (somente administradores do sistema concedem)
admin.get("/gestores", rota(async (req, res) => {
  const [rows] = await db.query("SELECT g.usuario_id, u.nome FROM cursos_gestores g JOIN usuarios u ON u.id = g.usuario_id ORDER BY u.nome");
  res.json({ gestores: rows });
}));
admin.put("/gestores", rota(async (req, res) => {
  if (!ehAdmin(req.user)) falha(403, "Somente administradores podem conceder esta permissão.");
  const ids = (Array.isArray(req.body?.usuarioIds) ? req.body.usuarioIds : []).map(Number).filter(Number.isInteger);
  await db.query("DELETE FROM cursos_gestores");
  for (const id of ids) await db.query("INSERT IGNORE INTO cursos_gestores (usuario_id, concedido_por) SELECT id, ? FROM usuarios WHERE id = ? AND empresa_id = ?", [req.user.id, id, req.user.empresa_id]);
  await auditar(req, "gestores", "permissao", null, { ids });
  res.json({ ok: true });
}));
admin.get("/auditoria", rota(async (req, res) => {
  const [rows] = await db.query("SELECT a.id, a.acao, a.entidade, a.entidade_id, a.detalhes, a.criado_em, u.nome AS usuario FROM cursos_auditoria a LEFT JOIN usuarios u ON u.id = a.usuario_id ORDER BY a.id DESC LIMIT 200");
  res.json({ registros: rows.map((r) => ({ ...r, detalhes: json(r.detalhes) })) });
}));

// relatórios
async function dadosRelatorio(req) {
  const de = /^\d{4}-\d{2}-\d{2}$/.test(req.query.de || "") ? req.query.de : dia(new Date(Date.now() - 90 * 86400000));
  const ate = /^\d{4}-\d{2}-\d{2}$/.test(req.query.ate || "") ? req.query.ate : dia(agora());
  const setor = inteiro(req.query.setor), curso = inteiro(req.query.curso), emp = req.user.empresa_id;
  const fu = setor ? " AND u.setor_id = ?" : "", fc = curso ? " AND m.curso_id = ?" : "";
  const extra = [...(setor ? [setor] : []), ...(curso ? [curso] : [])];
  const base = `FROM cursos_matriculas m JOIN usuarios u ON u.id = m.usuario_id AND u.deletado_em IS NULL AND u.empresa_id = ? JOIN cursos c ON c.id = m.curso_id
                WHERE m.criado_em < DATE_ADD(?, INTERVAL 1 DAY) ${fu}${fc}`;
  const [[kpi]] = await db.query(`SELECT COUNT(*) matriculas, SUM(m.concluido_em IS NULL) ativas, SUM(m.concluido_em IS NOT NULL) concluidas, COUNT(DISTINCT m.usuario_id) alunos ${base}`, [emp, ate, ...extra]);
  const [[pub]] = await db.query("SELECT COUNT(*) n FROM cursos WHERE empresa_id = ? AND status = 'publicado'", [emp]);
  const [[media]] = await db.query(
    `SELECT AVG(t.nota) media FROM cursos_tentativas t JOIN usuarios u ON u.id = t.usuario_id AND u.empresa_id = ? WHERE t.status = 'finalizada' AND t.nota IS NOT NULL AND DATE(t.finalizada_em) BETWEEN ? AND ? ${setor ? "AND u.setor_id = ?" : ""}${curso ? " AND t.curso_id = ?" : ""}`, [emp, de, ate, ...extra]);
  const [[horas]] = await db.query(
    `SELECT COALESCE(SUM(p.segundos),0) s FROM cursos_progresso p JOIN usuarios u ON u.id = p.usuario_id AND u.empresa_id = ? WHERE DATE(p.atualizado_em) BETWEEN ? AND ? ${setor ? "AND u.setor_id = ?" : ""}${curso ? " AND p.curso_id = ?" : ""}`, [emp, de, ate, ...extra]);
  const [maisAcessados] = await db.query(`SELECT c.id, c.titulo, COUNT(*) matriculas, SUM(m.concluido_em IS NOT NULL) concluidos ${base} GROUP BY c.id ORDER BY matriculas DESC LIMIT 8`, [emp, ate, ...extra]);
  const [desempenho] = await db.query(`SELECT u.id, u.nome, SUM(m.concluido_em IS NOT NULL) concluidos, COUNT(*) matriculas ${base} GROUP BY u.id HAVING concluidos > 0 ORDER BY concluidos DESC, u.nome LIMIT 8`, [emp, ate, ...extra]);
  const [pendentes] = await db.query(`SELECT u.id, u.nome, s.nome AS setor, COUNT(*) pendentes, SUM(m.prazo_em < CURDATE()) atrasados ${base} AND m.obrigatorio = 1 AND m.concluido_em IS NULL GROUP BY u.id ORDER BY atrasados DESC, pendentes DESC LIMIT 50`.replace("JOIN cursos c", "LEFT JOIN setores s ON s.id = u.setor_id JOIN cursos c"), [emp, ate, ...extra]);
  const [porSetor] = await db.query(`SELECT COALESCE(s.nome, 'Sem setor') setor, COUNT(*) matriculas, SUM(m.concluido_em IS NOT NULL) concluidos ${base} GROUP BY u.setor_id ORDER BY matriculas DESC`.replace("JOIN cursos c", "LEFT JOIN setores s ON s.id = u.setor_id JOIN cursos c"), [emp, ate, ...extra]);
  const [serie] = await db.query(`SELECT DATE(m.concluido_em) d, COUNT(*) n ${base} AND m.concluido_em IS NOT NULL AND DATE(m.concluido_em) BETWEEN ? AND ? GROUP BY DATE(m.concluido_em) ORDER BY d`, [emp, ate, ...extra, de, ate]);
  return {
    periodo: { de, ate },
    kpis: { alunos: kpi.alunos, cursosPublicados: pub.n, matriculasAtivas: Number(kpi.ativas ?? 0), taxaConclusao: kpi.matriculas ? Math.round((Number(kpi.concluidas) / kpi.matriculas) * 100) : 0, mediaAvaliacoes: media.media === null ? null : Math.round(Number(media.media) * 10) / 10, horasTreinamento: Math.round((Number(horas.s) / 3600) * 10) / 10 },
    maisAcessados, desempenho, pendentes: pendentes.map((p) => ({ ...p, atrasados: Number(p.atrasados) })), porSetor: porSetor.map((s) => ({ ...s, concluidos: Number(s.concluidos) })),
    serie: serie.map((s) => ({ d: s.d instanceof Date ? dia(new Date(s.d.getTime() - s.d.getTimezoneOffset() * 60000)) : String(s.d), n: s.n })),
  };
}
admin.get("/relatorios", rota(async (req, res) => res.json(await dadosRelatorio(req))));
const csvCelula = (v) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // evita injeção de fórmula ao abrir no Excel
  return /[";\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
async function linhasRelatorio(req) {
  const setor = inteiro(req.query.setor), curso = inteiro(req.query.curso);
  const [rows] = await db.query(
    `SELECT u.nome AS funcionario, COALESCE(s.nome,'') AS setor, c.titulo AS curso, m.obrigatorio, m.prazo_em, m.concluido_em,
       (SELECT COUNT(*) FROM cursos_progresso p WHERE p.usuario_id = m.usuario_id AND p.curso_id = m.curso_id AND p.concluida_em IS NOT NULL) feitas,
       (SELECT COUNT(*) FROM cursos_aulas a WHERE a.curso_id = c.id) total,
       (SELECT MAX(nota) FROM cursos_tentativas t WHERE t.usuario_id = m.usuario_id AND t.curso_id = m.curso_id) nota
       FROM cursos_matriculas m JOIN usuarios u ON u.id = m.usuario_id AND u.empresa_id = ? LEFT JOIN setores s ON s.id = u.setor_id JOIN cursos c ON c.id = m.curso_id
      WHERE 1=1${setor ? " AND u.setor_id = ?" : ""}${curso ? " AND c.id = ?" : ""} ORDER BY u.nome, c.titulo LIMIT 20000`,
    [req.user.empresa_id, ...(setor ? [setor] : []), ...(curso ? [curso] : [])]);
  const hoje = dia(agora());
  const cab = ["Funcionário", "Setor", "Curso", "Obrigatório", "Prazo", "Progresso (%)", "Melhor nota", "Situação", "Concluído em"];
  const linhas = rows.map((r) => [r.funcionario, r.setor, r.curso, r.obrigatorio ? "Sim" : "Não", r.prazo_em ? dia(new Date(r.prazo_em)) : "", r.total ? Math.round((r.feitas / r.total) * 100) : 0, r.nota === null ? "" : Number(r.nota),
    r.concluido_em ? "Concluído" : r.prazo_em && dia(new Date(r.prazo_em)) < hoje ? "Atrasado" : "Em andamento", r.concluido_em ? dia(new Date(r.concluido_em)) : ""]);
  return { cab, linhas };
}
admin.get("/relatorios/linhas", rota(async (req, res) => res.json(await linhasRelatorio(req))));
admin.get("/relatorios.csv", rota(async (req, res) => {
  const { cab, linhas } = await linhasRelatorio(req);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="relatorio-cursos-${dia(agora())}.csv"`);
  res.send("\ufeff" + [cab, ...linhas].map((l) => l.map(csvCelula).join(";")).join("\r\n"));
}));

export default router;
