import { sanitizeForLog } from "../validators/networkDiagnosticsValidator.js";

const DEFAULT_TIMEOUT_SECONDS = 8;

const isTruthy = (valor) => ["1", "true", "yes", "sim", "on"].includes(String(valor || "").toLowerCase());

const toNumberOrNull = (valor) => {
    if (valor === null || valor === undefined || valor === "") return null;

    const numero = Number(String(valor).replace(",", ".").replace(/[^\d.-]/g, ""));
    return Number.isFinite(numero) ? Number(numero.toFixed(2)) : null;
};

const pick = (source = {}, keys = []) => {
    for (const key of keys) {
        const value = source?.[key];
        if (value !== undefined && value !== null && value !== "") return value;
    }

    return null;
};

const buildAvailability = () => {
    const enabled = isTruthy(process.env.HILLSTONE_ENABLED);
    const protocol = String(process.env.HILLSTONE_PROTOCOL || "").toLowerCase();
    const host = process.env.HILLSTONE_HOST || "";
    const hasSupportedProtocol = ["https", "http"].includes(protocol);
    const sessionUrl = process.env.HILLSTONE_SESSION_LOOKUP_URL || "";
    const trafficUrl = process.env.HILLSTONE_TRAFFIC_LOOKUP_URL || "";
    const missing = [];

    if (!enabled) missing.push("HILLSTONE_ENABLED");
    if (!host) missing.push("HILLSTONE_HOST");
    if (!protocol) missing.push("HILLSTONE_PROTOCOL");
    if (enabled && protocol && !hasSupportedProtocol) missing.push("HILLSTONE_SESSION_LOOKUP_URL");

    const apiConfigured = enabled && host && hasSupportedProtocol && (sessionUrl || trafficUrl);

    return {
        available: apiConfigured,
        enabled,
        protocol: protocol || null,
        hostConfigured: Boolean(host),
        sessionLookupConfigured: Boolean(sessionUrl),
        trafficLookupConfigured: Boolean(trafficUrl),
        missing,
        message: apiConfigured
            ? "Integração com o Hillstone configurada."
            : "Integração com o Hillstone ainda não configurada.",
    };
};

export const getHillstoneAvailability = () => buildAvailability();

const replaceTemplate = (template, replacements = {}) => {
    let url = String(template || "");

    Object.entries(replacements).forEach(([key, value]) => {
        url = url.replaceAll(`{${key}}`, encodeURIComponent(String(value ?? "")));
    });

    return url;
};

const ensureTemplate = (template, envName) => {
    if (!template) {
        const err = new Error("Integração com o Hillstone ainda não configurada.");
        err.statusCode = 503;
        err.details = { missing: [envName] };
        throw err;
    }
};

const buildHeaders = () => {
    const headers = {
        Accept: "application/json",
    };
    const token = process.env.HILLSTONE_API_TOKEN || "";

    if (token) {
        headers.Authorization = `${process.env.HILLSTONE_AUTH_PREFIX || "Bearer "}${token}`;
    }

    return headers;
};

const fetchJson = async (url, { signal } = {}) => {
    const timeoutMs = Math.max(1000, Number(process.env.HILLSTONE_TIMEOUT_SECONDS || DEFAULT_TIMEOUT_SECONDS) * 1000);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const abortFromParent = () => controller.abort(signal?.reason);

    if (signal?.aborted) {
        clearTimeout(timeout);
        throw new Error("Operação cancelada.");
    }

    signal?.addEventListener("abort", abortFromParent, { once: true });

    try {
        const response = await fetch(url, {
            method: "GET",
            headers: buildHeaders(),
            signal: controller.signal,
        });

        if (!response.ok) {
            const err = new Error(`Hillstone retornou HTTP ${response.status}.`);
            err.statusCode = 503;
            throw err;
        }

        return response.json();
    } finally {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", abortFromParent);
    }
};

const normalizeSessionPayload = (payload = {}, customer = {}) => {
    const source = Array.isArray(payload) ? payload[0] || {} : payload?.data || payload?.session || payload;

    return {
        available: true,
        online: Boolean(pick(source, ["online", "active", "is_active"]) ?? customer.status === "online"),
        ip: String(pick(source, ["ip", "currentIp", "current_ip", "framed_ip"]) || customer.ip || "").trim() || null,
        username: String(pick(source, ["username", "user", "login", "pppoe_username"]) || customer.pppoeUsername || "").trim() || null,
        sessionUptimeSeconds: toNumberOrNull(pick(source, ["sessionUptimeSeconds", "session_uptime_seconds", "uptime_seconds", "uptime"])),
        interface: String(pick(source, ["interface", "ifname", "nas", "concentrator", "concentrador"]) || "").trim() || null,
        popName: String(pick(source, ["popName", "pop_name", "pop"]) || customer.popName || "").trim() || null,
        updatedAt: String(pick(source, ["updatedAt", "updated_at", "timestamp"]) || new Date().toISOString()),
        source: "hillstone",
    };
};

