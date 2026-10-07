import net from "net";

const MAX_SEARCH_LENGTH = 120;
const SAFE_ID_REGEX = /^[a-zA-Z0-9_.:@-]{1,120}$/;
const RUN_ID_REGEX = /^nd_[a-zA-Z0-9_-]{8,80}$/;

export const normalizarTextoBuscaCliente = (valor = "") => (
    String(valor || "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, MAX_SEARCH_LENGTH)
);

export const validarTextoBuscaCliente = (valor = "") => {
    const query = normalizarTextoBuscaCliente(valor);

    if (query.length < 2) {
        const err = new Error("Informe pelo menos 2 caracteres para pesquisar.");
        err.statusCode = 400;
        throw err;
    }

    return query;
};

export const validarCustomerId = (valor = "") => {
    const customerId = String(valor || "").trim();

    if (!SAFE_ID_REGEX.test(customerId)) {
        const err = new Error("Cliente inválido.");
        err.statusCode = 400;
        throw err;
    }

    return customerId;
};

export const validarRunId = (valor = "") => {
    const runId = String(valor || "").trim();

    if (!RUN_ID_REGEX.test(runId)) {
        const err = new Error("Execução inválida.");
        err.statusCode = 400;
        throw err;
    }

    return runId;
};

export const validarPeriodoTrafego = (valor = "5m") => {
    const periodo = String(valor || "5m").trim().toLowerCase();
    const permitidos = new Set(["5m", "15m", "30m", "1h"]);

    if (!permitidos.has(periodo)) return "5m";

    return periodo;
};

export const periodoParaMinutos = (periodo = "5m") => ({
    "5m": 5,
    "15m": 15,
    "30m": 30,
    "1h": 60,
}[validarPeriodoTrafego(periodo)] || 5);

export const parsePositiveInt = (valor, fallback, { min = 1, max = 100 } = {}) => {
    const numero = Number(valor);

    if (!Number.isInteger(numero)) return fallback;

    return Math.min(max, Math.max(min, numero));
};

export const parseHistoryFilters = (query = {}) => {
    const page = parsePositiveInt(query.page, 1, { min: 1, max: 100000 });
    const limit = parsePositiveInt(query.limit, 20, { min: 1, max: 100 });
    const filters = {
        customer: normalizarTextoBuscaCliente(query.customer || query.cliente || ""),
        user: normalizarTextoBuscaCliente(query.user || query.usuario || ""),
        status: normalizarTextoBuscaCliente(query.status || ""),
        pop: normalizarTextoBuscaCliente(query.pop || ""),
        result: normalizarTextoBuscaCliente(query.result || query.resultado || ""),
        dateFrom: normalizarTextoBuscaCliente(query.date_from || query.started_at_from || ""),
        dateTo: normalizarTextoBuscaCliente(query.date_to || query.started_at_to || ""),
    };

    if (query.user_id) {
        const userId = Number(query.user_id);
        if (Number.isInteger(userId) && userId > 0) filters.userId = userId;
    }

    Object.keys(filters).forEach((key) => {
        if (!filters[key]) delete filters[key];
    });

    return { page, limit, filters };
};

export const isValidCustomerIp = (ip) => Boolean(ip && net.isIP(String(ip).trim()));

export const sanitizeForLog = (payload = {}) => {
    const sensiveis = /password|senha|token|secret|community|auth|priv|cookie|key/i;

    if (Array.isArray(payload)) {
        return payload.map((item) => sanitizeForLog(item));
    }

    if (payload && typeof payload === "object") {
        return Object.fromEntries(
            Object.entries(payload).map(([key, value]) => [
                key,
                sensiveis.test(key) ? "[redacted]" : sanitizeForLog(value),
            ])
        );
    }

    return payload;
};
