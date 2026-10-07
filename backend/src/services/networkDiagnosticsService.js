import {
    createDiagnosticHistory,
    getDiagnosticRunByRunId,
    logNetworkDiagnosticAudit,
    searchDiagnosticHistory,
    serializeDiagnosticHistoryRow,
    updateDiagnosticHistory,
} from "../repositories/networkDiagnosticsRepository.js";
import {
    getCustomerDetails,
    getSgpAvailability,
    searchCustomers,
} from "./sgpCustomerService.js";
import {
    getSgpWebCurrentTraffic,
    getSgpWebTrafficAvailability,
} from "./sgpWebTrafficService.js";
import {
    findCustomerSession,
    getCurrentTraffic,
    getHillstoneAvailability,
} from "./hillstoneService.js";
import { runControlledPing } from "./networkPingService.js";
import {
    getRemoteSpeedTestAvailability,
    runRemoteSpeedTest,
} from "./remoteSpeedTestService.js";
import {
    isValidCustomerIp,
    periodoParaMinutos,
    sanitizeForLog,
} from "../validators/networkDiagnosticsValidator.js";

export class NetworkDiagnosticError extends Error {
    constructor(message, statusCode = 400, details = {}) {
        super(message);
        this.name = "NetworkDiagnosticError";
        this.statusCode = statusCode;
        this.details = details;
    }
}

const queue = [];
const activeRuns = new Map();
const runningByCustomer = new Map();
const queuedByCustomer = new Map();
const runningByUser = new Map();
const queuedByUser = new Map();
const lastRunCompletedByCustomer = new Map();

const toInt = (valor, fallback, min, max) => {
    const number = Number(valor);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(number)));
};

const getLimits = () => ({
    maxConcurrent: toInt(process.env.NETWORK_DIAGNOSTIC_MAX_CONCURRENT, 5, 1, 50),
    userMaxConcurrent: toInt(process.env.NETWORK_DIAGNOSTIC_USER_MAX_CONCURRENT, 2, 1, 20),
    timeoutMs: toInt(process.env.NETWORK_DIAGNOSTIC_TIMEOUT_SECONDS, 60, 5, 600) * 1000,
    cooldownMs: toInt(process.env.NETWORK_DIAGNOSTIC_CLIENT_COOLDOWN_SECONDS, 30, 0, 3600) * 1000,
});

const getThresholds = () => ({
    highUsagePercent: Number(process.env.NETWORK_DIAGNOSTIC_HIGH_USAGE_PERCENT || 85),
    packetLossWarnPercent: Number(process.env.NETWORK_DIAGNOSTIC_PACKET_LOSS_WARN_PERCENT || 2),
    pingWarnMs: Number(process.env.NETWORK_DIAGNOSTIC_PING_WARN_MS || 80),
    jitterWarnMs: Number(process.env.NETWORK_DIAGNOSTIC_JITTER_WARN_MS || 30),
    opticalMinDbm: Number(process.env.NETWORK_DIAGNOSTIC_OPTICAL_MIN_DBM || -27),
    opticalMaxDbm: Number(process.env.NETWORK_DIAGNOSTIC_OPTICAL_MAX_DBM || -8),
});

const roundMetric = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? Number(number.toFixed(2)) : null;
};

const createRunId = () => (
    `nd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`
);

const customerRunKey = (customerId, contractId = "") => (
    `${String(customerId || "").trim()}::${String(contractId || "").trim()}`
);

const incrementMap = (map, key) => {
    map.set(key, Number(map.get(key) || 0) + 1);
};

const decrementMap = (map, key) => {
    const next = Number(map.get(key) || 0) - 1;

    if (next > 0) {
        map.set(key, next);
        return;
    }

    map.delete(key);
};

const emitToRun = (io, runId, event, payload = {}) => {
    if (!io || !runId) return;

    io.to(`network-diagnostic:${runId}`).emit(event, {
        runId,
        ...payload,
    });
};

