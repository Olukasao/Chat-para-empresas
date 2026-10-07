import db from "../db/db.js";

let tabelasGarantidas = false;
let tabelasGarantidasPromise = null;

const stringifyJson = (value) => {
    if (value === undefined) return null;

    try {
        return JSON.stringify(value);
    } catch (_err) {
        return null;
    }
};

export const parseJson = (value, fallback = null) => {
    if (!value) return fallback;

    try {
        return JSON.parse(value);
    } catch (_err) {
        return fallback;
    }
};

export const ensureNetworkDiagnosticTables = async (connection = db) => {
    if (tabelasGarantidas) return;
    if (tabelasGarantidasPromise) return tabelasGarantidasPromise;

    tabelasGarantidasPromise = (async () => {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS network_diagnostic_permissions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                empresa_id INT NOT NULL,
                subject_type ENUM('user', 'role', 'department') NOT NULL,
                subject_id INT NOT NULL DEFAULT 0,
                subject_key VARCHAR(100) NOT NULL DEFAULT '',
                permissions_json LONGTEXT DEFAULT NULL,
                access_blocked TINYINT(1) NOT NULL DEFAULT 0,
                created_by INT DEFAULT NULL,
                updated_by INT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
                FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL,
                FOREIGN KEY (updated_by) REFERENCES usuarios(id) ON DELETE SET NULL,
                UNIQUE KEY unique_network_diagnostic_permission_subject (empresa_id, subject_type, subject_id, subject_key),
                INDEX idx_network_diagnostic_permissions_empresa_subject (empresa_id, subject_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS network_diagnostic_history (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                empresa_id INT NOT NULL,
                run_id VARCHAR(64) NOT NULL,
                customer_id VARCHAR(80) DEFAULT NULL,
                contract_id VARCHAR(80) DEFAULT NULL,
                customer_name VARCHAR(255) DEFAULT NULL,
                pppoe_username VARCHAR(160) DEFAULT NULL,
                customer_ip VARCHAR(45) DEFAULT NULL,
                plan_name VARCHAR(160) DEFAULT NULL,
                plan_download_mbps DECIMAL(10,2) DEFAULT NULL,
                plan_upload_mbps DECIMAL(10,2) DEFAULT NULL,
                status VARCHAR(40) NOT NULL DEFAULT 'queued',
                result_status VARCHAR(40) DEFAULT NULL,
                connection_status VARCHAR(40) DEFAULT NULL,
                download_current_mbps DECIMAL(12,2) DEFAULT NULL,
                upload_current_mbps DECIMAL(12,2) DEFAULT NULL,
                download_peak_mbps DECIMAL(12,2) DEFAULT NULL,
                upload_peak_mbps DECIMAL(12,2) DEFAULT NULL,
                download_test_mbps DECIMAL(12,2) DEFAULT NULL,
                upload_test_mbps DECIMAL(12,2) DEFAULT NULL,
                ping_ms DECIMAL(10,2) DEFAULT NULL,
                jitter_ms DECIMAL(10,2) DEFAULT NULL,
                packet_loss_percent DECIMAL(6,2) DEFAULT NULL,
                optical_signal_dbm DECIMAL(7,2) DEFAULT NULL,
                onu_identifier VARCHAR(180) DEFAULT NULL,
                pop_name VARCHAR(160) DEFAULT NULL,
                diagnostic_source VARCHAR(80) DEFAULT NULL,
                conclusion_title VARCHAR(180) DEFAULT NULL,
                conclusion_message TEXT DEFAULT NULL,
                requested_by_user_id INT DEFAULT NULL,
                requested_by_user_name VARCHAR(160) DEFAULT NULL,
                started_at TIMESTAMP NULL DEFAULT NULL,
                completed_at TIMESTAMP NULL DEFAULT NULL,
                duration_ms INT DEFAULT NULL,
                error_message TEXT DEFAULT NULL,
                raw_result_json LONGTEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
                FOREIGN KEY (requested_by_user_id) REFERENCES usuarios(id) ON DELETE SET NULL,
                UNIQUE KEY unique_network_diagnostic_run (run_id),
                INDEX idx_network_diagnostic_history_empresa_created (empresa_id, created_at),
                INDEX idx_network_diagnostic_history_customer (empresa_id, customer_id, contract_id),
                INDEX idx_network_diagnostic_history_user (empresa_id, requested_by_user_id, created_at),
                INDEX idx_network_diagnostic_history_status (empresa_id, status, result_status),
                INDEX idx_network_diagnostic_history_pop (empresa_id, pop_name, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS network_diagnostic_audit_logs (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                empresa_id INT NOT NULL,
                run_id VARCHAR(64) DEFAULT NULL,
                user_id INT DEFAULT NULL,
                user_name VARCHAR(160) DEFAULT NULL,
                customer_id VARCHAR(80) DEFAULT NULL,
                customer_ip VARCHAR(45) DEFAULT NULL,
                action VARCHAR(80) NOT NULL,
                details_json LONGTEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE SET NULL,
                INDEX idx_network_diagnostic_audit_empresa (empresa_id, created_at),
                INDEX idx_network_diagnostic_audit_run (run_id),
                INDEX idx_network_diagnostic_audit_action (action)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        tabelasGarantidas = true;
    })();

    return tabelasGarantidasPromise;
};

const HISTORY_COLUMNS = [
    "empresa_id",
    "run_id",
    "customer_id",
    "contract_id",
    "customer_name",
    "pppoe_username",
    "customer_ip",
    "plan_name",
    "plan_download_mbps",
    "plan_upload_mbps",
    "status",
    "result_status",
    "connection_status",
    "download_current_mbps",
    "upload_current_mbps",
    "download_peak_mbps",
    "upload_peak_mbps",
    "download_test_mbps",
    "upload_test_mbps",
    "ping_ms",
    "jitter_ms",
    "packet_loss_percent",
    "optical_signal_dbm",
    "onu_identifier",
    "pop_name",
    "diagnostic_source",
    "conclusion_title",
    "conclusion_message",
    "requested_by_user_id",
    "requested_by_user_name",
    "started_at",
    "completed_at",
    "duration_ms",
    "error_message",
    "raw_result_json",
];

const UPDATE_COLUMNS = new Set(HISTORY_COLUMNS.filter((column) => column !== "empresa_id" && column !== "run_id"));

const normalizeHistoryPayload = (payload = {}) => {
    const normalized = { ...payload };

    if (normalized.raw_result_json && typeof normalized.raw_result_json !== "string") {
        normalized.raw_result_json = stringifyJson(normalized.raw_result_json);
    }

    return normalized;
};

export const createDiagnosticHistory = async (payload = {}, connection = db) => {
    await ensureNetworkDiagnosticTables(connection);

    const normalized = normalizeHistoryPayload(payload);
    const columns = HISTORY_COLUMNS.filter((column) => normalized[column] !== undefined);
    const values = columns.map((column) => normalized[column]);
    const placeholders = columns.map(() => "?").join(", ");

    await connection.query(`
        INSERT INTO network_diagnostic_history (${columns.join(", ")})
        VALUES (${placeholders})
    `, values);

    return getDiagnosticRunByRunId(normalized.run_id, normalized.empresa_id, connection);
};

export const updateDiagnosticHistory = async (runId, empresaId, payload = {}, connection = db) => {
    await ensureNetworkDiagnosticTables(connection);

    const normalized = normalizeHistoryPayload(payload);
    const columns = Object.keys(normalized).filter((column) => UPDATE_COLUMNS.has(column));

    if (!columns.length) {
        return getDiagnosticRunByRunId(runId, empresaId, connection);
    }

    const sets = columns.map((column) => `${column} = ?`).join(", ");
    const values = columns.map((column) => normalized[column]);

    await connection.query(`
        UPDATE network_diagnostic_history
        SET ${sets}
        WHERE run_id = ?
          AND empresa_id = ?
    `, [...values, runId, empresaId]);

    return getDiagnosticRunByRunId(runId, empresaId, connection);
};

export const getDiagnosticRunByRunId = async (runId, empresaId = null, connection = db) => {
    await ensureNetworkDiagnosticTables(connection);

    const params = [runId];
    const empresaFilter = empresaId ? "AND empresa_id = ?" : "";

    if (empresaId) params.push(empresaId);

    const [rows] = await connection.query(`
        SELECT *
        FROM network_diagnostic_history
        WHERE run_id = ?
          ${empresaFilter}
        LIMIT 1
    `, params);

    return rows[0] || null;
};

export const searchDiagnosticHistory = async ({
    empresaId,
    filters = {},
    page = 1,
    limit = 20,
} = {}, connection = db) => {
    await ensureNetworkDiagnosticTables(connection);

    const where = ["empresa_id = ?"];
    const params = [empresaId];

    if (filters.customer) {
        where.push("(customer_name LIKE ? OR customer_id LIKE ? OR contract_id LIKE ? OR pppoe_username LIKE ?)");
        const like = `%${filters.customer}%`;
        params.push(like, like, like, like);
    }

    if (filters.userId) {
        where.push("requested_by_user_id = ?");
        params.push(filters.userId);
    }

    if (filters.user) {
        where.push("requested_by_user_name LIKE ?");
        params.push(`%${filters.user}%`);
    }

    if (filters.status) {
        where.push("status = ?");
        params.push(filters.status);
    }

    if (filters.pop) {
        where.push("pop_name LIKE ?");
        params.push(`%${filters.pop}%`);
    }

    if (filters.result) {
        where.push("(result_status = ? OR conclusion_title LIKE ?)");
        params.push(filters.result, `%${filters.result}%`);
    }

    if (filters.dateFrom) {
        where.push("created_at >= ?");
        params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
        where.push("created_at <= ?");
        params.push(filters.dateTo);
    }

    const offset = (page - 1) * limit;
    const whereSql = where.join(" AND ");
    const [rows] = await connection.query(`
        SELECT *
        FROM network_diagnostic_history
        WHERE ${whereSql}
        ORDER BY created_at DESC, id DESC
        LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const [countRows] = await connection.query(`
        SELECT COUNT(*) AS total
        FROM network_diagnostic_history
        WHERE ${whereSql}
    `, params);

    return {
        rows,
        page,
        limit,
        total: Number(countRows[0]?.total || 0),
    };
};

export const logNetworkDiagnosticAudit = async ({
    empresaId,
    runId = null,
    user = {},
    customerId = null,
    customerIp = null,
    action,
    details = null,
} = {}, connection = db) => {
    if (!empresaId || !action) return;

    try {
        await ensureNetworkDiagnosticTables(connection);
        await connection.query(`
            INSERT INTO network_diagnostic_audit_logs (
                empresa_id,
                run_id,
                user_id,
                user_name,
                customer_id,
                customer_ip,
                action,
                details_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            empresaId,
            runId,
            user?.id || null,
            user?.nome || null,
            customerId,
            customerIp,
            action,
            stringifyJson(details),
        ]);
    } catch (err) {
        console.error("Erro ao registrar auditoria do diagnóstico de rede:", err);
    }
};

export const getNetworkDiagnosticPermissionGrants = async (user = {}, connection = db) => {
    await ensureNetworkDiagnosticTables(connection);

    const [rows] = await connection.query(`
        SELECT subject_type, subject_id, subject_key, permissions_json, access_blocked
        FROM network_diagnostic_permissions
        WHERE empresa_id = ?
          AND (
            (subject_type = 'role' AND subject_key = ?)
            OR (subject_type = 'department' AND subject_id = ?)
            OR (subject_type = 'user' AND subject_id = ?)
          )
        ORDER BY FIELD(subject_type, 'role', 'department', 'user'), id ASC
    `, [
        user.empresa_id,
        user.perfil || "",
        user.setor_id || 0,
        user.id || 0,
    ]);

    return rows;
};

export const serializeDiagnosticHistoryRow = (row = {}) => ({
    id: row.id,
    runId: row.run_id,
    empresaId: row.empresa_id,
    customerId: row.customer_id,
    contractId: row.contract_id,
    customerName: row.customer_name,
    pppoeUsername: row.pppoe_username,
    customerIp: row.customer_ip,
    planName: row.plan_name,
    planDownloadMbps: row.plan_download_mbps === null ? null : Number(row.plan_download_mbps),
    planUploadMbps: row.plan_upload_mbps === null ? null : Number(row.plan_upload_mbps),
    status: row.status,
    resultStatus: row.result_status,
    connectionStatus: row.connection_status,
    downloadCurrentMbps: row.download_current_mbps === null ? null : Number(row.download_current_mbps),
    uploadCurrentMbps: row.upload_current_mbps === null ? null : Number(row.upload_current_mbps),
    downloadPeakMbps: row.download_peak_mbps === null ? null : Number(row.download_peak_mbps),
    uploadPeakMbps: row.upload_peak_mbps === null ? null : Number(row.upload_peak_mbps),
    downloadTestMbps: row.download_test_mbps === null ? null : Number(row.download_test_mbps),
    uploadTestMbps: row.upload_test_mbps === null ? null : Number(row.upload_test_mbps),
    pingMs: row.ping_ms === null ? null : Number(row.ping_ms),
    jitterMs: row.jitter_ms === null ? null : Number(row.jitter_ms),
    packetLossPercent: row.packet_loss_percent === null ? null : Number(row.packet_loss_percent),
    opticalSignalDbm: row.optical_signal_dbm === null ? null : Number(row.optical_signal_dbm),
    onuIdentifier: row.onu_identifier,
    popName: row.pop_name,
    diagnosticSource: row.diagnostic_source,
    conclusionTitle: row.conclusion_title,
    conclusionMessage: row.conclusion_message,
    requestedByUserId: row.requested_by_user_id,
    requestedByUserName: row.requested_by_user_name,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationMs: row.duration_ms,
    errorMessage: row.error_message,
    rawResult: parseJson(row.raw_result_json, null),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});
