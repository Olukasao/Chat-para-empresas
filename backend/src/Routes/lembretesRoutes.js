// Lembretes com alarme no app. Montado em /api/lembretes.
import { Router } from "express";
import db from "../db/db.js";
import authMiddleware from "../middlewares/middleware.js";
import { criarLimitador } from "../services/assistenteIa.js";
import { registrarProvedor, registrarUso } from "../services/iaAdminService.js";
import { agoraSaoPaulo, interpretarLembretes } from "../services/lembretesIa.js";
import { descreverRegra, horariosNoDia, normalizarRegra, proximaOcorrencia } from "../services/lembretesLogica.js";

const router = Router();
router.use(authMiddleware);
const limiteIa = criarLimitador({ max: Number(process.env.LEMBRETES_IA_LIMITE_HORA) || 40 });
const MAX_ATIVOS = 60;
const SONECAS = [5, 10, 30, 60];

const semFalha = (p) => p.catch((e) => console.error("[lembretes] estatística:", e?.message));
const idValido = (v) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };

let schemaPronto = null;
export function garantirSchemaLembretes() {
    schemaPronto ??= (async () => {
        const motor = "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
        await db.query(`CREATE TABLE IF NOT EXISTS lembretes (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            empresa_id INT NOT NULL,
            usuario_id INT NOT NULL,
            texto VARCHAR(300) NOT NULL,
            tipo VARCHAR(10) NOT NULL,
            horarios VARCHAR(80) NOT NULL,
            dias_semana VARCHAR(20) NOT NULL DEFAULT '',
            dia_mes TINYINT DEFAULT NULL,
            data_unica DATE DEFAULT NULL,
            avisar_chat TINYINT(1) NOT NULL DEFAULT 1,
            ativo TINYINT(1) NOT NULL DEFAULT 1,
            proximo_em DATETIME DEFAULT NULL,
            criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_lembretes_usuario (empresa_id, usuario_id, ativo),
            KEY idx_lembretes_vencer (ativo, proximo_em)
        ) ${motor}`);
        await db.query(`CREATE TABLE IF NOT EXISTS lembrete_disparos (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            lembrete_id INT DEFAULT NULL,
            empresa_id INT NOT NULL,
            usuario_id INT NOT NULL,
            texto VARCHAR(300) NOT NULL,
            disparou_em DATETIME NOT NULL,
            status VARCHAR(10) NOT NULL DEFAULT 'aberto',
            soneca_ate DATETIME DEFAULT NULL,
            KEY idx_lembrete_disparos_usuario (empresa_id, usuario_id, status, soneca_ate)
        ) ${motor}`);
        // Lembretes que as pessoas criaram a partir das Notas (recurso retirado) passam para a nova tela, como "uma vez".
        const [antiga] = await db.query("SHOW TABLES LIKE 'note_lembretes'");
        if (antiga.length) {
            const [pendentes] = await db.query("SELECT id, empresa_id, usuario_id, texto, DATE_FORMAT(quando, '%Y-%m-%d') AS data, DATE_FORMAT(quando, '%H:%i') AS hora FROM note_lembretes WHERE status = 'pendente'");
            for (const l of pendentes) {
                const regra = normalizarRegra({ texto: l.texto, tipo: "unico", horarios: [l.hora], data: l.data });
                await db.query("INSERT INTO lembretes (empresa_id, usuario_id, texto, tipo, horarios, data_unica, proximo_em) VALUES (?, ?, ?, 'unico', ?, ?, ?)",
                    [l.empresa_id, l.usuario_id, regra.texto, regra.horarios.join(","), regra.data, `${regra.data} ${regra.horarios[0]}:00`]);
            }
            await db.query("RENAME TABLE note_lembretes TO note_lembretes_antiga");
        }
    })().catch((e) => { schemaPronto = null; throw e; });
    return schemaPronto;
}
router.use(async (_req, res, next) => {
    try { await garantirSchemaLembretes(); next(); } catch (e) { console.error("[lembretes] schema:", e?.message); res.status(500).json({ error: "Não foi possível preparar os lembretes." }); }
});

// Datas já formatadas pelo banco: nada depende do fuso do servidor.
const COLUNAS = "id, empresa_id, usuario_id, texto, tipo, horarios, dias_semana, dia_mes, DATE_FORMAT(data_unica, '%Y-%m-%d') AS data_unica, avisar_chat, ativo, DATE_FORMAT(proximo_em, '%Y-%m-%d %H:%i:%s') AS proximo_em";
const lista = (csv) => String(csv || "").split(",").map((x) => x.trim()).filter(Boolean);
export function regraDaLinha(l) {
    return {
        texto: l.texto, tipo: l.tipo, horarios: lista(l.horarios), dias_semana: lista(l.dias_semana).map(Number),
        dia_mes: l.dia_mes ?? null, data: l.data_unica || null, avisar_chat: l.avisar_chat ? 1 : 0,
    };
}
const paraResposta = (l) => {
    const regra = regraDaLinha(l);
    return { id: l.id, ...regra, ativo: Boolean(l.ativo), descricao: descreverRegra(regra), proximo: l.proximo_em || null };
};