const normalizeHistoryForRun = (row) => row ? serializeDiagnosticHistoryRow(row) : null;

const buildDiagnosticSource = ({ sgpResult, hillstoneSession, hillstoneTraffic, pingResult, remoteSpeedTest }) => {
    const sources = [
        sgpResult?.source || "sgp",
        hillstoneSession?.available ? "hillstone" : null,
        hillstoneTraffic?.available ? hillstoneTraffic.source || "traffic" : null,
        pingResult?.available ? "backend-ping" : null,
        remoteSpeedTest?.supported ? remoteSpeedTest.provider || "remote-speed-test" : null,
    ].filter(Boolean);

    return Array.from(new Set(sources)).join(",");
};

const getConnectionStatus = (customer = {}, session = {}) => {
    if (session?.available && session.online === true) return "online";
    if (session?.available && session.online === false) return "offline";
    return customer.status || "unknown";
};

const getTrafficAvailabilityForSource = (traffic = {}) => (
    traffic?.source === "sgp-web" ? getSgpWebTrafficAvailability() : getHillstoneAvailability()
);

const resolveCurrentTraffic = async (customer = {}, { hillstoneSession = null, signal } = {}) => {
    const sgpAvailability = getSgpWebTrafficAvailability();
    let sgpTraffic = null;

    if (sgpAvailability.available) {
        sgpTraffic = await getSgpWebCurrentTraffic(customer, { signal });
        if (sgpTraffic.available) return sgpTraffic;
    }

    const hillstoneTraffic = await getCurrentTraffic(customer, {
        session: hillstoneSession?.available ? hillstoneSession : null,
        signal,
    });

    if (hillstoneTraffic.available) return hillstoneTraffic;

    return sgpTraffic || hillstoneTraffic;
};

const calculateUsagePercent = (traffic = {}, customer = {}) => {
    const downloadPercent = Number(customer.planDownloadMbps) > 0 && Number(traffic.downloadMbps) >= 0
        ? (Number(traffic.downloadMbps) / Number(customer.planDownloadMbps)) * 100
        : null;
    const uploadPercent = Number(customer.planUploadMbps) > 0 && Number(traffic.uploadMbps) >= 0
        ? (Number(traffic.uploadMbps) / Number(customer.planUploadMbps)) * 100
        : null;
    const valid = [downloadPercent, uploadPercent].filter((value) => Number.isFinite(value));

    if (!valid.length) return null;

    return roundMetric(Math.max(...valid));
};

