// Assistente do Workspace na internet (via 9Router). Montado em /api/ia/assistente.
import { Router } from "express";
import db from "../db/db.js";
import authMiddleware from "../middlewares/middleware.js";
import {
  MAX_MEMORIAS, configuracao, conversar, criarLimitador, extrairMemorias, memoriaRepetida, normalizarMemoria, resumoDoDia,
} from "../services/assistenteIa.js";
import { provedorBusca } from "../services/buscaWeb.js";
import { MAX_AUDIO_BYTES, converterParaWav, transcreverWav } from "../services/transcricao.js";
import { IDS_FONTES, filtrarBlocosPorFonte, fontesDoUsuario, registrarProvedor, registrarUso } from "../services/iaAdminService.js";

// Estatísticas nunca derrubam o Assistente: qualquer erro de gravação é só registrado.
const semFalha = (p) => p.catch((e) => console.error("[assistente] estatística:", e?.message));
const observador = (req) => (e) => { void semFalha(registrarProvedor({ empresaId: req.user.empresa_id, provedor: e.provedor, ok: e.ok, erro: e.erro })); };
const fontesOuTodas = (req) => fontesDoUsuario(req.user).catch(() => [...IDS_FONTES]);

const router = Router();
router.use(authMiddleware);
const limite = criarLimitador({ max: Number(process.env.ASSISTENTE_LIMITE_HORA) || 40 });
const limiteDitado = criarLimitador({ max: Number(process.env.ASSISTENTE_LIMITE_DITADO_HORA) || 60 });
const limiteResumo = criarLimitador({ max: Number(process.env.ASSISTENTE_LIMITE_RESUMO_HORA) || 12 });

