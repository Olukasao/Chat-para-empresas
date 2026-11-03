// Controle da IA pela administração: quais fontes de dados cada setor pode usar no Assistente, quanto cada pessoa usa
// (só contagens, nunca o conteúdo das perguntas) e a saúde dos provedores gratuitos (acertos, falhas, saldo).
import db from "../db/db.js";

export const FONTES = [
    { id: "agenda", rotulo: "Agenda de técnicos", grupo: "dados" },
    { id: "mudancas", rotulo: "Histórico de mudanças da agenda", grupo: "dados" },
    { id: "chamados", rotulo: "Chamados e filas de suporte", grupo: "dados" },
    { id: "painel", rotulo: "Painel NOC e resumo do dia", grupo: "dados" },
    { id: "rede", rotulo: "Rede (OLT)", grupo: "dados" },
    { id: "web", rotulo: "Pesquisa na internet", grupo: "recurso" },
    { id: "imagens", rotulo: "Anexar imagens (prints)", grupo: "recurso" },
    { id: "cursos", rotulo: "IA nos Cursos", grupo: "recurso" },
];
export const IDS_FONTES = FONTES.map((f) => f.id);
const CAMPOS_USO = new Set(["perguntas", "resumos", "imagens", "pesquisas", "dados", "falhas"]);