export const classifyDiagnosticResult = ({
    customer = {},
    connectionStatus,
    traffic = {},
    ping = {},
    remoteSpeedTest = {},
    hillstoneAvailable = false,
} = {}) => {
    const thresholds = getThresholds();
    const usagePercent = calculateUsagePercent(traffic, customer);
    const packetLoss = Number(ping.packetLossPercent);
    const pingMs = Number(ping.avgMs);
    const jitterMs = Number(ping.jitterMs);
    const opticalSignal = Number(customer.opticalSignalDbm);

    if (connectionStatus === "offline") {
        return {
            status: "offline",
            title: "Cliente sem sessão ativa",
            message: "Cliente localizado, mas sem sessão PPPoE ativa no momento.",
            usagePercent,
        };
    }

    if (Number.isFinite(packetLoss) && packetLoss > thresholds.packetLossWarnPercent) {
        return {
            status: "packet_loss",
            title: "Perda de pacotes detectada",
            message: "Foi detectada perda de pacotes acima do limite esperado.",
            usagePercent,
        };
    }

    if (Number.isFinite(pingMs) && pingMs > thresholds.pingWarnMs) {
        return {
            status: "latency",
            title: "Latência elevada",
            message: "A latência média ficou acima da faixa esperada durante a coleta.",
            usagePercent,
        };
    }

    if (Number.isFinite(jitterMs) && jitterMs > thresholds.jitterWarnMs) {
        return {
            status: "jitter",
            title: "Jitter elevado",
            message: "A variação de latência ficou acima da faixa esperada durante a coleta.",
            usagePercent,
        };
    }

    if (
        Number.isFinite(opticalSignal) &&
        Number.isFinite(thresholds.opticalMinDbm) &&
        Number.isFinite(thresholds.opticalMaxDbm) &&
        (opticalSignal < thresholds.opticalMinDbm || opticalSignal > thresholds.opticalMaxDbm)
    ) {
        return {
            status: "optical_signal",
            title: "Sinal óptico fora da faixa",
            message: "O sinal óptico pode estar fora da faixa recomendada. Verifique a rede óptica antes de concluir o atendimento.",
            usagePercent,
        };
    }

    if (Number.isFinite(usagePercent) && usagePercent >= thresholds.highUsagePercent) {
        return {
            status: "high_usage",
            title: "Possível saturação",
            message: "O tráfego está próximo do limite do plano contratado.",
            usagePercent,
        };
    }

    if (
        connectionStatus === "online" &&
        hillstoneAvailable &&
        Number(traffic.downloadMbps || 0) < 0.1 &&
        Number(traffic.uploadMbps || 0) < 0.1
    ) {
        return {
            status: "no_traffic",
            title: "Sem tráfego relevante",
            message: "Cliente conectado, mas sem tráfego relevante durante a coleta.",
            usagePercent,
        };
    }

    if (!hillstoneAvailable) {
        return {
            status: "partial",
            title: "Diagnóstico parcial",
            message: "Integração de tráfego ainda não configurada.",
            usagePercent,
        };
    }

    if (remoteSpeedTest?.supported === false) {
        return {
            status: "normal",
            title: "Conexão normal",
            message: "Cliente online, com latência normal e sem perda relevante.",
            usagePercent,
        };
    }

    return {
        status: "normal",
        title: "Conexão normal",
        message: "Cliente online, latência normal e sem perda relevante de pacotes.",
        usagePercent,
    };
};

const buildRunSnapshot = ({
    customer,
    connectionStatus,
    hillstoneSession,
    hillstoneTraffic,
    pingResult,
    remoteSpeedTest,
    conclusion,
    diagnosticSource,
}) => ({
    customer,
    connection: {
        status: connectionStatus,
        pppoeUsername: hillstoneSession?.username || customer.pppoeUsername || null,
        ip: hillstoneSession?.ip || hillstoneTraffic?.ip || customer.ip || null,
        popName: hillstoneTraffic?.popName || hillstoneSession?.popName || customer.popName || null,
        interface: hillstoneTraffic?.interface || hillstoneSession?.interface || null,
        sessionUptimeSeconds: hillstoneTraffic?.sessionUptimeSeconds ?? hillstoneSession?.sessionUptimeSeconds ?? customer.sessionUptimeSeconds ?? null,
    },
    traffic: hillstoneTraffic,
    quality: {
        pingMs: pingResult?.avgMs ?? null,
        jitterMs: pingResult?.jitterMs ?? null,
        packetLossPercent: pingResult?.packetLossPercent ?? null,
        sent: pingResult?.sent ?? null,
        received: pingResult?.received ?? null,
        testedAt: pingResult?.testedAt ?? null,
        status: pingResult?.status ?? "not_tested",
    },
    capacityTest: remoteSpeedTest,
    conclusion,
    diagnosticSource,
});

