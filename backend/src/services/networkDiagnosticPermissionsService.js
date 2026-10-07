import {
    ensureNetworkDiagnosticTables,
    getNetworkDiagnosticPermissionGrants,
    parseJson,
} from "../repositories/networkDiagnosticsRepository.js";

export const NETWORK_DIAGNOSTIC_PERMISSION_KEYS = [
    "network_diagnostics.view",
    "network_diagnostics.run",
    "network_diagnostics.history",
    "network_diagnostics.admin",
];

const ALL_NETWORK_DIAGNOSTIC_PERMISSIONS = Object.fromEntries(
    NETWORK_DIAGNOSTIC_PERMISSION_KEYS.map((permission) => [permission, true])
);

const parseCsvSet = (valor = "") => (
    new Set(
        String(valor || "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
    )
);

const parseNumberSet = (valor = "") => (
    new Set(
        String(valor || "")
            .split(",")
            .map((item) => Number(item.trim()))
            .filter((item) => Number.isInteger(item) && item > 0)
    )
);

const normalizeText = (valor = "") => (
    String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
);

const parseKeywordSet = (valor = "", fallback = []) => {
    const keywords = String(valor || "")
        .split(",")
        .map((item) => normalizeText(item.trim()))
        .filter(Boolean);

    return new Set(keywords.length ? keywords : fallback.map(normalizeText));
};

const normalizarPermissionsObject = (permissions = {}) => {
    const input = permissions && typeof permissions === "object" ? permissions : {};

    return Object.fromEntries(
        Object.entries(input)
            .filter(([permission]) => NETWORK_DIAGNOSTIC_PERMISSION_KEYS.includes(permission))
            .map(([permission, enabled]) => [permission, Boolean(enabled)])
    );
};

const buildEnvPermissions = (user = {}) => {
    const permissions = {};
    const perfil = String(user.perfil || "");
    const setorId = Number(user.setor_id || 0);
    const setorNome = normalizeText(user.setor_nome || user.setor || "");
    const viewProfiles = parseCsvSet(process.env.NETWORK_DIAGNOSTIC_VIEW_PROFILES || process.env.NETWORK_DIAGNOSTIC_ALLOWED_PROFILES || "");
    const runProfiles = parseCsvSet(process.env.NETWORK_DIAGNOSTIC_RUN_PROFILES || process.env.NETWORK_DIAGNOSTIC_ALLOWED_PROFILES || "");
    const historyProfiles = parseCsvSet(process.env.NETWORK_DIAGNOSTIC_HISTORY_PROFILES || "");
    const adminProfiles = parseCsvSet(process.env.NETWORK_DIAGNOSTIC_ADMIN_PROFILES || "");
    const viewDepartments = parseNumberSet(process.env.NETWORK_DIAGNOSTIC_VIEW_DEPARTMENT_IDS || process.env.NETWORK_DIAGNOSTIC_ALLOWED_SECTOR_IDS || "");
    const runDepartments = parseNumberSet(process.env.NETWORK_DIAGNOSTIC_RUN_DEPARTMENT_IDS || process.env.NETWORK_DIAGNOSTIC_ALLOWED_SECTOR_IDS || "");
    const historyDepartments = parseNumberSet(process.env.NETWORK_DIAGNOSTIC_HISTORY_DEPARTMENT_IDS || "");
    const adminDepartments = parseNumberSet(process.env.NETWORK_DIAGNOSTIC_ADMIN_DEPARTMENT_IDS || "");
    const supportKeywords = parseKeywordSet(process.env.NETWORK_DIAGNOSTIC_SUPPORT_SECTOR_KEYWORDS, [
        "suporte",
        "atendimento tecnico",
        "tecnico",
        "n1",
        "n2",
        "n3",
    ]);
    const nocKeywords = parseKeywordSet(process.env.NETWORK_DIAGNOSTIC_NOC_SECTOR_KEYWORDS, [
        "noc",
        "monitoramento",
        "rede",
        "redes",
    ]);
    const isSupportSector = [...supportKeywords].some((keyword) => setorNome.includes(keyword));
    const isNocSector = [...nocKeywords].some((keyword) => setorNome.includes(keyword));

    if (viewProfiles.has(perfil) || viewDepartments.has(setorId) || isSupportSector || isNocSector) {
        permissions["network_diagnostics.view"] = true;
    }

    if (runProfiles.has(perfil) || runDepartments.has(setorId) || isSupportSector || isNocSector) {
        permissions["network_diagnostics.run"] = true;
        permissions["network_diagnostics.view"] = true;
    }

    if (historyProfiles.has(perfil) || historyDepartments.has(setorId) || isNocSector) {
        permissions["network_diagnostics.history"] = true;
        permissions["network_diagnostics.view"] = true;
    }

    if (adminProfiles.has(perfil) || adminDepartments.has(setorId)) {
        Object.assign(permissions, ALL_NETWORK_DIAGNOSTIC_PERMISSIONS);
    }

    return permissions;
};

export const resolveNetworkDiagnosticPermissions = async (user = {}) => {
    if (user?.perfil === "admin") {
        return {
            permissions: { ...ALL_NETWORK_DIAGNOSTIC_PERMISSIONS },
            is_admin: true,
            access_blocked: false,
        };
    }

    await ensureNetworkDiagnosticTables();

    const resolved = {
        ...buildEnvPermissions(user),
    };
    let accessBlocked = false;
    const grants = await getNetworkDiagnosticPermissionGrants(user);

    grants.forEach((grant) => {
        if (Number(grant.access_blocked) === 1) {
            accessBlocked = true;
            return;
        }

        const permissions = normalizarPermissionsObject(parseJson(grant.permissions_json, {}));
        Object.entries(permissions).forEach(([permission, enabled]) => {
            resolved[permission] = Boolean(enabled);
        });
    });

    if (resolved["network_diagnostics.admin"]) {
        Object.assign(resolved, ALL_NETWORK_DIAGNOSTIC_PERMISSIONS);
    }

    if (resolved["network_diagnostics.run"]) {
        resolved["network_diagnostics.view"] = true;
    }

    if (resolved["network_diagnostics.history"]) {
        resolved["network_diagnostics.view"] = true;
    }

    return {
        permissions: accessBlocked ? {} : resolved,
        is_admin: false,
        access_blocked: accessBlocked,
    };
};

export const userHasNetworkDiagnosticPermission = async (user = {}, permission) => {
    const access = await resolveNetworkDiagnosticPermissions(user);
    return Boolean(access.permissions?.[permission]);
};

export const requireNetworkDiagnosticPermission = (permission) => async (req, res, next) => {
    try {
        const access = await resolveNetworkDiagnosticPermissions(req.user);

        if (!access.permissions?.[permission]) {
            return res.status(403).json({
                error: "Você não possui permissão para acessar este diagnóstico.",
            });
        }

        req.networkDiagnosticAccess = access;
        return next();
    } catch (err) {
        console.error("Erro ao validar permissão de diagnóstico de conexão:", err);
        return res.status(500).json({ error: "Erro ao validar permissões." });
    }
};

export const serializeNetworkDiagnosticAccess = (access = {}) => ({
    permissions: access.permissions || {},
    is_admin: Boolean(access.is_admin),
    access_blocked: Boolean(access.access_blocked),
    can_view: Boolean(access.permissions?.["network_diagnostics.view"]),
    can_run: Boolean(access.permissions?.["network_diagnostics.run"]),
    can_history: Boolean(access.permissions?.["network_diagnostics.history"]),
    can_admin: Boolean(access.permissions?.["network_diagnostics.admin"]),
});