router.post("/interpretar", async (req, res) => {
    const p = limiteIa(`${req.user.empresa_id}:${req.user.id}`);
    if (!p.ok) {
        res.set("Retry-After", String(p.tentarEmSeg));
        return res.status(429).json({ error: `Muitos pedidos à IA seguidos. Tente de novo em ${Math.ceil(p.tentarEmSeg / 60)} min.` });
    }
    try {
        const observar = (e) => { void semFalha(registrarProvedor({ empresaId: req.user.empresa_id, provedor: e.provedor, ok: e.ok, erro: e.erro })); };
        const lembretes = await interpretarLembretes(req.body?.texto, { observar });
        void semFalha(registrarUso({ empresaId: req.user.empresa_id, usuarioId: req.user.id, campo: "resumos" }));
        res.json({ lembretes: lembretes.map((r) => ({ ...r, descricao: descreverRegra(r) })) });
    } catch (e) {
        if (e.status && ![400, 502].includes(e.status)) console.error("[lembretes] IA:", e.message, e.detalhe || "");
        const status = e.status || 500;
        res.status(status).json({ error: [400, 502, 503].includes(status) ? e.message : "Não foi possível entender o pedido agora." });
    }
});

router.get("/", async (req, res) => {
    try {
        const [linhas] = await db.query(`SELECT ${COLUNAS} FROM lembretes WHERE empresa_id = ? AND usuario_id = ? ORDER BY ativo DESC, proximo_em IS NULL, proximo_em ASC, id DESC LIMIT 200`, [req.user.empresa_id, req.user.id]);
        res.json({ lembretes: linhas.map(paraResposta) });
    } catch (e) {
        console.error("[lembretes] listar:", e?.message);
        res.status(500).json({ error: "Não foi possível carregar os lembretes." });
    }
});