const buildHistoryPayloadFromSnapshot = ({
    item,
    snapshot,
    status = "completed",
    errorMessage = null,
}) => ({
    customer_id: snapshot.customer?.customerId || snapshot.customer?.id || item.customerId,
    contract_id: snapshot.customer?.contractId || item.contractId || null,
    customer_name: snapshot.customer?.name || null,
    pppoe_username: snapshot.connection?.pppoeUsername || null,
    customer_ip: snapshot.connection?.ip || null,
    plan_name: snapshot.customer?.planName || null,
    plan_download_mbps: snapshot.customer?.planDownloadMbps ?? null,
    plan_upload_mbps: snapshot.customer?.planUploadMbps ?? null,
    status,
    result_status: snapshot.conclusion?.status || null,
    connection_status: snapshot.connection?.status || null,
    download_current_mbps: snapshot.traffic?.downloadMbps ?? null,
    upload_current_mbps: snapshot.traffic?.uploadMbps ?? null,
    download_peak_mbps: snapshot.traffic?.downloadPeakMbps ?? null,
    upload_peak_mbps: snapshot.traffic?.uploadPeakMbps ?? null,
    download_test_mbps: snapshot.capacityTest?.downloadMbps ?? null,
    upload_test_mbps: snapshot.capacityTest?.uploadMbps ?? null,
    ping_ms: snapshot.quality?.pingMs ?? null,
    jitter_ms: snapshot.quality?.jitterMs ?? null,
    packet_loss_percent: snapshot.quality?.packetLossPercent ?? null,
    optical_signal_dbm: snapshot.customer?.opticalSignalDbm ?? null,
    onu_identifier: snapshot.customer?.onuIdentifier || null,
    pop_name: snapshot.connection?.popName || null,
    diagnostic_source: snapshot.diagnosticSource || null,
    conclusion_title: snapshot.conclusion?.title || null,
    conclusion_message: snapshot.conclusion?.message || null,
    completed_at: new Date(),
    duration_ms: Date.now() - item.startedAtMs,
    error_message: errorMessage,
    raw_result_json: sanitizeForLog(snapshot),
});

const updateRunProgress = async (item, step, message, details = {}) => {
    const progress = {
        step,
        message,
        details: sanitizeForLog(details),
        at: new Date().toISOString(),
    };

    item.progress.push(progress);

    await logNetworkDiagnosticAudit({
        empresaId: item.user.empresa_id,
        runId: item.runId,
        user: item.user,
        customerId: item.customerId,
        action: "progress",
        details: progress,
    });

    emitToRun(item.io, item.runId, "network-diagnostic:progress", progress);
};

