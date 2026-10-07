import crypto from "crypto";
import db from "../db/db.js";

export const AUDIT_LEVELS = {
    NORMAL: "normal",
    IMPORTANT: "important",
    CRITICAL: "critical",
};

export const AUDIT_TYPES = {
    MANUTENCAO: "manutencao",
    INSTALACAO: "instalacao",
    AGENDA: "agenda",
    AUSENCIAS: "ausencias",
    CHAT: "chat",
    USUARIOS: "usuarios",
    SISTEMA: "sistema",
};

const MAX_LIMIT = 100;
let auditTableReadyPromise = null;

const serializarValor = (valor) => {
    if (valor === undefined || valor === null) return null;

    try {
        return JSON.stringify(valor);
    } catch {
        return String(valor);
    }
};

export const parseAuditJson = (valor) => {
    if (!valor) return null;
    if (typeof valor !== "string") return valor;

    try {
        return JSON.parse(valor);
    } catch {
        return valor;
    }
};

export const createAuditEventId = () => {
    const data = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date()).replaceAll("-", "");

    return `EVT-${data}-${crypto.randomUUID()}`;
};

export const normalizeAuditLevel = (nivel) => {
    const valor = String(nivel || "").trim().toLowerCase();
    return Object.values(AUDIT_LEVELS).includes(valor) ? valor : AUDIT_LEVELS.NORMAL;
};

export const normalizeAuditType = (tipo) => {
    const valor = String(tipo || "").trim().toLowerCase();
    return Object.values(AUDIT_TYPES).includes(valor) ? valor : AUDIT_TYPES.SISTEMA;
};

export const getAuditRequestInfo = (req = null) => ({
    ip: req?.ip || req?.headers?.["x-forwarded-for"] || null,
    userAgent: req?.get?.("user-agent") || req?.headers?.["user-agent"] || null,
});

export const ensureAuditLogsTable = async (connection = db) => {
    if (connection !== db) {
        await criarTabelaAuditLogs(connection);
        return;
    }

    if (!auditTableReadyPromise) {
        auditTableReadyPromise = criarTabelaAuditLogs(connection).catch((err) => {
            auditTableReadyPromise = null;
            throw err;
        });
    }

    await auditTableReadyPromise;
};