let schemaPronto = null;
function garantirSchema() {
  schemaPronto ??= db.query(
    `CREATE TABLE IF NOT EXISTS assistente_memorias (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NOT NULL,
      usuario_id INT NOT NULL,
      texto VARCHAR(300) NOT NULL,
      origem VARCHAR(10) NOT NULL DEFAULT 'auto',
      criada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      atualizada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_assistente_memorias_usuario (empresa_id, usuario_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ).catch((e) => { schemaPronto = null; throw e; });
  return schemaPronto;
}
const dono = (req) => [req.user.empresa_id, req.user.id];
async function listarMemorias(req) {
  await garantirSchema();
  const [linhas] = await db.query(
    "SELECT id, texto, origem, criada_em FROM assistente_memorias WHERE empresa_id = ? AND usuario_id = ? ORDER BY id ASC LIMIT ?",
    [...dono(req), MAX_MEMORIAS],
  );
  return linhas;
}

router.get("/status", async (req, res) => {
  const cfg = configuracao();
  const fontes = await fontesOuTodas(req);
  res.json({
    configurada: cfg.configurada, busca: !!provedorBusca() && fontes.includes("web"), modelos: cfg.catalogo, memoria: true,
    imagens: cfg.modelosVisao.length > 0 && fontes.includes("imagens"), fontes,
  });
});

router.get("/memorias", async (req, res) => {
  try {
    res.json({ memorias: await listarMemorias(req), maximo: MAX_MEMORIAS });
  } catch (e) {
    console.error("[assistente] memórias:", e?.message);
    res.status(500).json({ error: "Não foi possível carregar a memória." });
  }
});

router.post("/memorias", async (req, res) => {
  try {
    const texto = normalizarMemoria(req.body?.texto);
    if (!texto) return res.status(400).json({ error: "Escreva uma memória curta, sem CPF, telefone, e-mail ou outros dados sensíveis." });
    const atuais = await listarMemorias(req);
    if (atuais.length >= MAX_MEMORIAS) return res.status(400).json({ error: `Limite de ${MAX_MEMORIAS} memórias. Apague alguma antes.` });
    if (memoriaRepetida(texto, atuais.map((m) => m.texto))) return res.status(409).json({ error: "Isso já está na memória." });
    const [r] = await db.query("INSERT INTO assistente_memorias (empresa_id, usuario_id, texto, origem) VALUES (?, ?, ?, 'pedido')", [...dono(req), texto]);
    res.status(201).json({ id: r.insertId, texto });
  } catch (e) {
    console.error("[assistente] memórias:", e?.message);
    res.status(500).json({ error: "Não foi possível guardar a memória." });
  }
});

router.put("/memorias/:id", async (req, res) => {
  try {
    const texto = normalizarMemoria(req.body?.texto);
    if (!texto) return res.status(400).json({ error: "Escreva uma memória curta, sem CPF, telefone, e-mail ou outros dados sensíveis." });
    await garantirSchema();
    const [r] = await db.query("UPDATE assistente_memorias SET texto = ? WHERE id = ? AND empresa_id = ? AND usuario_id = ?", [texto, Number(req.params.id), ...dono(req)]);
    if (!r.affectedRows) return res.status(404).json({ error: "Memória não encontrada." });
    res.json({ ok: true });
  } catch (e) {
    console.error("[assistente] memórias:", e?.message);
    res.status(500).json({ error: "Não foi possível editar a memória." });
  }
});

router.delete("/memorias/:id", async (req, res) => {
  try {
    await garantirSchema();
    await db.query("DELETE FROM assistente_memorias WHERE id = ? AND empresa_id = ? AND usuario_id = ?", [Number(req.params.id), ...dono(req)]);
    res.json({ ok: true });
  } catch (e) {
    console.error("[assistente] memórias:", e?.message);
    res.status(500).json({ error: "Não foi possível apagar a memória." });
  }
});

router.delete("/memorias", async (req, res) => {
  try {
    await garantirSchema();
    await db.query("DELETE FROM assistente_memorias WHERE empresa_id = ? AND usuario_id = ?", dono(req));
    res.json({ ok: true });
  } catch (e) {
    console.error("[assistente] memórias:", e?.message);
    res.status(500).json({ error: "Não foi possível apagar a memória." });
  }
});

// Resumo do dia da Home: texto curto a partir dos números que o app já tem. Não usa histórico, memória nem pesquisa.
router.post("/resumo", async (req, res) => {
  const permitido = limiteResumo(`${req.user.empresa_id}:${req.user.id}`);
  if (!permitido.ok) {
    res.set("Retry-After", String(permitido.tentarEmSeg));
    return res.status(429).json({ error: `Muitos resumos seguidos. Tente de novo em ${Math.ceil(permitido.tentarEmSeg / 60)} min.` });
  }
  try {
    const r = await resumoDoDia(req.body?.texto, { observar: observador(req) });
    void semFalha(registrarUso({ empresaId: req.user.empresa_id, usuarioId: req.user.id, campo: "resumos" }));
    res.json({ resumo: r.resposta, modelo: r.modelo });
  } catch (e) {
    if (e.status && e.status !== 400) console.error("[assistente] resumo falhou:", e.message, e.detalhe || "");
    const status = e.status || 400;
    res.status(status).json({ error: status === 400 ? e.message : "Não foi possível gerar o resumo agora." });
  }
});

// Ditado por voz: recebe o áudio gravado no app (base64) e devolve o texto falado. O áudio não é guardado.
router.post("/transcrever", async (req, res) => {
  const permitido = limiteDitado(`${req.user.empresa_id}:${req.user.id}`);
  if (!permitido.ok) {
    res.set("Retry-After", String(permitido.tentarEmSeg));
    return res.status(429).json({ error: `Muitos ditados seguidos. Tente de novo em ${Math.ceil(permitido.tentarEmSeg / 60)} min.` });
  }
  try {
    const base64 = typeof req.body?.audio === "string" ? req.body.audio : "";
    const bruto = Buffer.from(base64, "base64");
    if (bruto.length < 800) return res.status(400).json({ error: "Não ouvi nada. Fale perto do microfone e tente de novo." });
    if (bruto.length > MAX_AUDIO_BYTES) return res.status(413).json({ error: "O áudio ficou longo demais. Dite em trechos de até 1 minuto." });
    const wav = await converterParaWav(bruto);
    const texto = await transcreverWav(wav, { observar: observador(req) });
    void semFalha(registrarUso({ empresaId: req.user.empresa_id, usuarioId: req.user.id, campo: "resumos" }));
    res.json({ texto });
  } catch (e) {
    if (e.status !== 400) console.error("[assistente] ditado falhou:", e.message, e.detalhe || "");
    const status = e.status || 500;
    res.status(status).json({ error: [400, 502, 503].includes(status) ? e.message : "Não foi possível transcrever agora." });
  }
});

router.post("/conversar", async (req, res) => {
  const permitido = limite(`${req.user.empresa_id}:${req.user.id}`);
  if (!permitido.ok) {
    res.set("Retry-After", String(permitido.tentarEmSeg));
    return res.status(429).json({ error: `Você atingiu o limite de perguntas por hora. Tente de novo em ${Math.ceil(permitido.tentarEmSeg / 60)} min.` });
  }
  const empresaId = req.user.empresa_id, usuarioId = req.user.id;
  try {
    const permitidas = await fontesOuTodas(req);
    const pediuImagem = Array.isArray(req.body?.imagens) && req.body.imagens.length > 0;
    if (pediuImagem && !permitidas.includes("imagens")) return res.status(403).json({ error: "O seu setor não pode enviar imagens ao Assistente." });
    const web = req.body?.web === true && permitidas.includes("web");
    const { blocos: dadosPermitidos, removidos } = filtrarBlocosPorFonte(req.body?.dados, permitidas);
    // Memória é um recurso à parte: se falhar, a conversa segue sem ela.
    const usarMemoria = req.body?.memoria !== false;
    let atuais = [];
    if (usarMemoria) atuais = await listarMemorias(req).catch(() => []);
    const mensagens = req.body?.mensagens;
    const ultima = Array.isArray(mensagens) ? [...mensagens].reverse().find((m) => m?.role === "user")?.content : "";
    // A resposta e a extração de memória andam juntas, para o aviso "Memorizei" chegar com a resposta.
    const [r, novas] = await Promise.all([
      conversar(mensagens, {
        web,
        observar: observador(req),
        modelo: typeof req.body?.modelo === "string" ? req.body.modelo : "",
        dados: dadosPermitidos,
        imagens: req.body?.imagens,
        memorias: atuais.map((m) => m.texto),
      }),
      usarMemoria && atuais.length < MAX_MEMORIAS && typeof ultima === "string"
        ? extrairMemorias(ultima, atuais.map((m) => m.texto))
        : Promise.resolve([]),
    ]);
    const memorizado = [];
    for (const n of novas.slice(0, MAX_MEMORIAS - atuais.length)) {
      try {
        const [ins] = await db.query("INSERT INTO assistente_memorias (empresa_id, usuario_id, texto, origem) VALUES (?, ?, ?, ?)", [...dono(req), n.texto, n.origem]);
        memorizado.push({ id: ins.insertId, texto: n.texto });
      } catch (e) {
        console.error("[assistente] não guardou memória:", e?.message);
      }
    }
    void semFalha(registrarUso({ empresaId, usuarioId, campo: "perguntas" }));
    if (web) void semFalha(registrarUso({ empresaId, usuarioId, campo: "pesquisas" }));
    if (pediuImagem) void semFalha(registrarUso({ empresaId, usuarioId, campo: "imagens" }));
    if (dadosPermitidos.length) void semFalha(registrarUso({ empresaId, usuarioId, campo: "dados" }));
    res.json({ bloqueadas: removidos, resposta: r.resposta, fontes: r.fontes, busca: r.busca, modelo: r.modelo, dadosUsados: r.dadosUsados, memorizado });
  } catch (e) {
    void semFalha(registrarUso({ empresaId, usuarioId, campo: "falhas" }));
    // Só o motivo técnico vai para o log; o texto da conversa nunca.
    if (e.status) console.error("[assistente] falha:", e.message, e.detalhe || "");
    const status = e.status || 400;
    res.status(status).json({ error: status === 400 ? e.message : "O assistente na internet não respondeu agora. Tente de novo ou use a IA local." });
  }
});

export default router;