const executeRun = async (item) => {
    const timeout = setTimeout(() => {
        item.controller.abort(new Error("Diagnóstico cancelado por tempo excedido."));
    }, getLimits().timeoutMs);

    try {
        await updateRunProgress(item, "consulting_customer", "Consultando cliente...");
        const sgpResult = await getCustomerDetails(item.customerId, {
            signal: item.controller.signal,
            fallbackCustomer: item.customerSnapshot,
        });
        const customer = sgpResult.customer;

        await updateRunProgress(item, "locating_pppoe", "Localizando sessão PPPoE...", {
            customerId: customer.customerId || customer.id,
            contractId: customer.contractId,
        });
        const hillstoneSession = await findCustomerSession(customer, {
            signal: item.controller.signal,
        });

        await updateRunProgress(item, "consulting_traffic", "Consultando tráfego em tempo real...");
        const hillstoneTraffic = await resolveCurrentTraffic(customer, {
            hillstoneSession,
            signal: item.controller.signal,
        });

        const connectionStatus = getConnectionStatus(customer, hillstoneSession);
        const pingTarget = hillstoneSession?.ip || hillstoneTraffic?.ip || customer.ip;
        let pingResult = {
            available: false,
            status: "not_tested",
            message: "Cliente sem IP válido para teste de ping.",
        };

        await updateRunProgress(item, "latency", "Executando teste de latência...", { hasIp: isValidCustomerIp(pingTarget) });

        if (isValidCustomerIp(pingTarget)) {
            pingResult = await runControlledPing(pingTarget, { signal: item.controller.signal });
        }

        await updateRunProgress(item, "packet_loss", "Calculando perda...");

        await updateRunProgress(item, "optical_signal", "Consultando sinal óptico, quando disponível...");
        const remoteSpeedTest = await runRemoteSpeedTest(customer);
        const diagnosticSource = buildDiagnosticSource({
            sgpResult,
            hillstoneSession,
            hillstoneTraffic,
            pingResult,
            remoteSpeedTest,
        });
        const conclusion = classifyDiagnosticResult({
            customer,
            connectionStatus,
            traffic: hillstoneTraffic,
            ping: pingResult,
            remoteSpeedTest,
            hillstoneAvailable: Boolean(hillstoneTraffic?.available || hillstoneSession?.available),
        });
        const snapshot = buildRunSnapshot({
            customer,
            connectionStatus,
            hillstoneSession,
            hillstoneTraffic,
            pingResult,
            remoteSpeedTest,
            conclusion,
            diagnosticSource,
        });

        await updateRunProgress(item, "completed", "Diagnóstico concluído.", {
            result: conclusion.status,
        });

        const row = await updateDiagnosticHistory(item.runId, item.user.empresa_id, buildHistoryPayloadFromSnapshot({
            item,
            snapshot,
            status: "completed",
        }));
        const result = {
            run: normalizeHistoryForRun(row),
            diagnostic: snapshot,
        };

        emitToRun(item.io, item.runId, "network-diagnostic:completed", result);

        await logNetworkDiagnosticAudit({
            empresaId: item.user.empresa_id,
            runId: item.runId,
            user: item.user,
            customerId: snapshot.customer?.customerId || item.customerId,
            customerIp: snapshot.connection?.ip,
            action: "completed",
            details: {
                durationMs: Date.now() - item.startedAtMs,
                resultStatus: conclusion.status,
            },
        });
    } catch (err) {
        const aborted = item.controller.signal.aborted;
        const status = aborted ? "cancelled" : "failed";
        const message = aborted
            ? "Diagnóstico cancelado por tempo excedido."
            : err.message || "Erro ao executar diagnóstico.";

        const row = await updateDiagnosticHistory(item.runId, item.user.empresa_id, {
            status,
            completed_at: new Date(),
            duration_ms: Date.now() - item.startedAtMs,
            error_message: message,
        });

        emitToRun(item.io, item.runId, "network-diagnostic:failed", {
            run: normalizeHistoryForRun(row),
            error: message,
        });

        await logNetworkDiagnosticAudit({
            empresaId: item.user.empresa_id,
            runId: item.runId,
            user: item.user,
            customerId: item.customerId,
            action: status,
            details: {
                error: message,
                statusCode: err.statusCode || null,
            },
        });
    } finally {
        clearTimeout(timeout);
    }
};

const processQueue = () => {
    const { maxConcurrent } = getLimits();

    while (activeRuns.size < maxConcurrent && queue.length > 0) {
        const item = queue.shift();
        const userKey = String(item.user.id);
        const customerKey = item.customerKey;

        queuedByCustomer.delete(customerKey);
        decrementMap(queuedByUser, userKey);
        activeRuns.set(item.runId, item);
        runningByCustomer.set(customerKey, item.runId);
        incrementMap(runningByUser, userKey);
        item.status = "running";
        item.startedAtMs = Date.now();

        updateDiagnosticHistory(item.runId, item.user.empresa_id, {
            status: "running",
            started_at: new Date(),
        }).then((row) => {
            emitToRun(item.io, item.runId, "network-diagnostic:started", {
                run: normalizeHistoryForRun(row),
            });
        }).catch((err) => {
            console.error("Erro ao atualizar início do diagnóstico:", err);
        });

        executeRun(item).finally(() => {
            activeRuns.delete(item.runId);
            runningByCustomer.delete(customerKey);
            decrementMap(runningByUser, userKey);
            lastRunCompletedByCustomer.set(customerKey, Date.now());
            processQueue();
        });
    }
};

export const getDiagnosticIntegrationsStatus = () => ({
    sgp: getSgpAvailability(),
    sgpTraffic: getSgpWebTrafficAvailability(),
    hillstone: getHillstoneAvailability(),
    remoteSpeedTest: getRemoteSpeedTestAvailability(),
});