const normalizeTrafficPayload = (payload = {}, customer = {}, session = {}) => {
    const source = Array.isArray(payload) ? payload[0] || {} : payload?.data || payload?.traffic || payload;

    return {
        available: true,
        online: Boolean(pick(source, ["online", "active", "is_active"]) ?? session.online ?? customer.status === "online"),
        ip: String(pick(source, ["ip", "currentIp", "current_ip", "framed_ip"]) || session.ip || customer.ip || "").trim() || null,
        username: String(pick(source, ["username", "user", "login", "pppoe_username"]) || session.username || customer.pppoeUsername || "").trim() || null,
        downloadMbps: toNumberOrNull(pick(source, ["downloadMbps", "download_mbps", "rx_mbps", "down_mbps", "download"])),
        uploadMbps: toNumberOrNull(pick(source, ["uploadMbps", "upload_mbps", "tx_mbps", "up_mbps", "upload"])),
        downloadPeakMbps: toNumberOrNull(pick(source, ["downloadPeakMbps", "download_peak_mbps", "rx_peak_mbps", "download_peak"])),
        uploadPeakMbps: toNumberOrNull(pick(source, ["uploadPeakMbps", "upload_peak_mbps", "tx_peak_mbps", "upload_peak"])),
        bytesReceived: toNumberOrNull(pick(source, ["bytesReceived", "bytes_received", "rx_bytes"])),
        bytesSent: toNumberOrNull(pick(source, ["bytesSent", "bytes_sent", "tx_bytes"])),
        sessionUptimeSeconds: toNumberOrNull(pick(source, ["sessionUptimeSeconds", "session_uptime_seconds", "uptime_seconds"])) ?? session.sessionUptimeSeconds ?? null,
        interface: String(pick(source, ["interface", "ifname", "nas", "concentrator", "concentrador"]) || session.interface || "").trim() || null,
        popName: String(pick(source, ["popName", "pop_name", "pop"]) || session.popName || customer.popName || "").trim() || null,
        updatedAt: String(pick(source, ["updatedAt", "updated_at", "timestamp"]) || new Date().toISOString()),
        source: "hillstone",
    };
};

const unavailable = (details = {}) => ({
    available: false,
    online: null,
    ip: null,
    username: null,
    downloadMbps: null,
    uploadMbps: null,
    downloadPeakMbps: null,
    uploadPeakMbps: null,
    sessionUptimeSeconds: null,
    interface: null,
    updatedAt: new Date().toISOString(),
    message: "Integração com o Hillstone ainda não configurada.",
    details,
    source: "hillstone",
});

export const findCustomerSession = async (customer = {}, { signal } = {}) => {
    const availability = buildAvailability();

    if (!availability.available || !process.env.HILLSTONE_SESSION_LOOKUP_URL) {
        console.warn("[Hillstone] Sessão indisponível:", sanitizeForLog({ availability, customerId: customer.id }));
        return unavailable({ missing: availability.missing.concat(process.env.HILLSTONE_SESSION_LOOKUP_URL ? [] : ["HILLSTONE_SESSION_LOOKUP_URL"]) });
    }

    ensureTemplate(process.env.HILLSTONE_SESSION_LOOKUP_URL, "HILLSTONE_SESSION_LOOKUP_URL");
    const url = replaceTemplate(process.env.HILLSTONE_SESSION_LOOKUP_URL, {
        ip: customer.ip || "",
        username: customer.pppoeUsername || "",
        customerId: customer.id || "",
    });
    const payload = await fetchJson(url, { signal });
    return normalizeSessionPayload(payload, customer);
};

export const getCurrentTraffic = async (customer = {}, { session = null, signal } = {}) => {
    const availability = buildAvailability();

    if (!availability.available || !process.env.HILLSTONE_TRAFFIC_LOOKUP_URL) {
        console.warn("[Hillstone] Tráfego indisponível:", sanitizeForLog({ availability, customerId: customer.id }));
        return unavailable({ missing: availability.missing.concat(process.env.HILLSTONE_TRAFFIC_LOOKUP_URL ? [] : ["HILLSTONE_TRAFFIC_LOOKUP_URL"]) });
    }

    ensureTemplate(process.env.HILLSTONE_TRAFFIC_LOOKUP_URL, "HILLSTONE_TRAFFIC_LOOKUP_URL");
    const url = replaceTemplate(process.env.HILLSTONE_TRAFFIC_LOOKUP_URL, {
        ip: session?.ip || customer.ip || "",
        username: session?.username || customer.pppoeUsername || "",
        customerId: customer.id || "",
    });
    const payload = await fetchJson(url, { signal });
    return normalizeTrafficPayload(payload, customer, session || {});
};
