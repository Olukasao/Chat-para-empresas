import { Router } from "express";
import authMiddleware from "../middlewares/middleware.js";
import {
    cancelNetworkDiagnosticRun,
    getCustomerDiagnosticSummary,
    getCustomerTraffic,
    getDiagnosticIntegrationsStatus,
    getRunStatus,
    listNetworkDiagnosticHistory,
    searchDiagnosticCustomers,
    startNetworkDiagnosticRun,
} from "../services/networkDiagnosticsService.js";
import {
    requireNetworkDiagnosticPermission,
    resolveNetworkDiagnosticPermissions,
    serializeNetworkDiagnosticAccess,
} from "../services/networkDiagnosticPermissionsService.js";
import {
    normalizarTextoBuscaCliente,
    parseHistoryFilters,
    validarCustomerId,
    validarPeriodoTrafego,
    validarRunId,
    validarTextoBuscaCliente,
} from "../validators/networkDiagnosticsValidator.js";
import {
    logNetworkDiagnosticAudit,
} from "../repositories/networkDiagnosticsRepository.js";

const router = Router();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = Number(process.env.NETWORK_DIAGNOSTIC_RATE_LIMIT_PER_MINUTE || 60);
const rateLimitStore = new Map();

const clearOldRateLimitEntries = () => {
    const now = Date.now();

    rateLimitStore.forEach((entry, key) => {
        if (now > entry.resetAt + RATE_LIMIT_WINDOW_MS) {
            rateLimitStore.delete(key);
        }
    });
};

const networkDiagnosticsRateLimit = (req, res, next) => {
    clearOldRateLimitEntries();

    const key = `${req.user?.id || req.ip}:network-diagnostics`;
    const now = Date.now();
    const current = rateLimitStore.get(key);

    if (!current || now > current.resetAt) {
        rateLimitStore.set(key, {
            count: 1,
            resetAt: now + RATE_LIMIT_WINDOW_MS,
        });
        return next();
    }

    current.count += 1;

    if (current.count > RATE_LIMIT_MAX) {
        return res.status(429).json({
            error: "Muitas requisições de diagnóstico. Aguarde alguns instantes.",
            retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000),
        });
    }

    return next();
};

const sendError = async (req, res, err, fallbackMessage = "Erro ao processar diagnóstico.") => {
    const statusCode = err.statusCode && Number(err.statusCode) >= 400 && Number(err.statusCode) < 600
        ? Number(err.statusCode)
        : 500;
    const message = err.message || fallbackMessage;

    console.error("[NetworkDiagnostics]", message, {
        statusCode,
        details: err.details || null,
    });

    await logNetworkDiagnosticAudit({
        empresaId: req.user?.empresa_id,
        user: req.user,
        customerId: req.params?.customerId || null,
        action: "error",
        details: {
            path: req.originalUrl,
            statusCode,
            message,
            details: err.details || null,
        },
    });

    return res.status(statusCode).json({
        error: message,
        details: err.details || undefined,
    });
};

router.use(authMiddleware);
router.use(networkDiagnosticsRateLimit);

router.get("/network-diagnostics/permissions/me", async (req, res) => {
    try {
        const access = await resolveNetworkDiagnosticPermissions(req.user);

        res.json({
            access: serializeNetworkDiagnosticAccess(access),
            integrations: getDiagnosticIntegrationsStatus(),
        });
    } catch (err) {
        await sendError(req, res, err, "Erro ao buscar permissões.");
    }
});

router.get(
    "/network-diagnostics/customers/search",
    requireNetworkDiagnosticPermission("network_diagnostics.view"),
    async (req, res) => {
        try {
            const query = validarTextoBuscaCliente(req.query.q || req.query.query || req.query.search);
            const result = await searchDiagnosticCustomers(query);

            await logNetworkDiagnosticAudit({
                empresaId: req.user.empresa_id,
                user: req.user,
                action: "customer_search",
                details: {
                    query: normalizarTextoBuscaCliente(query),
                    total: result.customers.length,
                    elapsedMs: result.elapsedMs || null,
                },
            });

            res.json({
                ...result,
                integrations: getDiagnosticIntegrationsStatus(),
            });
        } catch (err) {
            await sendError(req, res, err, "Erro ao pesquisar cliente.");
        }
    }
);

router.get(
    "/network-diagnostics/customers/:customerId",
    requireNetworkDiagnosticPermission("network_diagnostics.view"),
    async (req, res) => {
        try {
            const customerId = validarCustomerId(req.params.customerId);
            const diagnostic = await getCustomerDiagnosticSummary(customerId);

            await logNetworkDiagnosticAudit({
                empresaId: req.user.empresa_id,
                user: req.user,
                customerId,
                customerIp: diagnostic.connection?.ip || null,
                action: "customer_diagnostic_view",
            });

            res.json({
                diagnostic,
                integrations: getDiagnosticIntegrationsStatus(),
            });
        } catch (err) {
            await sendError(req, res, err, "Erro ao carregar diagnóstico do cliente.");
        }
    }
);

router.get(
    "/network-diagnostics/customers/:customerId/traffic",
    requireNetworkDiagnosticPermission("network_diagnostics.view"),
    async (req, res) => {
        try {
            const customerId = validarCustomerId(req.params.customerId);
            const period = validarPeriodoTrafego(req.query.period);
            const result = await getCustomerTraffic(customerId, { period });

            res.json(result);
        } catch (err) {
            await sendError(req, res, err, "Não foi possível consultar o tráfego do cliente.");
        }
    }
);

router.post(
    "/network-diagnostics/customers/:customerId/run",
    requireNetworkDiagnosticPermission("network_diagnostics.run"),
    async (req, res) => {
        try {
            const customerId = validarCustomerId(req.params.customerId);
            const result = await startNetworkDiagnosticRun({
                user: req.user,
                customerId,
                customerSnapshot: req.body?.customer || null,
                io: req.app.get("io"),
            });

            res.status(202).json(result);
        } catch (err) {
            await sendError(req, res, err, "Erro ao iniciar diagnóstico.");
        }
    }
);

router.get(
    "/network-diagnostics/runs/:runId",
    requireNetworkDiagnosticPermission("network_diagnostics.view"),
    async (req, res) => {
        try {
            const runId = validarRunId(req.params.runId);
            const result = await getRunStatus({ runId, user: req.user });

            res.json(result);
        } catch (err) {
            await sendError(req, res, err, "Erro ao consultar execução.");
        }
    }
);

router.post(
    "/network-diagnostics/runs/:runId/cancel",
    requireNetworkDiagnosticPermission("network_diagnostics.run"),
    async (req, res) => {
        try {
            const runId = validarRunId(req.params.runId);
            const run = await cancelNetworkDiagnosticRun({ runId, user: req.user });

            res.json({ run });
        } catch (err) {
            await sendError(req, res, err, "Erro ao cancelar diagnóstico.");
        }
    }
);

router.get(
    "/network-diagnostics/history",
    requireNetworkDiagnosticPermission("network_diagnostics.history"),
    async (req, res) => {
        try {
            const { page, limit, filters } = parseHistoryFilters(req.query);
            const result = await listNetworkDiagnosticHistory({
                user: req.user,
                filters,
                page,
                limit,
            });

            res.json(result);
        } catch (err) {
            await sendError(req, res, err, "Erro ao listar histórico de diagnósticos.");
        }
    }
);

export default router;