export const searchDiagnosticCustomers = async (query, options = {}) => (
    searchCustomers(query, options)
);

export const getCustomerDiagnosticSummary = async (customerId, { fallbackCustomer = null, signal } = {}) => {
    const sgpResult = await getCustomerDetails(customerId, { signal, fallbackCustomer });
    const customer = sgpResult.customer;
    const hillstoneSession = await findCustomerSession(customer, { signal });
    const hillstoneTraffic = await resolveCurrentTraffic(customer, {
        hillstoneSession,
        signal,
    });
    const connectionStatus = getConnectionStatus(customer, hillstoneSession);
    const capacity = getRemoteSpeedTestAvailability(customer);
    const conclusion = classifyDiagnosticResult({
        customer,
        connectionStatus,
        traffic: hillstoneTraffic,
        ping: {},
        remoteSpeedTest: capacity,
        hillstoneAvailable: Boolean(hillstoneTraffic?.available || hillstoneSession?.available),
    });

    return buildRunSnapshot({
        customer,
        connectionStatus,
        hillstoneSession,
        hillstoneTraffic,
        pingResult: null,
        remoteSpeedTest: capacity,
        conclusion,
        diagnosticSource: buildDiagnosticSource({
            sgpResult,
            hillstoneSession,
            hillstoneTraffic,
            pingResult: null,
            remoteSpeedTest: capacity,
        }),
    });
};

export const getCustomerTraffic = async (customerId, { period = "5m", fallbackCustomer = null, signal } = {}) => {
    const minutes = periodoParaMinutos(period);
    const sgpResult = await getCustomerDetails(customerId, { signal, fallbackCustomer });
    const customer = sgpResult.customer;
    const hillstoneSession = await findCustomerSession(customer, { signal });
    const traffic = await resolveCurrentTraffic(customer, {
        hillstoneSession,
        signal,
    });

    return {
        period,
        minutes,
        traffic,
        point: {
            at: traffic.updatedAt || new Date().toISOString(),
            downloadMbps: traffic.downloadMbps,
            uploadMbps: traffic.uploadMbps,
        },
        availability: getTrafficAvailabilityForSource(traffic),
    };
};

export const startNetworkDiagnosticRun = async ({
    user,
    customerId,
    customerSnapshot = null,
    io = null,
} = {}) => {
    const limits = getLimits();
    const normalizedCustomerId = String(customerId || "").trim();
    const normalizedContractId = String(customerSnapshot?.contractId || customerSnapshot?.contract_id || "").trim();
    const customerKey = customerRunKey(normalizedCustomerId, normalizedContractId);
    const userKey = String(user.id);

    if (runningByCustomer.has(customerKey) || queuedByCustomer.has(customerKey)) {
        throw new NetworkDiagnosticError("Já existe um diagnóstico ativo para este cliente.", 409);
    }

    const lastCompletedAt = Number(lastRunCompletedByCustomer.get(customerKey) || 0);
    const cooldownRemainingMs = limits.cooldownMs - (Date.now() - lastCompletedAt);

    if (cooldownRemainingMs > 0) {
        throw new NetworkDiagnosticError("Aguarde o intervalo mínimo para executar novo diagnóstico deste cliente.", 429, {
            retryAfterSeconds: Math.ceil(cooldownRemainingMs / 1000),
        });
    }

    const userPending = Number(runningByUser.get(userKey) || 0) + Number(queuedByUser.get(userKey) || 0);

    if (userPending >= limits.userMaxConcurrent) {
        throw new NetworkDiagnosticError("Limite de diagnósticos simultâneos por usuário atingido.", 429);
    }

    const runId = createRunId();
    const item = {
        runId,
        user,
        customerId: normalizedCustomerId,
        contractId: normalizedContractId || null,
        customerSnapshot,
        customerKey,
        controller: new AbortController(),
        io,
        progress: [],
        status: "queued",
        startedAtMs: Date.now(),
    };

    await createDiagnosticHistory({
        empresa_id: user.empresa_id,
        run_id: runId,
        customer_id: normalizedCustomerId,
        contract_id: normalizedContractId || null,
        customer_name: customerSnapshot?.name || customerSnapshot?.nome || null,
        pppoe_username: customerSnapshot?.pppoeUsername || customerSnapshot?.login_pppoe || null,
        customer_ip: customerSnapshot?.ip || customerSnapshot?.current_ip || null,
        plan_name: customerSnapshot?.planName || customerSnapshot?.plano || null,
        plan_download_mbps: customerSnapshot?.planDownloadMbps || null,
        plan_upload_mbps: customerSnapshot?.planUploadMbps || null,
        status: "queued",
        diagnostic_source: "sgp,hillstone,backend-ping",
        requested_by_user_id: user.id,
        requested_by_user_name: user.nome,
        started_at: new Date(),
    });

    queue.push(item);
    queuedByCustomer.set(customerKey, runId);
    incrementMap(queuedByUser, userKey);

    await logNetworkDiagnosticAudit({
        empresaId: user.empresa_id,
        runId,
        user,
        customerId: normalizedCustomerId,
        customerIp: customerSnapshot?.ip || null,
        action: "queued",
        details: {
            activeRuns: activeRuns.size,
            queueLength: queue.length,
        },
    });

    setImmediate(processQueue);

    return {
        runId,
        status: activeRuns.has(runId) ? "running" : "queued",
        limits,
    };
};