let tabelasProntas = null;
export function garantirTabelasIa() {
    tabelasProntas ??= (async () => {
        const ddl = [
            `CREATE TABLE IF NOT EXISTS ia_config (
                empresa_id INT NOT NULL, chave VARCHAR(40) NOT NULL, valor VARCHAR(255) NOT NULL DEFAULT '',
                PRIMARY KEY (empresa_id, chave)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
            `CREATE TABLE IF NOT EXISTS ia_fontes_setor (
                empresa_id INT NOT NULL, setor_id INT NOT NULL, fonte VARCHAR(20) NOT NULL, permitido TINYINT(1) NOT NULL DEFAULT 1,
                PRIMARY KEY (empresa_id, setor_id, fonte)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
            `CREATE TABLE IF NOT EXISTS ia_uso (
                empresa_id INT NOT NULL, usuario_id INT NOT NULL, dia DATE NOT NULL,
                perguntas INT NOT NULL DEFAULT 0, resumos INT NOT NULL DEFAULT 0, imagens INT NOT NULL DEFAULT 0,
                pesquisas INT NOT NULL DEFAULT 0, dados INT NOT NULL DEFAULT 0, falhas INT NOT NULL DEFAULT 0,
                PRIMARY KEY (empresa_id, usuario_id, dia)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
            `CREATE TABLE IF NOT EXISTS ia_provedores (
                empresa_id INT NOT NULL, dia DATE NOT NULL, provedor VARCHAR(100) NOT NULL,
                ok INT NOT NULL DEFAULT 0, falha INT NOT NULL DEFAULT 0, ultimo_erro VARCHAR(200) NOT NULL DEFAULT '',
                ultimo_em TIMESTAMP NULL DEFAULT NULL,
                PRIMARY KEY (empresa_id, dia, provedor)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
            `CREATE TABLE IF NOT EXISTS briefing_destinatarios (
                empresa_id INT NOT NULL, usuario_id INT NOT NULL, ativo TINYINT(1) NOT NULL DEFAULT 1,
                PRIMARY KEY (empresa_id, usuario_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
            `CREATE TABLE IF NOT EXISTS briefing_envios (
                empresa_id INT NOT NULL, dia DATE NOT NULL, enviado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, quantidade INT NOT NULL DEFAULT 0,
                PRIMARY KEY (empresa_id, dia)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
            // Alertas de rede que a equipe ignorou no app; o briefing não os cita.
            `CREATE TABLE IF NOT EXISTS olt_alertas_ignorados (
                empresa_id INT NOT NULL, alerta_id VARCHAR(64) NOT NULL, usuario_id INT NOT NULL,
                criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (empresa_id, alerta_id, usuario_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        ];
        for (const sql of ddl) await db.query(sql);
    })().catch((e) => { tabelasProntas = null; throw e; });
    return tabelasProntas;
}

export const hojeSaoPaulo = (agora = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);

// ---------- Fontes por setor ----------

/** O que está liberado, dado o que foi bloqueado: tudo é liberado, a menos que haja um bloqueio explícito. */
export const fontesLiberadas = (linhas = []) => {
    const bloqueadas = new Set(linhas.filter((l) => !l.permitido).map((l) => l.fonte));
    return IDS_FONTES.filter((id) => !bloqueadas.has(id));
};

export async function fontesDoSetor(empresaId, setorId) {
    await garantirTabelasIa();
    const [linhas] = await db.query(
        "SELECT fonte, permitido FROM ia_fontes_setor WHERE empresa_id = ? AND setor_id = ?",
        [empresaId, Number(setorId) || 0],
    );
    return fontesLiberadas(linhas);
}

export async function definirFonteDoSetor({ empresaId, setorId, fonte, permitido }) {
    if (!IDS_FONTES.includes(fonte)) throw Object.assign(new Error("Fonte desconhecida."), { status: 400 });
    await garantirTabelasIa();
    const [setores] = await db.query("SELECT id FROM setores WHERE id = ? LIMIT 1", [Number(setorId)]);
    if (!setores[0]) throw Object.assign(new Error("Setor não encontrado."), { status: 404 });
    await db.query(
        `INSERT INTO ia_fontes_setor (empresa_id, setor_id, fonte, permitido) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE permitido = VALUES(permitido)`,
        [empresaId, Number(setorId), fonte, permitido ? 1 : 0],
    );
}

/** Fonte de um bloco: a declarada pelo app ou, em app antigo, deduzida do título. */
export function fonteDoBloco(b) {
    if (typeof b?.fonte === "string" && IDS_FONTES.includes(b.fonte)) return b.fonte;
    const t = String(b?.titulo || "").toLowerCase();
    if (/mudan[cç]as/.test(t)) return "mudancas";
    if (/agenda/.test(t)) return "agenda";
    if (/chamados|filas de suporte/.test(t)) return "chamados";
    if (/painel/.test(t)) return "painel";
    if (/rede|olt/.test(t)) return "rede";
    return null;
}

/** Mantém só os blocos cuja fonte o setor pode usar. */
export function filtrarBlocosPorFonte(blocos, permitidas) {
    if (!Array.isArray(blocos)) return { blocos: [], removidos: [] };
    const ok = new Set(permitidas);
    const mantidos = [], removidos = [];
    for (const b of blocos) {
        const fonte = fonteDoBloco(b);
        if (fonte && !ok.has(fonte)) removidos.push(fonte);
        else mantidos.push(b);
    }
    return { blocos: mantidos, removidos: [...new Set(removidos)] };
}

export async function fontesDoUsuario(user) {
    const [linhas] = await db.query("SELECT setor_id FROM usuarios WHERE id = ? LIMIT 1", [user.id]);
    const setorId = linhas[0]?.setor_id;
    if (!setorId) return [...IDS_FONTES];
    return fontesDoSetor(user.empresa_id, setorId);
}

// ---------- Uso e provedores ----------

export async function registrarUso({ empresaId, usuarioId, campo, quantidade = 1 }) {
    if (!CAMPOS_USO.has(campo)) return;
    await garantirTabelasIa();
    await db.query(
        `INSERT INTO ia_uso (empresa_id, usuario_id, dia, ${campo}) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE ${campo} = ${campo} + VALUES(${campo})`,
        [empresaId, usuarioId, hojeSaoPaulo(), Math.max(1, Math.floor(quantidade))],
    );
}

export async function registrarProvedor({ empresaId, provedor, ok, erro = "" }) {
    if (!provedor) return;
    await garantirTabelasIa();
    await db.query(
        `INSERT INTO ia_provedores (empresa_id, dia, provedor, ok, falha, ultimo_erro, ultimo_em) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE ok = ok + VALUES(ok), falha = falha + VALUES(falha),
            ultimo_erro = IF(VALUES(falha) > 0, VALUES(ultimo_erro), ultimo_erro),
            ultimo_em = IF(VALUES(falha) > 0, VALUES(ultimo_em), ultimo_em)`,
        [empresaId, hojeSaoPaulo(), String(provedor).slice(0, 100), ok ? 1 : 0, ok ? 0 : 1, ok ? "" : String(erro).slice(0, 200), ok ? null : new Date()],
    );
}

/** Soma de dias de uso por pessoa, mais usados primeiro. */
export async function usoPorPessoa(empresaId, dias = 30) {
    await garantirTabelasIa();
    const [linhas] = await db.query(`
        SELECT u.id, u.nome, s.nome AS setor,
               SUM(i.perguntas) AS perguntas, SUM(i.resumos) AS resumos, SUM(i.imagens) AS imagens,
               SUM(i.pesquisas) AS pesquisas, SUM(i.dados) AS dados, SUM(i.falhas) AS falhas, DATE_FORMAT(MAX(i.dia), '%Y-%m-%d') AS ultimo_dia
        FROM ia_uso i
        JOIN usuarios u ON u.id = i.usuario_id
        LEFT JOIN setores s ON s.id = u.setor_id
        WHERE i.empresa_id = ? AND i.dia >= DATE_SUB(?, INTERVAL ? DAY)
        GROUP BY u.id, u.nome, s.nome
        ORDER BY perguntas DESC, u.nome ASC
        LIMIT 200
    `, [empresaId, hojeSaoPaulo(), Math.max(1, dias) - 1]);
    return linhas.map((l) => ({ ...l, perguntas: Number(l.perguntas), resumos: Number(l.resumos), imagens: Number(l.imagens), pesquisas: Number(l.pesquisas), dados: Number(l.dados), falhas: Number(l.falhas) }));
}

export async function usoPorDia(empresaId, dias = 14) {
    await garantirTabelasIa();
    const [linhas] = await db.query(`
        SELECT DATE_FORMAT(dia, '%Y-%m-%d') AS dia, SUM(perguntas) AS perguntas, SUM(resumos) AS resumos, SUM(falhas) AS falhas, COUNT(DISTINCT usuario_id) AS pessoas
        FROM ia_uso WHERE empresa_id = ? AND dia >= DATE_SUB(?, INTERVAL ? DAY)
        GROUP BY dia ORDER BY dia ASC
    `, [empresaId, hojeSaoPaulo(), Math.max(1, dias) - 1]);
    return linhas.map((l) => ({ dia: l.dia, perguntas: Number(l.perguntas), resumos: Number(l.resumos), falhas: Number(l.falhas), pessoas: Number(l.pessoas) }));
}

/** Provedores nos últimos dias: acertos, falhas, taxa de falha e o último erro. */
export async function saudeDosProvedores(empresaId, dias = 7) {
    await garantirTabelasIa();
    const [linhas] = await db.query(`
        SELECT provedor, SUM(ok) AS ok, SUM(falha) AS falha, MAX(ultimo_em) AS ultimo_em,
               SUBSTRING_INDEX(GROUP_CONCAT(ultimo_erro ORDER BY ultimo_em DESC SEPARATOR '\\n'), '\\n', 1) AS ultimo_erro
        FROM ia_provedores WHERE empresa_id = ? AND dia >= DATE_SUB(?, INTERVAL ? DAY)
        GROUP BY provedor ORDER BY (SUM(ok) + SUM(falha)) DESC
    `, [empresaId, hojeSaoPaulo(), Math.max(1, dias) - 1]);
    return linhas.map((l) => {
        const ok = Number(l.ok), falha = Number(l.falha), total = ok + falha;
        return { provedor: l.provedor, ok, falha, taxaFalha: total ? Math.round((falha / total) * 100) : 0, ultimo_erro: l.ultimo_erro || "", ultimo_em: l.ultimo_em };
    });
}

let cacheSaldo = { em: 0, valor: null };
/** Saldo de créditos do Serper (a única API de busca que informa o saldo). Guarda por 10 minutos para não gastar chamadas. */
export async function saldoSerper({ env = process.env, fetchImpl = fetch, agora = Date.now() } = {}) {
    if (!env.SERPER_API_KEY) return null;
    if (cacheSaldo.valor && agora - cacheSaldo.em < 600_000) return cacheSaldo.valor;
    try {
        const r = await fetchImpl("https://google.serper.dev/account", { headers: { "X-API-KEY": env.SERPER_API_KEY }, signal: AbortSignal.timeout(8000) });
        if (!r.ok) return null;
        const d = await r.json();
        if (!Number.isFinite(Number(d?.balance))) return null;
        cacheSaldo = { em: agora, valor: { creditos: Number(d.balance) } };
        return cacheSaldo.valor;
    } catch {
        return null;
    }
}

// ---------- Configuração geral ----------

export async function lerConfig(empresaId) {
    await garantirTabelasIa();
    const [linhas] = await db.query("SELECT chave, valor FROM ia_config WHERE empresa_id = ?", [empresaId]);
    return Object.fromEntries(linhas.map((l) => [l.chave, l.valor]));
}

export async function gravarConfig(empresaId, chave, valor) {
    await garantirTabelasIa();
    await db.query(
        "INSERT INTO ia_config (empresa_id, chave, valor) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)",
        [empresaId, String(chave).slice(0, 40), String(valor).slice(0, 255)],
    );
}

/** Troca a lista de alertas ignorados desta pessoa (o app manda a lista inteira a cada mudança). */
export async function sincronizarAlertasIgnorados({ empresaId, usuarioId, ids }) {
    await garantirTabelasIa();
    const lista = [...new Set((Array.isArray(ids) ? ids : []).map((x) => String(x).slice(0, 64)).filter(Boolean))].slice(0, 500);
    await db.query("DELETE FROM olt_alertas_ignorados WHERE empresa_id = ? AND usuario_id = ?", [empresaId, usuarioId]);
    for (const id of lista) await db.query("INSERT IGNORE INTO olt_alertas_ignorados (empresa_id, alerta_id, usuario_id) VALUES (?, ?, ?)", [empresaId, id, usuarioId]);
    return lista.length;
}

/** Ids de alertas que alguém da equipe ignorou. Esquece os de mais de 60 dias. */
export async function alertasIgnorados(empresaId) {
    await garantirTabelasIa();
    await db.query("DELETE FROM olt_alertas_ignorados WHERE criado_em < (NOW() - INTERVAL 60 DAY)");
    const [rows] = await db.query("SELECT DISTINCT alerta_id FROM olt_alertas_ignorados WHERE empresa_id = ?", [empresaId]);
    return new Set(rows.map((r) => String(r.alerta_id)));
}