async function gravar(req, regra, id = null) {
    const proximo = proximaOcorrencia(regra, agoraSaoPaulo());
    if (!proximo && regra.tipo === "unico") throw Object.assign(new Error("Essa data e hora já passaram. Escolha um horário no futuro."), { status: 400 });
    const valores = [regra.texto, regra.tipo, regra.horarios.join(","), regra.dias_semana.join(","), regra.dia_mes, regra.data, regra.avisar_chat, proximo];
    if (id) {
        const [r] = await db.query("UPDATE lembretes SET texto = ?, tipo = ?, horarios = ?, dias_semana = ?, dia_mes = ?, data_unica = ?, avisar_chat = ?, proximo_em = ?, ativo = 1 WHERE id = ? AND empresa_id = ? AND usuario_id = ?", [...valores, id, req.user.empresa_id, req.user.id]);
        if (!r.affectedRows) throw Object.assign(new Error("Lembrete não encontrado."), { status: 404 });
        return id;
    }
    const [r] = await db.query("INSERT INTO lembretes (empresa_id, usuario_id, texto, tipo, horarios, dias_semana, dia_mes, data_unica, avisar_chat, proximo_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [req.user.empresa_id, req.user.id, ...valores]);
    return r.insertId;
}

router.post("/", async (req, res) => {
    try {
        const entradas = Array.isArray(req.body?.lembretes) ? req.body.lembretes.slice(0, 5) : [req.body];
        const regras = entradas.map(normalizarRegra);
        const [[{ n }]] = await db.query("SELECT COUNT(*) AS n FROM lembretes WHERE empresa_id = ? AND usuario_id = ? AND ativo = 1", [req.user.empresa_id, req.user.id]);
        if (Number(n) + regras.length > MAX_ATIVOS) return res.status(400).json({ error: `Você pode ter até ${MAX_ATIVOS} lembretes ativos. Exclua alguns antes.` });
        const ids = [];
        for (const r of regras) ids.push(await gravar(req, r));
        res.status(201).json({ ids });
    } catch (e) {
        if (!e.status) console.error("[lembretes] criar:", e?.message);
        res.status(e.status || 500).json({ error: e.status ? e.message : "Não foi possível salvar o lembrete." });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const id = idValido(req.params.id);
        if (!id) return res.status(400).json({ error: "Lembrete inválido." });
        await gravar(req, normalizarRegra(req.body), id);
        res.json({ ok: true });
    } catch (e) {
        if (!e.status) console.error("[lembretes] editar:", e?.message);
        res.status(e.status || 500).json({ error: e.status ? e.message : "Não foi possível salvar o lembrete." });
    }
});

router.patch("/:id/ativo", async (req, res) => {
    try {
        const id = idValido(req.params.id);
        if (!id) return res.status(400).json({ error: "Lembrete inválido." });
        const [linhas] = await db.query(`SELECT ${COLUNAS} FROM lembretes WHERE id = ? AND empresa_id = ? AND usuario_id = ?`, [id, req.user.empresa_id, req.user.id]);
        if (!linhas[0]) return res.status(404).json({ error: "Lembrete não encontrado." });
        const ativar = req.body?.ativo === true || req.body?.ativo === "true";
        let proximo = null;
        if (ativar) {
            proximo = proximaOcorrencia(regraDaLinha(linhas[0]), agoraSaoPaulo());
            if (!proximo) return res.status(400).json({ error: "Esse lembrete era de uma data que já passou. Edite a data para ativá-lo de novo." });
        }
        await db.query("UPDATE lembretes SET ativo = ?, proximo_em = ? WHERE id = ?", [ativar ? 1 : 0, proximo, id]);
        res.json({ ok: true });
    } catch (e) {
        console.error("[lembretes] ativar:", e?.message);
        res.status(500).json({ error: "Não foi possível alterar o lembrete." });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const id = idValido(req.params.id);
        if (!id) return res.status(400).json({ error: "Lembrete inválido." });
        await db.query("DELETE FROM lembretes WHERE id = ? AND empresa_id = ? AND usuario_id = ?", [id, req.user.empresa_id, req.user.id]);
        res.json({ ok: true });
    } catch (e) {
        console.error("[lembretes] excluir:", e?.message);
        res.status(500).json({ error: "Não foi possível excluir o lembrete." });
    }
});

/** O que ainda vai tocar hoje (para o Início e o Resumo de hoje). */
router.get("/hoje", async (req, res) => {
    try {
        const agora = agoraSaoPaulo();
        const hoje = agora.slice(0, 10), hm = agora.slice(11, 16);
        const [linhas] = await db.query(`SELECT ${COLUNAS} FROM lembretes WHERE empresa_id = ? AND usuario_id = ? AND ativo = 1`, [req.user.empresa_id, req.user.id]);
        const itens = [];
        for (const l of linhas) for (const h of horariosNoDia(regraDaLinha(l), hoje)) if (h > hm) itens.push({ id: l.id, texto: l.texto, hora: h });
        itens.sort((a, b) => a.hora.localeCompare(b.hora));
        res.json({ lembretes: itens.slice(0, 20) });
    } catch (e) {
        console.error("[lembretes] hoje:", e?.message);
        res.status(500).json({ error: "Não foi possível carregar os lembretes de hoje." });
    }
});

// ----- Alarmes (o que já tocou e espera uma ação) -----------------------------------------------------------------
router.get("/alarmes", async (req, res) => {
    try {
        const agora = agoraSaoPaulo();
        const [linhas] = await db.query(`SELECT id, lembrete_id, texto, DATE_FORMAT(disparou_em, '%Y-%m-%d %H:%i:%s') AS disparou_em FROM lembrete_disparos
            WHERE empresa_id = ? AND usuario_id = ? AND (status = 'aberto' OR (status = 'soneca' AND soneca_ate <= ?))
            ORDER BY disparou_em ASC LIMIT 20`, [req.user.empresa_id, req.user.id, agora]);
        res.json({ alarmes: linhas });
    } catch (e) {
        console.error("[lembretes] alarmes:", e?.message);
        res.status(500).json({ error: "Não foi possível carregar os alarmes." });
    }
});

router.post("/alarmes/:id/concluir", async (req, res) => {
    try {
        const id = idValido(req.params.id);
        if (!id) return res.status(400).json({ error: "Alarme inválido." });
        await db.query("UPDATE lembrete_disparos SET status = 'feito' WHERE id = ? AND empresa_id = ? AND usuario_id = ?", [id, req.user.empresa_id, req.user.id]);
        res.json({ ok: true });
    } catch (e) {
        console.error("[lembretes] concluir:", e?.message);
        res.status(500).json({ error: "Não foi possível concluir o alarme." });
    }
});

router.post("/alarmes/:id/soneca", async (req, res) => {
    try {
        const id = idValido(req.params.id);
        const minutos = Number(req.body?.minutos);
        if (!id || !SONECAS.includes(minutos)) return res.status(400).json({ error: "Escolha 5, 10, 30 ou 60 minutos." });
        const ate = agoraSaoPaulo(new Date(Date.now() + minutos * 60000));
        const [r] = await db.query("UPDATE lembrete_disparos SET status = 'soneca', soneca_ate = ? WHERE id = ? AND empresa_id = ? AND usuario_id = ?", [ate, id, req.user.empresa_id, req.user.id]);
        if (!r.affectedRows) return res.status(404).json({ error: "Alarme não encontrado." });
        res.json({ ok: true, ate });
    } catch (e) {
        console.error("[lembretes] soneca:", e?.message);
        res.status(500).json({ error: "Não foi possível adiar o alarme." });
    }
});

export default router;