const criarTabelaAuditLogs = async (connection) => {
    await connection.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            event_id VARCHAR(120) NOT NULL,
            empresa_id INT NULL,
            usuario_id INT NULL,
            usuario_nome VARCHAR(255) NULL,
            usuario_perfil VARCHAR(80) NULL,
            acao VARCHAR(100) NOT NULL,
            entidade VARCHAR(80) NOT NULL,
            entidade_id VARCHAR(120) NULL,
            tipo VARCHAR(40) NOT NULL DEFAULT 'sistema',
            nivel VARCHAR(20) NOT NULL DEFAULT 'normal',
            origem VARCHAR(80) NOT NULL DEFAULT 'SISTEMA',
            valor_anterior LONGTEXT NULL,
            valor_novo LONGTEXT NULL,
            metadata LONGTEXT NULL,
            ip VARCHAR(80) NULL,
            user_agent VARCHAR(255) NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_audit_created_at (created_at),
            INDEX idx_audit_empresa_created (empresa_id, created_at),
            INDEX idx_audit_usuario_created (usuario_id, created_at),
            INDEX idx_audit_entidade (entidade, entidade_id),
            INDEX idx_audit_acao_created (acao, created_at),
            INDEX idx_audit_event_id (event_id),
            INDEX idx_audit_tipo_nivel_created (tipo, nivel, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
};

export const registrarAuditoria = async ({
    usuario = null,
    usuarioId = null,
    usuarioNome = null,
    usuarioPerfil = null,
    empresaId = null,
    acao,
    entidade,
    entidadeId = null,
    tipo = AUDIT_TYPES.SISTEMA,
    nivel = AUDIT_LEVELS.NORMAL,
    origem = "SISTEMA",
    valorAnterior = null,
    valorNovo = null,
    metadata = null,
    eventId = null,
    req = null,
    connection = db,
} = {}) => {
    if (!acao || !entidade) {
        throw new Error("acao e entidade são obrigatórios para auditoria.");
    }

    await ensureAuditLogsTable(connection);

    const requestInfo = getAuditRequestInfo(req);
    const usuarioFinal = usuario || {};
    const empresaFinal = empresaId ?? usuarioFinal.empresa_id ?? null;

    const [resultado] = await connection.query(`
        INSERT INTO audit_logs (
            event_id,
            empresa_id,
            usuario_id,
            usuario_nome,
            usuario_perfil,
            acao,
            entidade,
            entidade_id,
            tipo,
            nivel,
            origem,
            valor_anterior,
            valor_novo,
            metadata,
            ip,
            user_agent
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        eventId || createAuditEventId(),
        empresaFinal,
        usuarioId ?? usuarioFinal.id ?? null,
        usuarioNome ?? usuarioFinal.nome ?? null,
        usuarioPerfil ?? usuarioFinal.perfil ?? null,
        String(acao).trim().toUpperCase(),
        String(entidade).trim().toLowerCase(),
        entidadeId === undefined || entidadeId === null ? null : String(entidadeId),
        normalizeAuditType(tipo),
        normalizeAuditLevel(nivel),
        String(origem || "SISTEMA").trim().toUpperCase(),
        serializarValor(valorAnterior),
        serializarValor(valorNovo),
        serializarValor(metadata),
        requestInfo.ip,
        requestInfo.userAgent,
    ]);

    return resultado.insertId;
};

const normalizarInteiroPositivo = (valor, fallback) => {
    const numero = Number(valor);
    return Number.isInteger(numero) && numero > 0 ? numero : fallback;
};

const getDiaSaoPaulo = (date = new Date()) => new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
}).format(date);

export const getSaoPauloPeriodRange = (periodo = "hoje") => {
    const agora = new Date();
    const hoje = getDiaSaoPaulo(agora);
    const data = new Date(`${hoje}T00:00:00-03:00`);

    if (periodo === "ontem") {
        data.setDate(data.getDate() - 1);
        const inicio = data.toISOString().slice(0, 10);
        const fimData = new Date(data);
        fimData.setDate(fimData.getDate() + 1);
        return {
            dataInicio: `${inicio} 00:00:00`,
            dataFim: `${fimData.toISOString().slice(0, 10)} 00:00:00`,
        };
    }

    const dias = periodo === "30d" ? 30 : periodo === "7d" ? 7 : 1;
    data.setDate(data.getDate() - (dias - 1));

    const amanha = new Date(`${hoje}T00:00:00-03:00`);
    amanha.setDate(amanha.getDate() + 1);

    return {
        dataInicio: `${data.toISOString().slice(0, 10)} 00:00:00`,
        dataFim: `${amanha.toISOString().slice(0, 10)} 00:00:00`,
    };
};

const normalizarDataSql = (valor) => {
    const texto = String(valor || "").trim();
    if (!texto) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return `${texto} 00:00:00`;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(texto)) return texto.replace("T", " ").slice(0, 19);
    if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/.test(texto)) return texto.slice(0, 19);
    return "";
};

const buildAuditWhere = ({
    empresaId = null,
    dataInicio = "",
    dataFim = "",
    usuario = "",
    tecnico = "",
    entidade = "",
    entidadeId = "",
    acao = "",
    tipo = "",
    nivel = "",
    search = "",
    eventId = "",
    criticalOnly = false,
} = {}) => {
    const where = [];
    const params = [];

    if (empresaId !== null && empresaId !== undefined) {
        where.push("(empresa_id = ? OR empresa_id IS NULL)");
        params.push(empresaId);
    }

    if (dataInicio) {
        where.push("created_at >= ?");
        params.push(dataInicio);
    }

    if (dataFim) {
        where.push("created_at < ?");
        params.push(dataFim);
    }

    if (usuario) {
        const usuarioId = Number(usuario);
        if (Number.isInteger(usuarioId) && usuarioId > 0) {
            where.push("usuario_id = ?");
            params.push(usuarioId);
        } else {
            where.push("usuario_nome LIKE ?");
            params.push(`%${usuario}%`);
        }
    }

    if (tecnico) {
        where.push("(valor_anterior LIKE ? OR valor_novo LIKE ? OR metadata LIKE ?)");
        params.push(`%${tecnico}%`, `%${tecnico}%`, `%${tecnico}%`);
    }

    if (entidade) {
        where.push("entidade = ?");
        params.push(String(entidade).toLowerCase());
    }

    if (entidadeId) {
        where.push("entidade_id = ?");
        params.push(String(entidadeId));
    }

    if (acao) {
        where.push("acao = ?");
        params.push(String(acao).toUpperCase());
    }

    if (tipo) {
        where.push("tipo = ?");
        params.push(normalizeAuditType(tipo));
    }

    if (nivel || criticalOnly) {
        where.push("nivel = ?");
        params.push(criticalOnly ? AUDIT_LEVELS.CRITICAL : normalizeAuditLevel(nivel));
    }

    if (eventId) {
        where.push("event_id = ?");
        params.push(eventId);
    }

    if (search) {
        const like = `%${search}%`;
        where.push(`(
            event_id LIKE ?
            OR usuario_nome LIKE ?
            OR acao LIKE ?
            OR entidade LIKE ?
            OR entidade_id LIKE ?
            OR origem LIKE ?
            OR valor_anterior LIKE ?
            OR valor_novo LIKE ?
            OR metadata LIKE ?
        )`);
        params.push(like, like, like, like, like, like, like, like, like);
    }

    return {
        whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
        params,
    };
};

export const mapAuditRow = (row = {}) => ({
    ...row,
    valor_anterior: parseAuditJson(row.valor_anterior),
    valor_novo: parseAuditJson(row.valor_novo),
    metadata: parseAuditJson(row.metadata),
});

export const listarAuditLogs = async ({
    empresaId,
    page = 1,
    limit = 25,
    periodo = "",
    dataInicio = "",
    dataFim = "",
    ...filtros
} = {}) => {
    await ensureAuditLogsTable();

    const pagina = normalizarInteiroPositivo(page, 1);
    const limite = Math.min(normalizarInteiroPositivo(limit, 25), MAX_LIMIT);
    let inicio = normalizarDataSql(dataInicio);
    let fim = normalizarDataSql(dataFim);

    if (!inicio && !fim && periodo) {
        const range = getSaoPauloPeriodRange(periodo);
        inicio = range.dataInicio;
        fim = range.dataFim;
    }

    const { whereSql, params } = buildAuditWhere({
        empresaId,
        dataInicio: inicio,
        dataFim: fim,
        ...filtros,
    });

    const [totalRows] = await db.query(`
        SELECT COUNT(*) AS total
        FROM audit_logs
        ${whereSql}
    `, params);

    const total = Number(totalRows[0]?.total || 0);
    const offset = (pagina - 1) * limite;
    const [rows] = await db.query(`
        SELECT *
        FROM audit_logs
        ${whereSql}
        ORDER BY created_at DESC, id DESC
        LIMIT ? OFFSET ?
    `, [...params, limite, offset]);

    return {
        data: rows.map(mapAuditRow),
        pagination: {
            page: pagina,
            limit: limite,
            total,
            total_pages: Math.max(Math.ceil(total / limite), 1),
        },
    };
};

export const obterAuditLogPorId = async (id, empresaId) => {
    await ensureAuditLogsTable();

    const [rows] = await db.query(`
        SELECT *
        FROM audit_logs
        WHERE id = ?
          AND (empresa_id = ? OR empresa_id IS NULL)
        LIMIT 1
    `, [id, empresaId]);

    return rows[0] ? mapAuditRow(rows[0]) : null;
};

const contarResumo = async (empresaId, dataInicio, dataFim, extraWhere, extraParams = []) => {
    const [rows] = await db.query(`
        SELECT COUNT(*) AS total
        FROM audit_logs
        WHERE (empresa_id = ? OR empresa_id IS NULL)
          AND created_at >= ?
          AND created_at < ?
          ${extraWhere}
    `, [empresaId, dataInicio, dataFim, ...extraParams]);

    return Number(rows[0]?.total || 0);
};

export const obterResumoOperacional = async (empresaId, periodo = "hoje") => {
    await ensureAuditLogsTable();

    const { dataInicio, dataFim } = getSaoPauloPeriodRange(periodo);
    const [
        chamados,
        instalacoes,
        reagendamentos,
        transferencias,
        concluidos,
        agenda,
        ausencias,
        mensagens,
        usuariosAtivosRows,
        criticos,
        total,
    ] = await Promise.all([
        contarResumo(empresaId, dataInicio, dataFim, "AND entidade = 'chamado'"),
        contarResumo(empresaId, dataInicio, dataFim, "AND entidade = 'instalacao'"),
        contarResumo(empresaId, dataInicio, dataFim, "AND acao LIKE 'REAGENDAR%'"),
        contarResumo(empresaId, dataInicio, dataFim, "AND acao IN ('ALTERAR_TECNICO', 'TRANSFERIR_CHAMADO', 'TRANSFERIR_INSTALACAO')"),
        contarResumo(empresaId, dataInicio, dataFim, "AND acao IN ('FINALIZAR_CHAMADO', 'FINALIZAR_INSTALACAO')"),
        contarResumo(empresaId, dataInicio, dataFim, "AND tipo = 'agenda'"),
        contarResumo(empresaId, dataInicio, dataFim, "AND tipo = 'ausencias'"),
        contarResumo(empresaId, dataInicio, dataFim, "AND acao = 'ENVIAR_MENSAGEM'"),
        db.query(`
            SELECT COUNT(DISTINCT usuario_id) AS total
            FROM audit_logs
            WHERE (empresa_id = ? OR empresa_id IS NULL)
              AND created_at >= ?
              AND created_at < ?
              AND usuario_id IS NOT NULL
        `, [empresaId, dataInicio, dataFim]),
        contarResumo(empresaId, dataInicio, dataFim, "AND nivel = 'critical'"),
        contarResumo(empresaId, dataInicio, dataFim, ""),
    ]);

    return {
        periodo,
        data_inicio: dataInicio,
        data_fim: dataFim,
        chamados_movimentados: chamados,
        instalacoes_movimentadas: instalacoes,
        reagendamentos,
        transferencias_tecnico: transferencias,
        chamados_concluidos: concluidos,
        alteracoes_agenda: agenda,
        ausencias,
        mensagens_enviadas: mensagens,
        usuarios_ativos: Number(usuariosAtivosRows[0][0]?.total || 0),
        eventos_criticos: criticos,
        total_eventos: total,
    };
};