export const cancelNetworkDiagnosticRun = async ({ runId, user } = {}) => {
    const queuedIndex = queue.findIndex((item) => item.runId === runId);

    if (queuedIndex >= 0) {
        const [item] = queue.splice(queuedIndex, 1);
        queuedByCustomer.delete(item.customerKey);
        decrementMap(queuedByUser, String(item.user.id));
        const row = await updateDiagnosticHistory(runId, user.empresa_id, {
            status: "cancelled",
            completed_at: new Date(),
            error_message: "Diagnóstico cancelado pelo usuário.",
        });
        emitToRun(item.io, runId, "network-diagnostic:failed", {
            run: normalizeHistoryForRun(row),
            error: "Diagnóstico cancelado pelo usuário.",
        });
        return normalizeHistoryForRun(row);
    }

    const active = activeRuns.get(runId);

    if (!active) {
        const row = await getDiagnosticRunByRunId(runId, user.empresa_id);
        if (!row) throw new NetworkDiagnosticError("Execução não encontrada.", 404);
        return normalizeHistoryForRun(row);
    }

    active.controller.abort(new Error("Diagnóstico cancelado pelo usuário."));
    const row = await updateDiagnosticHistory(runId, user.empresa_id, {
        status: "cancel_requested",
        error_message: "Cancelamento solicitado pelo usuário.",
    });

    await logNetworkDiagnosticAudit({
        empresaId: user.empresa_id,
        runId,
        user,
        customerId: active.customerId,
        action: "cancel_requested",
    });

    return normalizeHistoryForRun(row);
};

export const getRunStatus = async ({ runId, user } = {}) => {
    const row = await getDiagnosticRunByRunId(runId, user.empresa_id);

    if (!row) {
        throw new NetworkDiagnosticError("Execução não encontrada.", 404);
    }

    return {
        run: normalizeHistoryForRun(row),
        progress: activeRuns.get(runId)?.progress || queue.find((item) => item.runId === runId)?.progress || [],
    };
};

export const listNetworkDiagnosticHistory = async ({ user, filters, page, limit } = {}) => {
    const result = await searchDiagnosticHistory({
        empresaId: user.empresa_id,
        filters,
        page,
        limit,
    });

    return {
        ...result,
        rows: result.rows.map(serializeDiagnosticHistoryRow),
    };
};
