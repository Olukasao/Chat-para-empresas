import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Router } from "express";
import multer from "multer";
import db from "../db/db.js";
import authMiddleware from "../middlewares/middleware.js";

const router = Router();
const PERFIL_ADMIN = "admin";
const REQUEST_ID_REGEX = /^[a-zA-Z0-9:_-]{8,120}$/;
const SPIN_UID_REGEX = /^spin_[a-zA-Z0-9-]{8,80}$/;
const PRIZE_TYPES = new Set(["FINANCEIRO", "PRODUTO", "BENEFICIO", "BENEFICIO_INTERNO", "OUTRO"]);
const REDEMPTION_STATUSES = new Set([
    "GANHO",
    "AGUARDANDO_RESGATE",
    "RESGATE_SOLICITADO",
    "EM_PROCESSAMENTO",
    "DISPONIVEL_PARA_RETIRADA",
    "ENTREGUE",
    "PAGO",
    "APLICADO",
    "CANCELADO",
]);
const FINAL_REDEMPTION_STATUSES = ["ENTREGUE", "PAGO", "APLICADO", "CANCELADO"];
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = Number(process.env.ROULETTE_SPIN_RATE_LIMIT_PER_MINUTE || 12);
const DEFAULT_SEED_ENABLED = process.env.ROULETTE_DEFAULT_SEED_ENABLED !== "false";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROULETTE_UPLOAD_ROOT = path.resolve(__dirname, "../../../uploads/roulette");
const ROULETTE_IMAGE_MAX_SIZE_MB = 5;
const ROULETTE_IMAGE_MAX_SIZE_BYTES = ROULETTE_IMAGE_MAX_SIZE_MB * 1024 * 1024;
const ROULETTE_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const spinRateLimitStore = new Map();
let rouletteTablesReadyPromise = null;

const DEFAULT_PRIZES = [
    { name: "R$ 20", publicName: "R$ 20", icon: "R$20", color: "#00d4ff", type: "FINANCEIRO", stock: 30, weight: 50, value: 20 },
    { name: "R$ 50", publicName: "R$ 50", icon: "R$50", color: "#38bdf8", type: "FINANCEIRO", stock: 12, weight: 10, value: 50 },
    { name: "Copo Stanley", publicName: "Copo Stanley", icon: "ST", color: "#f8c76b", type: "PRODUTO", stock: 5, weight: 10, value: 120 },
    { name: "1 mês grátis de mensalidade", publicName: "1 mês grátis", icon: "1M", color: "#22c55e", type: "BENEFICIO", stock: 4, weight: 25, value: 100 },
    { name: "Vale iFood", publicName: "Vale iFood", icon: "IF", color: "#f97316", type: "FINANCEIRO", stock: 8, weight: 8, value: 40 },
    { name: "R$150 no Pix", publicName: "Prêmio Misterioso", icon: "?", color: "#a78bfa", type: "OUTRO", stock: 2, weight: 2, value: 150, mystery: true },
    { name: "R$300", publicName: "Jackpot", icon: "JP", color: "#facc15", type: "FINANCEIRO", stock: 1, weight: 1, value: 300, jackpot: true },
];

const normalizarSegmentoUpload = (valor = "geral") => (
    String(valor || "geral")
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 80)
        || "geral"
);

const normalizarNomeArquivoUpload = (nome = "premio") => {
    const nomeBase = path.basename(String(nome || "premio"));
    const extensao = path.extname(nomeBase).replace(/[^a-zA-Z0-9.]/g, "").slice(0, 24);
    const base = path.basename(nomeBase, path.extname(nomeBase))
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 90)
        || "premio";

    return `${base}${extensao}`;
};

const prizeImageStorage = multer.diskStorage({
    destination: (req, _file, callback) => {
        const destino = path.join(ROULETTE_UPLOAD_ROOT, normalizarSegmentoUpload(req.user?.empresa_id));

        fs.mkdirSync(destino, { recursive: true });
        callback(null, destino);
    },
    filename: (_req, file, callback) => {
        const nomeSeguro = normalizarNomeArquivoUpload(file.originalname || "premio.png");
        callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${nomeSeguro}`);
    },
});

const prizeImageUpload = multer({
    storage: prizeImageStorage,
    limits: {
        fileSize: ROULETTE_IMAGE_MAX_SIZE_BYTES,
        files: 1,
    },
    fileFilter: (_req, file, callback) => {
        const extensao = path.extname(file.originalname || "").toLowerCase();

        if (/^image\//i.test(file.mimetype || "") && ROULETTE_IMAGE_EXTENSIONS.includes(extensao)) {
            callback(null, true);
            return;
        }

        callback(new Error("Envie uma imagem JPG, PNG, WEBP ou GIF."));
    },
});

const uploadPrizeImageMiddleware = (req, res, next) => {
    prizeImageUpload.single("imagem")(req, res, (err) => {
        if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({
                error: `Imagem muito grande. Envie arquivos de até ${ROULETTE_IMAGE_MAX_SIZE_MB} MB.`,
            });
        }

        if (err) {
            console.error("Erro ao processar imagem do prêmio da roleta:", err);
            return res.status(400).json({
                error: err.message || "Não foi possível enviar a imagem do prêmio.",
            });
        }

        return next();
    });
};

const criarTabelasRoleta = async (connection) => {
    await connection.query(`
        CREATE TABLE IF NOT EXISTS roulette_campaigns (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            empresa_id INT NOT NULL,
            name VARCHAR(160) NOT NULL,
            description TEXT NULL,
            rules TEXT NULL,
            starts_at DATETIME NOT NULL,
            ends_at DATETIME NOT NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_by INT NULL,
            updated_by INT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
            FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL,
            FOREIGN KEY (updated_by) REFERENCES usuarios(id) ON DELETE SET NULL,
            INDEX idx_roulette_campaigns_company_active_dates (empresa_id, is_active, starts_at, ends_at),
            INDEX idx_roulette_campaigns_company_created (empresa_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
        CREATE TABLE IF NOT EXISTS roulette_campaign_departments (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            campaign_id INT NOT NULL,
            setor_id INT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (campaign_id) REFERENCES roulette_campaigns(id) ON DELETE CASCADE,
            FOREIGN KEY (setor_id) REFERENCES setores(id) ON DELETE CASCADE,
            UNIQUE KEY unique_roulette_campaign_department (campaign_id, setor_id),
            INDEX idx_roulette_campaign_departments_setor (setor_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
        CREATE TABLE IF NOT EXISTS roulette_prizes (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            empresa_id INT NOT NULL,
            campaign_id INT NOT NULL,
            name VARCHAR(160) NOT NULL,
            public_name VARCHAR(160) NULL,
            real_name VARCHAR(160) NULL,
            description TEXT NULL,
            image_url VARCHAR(500) NULL,
            icon VARCHAR(40) NULL,
            color VARCHAR(24) NULL,
            type VARCHAR(40) NOT NULL DEFAULT 'OUTRO',
            stock INT NULL,
            initial_stock INT NULL,
            weight INT NOT NULL DEFAULT 1,
            estimated_value DECIMAL(12,2) NOT NULL DEFAULT 0,
            is_mystery TINYINT(1) NOT NULL DEFAULT 0,
            is_jackpot TINYINT(1) NOT NULL DEFAULT 0,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_by INT NULL,
            updated_by INT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
            FOREIGN KEY (campaign_id) REFERENCES roulette_campaigns(id) ON DELETE CASCADE,
            FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL,
            FOREIGN KEY (updated_by) REFERENCES usuarios(id) ON DELETE SET NULL,
            INDEX idx_roulette_prizes_campaign_active (campaign_id, is_active, weight),
            INDEX idx_roulette_prizes_company_campaign (empresa_id, campaign_id),
            INDEX idx_roulette_prizes_stock (campaign_id, stock)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
        CREATE TABLE IF NOT EXISTS roulette_user_balances (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            empresa_id INT NOT NULL,
            user_id INT NOT NULL,
            available_spins INT NOT NULL DEFAULT 0,
            total_granted INT NOT NULL DEFAULT 0,
            total_spent INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
            UNIQUE KEY unique_roulette_balance_user (empresa_id, user_id),
            INDEX idx_roulette_balance_company_spins (empresa_id, available_spins)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
        CREATE TABLE IF NOT EXISTS roulette_spin_grants (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            grant_uid VARCHAR(80) NOT NULL,
            empresa_id INT NOT NULL,
            admin_id INT NULL,
            target_type VARCHAR(30) NOT NULL,
            target_user_id INT NULL,
            setor_id INT NULL,
            quantity INT NOT NULL,
            reason VARCHAR(255) NULL,
            total_users INT NOT NULL DEFAULT 0,
            metadata_json LONGTEXT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
            FOREIGN KEY (admin_id) REFERENCES usuarios(id) ON DELETE SET NULL,
            FOREIGN KEY (target_user_id) REFERENCES usuarios(id) ON DELETE SET NULL,
            FOREIGN KEY (setor_id) REFERENCES setores(id) ON DELETE SET NULL,
            UNIQUE KEY unique_roulette_spin_grant_uid (grant_uid),
            INDEX idx_roulette_spin_grants_company_created (empresa_id, created_at),
            INDEX idx_roulette_spin_grants_user_created (target_user_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
        CREATE TABLE IF NOT EXISTS roulette_spin_history (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            spin_uid VARCHAR(80) NOT NULL,
            empresa_id INT NOT NULL,
            user_id INT NOT NULL,
            campaign_id INT NOT NULL,
            prize_id INT NULL,
            request_id VARCHAR(140) NOT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'completed',
            ip VARCHAR(80) NULL,
            user_agent VARCHAR(255) NULL,
            error_message VARCHAR(255) NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
            FOREIGN KEY (campaign_id) REFERENCES roulette_campaigns(id) ON DELETE CASCADE,
            FOREIGN KEY (prize_id) REFERENCES roulette_prizes(id) ON DELETE SET NULL,
            UNIQUE KEY unique_roulette_spin_uid (spin_uid),
            UNIQUE KEY unique_roulette_spin_request (empresa_id, user_id, request_id),
            INDEX idx_roulette_spin_user_created (empresa_id, user_id, created_at),
            INDEX idx_roulette_spin_campaign_created (campaign_id, created_at),
            INDEX idx_roulette_spin_prize_created (prize_id, created_at),
            INDEX idx_roulette_spin_status (empresa_id, status, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
        CREATE TABLE IF NOT EXISTS roulette_redemptions (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            redemption_uid VARCHAR(80) NOT NULL,
            empresa_id INT NOT NULL,
            user_id INT NOT NULL,
            campaign_id INT NOT NULL,
            prize_id INT NOT NULL,
            spin_history_id BIGINT UNSIGNED NOT NULL,
            status VARCHAR(40) NOT NULL DEFAULT 'AGUARDANDO_RESGATE',
            user_note VARCHAR(500) NULL,
            admin_note VARCHAR(500) NULL,
            requested_at DATETIME NULL,
            processed_at DATETIME NULL,
            delivered_at DATETIME NULL,
            updated_by INT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
            FOREIGN KEY (campaign_id) REFERENCES roulette_campaigns(id) ON DELETE CASCADE,
            FOREIGN KEY (prize_id) REFERENCES roulette_prizes(id) ON DELETE CASCADE,
            FOREIGN KEY (spin_history_id) REFERENCES roulette_spin_history(id) ON DELETE CASCADE,
            FOREIGN KEY (updated_by) REFERENCES usuarios(id) ON DELETE SET NULL,
            UNIQUE KEY unique_roulette_redemption_uid (redemption_uid),
            UNIQUE KEY unique_roulette_redemption_spin (spin_history_id),
            INDEX idx_roulette_redemptions_user_created (empresa_id, user_id, created_at),
            INDEX idx_roulette_redemptions_status (empresa_id, status, created_at),
            INDEX idx_roulette_redemptions_campaign (campaign_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
        CREATE TABLE IF NOT EXISTS roulette_admin_logs (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            empresa_id INT NOT NULL,
            admin_id INT NULL,
            action VARCHAR(100) NOT NULL,
            entity VARCHAR(80) NOT NULL,
            entity_id VARCHAR(120) NULL,
            before_json LONGTEXT NULL,
            after_json LONGTEXT NULL,
            metadata_json LONGTEXT NULL,
            ip VARCHAR(80) NULL,
            user_agent VARCHAR(255) NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
            FOREIGN KEY (admin_id) REFERENCES usuarios(id) ON DELETE SET NULL,
            INDEX idx_roulette_admin_logs_company_created (empresa_id, created_at),
            INDEX idx_roulette_admin_logs_admin_created (admin_id, created_at),
            INDEX idx_roulette_admin_logs_entity (entity, entity_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
        CREATE TABLE IF NOT EXISTS roulette_notifications (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            empresa_id INT NOT NULL,
            user_id INT NOT NULL,
            type VARCHAR(60) NOT NULL,
            title VARCHAR(180) NOT NULL,
            message VARCHAR(500) NULL,
            metadata_json LONGTEXT NULL,
            read_at DATETIME NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
            INDEX idx_roulette_notifications_user_read (user_id, read_at, created_at),
            INDEX idx_roulette_notifications_company_created (empresa_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
};

const garantirTabelasRoleta = async () => {
    if (!rouletteTablesReadyPromise) {
        rouletteTablesReadyPromise = criarTabelasRoleta(db).catch((err) => {
            rouletteTablesReadyPromise = null;
            throw err;
        });
    }

    await rouletteTablesReadyPromise;
};

const serializarJson = (valor) => {
    if (valor === undefined || valor === null) return null;

    try {
        return JSON.stringify(valor);
    } catch {
        return String(valor);
    }
};

const parseJson = (valor, fallback = null) => {
    if (!valor) return fallback;
    if (typeof valor !== "string") return valor;

    try {
        return JSON.parse(valor);
    } catch {
        return fallback;
    }
};

const limitarTexto = (valor = "", limite = 255) => (
    String(valor ?? "").trim().replace(/\s+/g, " ").slice(0, limite)
);

const normalizarBoolean = (valor) => (
    valor === true || valor === 1 || valor === "1" || valor === "true" || valor === "on"
);

const normalizarInteiro = (valor, { min = 0, max = 1_000_000, nullable = false } = {}) => {
    if ((valor === "" || valor === null || valor === undefined) && nullable) {
        return null;
    }

    const numero = Number(valor);

    if (!Number.isInteger(numero) || numero < min || numero > max) {
        return null;
    }

    return numero;
};

const normalizarDecimal = (valor, fallback = 0) => {
    if (valor === "" || valor === null || valor === undefined) return fallback;

    const numero = Number(valor);
    if (!Number.isFinite(numero) || numero < 0) return fallback;

    return Math.round(numero * 100) / 100;
};

const normalizarTipoPremio = (valor = "OUTRO") => {
    const normalizado = String(valor || "OUTRO")
        .trim()
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "_");

    return PRIZE_TYPES.has(normalizado) ? normalizado : "OUTRO";
};

const normalizarStatusResgate = (valor = "") => {
    const normalizado = String(valor || "")
        .trim()
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "_");

    return REDEMPTION_STATUSES.has(normalizado) ? normalizado : "";
};

const normalizarDataSql = (valor, fimDoDia = false) => {
    const texto = String(valor || "").trim();

    if (!texto) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
        return `${texto} ${fimDoDia ? "23:59:59" : "00:00:00"}`;
    }
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(texto)) {
        return texto.replace("T", " ").slice(0, 19);
    }
    if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/.test(texto)) {
        return texto.slice(0, 19);
    }

    return "";
};

const dataSqlParaInput = (valor) => {
    if (!valor) return "";
    const texto = String(valor);
    return texto.replace("T", " ").slice(0, 16).replace(" ", "T");
};

const formatarDataSqlLocal = (date) => {
    const pad = (numero) => String(numero).padStart(2, "0");

    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
    ].join("-") + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const obterPeriodoMesAtual = () => {
    const agora = new Date();
    const inicio = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0);
    const fim = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59);

    return {
        inicio: formatarDataSqlLocal(inicio),
        fim: formatarDataSqlLocal(fim),
    };
};

const validarRequestId = (valor = "") => {
    const requestId = limitarTexto(valor, 120);
    return REQUEST_ID_REGEX.test(requestId) ? requestId : "";
};

const getRequestId = (req) => (
    validarRequestId(req.body?.request_id || req.headers["idempotency-key"] || req.headers["x-idempotency-key"])
);

const getClientIp = (req) => {
    const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    return forwarded || req.ip || null;
};

const criarSpinUid = () => `spin_${crypto.randomUUID()}`;
const criarGrantUid = () => `grant_${crypto.randomUUID()}`;
const criarRedemptionUid = () => `redeem_${crypto.randomUUID()}`;

const isDuplicateEntryError = (err) => (
    err?.code === "ER_DUP_ENTRY" || err?.errno === 1062
);

const criarErroHttp = (statusCode, message, code = "roulette.error") => {
    const err = new Error(message);
    err.statusCode = statusCode;
    err.publicCode = code;
    return err;
};

const limparRateLimitAntigo = () => {
    const now = Date.now();

    spinRateLimitStore.forEach((entry, key) => {
        if (now > entry.resetAt + RATE_LIMIT_WINDOW_MS) {
            spinRateLimitStore.delete(key);
        }
    });
};

const rouletteSpinRateLimit = (req, res, next) => {
    limparRateLimitAntigo();

    const key = `${req.user?.id || req.ip}:roulette-spin`;
    const now = Date.now();
    const current = spinRateLimitStore.get(key);

    if (!current || now > current.resetAt) {
        spinRateLimitStore.set(key, {
            count: 1,
            resetAt: now + RATE_LIMIT_WINDOW_MS,
        });
        return next();
    }

    current.count += 1;

    if (current.count > RATE_LIMIT_MAX) {
        return res.status(429).json({
            error: "Muitas tentativas de giro. Aguarde alguns instantes.",
            code: "roulette.rate_limited",
            retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000),
        });
    }

    return next();
};

const requireRouletteAdmin = (req, res, next) => {
    if (req.user?.perfil !== PERFIL_ADMIN) {
        return res.status(403).json({ error: "Acesso restrito ao administrador." });
    }

    req.admin = req.user;
    return next();
};

const registrarAdminLog = async (connection, req, {
    action,
    entity,
    entityId = null,
    before = null,
    after = null,
    metadata = null,
}) => {
    await connection.query(`
        INSERT INTO roulette_admin_logs (
            empresa_id,
            admin_id,
            action,
            entity,
            entity_id,
            before_json,
            after_json,
            metadata_json,
            ip,
            user_agent
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        req.user.empresa_id,
        req.user.id,
        limitarTexto(action, 100).toUpperCase(),
        limitarTexto(entity, 80).toLowerCase(),
        entityId === null || entityId === undefined ? null : String(entityId),
        serializarJson(before),
        serializarJson(after),
        serializarJson(metadata),
        getClientIp(req),
        limitarTexto(req.get("user-agent") || "", 255) || null,
    ]);
};

const garantirCampanhaPadraoRoleta = async (empresaId) => {
    if (!DEFAULT_SEED_ENABLED) return;

    const [existentes] = await db.query(`
        SELECT id
        FROM roulette_campaigns
        WHERE empresa_id = ?
        LIMIT 1
    `, [empresaId]);

    if (existentes.length) return;

    const { inicio, fim } = obterPeriodoMesAtual();

    const [campaignResult] = await db.query(`
        INSERT INTO roulette_campaigns (
            empresa_id,
            name,
            description,
            rules,
            starts_at,
            ends_at,
            is_active
        )
        VALUES (?, ?, ?, ?, ?, ?, 1)
    `, [
        empresaId,
        "ROLETA DE PRÊMIOS",
        "Campanha inicial criada automaticamente para a roleta.",
        "Cada giro consome 1 saldo disponível. Prêmios com estoque esgotado deixam de participar do sorteio.",
        inicio,
        fim,
    ]);

    const campaignId = campaignResult.insertId;
    const values = DEFAULT_PRIZES.map((prize) => [
        empresaId,
        campaignId,
        prize.name,
        prize.publicName,
        prize.name,
        prize.mystery ? "O prêmio real será revelado somente ao vencedor." : "",
        null,
        prize.icon,
        prize.color,
        prize.type,
        prize.stock,
        prize.stock,
        prize.weight,
        prize.value,
        prize.mystery ? 1 : 0,
        prize.jackpot ? 1 : 0,
        1,
    ]);

    await db.query(`
        INSERT INTO roulette_prizes (
            empresa_id,
            campaign_id,
            name,
            public_name,
            real_name,
            description,
            image_url,
            icon,
            color,
            type,
            stock,
            initial_stock,
            weight,
            estimated_value,
            is_mystery,
            is_jackpot,
            is_active
        )
        VALUES ?
    `, [values]);
};

const serializarCampanha = (campaign = {}) => ({
    id: campaign.id,
    empresa_id: campaign.empresa_id,
    name: campaign.name,
    description: campaign.description || "",
    rules: campaign.rules || "",
    starts_at: campaign.starts_at,
    ends_at: campaign.ends_at,
    starts_at_input: dataSqlParaInput(campaign.starts_at),
    ends_at_input: dataSqlParaInput(campaign.ends_at),
    is_active: Boolean(campaign.is_active),
    department_ids: Array.isArray(campaign.department_ids) ? campaign.department_ids : [],
    departments: Array.isArray(campaign.departments) ? campaign.departments : [],
    created_at: campaign.created_at,
    updated_at: campaign.updated_at,
});

const serializarPremioUsuario = (prize = {}, { reveal = false } = {}) => {
    const isMystery = Boolean(prize.is_mystery);
    const publicName = prize.public_name || (isMystery ? "Prêmio Misterioso" : prize.name);
    const realName = prize.real_name || prize.name;
    const visibleName = isMystery && !reveal ? publicName : realName;

    return {
        id: prize.id,
        campaign_id: prize.campaign_id,
        name: visibleName,
        public_name: publicName,
        result_name: reveal ? realName : visibleName,
        description: isMystery && !reveal
            ? "O conteúdo real será revelado se você ganhar."
            : (prize.description || ""),
        image_url: prize.image_url || null,
        icon: isMystery && !reveal ? "?" : (prize.icon || ""),
        color: prize.color || "#00d4ff",
        type: prize.type || "OUTRO",
        is_mystery: isMystery,
        is_jackpot: Boolean(prize.is_jackpot),
    };
};

const calcularProbabilidades = (prizes = []) => {
    const totalWeight = prizes
        .filter((prize) => Boolean(prize.is_active) && Number(prize.weight) > 0 && (prize.stock === null || Number(prize.stock) > 0))
        .reduce((total, prize) => total + Number(prize.weight || 0), 0);

    return prizes.map((prize) => {
        const valido = Boolean(prize.is_active)
            && Number(prize.weight) > 0
            && (prize.stock === null || Number(prize.stock) > 0);
        const probability = valido && totalWeight > 0
            ? (Number(prize.weight || 0) / totalWeight) * 100
            : 0;

        return {
            ...prize,
            probability,
            probability_label: `${probability.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            })}%`,
            participates_in_draw: valido,
        };
    });
};

const serializarPremioAdmin = (prize = {}) => ({
    id: prize.id,
    empresa_id: prize.empresa_id,
    campaign_id: prize.campaign_id,
    campaign_name: prize.campaign_name || "",
    name: prize.name,
    public_name: prize.public_name || "",
    real_name: prize.real_name || prize.name,
    description: prize.description || "",
    image_url: prize.image_url || "",
    icon: prize.icon || "",
    color: prize.color || "#00d4ff",
    type: prize.type || "OUTRO",
    stock: prize.stock,
    initial_stock: prize.initial_stock,
    weight: Number(prize.weight || 0),
    estimated_value: Number(prize.estimated_value || 0),
    is_mystery: Boolean(prize.is_mystery),
    is_jackpot: Boolean(prize.is_jackpot),
    is_active: Boolean(prize.is_active),
    probability: Number(prize.probability || 0),
    probability_label: prize.probability_label || "0,00%",
    participates_in_draw: Boolean(prize.participates_in_draw),
    created_at: prize.created_at,
    updated_at: prize.updated_at,
});

const serializarResgate = (row = {}) => ({
    id: row.id,
    redemption_uid: row.redemption_uid,
    spin_uid: row.spin_uid || null,
    user_id: row.user_id,
    user_name: row.user_name || "",
    user_email: row.user_email || "",
    setor_nome: row.setor_nome || "",
    campaign_id: row.campaign_id,
    campaign_name: row.campaign_name || "",
    prize_id: row.prize_id,
    prize: serializarPremioUsuario({
        id: row.prize_id,
        campaign_id: row.campaign_id,
        name: row.prize_name,
        public_name: row.prize_public_name,
        real_name: row.prize_real_name,
        description: row.prize_description,
        image_url: row.prize_image_url,
        icon: row.prize_icon,
        color: row.prize_color,
        type: row.prize_type,
        is_mystery: row.prize_is_mystery,
        is_jackpot: row.prize_is_jackpot,
    }, { reveal: true }),
    status: row.status,
    user_note: row.user_note || "",
    admin_note: row.admin_note || "",
    requested_at: row.requested_at,
    processed_at: row.processed_at,
    delivered_at: row.delivered_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
});

const montarSelectResgates = () => `
    SELECT
        r.*,
        h.spin_uid,
        u.nome AS user_name,
        u.email AS user_email,
        s.nome AS setor_nome,
        c.name AS campaign_name,
        p.name AS prize_name,
        p.public_name AS prize_public_name,
        p.real_name AS prize_real_name,
        p.description AS prize_description,
        p.image_url AS prize_image_url,
        p.icon AS prize_icon,
        p.color AS prize_color,
        p.type AS prize_type,
        p.is_mystery AS prize_is_mystery,
        p.is_jackpot AS prize_is_jackpot
    FROM roulette_redemptions r
    JOIN roulette_spin_history h ON h.id = r.spin_history_id
    JOIN usuarios u ON u.id = r.user_id
    LEFT JOIN setores s ON s.id = u.setor_id
    JOIN roulette_campaigns c ON c.id = r.campaign_id
    JOIN roulette_prizes p ON p.id = r.prize_id
`;

const buscarCampanhaAtivaUsuario = async (connection, usuario) => {
    const [campaigns] = await connection.query(`
        SELECT c.*
        FROM roulette_campaigns c
        WHERE c.empresa_id = ?
          AND c.is_active = 1
          AND c.starts_at <= NOW()
          AND c.ends_at >= NOW()
          AND (
            NOT EXISTS (
                SELECT 1
                FROM roulette_campaign_departments cd
                WHERE cd.campaign_id = c.id
            )
            OR EXISTS (
                SELECT 1
                FROM roulette_campaign_departments cd
                WHERE cd.campaign_id = c.id
                  AND cd.setor_id = ?
            )
          )
        ORDER BY c.starts_at DESC, c.id DESC
        LIMIT 1
    `, [usuario.empresa_id, usuario.setor_id || 0]);

    return campaigns[0] || null;
};

const listarPremiosValidosCampanha = async (connection, campaignId, { lock = false } = {}) => {
    const [prizes] = await connection.query(`
        SELECT *
        FROM roulette_prizes
        WHERE campaign_id = ?
          AND is_active = 1
          AND weight > 0
          AND (stock IS NULL OR stock > 0)
        ORDER BY id ASC
        ${lock ? "FOR UPDATE" : ""}
    `, [campaignId]);

    return prizes;
};

const escolherPremioPonderado = (prizes = []) => {
    const totalWeight = prizes.reduce((total, prize) => total + Number(prize.weight || 0), 0);

    if (!prizes.length || totalWeight <= 0) {
        throw criarErroHttp(409, "Todos os prêmios desta campanha foram distribuídos.", "roulette.no_prizes");
    }

    const ticket = crypto.randomInt(1, totalWeight + 1);
    let acumulado = 0;

    for (const prize of prizes) {
        acumulado += Number(prize.weight || 0);
        if (ticket <= acumulado) {
            return prize;
        }
    }

    return prizes[prizes.length - 1];
};

const buscarSaldoUsuario = async (connection, empresaId, userId, { lock = false, create = false } = {}) => {
    if (create) {
        await connection.query(`
            INSERT INTO roulette_user_balances (empresa_id, user_id, available_spins, total_granted, total_spent)
            VALUES (?, ?, 0, 0, 0)
            ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)
        `, [empresaId, userId]);
    }

    const [rows] = await connection.query(`
        SELECT *
        FROM roulette_user_balances
        WHERE empresa_id = ?
          AND user_id = ?
        LIMIT 1
        ${lock ? "FOR UPDATE" : ""}
    `, [empresaId, userId]);

    return rows[0] || {
        empresa_id: empresaId,
        user_id: userId,
        available_spins: 0,
        total_granted: 0,
        total_spent: 0,
    };
};

const criarNotificacoes = async (connection, {
    empresaId,
    userIds = [],
    type,
    title,
    message = "",
    metadata = null,
}) => {
    const uniqueUserIds = [...new Set(userIds.map(Number).filter(Boolean))];

    if (!uniqueUserIds.length) return [];

    const rows = uniqueUserIds.map((userId) => [
        empresaId,
        userId,
        limitarTexto(type, 60),
        limitarTexto(title, 180),
        limitarTexto(message, 500),
        serializarJson(metadata),
    ]);

    await connection.query(`
        INSERT INTO roulette_notifications (
            empresa_id,
            user_id,
            type,
            title,
            message,
            metadata_json
        )
        VALUES ?
    `, [rows]);

    return uniqueUserIds.map((userId) => ({
        userId,
        type,
        title,
        message,
        metadata,
        created_at: new Date().toISOString(),
    }));
};

const emitirNotificacoes = (req, notifications = []) => {
    const io = req.app?.get?.("io");

    if (!io) return;

    notifications.forEach((notification) => {
        io.to(`user_${notification.userId}`).emit("roulette_notification", {
            type: notification.type,
            title: notification.title,
            message: notification.message,
            metadata: notification.metadata || null,
            created_at: notification.created_at,
        });
    });
};

const montarSpinResponsePorHistoryId = async (connection, empresaId, historyId) => {
    const [rows] = await connection.query(`
        SELECT
            h.id AS history_id,
            h.spin_uid,
            h.request_id,
            h.status,
            h.created_at,
            c.id AS campaign_id,
            c.name AS campaign_name,
            p.*,
            r.id AS redemption_id,
            r.redemption_uid,
            r.status AS redemption_status
        FROM roulette_spin_history h
        JOIN roulette_campaigns c ON c.id = h.campaign_id
        JOIN roulette_prizes p ON p.id = h.prize_id
        LEFT JOIN roulette_redemptions r ON r.spin_history_id = h.id
        WHERE h.empresa_id = ?
          AND h.id = ?
        LIMIT 1
    `, [empresaId, historyId]);

    if (!rows.length) return null;

    const row = rows[0];

    return {
        spinId: row.spin_uid,
        spin_uid: row.spin_uid,
        request_id: row.request_id,
        prizeId: row.id,
        prize_id: row.id,
        campaign: {
            id: row.campaign_id,
            name: row.campaign_name,
        },
        prize: serializarPremioUsuario(row, { reveal: true }),
        redemption: row.redemption_id
            ? {
                id: row.redemption_id,
                redemption_uid: row.redemption_uid,
                status: row.redemption_status,
            }
            : null,
        status: row.status,
        created_at: row.created_at,
    };
};

const buscarSpinPorRequestId = async (connection, usuario, requestId) => {
    const [rows] = await connection.query(`
        SELECT id
        FROM roulette_spin_history
        WHERE empresa_id = ?
          AND user_id = ?
          AND request_id = ?
        LIMIT 1
    `, [usuario.empresa_id, usuario.id, requestId]);

    if (!rows.length) return null;

    return montarSpinResponsePorHistoryId(connection, usuario.empresa_id, rows[0].id);
};

const listarUltimosGanhadores = async (empresaId) => {
    const [rows] = await db.query(`
        SELECT
            h.spin_uid,
            h.created_at,
            u.nome AS user_name,
            p.name,
            p.public_name,
            p.real_name,
            p.icon,
            p.color,
            p.type,
            p.is_mystery,
            p.is_jackpot,
            p.campaign_id,
            p.image_url,
            p.description
        FROM roulette_spin_history h
        JOIN usuarios u ON u.id = h.user_id
        JOIN roulette_prizes p ON p.id = h.prize_id
        WHERE h.empresa_id = ?
          AND h.status = 'completed'
        ORDER BY h.created_at DESC, h.id DESC
        LIMIT 14
    `, [empresaId]);

    return rows.map((row) => ({
        spin_uid: row.spin_uid,
        created_at: row.created_at,
        user_name: row.user_name,
        prize_name: row.is_mystery ? (row.public_name || "Prêmio Misterioso") : (row.public_name || row.name),
        prize: serializarPremioUsuario(row, { reveal: false }),
    }));
};

const listarNotificacoesUsuario = async (empresaId, userId) => {
    const [rows] = await db.query(`
        SELECT id, type, title, message, metadata_json, read_at, created_at
        FROM roulette_notifications
        WHERE empresa_id = ?
          AND user_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 50
    `, [empresaId, userId]);

    return rows.map((row) => ({
        ...row,
        metadata: parseJson(row.metadata_json, null),
        read: Boolean(row.read_at),
        metadata_json: undefined,
    }));
};

const obterDepartmentIdsCampanha = async (connection, campaignId) => {
    const [rows] = await connection.query(`
        SELECT cd.setor_id AS id, s.nome
        FROM roulette_campaign_departments cd
        JOIN setores s ON s.id = cd.setor_id
        WHERE cd.campaign_id = ?
        ORDER BY s.nome ASC
    `, [campaignId]);

    return {
        departmentIds: rows.map((row) => Number(row.id)),
        departments: rows.map((row) => ({ id: row.id, nome: row.nome })),
    };
};

const normalizarDepartmentIds = (valor) => (
    Array.isArray(valor)
        ? [...new Set(valor.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
        : []
);

const validarSetoresEmpresa = async (connection, empresaId, departmentIds = []) => {
    if (!departmentIds.length) return [];

    const [rows] = await connection.query(`
        SELECT id
        FROM setores
        WHERE empresa_id = ?
          AND id IN (?)
    `, [empresaId, departmentIds]);

    const validIds = rows.map((row) => Number(row.id));

    if (validIds.length !== departmentIds.length) {
        throw criarErroHttp(400, "Há setores inválidos para esta empresa.", "roulette.invalid_department");
    }

    return validIds;
};

const buscarCampanhaAdmin = async (connection, empresaId, campaignId) => {
    const [rows] = await connection.query(`
        SELECT *
        FROM roulette_campaigns
        WHERE id = ?
          AND empresa_id = ?
        LIMIT 1
    `, [campaignId, empresaId]);

    if (!rows.length) return null;

    const { departmentIds, departments } = await obterDepartmentIdsCampanha(connection, campaignId);

    return {
        ...rows[0],
        department_ids: departmentIds,
        departments,
    };
};

const montarPayloadCampanha = (body = {}) => {
    const name = limitarTexto(body.name || body.nome, 160);
    const description = limitarTexto(body.description || body.descricao || "", 2000);
    const rules = limitarTexto(body.rules || body.regras || "", 4000);
    const startsAt = normalizarDataSql(body.starts_at || body.inicio, false);
    const endsAt = normalizarDataSql(body.ends_at || body.fim, true);

    if (name.length < 3) {
        throw criarErroHttp(400, "Informe um nome de campanha com pelo menos 3 caracteres.", "roulette.invalid_campaign_name");
    }

    if (!startsAt || !endsAt) {
        throw criarErroHttp(400, "Informe datas válidas para início e fim da campanha.", "roulette.invalid_campaign_dates");
    }

    if (new Date(startsAt.replace(" ", "T")) > new Date(endsAt.replace(" ", "T"))) {
        throw criarErroHttp(400, "A data de início não pode ser maior que a data de fim.", "roulette.invalid_campaign_period");
    }

    return {
        name,
        description,
        rules,
        startsAt,
        endsAt,
        isActive: body.is_active === undefined ? true : normalizarBoolean(body.is_active),
        departmentIds: normalizarDepartmentIds(body.department_ids || body.setor_ids),
    };
};

const montarPayloadPremio = (body = {}) => {
    const campaignId = Number(body.campaign_id);
    const name = limitarTexto(body.name || body.nome, 160);
    const publicName = limitarTexto(body.public_name || body.nome_publico || "", 160);
    const realName = limitarTexto(body.real_name || body.premio_real || "", 160);
    const stock = normalizarInteiro(body.stock, { min: 0, nullable: true });
    const initialStock = normalizarInteiro(body.initial_stock, { min: 0, nullable: true });
    const weight = normalizarInteiro(body.weight, { min: 0, max: 1_000_000 });

    if (!Number.isInteger(campaignId) || campaignId <= 0) {
        throw criarErroHttp(400, "Campanha inválida.", "roulette.invalid_campaign");
    }

    if (name.length < 2) {
        throw criarErroHttp(400, "Informe um nome de prêmio com pelo menos 2 caracteres.", "roulette.invalid_prize_name");
    }

    if (stock === null && body.stock !== "" && body.stock !== null && body.stock !== undefined) {
        throw criarErroHttp(400, "Estoque inválido.", "roulette.invalid_stock");
    }

    if (weight === null) {
        throw criarErroHttp(400, "Peso inválido.", "roulette.invalid_weight");
    }

    return {
        campaignId,
        name,
        publicName: publicName || name,
        realName: realName || name,
        description: limitarTexto(body.description || body.descricao || "", 4000),
        imageUrl: limitarTexto(body.image_url || body.imagem || "", 500),
        icon: limitarTexto(body.icon || body.icone || "", 40),
        color: /^#[0-9a-fA-F]{6}$/.test(String(body.color || "")) ? String(body.color) : "#00d4ff",
        type: normalizarTipoPremio(body.type || body.tipo),
        stock,
        initialStock: initialStock ?? stock,
        weight,
        estimatedValue: normalizarDecimal(body.estimated_value || body.valor_estimado, 0),
        isMystery: normalizarBoolean(body.is_mystery),
        isJackpot: normalizarBoolean(body.is_jackpot),
        isActive: body.is_active === undefined ? true : normalizarBoolean(body.is_active),
    };
};

const listarCampanhasAdmin = async (empresaId) => {
    const [campaigns] = await db.query(`
        SELECT
            c.*,
            (SELECT COUNT(*) FROM roulette_prizes p WHERE p.campaign_id = c.id) AS total_prizes,
            (SELECT COUNT(*) FROM roulette_spin_history h WHERE h.campaign_id = c.id AND h.status = 'completed') AS total_spins
        FROM roulette_campaigns c
        WHERE c.empresa_id = ?
        ORDER BY c.starts_at DESC, c.id DESC
    `, [empresaId]);

    const departmentRows = campaigns.length
        ? await db.query(`
            SELECT cd.campaign_id, s.id, s.nome
            FROM roulette_campaign_departments cd
            JOIN setores s ON s.id = cd.setor_id
            WHERE cd.campaign_id IN (?)
            ORDER BY s.nome ASC
        `, [campaigns.map((campaign) => campaign.id)])
        : [[]];
    const departmentsByCampaign = new Map();

    departmentRows[0].forEach((row) => {
        const list = departmentsByCampaign.get(Number(row.campaign_id)) || [];
        list.push({ id: row.id, nome: row.nome });
        departmentsByCampaign.set(Number(row.campaign_id), list);
    });

    return campaigns.map((campaign) => serializarCampanha({
        ...campaign,
        departments: departmentsByCampaign.get(Number(campaign.id)) || [],
        department_ids: (departmentsByCampaign.get(Number(campaign.id)) || []).map((department) => Number(department.id)),
    }));
};

const listarPremiosAdmin = async (empresaId, campaignId = null) => {
    const params = [empresaId];
    let filtroCampanha = "";

    if (campaignId) {
        filtroCampanha = "AND p.campaign_id = ?";
        params.push(campaignId);
    }

    const [rows] = await db.query(`
        SELECT p.*, c.name AS campaign_name
        FROM roulette_prizes p
        JOIN roulette_campaigns c ON c.id = p.campaign_id
        WHERE p.empresa_id = ?
          ${filtroCampanha}
        ORDER BY c.starts_at DESC, p.id ASC
    `, params);

    const rowsByCampaign = new Map();

    rows.forEach((row) => {
        const list = rowsByCampaign.get(Number(row.campaign_id)) || [];
        list.push(row);
        rowsByCampaign.set(Number(row.campaign_id), list);
    });

    const withProbabilities = [];
    rowsByCampaign.forEach((items) => {
        withProbabilities.push(...calcularProbabilidades(items));
    });

    return withProbabilities.map(serializarPremioAdmin);
};

const buscarPremioAdmin = async (connection, empresaId, prizeId) => {
    const [rows] = await connection.query(`
        SELECT p.*, c.name AS campaign_name
        FROM roulette_prizes p
        JOIN roulette_campaigns c ON c.id = p.campaign_id
        WHERE p.id = ?
          AND p.empresa_id = ?
        LIMIT 1
    `, [prizeId, empresaId]);

    return rows[0] || null;
};

const listarUsuariosEmpresa = async (empresaId) => {
    const [rows] = await db.query(`
        SELECT u.id, u.nome, u.email, u.avatar, u.perfil, u.setor_id, s.nome AS setor_nome,
               COALESCE(b.available_spins, 0) AS available_spins
        FROM usuarios u
        LEFT JOIN setores s ON s.id = u.setor_id
        LEFT JOIN roulette_user_balances b ON b.user_id = u.id AND b.empresa_id = u.empresa_id
        WHERE u.empresa_id = ?
          AND u.deletado_em IS NULL
        ORDER BY u.nome ASC
    `, [empresaId]);

    return rows;
};

const listarSetoresEmpresa = async (empresaId) => {
    const [rows] = await db.query(`
        SELECT id, nome
        FROM setores
        WHERE empresa_id = ?
        ORDER BY nome ASC
    `, [empresaId]);

    return rows;
};

const listarUsuariosPorAlvoGrant = async (connection, req, { targetType, targetUserId, setorId }) => {
    if (targetType === "user") {
        const [rows] = await connection.query(`
            SELECT id, nome, email, setor_id
            FROM usuarios
            WHERE id = ?
              AND empresa_id = ?
              AND deletado_em IS NULL
            LIMIT 1
        `, [targetUserId, req.user.empresa_id]);

        if (!rows.length) {
            throw criarErroHttp(404, "Funcionário não encontrado.", "roulette.user_not_found");
        }

        return rows;
    }

    if (targetType === "department") {
        const [setores] = await connection.query(`
            SELECT id
            FROM setores
            WHERE id = ?
              AND empresa_id = ?
            LIMIT 1
        `, [setorId, req.user.empresa_id]);

        if (!setores.length) {
            throw criarErroHttp(400, "Setor inválido.", "roulette.invalid_department");
        }

        const [rows] = await connection.query(`
            SELECT id, nome, email, setor_id
            FROM usuarios
            WHERE empresa_id = ?
              AND setor_id = ?
              AND deletado_em IS NULL
            ORDER BY nome ASC
        `, [req.user.empresa_id, setorId]);

        return rows;
    }

    const [rows] = await connection.query(`
        SELECT id, nome, email, setor_id
        FROM usuarios
        WHERE empresa_id = ?
          AND deletado_em IS NULL
        ORDER BY nome ASC
    `, [req.user.empresa_id]);

    return rows;
};

router.use(authMiddleware);

router.get("/state", async (req, res) => {
    try {
        await garantirTabelasRoleta();
        await garantirCampanhaPadraoRoleta(req.user.empresa_id);

        const campaign = await buscarCampanhaAtivaUsuario(db, req.user);
        const balance = await buscarSaldoUsuario(db, req.user.empresa_id, req.user.id);
        const prizes = campaign
            ? await listarPremiosValidosCampanha(db, campaign.id)
            : [];
        const [latestWinners, notifications] = await Promise.all([
            listarUltimosGanhadores(req.user.empresa_id),
            listarNotificacoesUsuario(req.user.empresa_id, req.user.id),
        ]);

        res.json({
            user: req.user,
            balance: {
                available_spins: Number(balance.available_spins || 0),
                total_granted: Number(balance.total_granted || 0),
                total_spent: Number(balance.total_spent || 0),
            },
            campaign: campaign ? serializarCampanha(campaign) : null,
            prizes: prizes.map((prize) => serializarPremioUsuario(prize, { reveal: false })),
            latest_winners: latestWinners,
            notifications,
        });
    } catch (err) {
        console.error("roulette.state.failed", err);
        res.status(500).json({ error: "Erro ao carregar a roleta de prêmios." });
    }
});

router.post("/spin", rouletteSpinRateLimit, async (req, res) => {
    await garantirTabelasRoleta();
    await garantirCampanhaPadraoRoleta(req.user.empresa_id);

    const requestId = getRequestId(req);

    if (!requestId) {
        return res.status(400).json({
            error: "Identificador do giro ausente ou inválido.",
            code: "roulette.invalid_request_id",
        });
    }

    const idempotentSpin = await buscarSpinPorRequestId(db, req.user, requestId);

    if (idempotentSpin) {
        return res.json({ ...idempotentSpin, idempotent: true });
    }

    const connection = await db.getConnection();
    const notificationsToEmit = [];

    try {
        console.info("roulette.spin.started", {
            user_id: req.user.id,
            empresa_id: req.user.empresa_id,
            request_id: requestId,
        });

        await connection.beginTransaction();

        const duplicatedInsideTx = await buscarSpinPorRequestId(connection, req.user, requestId);
        if (duplicatedInsideTx) {
            await connection.commit();
            return res.json({ ...duplicatedInsideTx, idempotent: true });
        }

        const [users] = await connection.query(`
            SELECT id, nome, email, empresa_id, setor_id, perfil
            FROM usuarios
            WHERE id = ?
              AND empresa_id = ?
              AND deletado_em IS NULL
            LIMIT 1
            FOR UPDATE
        `, [req.user.id, req.user.empresa_id]);

        if (!users.length) {
            throw criarErroHttp(401, "Usuário inválido.", "roulette.invalid_user");
        }

        const usuario = users[0];
        const duplicatedAfterUserLock = await buscarSpinPorRequestId(connection, usuario, requestId);
        if (duplicatedAfterUserLock) {
            await connection.commit();
            return res.json({ ...duplicatedAfterUserLock, idempotent: true });
        }

        const campaign = await buscarCampanhaAtivaUsuario(connection, usuario);

        if (!campaign) {
            throw criarErroHttp(409, "Nenhuma campanha ativa no momento.", "roulette.no_campaign");
        }

        const balance = await buscarSaldoUsuario(connection, usuario.empresa_id, usuario.id, {
            lock: true,
            create: true,
        });

        if (Number(balance.available_spins || 0) <= 0) {
            throw criarErroHttp(409, "Você não possui giros disponíveis.", "roulette.no_spins");
        }

        const prizes = await listarPremiosValidosCampanha(connection, campaign.id, { lock: true });
        const selectedPrize = escolherPremioPonderado(prizes);
        const spinUid = criarSpinUid();

        const [historyResult] = await connection.query(`
            INSERT INTO roulette_spin_history (
                spin_uid,
                empresa_id,
                user_id,
                campaign_id,
                prize_id,
                request_id,
                status,
                ip,
                user_agent
            )
            VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?)
        `, [
            spinUid,
            usuario.empresa_id,
            usuario.id,
            campaign.id,
            selectedPrize.id,
            requestId,
            getClientIp(req),
            limitarTexto(req.get("user-agent") || "", 255) || null,
        ]);

        const [balanceResult] = await connection.query(`
            UPDATE roulette_user_balances
            SET available_spins = available_spins - 1,
                total_spent = total_spent + 1
            WHERE empresa_id = ?
              AND user_id = ?
              AND available_spins > 0
        `, [usuario.empresa_id, usuario.id]);

        if (balanceResult.affectedRows !== 1) {
            throw criarErroHttp(409, "Você não possui giros disponíveis.", "roulette.no_spins");
        }

        if (selectedPrize.stock !== null && selectedPrize.stock !== undefined) {
            const [stockResult] = await connection.query(`
                UPDATE roulette_prizes
                SET stock = stock - 1
                WHERE id = ?
                  AND campaign_id = ?
                  AND stock > 0
            `, [selectedPrize.id, campaign.id]);

            if (stockResult.affectedRows !== 1) {
                throw criarErroHttp(409, "Este prêmio acabou de esgotar. Tente girar novamente.", "roulette.stock_depleted");
            }
        }

        const redemptionUid = criarRedemptionUid();

        const [redemptionResult] = await connection.query(`
            INSERT INTO roulette_redemptions (
                redemption_uid,
                empresa_id,
                user_id,
                campaign_id,
                prize_id,
                spin_history_id,
                status
            )
            VALUES (?, ?, ?, ?, ?, ?, 'AGUARDANDO_RESGATE')
        `, [
            redemptionUid,
            usuario.empresa_id,
            usuario.id,
            campaign.id,
            selectedPrize.id,
            historyResult.insertId,
        ]);

        notificationsToEmit.push(...await criarNotificacoes(connection, {
            empresaId: usuario.empresa_id,
            userIds: [usuario.id],
            type: selectedPrize.is_jackpot ? "jackpot_won" : "prize_won",
            title: selectedPrize.is_jackpot ? "JACKPOT!" : "Você ganhou um prêmio!",
            message: `Você ganhou ${selectedPrize.real_name || selectedPrize.name}.`,
            metadata: {
                spin_uid: spinUid,
                prize_id: selectedPrize.id,
                redemption_id: redemptionResult.insertId,
            },
        }));

        if (selectedPrize.is_jackpot) {
            const [companyUsers] = await connection.query(`
                SELECT id
                FROM usuarios
                WHERE empresa_id = ?
                  AND deletado_em IS NULL
            `, [usuario.empresa_id]);

            notificationsToEmit.push(...await criarNotificacoes(connection, {
                empresaId: usuario.empresa_id,
                userIds: companyUsers.map((row) => row.id),
                type: "jackpot_public",
                title: "JACKPOT!",
                message: `${usuario.nome} acabou de ganhar ${selectedPrize.real_name || selectedPrize.name} na Roleta de Prêmios!`,
                metadata: {
                    spin_uid: spinUid,
                    prize_id: selectedPrize.id,
                    winner_user_id: usuario.id,
                },
            }));
        }

        await connection.commit();
        emitirNotificacoes(req, notificationsToEmit);

        const response = await montarSpinResponsePorHistoryId(db, usuario.empresa_id, historyResult.insertId);
        const updatedBalance = await buscarSaldoUsuario(db, usuario.empresa_id, usuario.id);

        console.info("roulette.spin.completed", {
            spin_uid: spinUid,
            user_id: usuario.id,
            prize_id: selectedPrize.id,
            request_id: requestId,
        });

        return res.status(201).json({
            ...response,
            balance: {
                available_spins: Number(updatedBalance.available_spins || 0),
                total_granted: Number(updatedBalance.total_granted || 0),
                total_spent: Number(updatedBalance.total_spent || 0),
            },
        });
    } catch (err) {
        try {
            await connection.rollback();
        } catch (rollbackErr) {
            console.error("roulette.spin.rollback_failed", rollbackErr);
        }

        if (isDuplicateEntryError(err)) {
            const existing = await buscarSpinPorRequestId(db, req.user, requestId);
            if (existing) {
                return res.json({ ...existing, idempotent: true });
            }
        }

        const statusCode = err.statusCode && err.statusCode >= 400 && err.statusCode < 600
            ? err.statusCode
            : 500;
        const message = err.statusCode ? err.message : "Não foi possível realizar o giro. Seu giro não foi consumido.";

        console.error("roulette.spin.failed", {
            user_id: req.user?.id,
            request_id: requestId,
            code: err.publicCode || err.code,
            message: err.message,
        });

        return res.status(statusCode).json({
            error: message,
            code: err.publicCode || "roulette.spin_failed",
        });
    } finally {
        connection.release();
    }
});

router.get("/spins/request/:requestId", async (req, res) => {
    try {
        await garantirTabelasRoleta();

        const requestId = validarRequestId(req.params.requestId);

        if (!requestId) {
            return res.status(400).json({ error: "Identificador do giro inválido." });
        }

        const spin = await buscarSpinPorRequestId(db, req.user, requestId);

        if (!spin) {
            return res.status(404).json({ error: "Giro não encontrado." });
        }

        res.json(spin);
    } catch (err) {
        console.error("roulette.spin_request_lookup.failed", err);
        res.status(500).json({ error: "Erro ao recuperar giro." });
    }
});

router.get("/spins/:spinUid", async (req, res) => {
    try {
        await garantirTabelasRoleta();

        const spinUid = String(req.params.spinUid || "");

        if (!SPIN_UID_REGEX.test(spinUid)) {
            return res.status(400).json({ error: "Giro inválido." });
        }

        const [rows] = await db.query(`
            SELECT id
            FROM roulette_spin_history
            WHERE empresa_id = ?
              AND user_id = ?
              AND spin_uid = ?
            LIMIT 1
        `, [req.user.empresa_id, req.user.id, spinUid]);

        if (!rows.length) {
            return res.status(404).json({ error: "Giro não encontrado." });
        }

        const spin = await montarSpinResponsePorHistoryId(db, req.user.empresa_id, rows[0].id);
        res.json(spin);
    } catch (err) {
        console.error("roulette.spin_lookup.failed", err);
        res.status(500).json({ error: "Erro ao recuperar giro." });
    }
});

router.get("/my-prizes", async (req, res) => {
    try {
        await garantirTabelasRoleta();

        const [rows] = await db.query(`
            ${montarSelectResgates()}
            WHERE r.empresa_id = ?
              AND r.user_id = ?
            ORDER BY r.created_at DESC, r.id DESC
            LIMIT 120
        `, [req.user.empresa_id, req.user.id]);

        res.json(rows.map(serializarResgate));
    } catch (err) {
        console.error("roulette.my_prizes.failed", err);
        res.status(500).json({ error: "Erro ao listar seus prêmios." });
    }
});

router.post("/redemptions/:id/request", async (req, res) => {
    try {
        await garantirTabelasRoleta();

        const redemptionId = Number(req.params.id);
        const userNote = limitarTexto(req.body?.user_note || req.body?.observacao || "", 500);

        if (!Number.isInteger(redemptionId) || redemptionId <= 0) {
            return res.status(400).json({ error: "Resgate inválido." });
        }

        const [result] = await db.query(`
            UPDATE roulette_redemptions
            SET status = 'RESGATE_SOLICITADO',
                user_note = ?,
                requested_at = COALESCE(requested_at, NOW())
            WHERE id = ?
              AND empresa_id = ?
              AND user_id = ?
              AND status IN ('GANHO', 'AGUARDANDO_RESGATE')
        `, [userNote || null, redemptionId, req.user.empresa_id, req.user.id]);

        if (result.affectedRows === 0) {
            return res.status(409).json({ error: "Este prêmio não pode ser solicitado agora." });
        }

        const [rows] = await db.query(`
            ${montarSelectResgates()}
            WHERE r.id = ?
              AND r.empresa_id = ?
              AND r.user_id = ?
            LIMIT 1
        `, [redemptionId, req.user.empresa_id, req.user.id]);

        res.json(serializarResgate(rows[0]));
    } catch (err) {
        console.error("roulette.redemption_request.failed", err);
        res.status(500).json({ error: "Erro ao solicitar resgate." });
    }
});

router.get("/history", async (req, res) => {
    try {
        await garantirTabelasRoleta();

        const [rows] = await db.query(`
            SELECT
                h.spin_uid,
                h.request_id,
                h.status,
                h.ip,
                h.created_at,
                c.id AS campaign_id,
                c.name AS campaign_name,
                p.*,
                r.id AS redemption_id,
                r.status AS redemption_status
            FROM roulette_spin_history h
            JOIN roulette_campaigns c ON c.id = h.campaign_id
            LEFT JOIN roulette_prizes p ON p.id = h.prize_id
            LEFT JOIN roulette_redemptions r ON r.spin_history_id = h.id
            WHERE h.empresa_id = ?
              AND h.user_id = ?
            ORDER BY h.created_at DESC, h.id DESC
            LIMIT 120
        `, [req.user.empresa_id, req.user.id]);

        res.json(rows.map((row) => ({
            spin_uid: row.spin_uid,
            request_id: row.request_id,
            status: row.status,
            created_at: row.created_at,
            campaign: {
                id: row.campaign_id,
                name: row.campaign_name,
            },
            prize: row.id ? serializarPremioUsuario(row, { reveal: true }) : null,
            redemption_id: row.redemption_id,
            redemption_status: row.redemption_status,
        })));
    } catch (err) {
        console.error("roulette.history.failed", err);
        res.status(500).json({ error: "Erro ao listar histórico da roleta." });
    }
});

router.get("/notifications", async (req, res) => {
    try {
        await garantirTabelasRoleta();
        const notifications = await listarNotificacoesUsuario(req.user.empresa_id, req.user.id);
        res.json({ notifications });
    } catch (err) {
        console.error("roulette.notifications.failed", err);
        res.status(500).json({ error: "Erro ao listar notificações da roleta." });
    }
});

router.post("/notifications/read", async (req, res) => {
    try {
        await garantirTabelasRoleta();

        await db.query(`
            UPDATE roulette_notifications
            SET read_at = COALESCE(read_at, NOW())
            WHERE empresa_id = ?
              AND user_id = ?
              AND read_at IS NULL
        `, [req.user.empresa_id, req.user.id]);

        res.json({ success: true });
    } catch (err) {
        console.error("roulette.notifications_read.failed", err);
        res.status(500).json({ error: "Erro ao marcar notificações." });
    }
});

router.get("/admin/bootstrap", requireRouletteAdmin, async (req, res) => {
    try {
        await garantirTabelasRoleta();
        await garantirCampanhaPadraoRoleta(req.user.empresa_id);

        const [
            campaigns,
            prizes,
            users,
            departments,
        ] = await Promise.all([
            listarCampanhasAdmin(req.user.empresa_id),
            listarPremiosAdmin(req.user.empresa_id),
            listarUsuariosEmpresa(req.user.empresa_id),
            listarSetoresEmpresa(req.user.empresa_id),
        ]);

        res.json({
            campaigns,
            prizes,
            users,
            departments,
            prize_types: [...PRIZE_TYPES],
            redemption_statuses: [...REDEMPTION_STATUSES],
        });
    } catch (err) {
        console.error("roulette.admin.bootstrap.failed", err);
        res.status(500).json({ error: "Erro ao carregar administração da roleta." });
    }
});

router.get("/admin/dashboard", requireRouletteAdmin, async (req, res) => {
    try {
        await garantirTabelasRoleta();

        const empresaId = req.user.empresa_id;
        const [
            [spinsRows],
            [participantsRows],
            [valueRows],
            [pendingRows],
            [balanceRows],
            [stockRows],
            [activeCampaignRows],
            [topPrizeRows],
            [rarePrizeRows],
        ] = await Promise.all([
            db.query(`
                SELECT COUNT(*) AS total
                FROM roulette_spin_history
                WHERE empresa_id = ?
                  AND status = 'completed'
            `, [empresaId]),
            db.query(`
                SELECT COUNT(DISTINCT user_id) AS total
                FROM roulette_spin_history
                WHERE empresa_id = ?
                  AND status = 'completed'
            `, [empresaId]),
            db.query(`
                SELECT COALESCE(SUM(p.estimated_value), 0) AS total
                FROM roulette_spin_history h
                JOIN roulette_prizes p ON p.id = h.prize_id
                WHERE h.empresa_id = ?
                  AND h.status = 'completed'
            `, [empresaId]),
            db.query(`
                SELECT COUNT(*) AS total
                FROM roulette_redemptions
                WHERE empresa_id = ?
                  AND status NOT IN (?)
            `, [empresaId, FINAL_REDEMPTION_STATUSES]),
            db.query(`
                SELECT COALESCE(SUM(available_spins), 0) AS total
                FROM roulette_user_balances
                WHERE empresa_id = ?
            `, [empresaId]),
            db.query(`
                SELECT COALESCE(SUM(stock), 0) AS total
                FROM roulette_prizes
                WHERE empresa_id = ?
                  AND stock IS NOT NULL
                  AND is_active = 1
            `, [empresaId]),
            db.query(`
                SELECT id, name, starts_at, ends_at
                FROM roulette_campaigns
                WHERE empresa_id = ?
                  AND is_active = 1
                  AND starts_at <= NOW()
                  AND ends_at >= NOW()
                ORDER BY starts_at DESC, id DESC
                LIMIT 1
            `, [empresaId]),
            db.query(`
                SELECT p.name, p.public_name, COUNT(*) AS total
                FROM roulette_spin_history h
                JOIN roulette_prizes p ON p.id = h.prize_id
                WHERE h.empresa_id = ?
                  AND h.status = 'completed'
                GROUP BY p.id, p.name, p.public_name
                ORDER BY total DESC, p.name ASC
                LIMIT 1
            `, [empresaId]),
            db.query(`
                SELECT p.name, p.public_name, p.weight, COUNT(*) AS total
                FROM roulette_spin_history h
                JOIN roulette_prizes p ON p.id = h.prize_id
                WHERE h.empresa_id = ?
                  AND h.status = 'completed'
                GROUP BY p.id, p.name, p.public_name, p.weight
                ORDER BY p.weight ASC, total DESC
                LIMIT 1
            `, [empresaId]),
        ]);

        res.json({
            total_spins: Number(spinsRows[0]?.total || 0),
            total_participants: Number(participantsRows[0]?.total || 0),
            estimated_value_distributed: Number(valueRows[0]?.total || 0),
            pending_redemptions: Number(pendingRows[0]?.total || 0),
            available_spins: Number(balanceRows[0]?.total || 0),
            active_stock: Number(stockRows[0]?.total || 0),
            active_campaign: activeCampaignRows[0] || null,
            top_prize: topPrizeRows[0] || null,
            rare_prize: rarePrizeRows[0] || null,
        });
    } catch (err) {
        console.error("roulette.admin.dashboard.failed", err);
        res.status(500).json({ error: "Erro ao carregar dashboard da roleta." });
    }
});

router.get("/admin/campaigns", requireRouletteAdmin, async (req, res) => {
    try {
        await garantirTabelasRoleta();
        res.json(await listarCampanhasAdmin(req.user.empresa_id));
    } catch (err) {
        console.error("roulette.admin.campaigns.failed", err);
        res.status(500).json({ error: "Erro ao listar campanhas." });
    }
});

router.post("/admin/campaigns", requireRouletteAdmin, async (req, res) => {
    await garantirTabelasRoleta();

    const connection = await db.getConnection();

    try {
        const payload = montarPayloadCampanha(req.body || {});

        await connection.beginTransaction();
        await validarSetoresEmpresa(connection, req.user.empresa_id, payload.departmentIds);

        const [result] = await connection.query(`
            INSERT INTO roulette_campaigns (
                empresa_id,
                name,
                description,
                rules,
                starts_at,
                ends_at,
                is_active,
                created_by,
                updated_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            req.user.empresa_id,
            payload.name,
            payload.description || null,
            payload.rules || null,
            payload.startsAt,
            payload.endsAt,
            payload.isActive ? 1 : 0,
            req.user.id,
            req.user.id,
        ]);

        if (payload.departmentIds.length) {
            await connection.query(`
                INSERT INTO roulette_campaign_departments (campaign_id, setor_id)
                VALUES ?
            `, [payload.departmentIds.map((setorId) => [result.insertId, setorId])]);
        }

        const campaign = await buscarCampanhaAdmin(connection, req.user.empresa_id, result.insertId);

        await registrarAdminLog(connection, req, {
            action: "CRIAR_CAMPANHA",
            entity: "campaign",
            entityId: result.insertId,
            after: campaign,
        });

        await connection.commit();
        res.status(201).json(serializarCampanha(campaign));
    } catch (err) {
        await connection.rollback();
        const statusCode = err.statusCode || 500;
        console.error("roulette.admin.campaign_create.failed", err);
        res.status(statusCode).json({ error: err.statusCode ? err.message : "Erro ao criar campanha." });
    } finally {
        connection.release();
    }
});

router.put("/admin/campaigns/:id", requireRouletteAdmin, async (req, res) => {
    await garantirTabelasRoleta();

    const connection = await db.getConnection();

    try {
        const campaignId = Number(req.params.id);

        if (!Number.isInteger(campaignId) || campaignId <= 0) {
            return res.status(400).json({ error: "Campanha inválida." });
        }

        const payload = montarPayloadCampanha(req.body || {});

        await connection.beginTransaction();

        const before = await buscarCampanhaAdmin(connection, req.user.empresa_id, campaignId);
        if (!before) {
            throw criarErroHttp(404, "Campanha não encontrada.", "roulette.campaign_not_found");
        }

        await validarSetoresEmpresa(connection, req.user.empresa_id, payload.departmentIds);

        await connection.query(`
            UPDATE roulette_campaigns
            SET name = ?,
                description = ?,
                rules = ?,
                starts_at = ?,
                ends_at = ?,
                is_active = ?,
                updated_by = ?
            WHERE id = ?
              AND empresa_id = ?
        `, [
            payload.name,
            payload.description || null,
            payload.rules || null,
            payload.startsAt,
            payload.endsAt,
            payload.isActive ? 1 : 0,
            req.user.id,
            campaignId,
            req.user.empresa_id,
        ]);

        await connection.query("DELETE FROM roulette_campaign_departments WHERE campaign_id = ?", [campaignId]);

        if (payload.departmentIds.length) {
            await connection.query(`
                INSERT INTO roulette_campaign_departments (campaign_id, setor_id)
                VALUES ?
            `, [payload.departmentIds.map((setorId) => [campaignId, setorId])]);
        }

        const after = await buscarCampanhaAdmin(connection, req.user.empresa_id, campaignId);

        await registrarAdminLog(connection, req, {
            action: "ALTERAR_CAMPANHA",
            entity: "campaign",
            entityId: campaignId,
            before,
            after,
        });

        await connection.commit();
        res.json(serializarCampanha(after));
    } catch (err) {
        await connection.rollback();
        const statusCode = err.statusCode || 500;
        console.error("roulette.admin.campaign_update.failed", err);
        res.status(statusCode).json({ error: err.statusCode ? err.message : "Erro ao atualizar campanha." });
    } finally {
        connection.release();
    }
});

router.get("/admin/prizes", requireRouletteAdmin, async (req, res) => {
    try {
        await garantirTabelasRoleta();
        const campaignId = req.query.campaign_id ? Number(req.query.campaign_id) : null;
        res.json(await listarPremiosAdmin(req.user.empresa_id, campaignId));
    } catch (err) {
        console.error("roulette.admin.prizes.failed", err);
        res.status(500).json({ error: "Erro ao listar prêmios." });
    }
});

router.post("/admin/prizes", requireRouletteAdmin, async (req, res) => {
    await garantirTabelasRoleta();

    const connection = await db.getConnection();

    try {
        const payload = montarPayloadPremio(req.body || {});

        await connection.beginTransaction();

        const campaign = await buscarCampanhaAdmin(connection, req.user.empresa_id, payload.campaignId);
        if (!campaign) {
            throw criarErroHttp(404, "Campanha não encontrada.", "roulette.campaign_not_found");
        }

        const [result] = await connection.query(`
            INSERT INTO roulette_prizes (
                empresa_id,
                campaign_id,
                name,
                public_name,
                real_name,
                description,
                image_url,
                icon,
                color,
                type,
                stock,
                initial_stock,
                weight,
                estimated_value,
                is_mystery,
                is_jackpot,
                is_active,
                created_by,
                updated_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            req.user.empresa_id,
            payload.campaignId,
            payload.name,
            payload.publicName,
            payload.realName,
            payload.description || null,
            payload.imageUrl || null,
            payload.icon || null,
            payload.color,
            payload.type,
            payload.stock,
            payload.initialStock,
            payload.weight,
            payload.estimatedValue,
            payload.isMystery ? 1 : 0,
            payload.isJackpot ? 1 : 0,
            payload.isActive ? 1 : 0,
            req.user.id,
            req.user.id,
        ]);

        const prize = await buscarPremioAdmin(connection, req.user.empresa_id, result.insertId);

        await registrarAdminLog(connection, req, {
            action: "CRIAR_PREMIO",
            entity: "prize",
            entityId: result.insertId,
            after: prize,
        });

        await connection.commit();
        res.status(201).json((await listarPremiosAdmin(req.user.empresa_id)).find((item) => Number(item.id) === Number(result.insertId)));
    } catch (err) {
        await connection.rollback();
        const statusCode = err.statusCode || 500;
        console.error("roulette.admin.prize_create.failed", err);
        res.status(statusCode).json({ error: err.statusCode ? err.message : "Erro ao criar prêmio." });
    } finally {
        connection.release();
    }
});

router.put("/admin/prizes/:id", requireRouletteAdmin, async (req, res) => {
    await garantirTabelasRoleta();

    const connection = await db.getConnection();

    try {
        const prizeId = Number(req.params.id);

        if (!Number.isInteger(prizeId) || prizeId <= 0) {
            return res.status(400).json({ error: "Prêmio inválido." });
        }

        const payload = montarPayloadPremio(req.body || {});

        await connection.beginTransaction();

        const before = await buscarPremioAdmin(connection, req.user.empresa_id, prizeId);
        if (!before) {
            throw criarErroHttp(404, "Prêmio não encontrado.", "roulette.prize_not_found");
        }

        const campaign = await buscarCampanhaAdmin(connection, req.user.empresa_id, payload.campaignId);
        if (!campaign) {
            throw criarErroHttp(404, "Campanha não encontrada.", "roulette.campaign_not_found");
        }

        await connection.query(`
            UPDATE roulette_prizes
            SET campaign_id = ?,
                name = ?,
                public_name = ?,
                real_name = ?,
                description = ?,
                image_url = ?,
                icon = ?,
                color = ?,
                type = ?,
                stock = ?,
                initial_stock = ?,
                weight = ?,
                estimated_value = ?,
                is_mystery = ?,
                is_jackpot = ?,
                is_active = ?,
                updated_by = ?
            WHERE id = ?
              AND empresa_id = ?
        `, [
            payload.campaignId,
            payload.name,
            payload.publicName,
            payload.realName,
            payload.description || null,
            payload.imageUrl || null,
            payload.icon || null,
            payload.color,
            payload.type,
            payload.stock,
            payload.initialStock,
            payload.weight,
            payload.estimatedValue,
            payload.isMystery ? 1 : 0,
            payload.isJackpot ? 1 : 0,
            payload.isActive ? 1 : 0,
            req.user.id,
            prizeId,
            req.user.empresa_id,
        ]);

        const after = await buscarPremioAdmin(connection, req.user.empresa_id, prizeId);

        await registrarAdminLog(connection, req, {
            action: "ALTERAR_PREMIO",
            entity: "prize",
            entityId: prizeId,
            before,
            after,
        });

        await connection.commit();
        res.json((await listarPremiosAdmin(req.user.empresa_id)).find((item) => Number(item.id) === Number(prizeId)));
    } catch (err) {
        await connection.rollback();
        const statusCode = err.statusCode || 500;
        console.error("roulette.admin.prize_update.failed", err);
        res.status(statusCode).json({ error: err.statusCode ? err.message : "Erro ao atualizar prêmio." });
    } finally {
        connection.release();
    }
});

router.post("/admin/prizes/:id/image", requireRouletteAdmin, uploadPrizeImageMiddleware, async (req, res) => {
    try {
        await garantirTabelasRoleta();

        const prizeId = Number(req.params.id);

        if (!Number.isInteger(prizeId) || prizeId <= 0) {
            if (req.file?.path) fs.rmSync(req.file.path, { force: true });
            return res.status(400).json({ error: "Prêmio inválido." });
        }

        const prize = await buscarPremioAdmin(db, req.user.empresa_id, prizeId);

        if (!prize) {
            if (req.file?.path) fs.rmSync(req.file.path, { force: true });
            return res.status(404).json({ error: "Prêmio não encontrado." });
        }

        if (!req.file?.filename) {
            return res.status(400).json({ error: "Envie uma imagem." });
        }

        const imageUrl = `/uploads/roulette/${normalizarSegmentoUpload(req.user.empresa_id)}/${req.file.filename}`;

        await db.query(`
            UPDATE roulette_prizes
            SET image_url = ?,
                updated_by = ?
            WHERE id = ?
              AND empresa_id = ?
        `, [imageUrl, req.user.id, prizeId, req.user.empresa_id]);

        await registrarAdminLog(db, req, {
            action: "ALTERAR_IMAGEM_PREMIO",
            entity: "prize",
            entityId: prizeId,
            before: { image_url: prize.image_url || null },
            after: { image_url: imageUrl },
        });

        res.json({ image_url: imageUrl });
    } catch (err) {
        if (req.file?.path) fs.rmSync(req.file.path, { force: true });
        console.error("roulette.admin.prize_image.failed", err);
        res.status(500).json({ error: "Erro ao enviar imagem do prêmio." });
    }
});

router.post("/admin/grants", requireRouletteAdmin, async (req, res) => {
    await garantirTabelasRoleta();

    const connection = await db.getConnection();

    try {
        const targetType = ["user", "department", "all"].includes(req.body?.target_type)
            ? req.body.target_type
            : "user";
        const targetUserId = Number(req.body?.user_id);
        const setorId = Number(req.body?.setor_id || req.body?.department_id);
        const quantity = normalizarInteiro(req.body?.quantity || req.body?.quantidade, { min: 1, max: 1000 });
        const reason = limitarTexto(req.body?.reason || req.body?.motivo || "", 255);

        if (!quantity) {
            return res.status(400).json({ error: "Quantidade de giros inválida." });
        }

        await connection.beginTransaction();

        const users = await listarUsuariosPorAlvoGrant(connection, req, {
            targetType,
            targetUserId,
            setorId,
        });

        if (!users.length) {
            throw criarErroHttp(400, "Nenhum funcionário encontrado para receber giros.", "roulette.no_grant_users");
        }

        for (const user of users) {
            await connection.query(`
                INSERT INTO roulette_user_balances (
                    empresa_id,
                    user_id,
                    available_spins,
                    total_granted,
                    total_spent
                )
                VALUES (?, ?, ?, ?, 0)
                ON DUPLICATE KEY UPDATE
                    available_spins = available_spins + VALUES(available_spins),
                    total_granted = total_granted + VALUES(total_granted)
            `, [req.user.empresa_id, user.id, quantity, quantity]);
        }

        const grantUid = criarGrantUid();

        const [grantResult] = await connection.query(`
            INSERT INTO roulette_spin_grants (
                grant_uid,
                empresa_id,
                admin_id,
                target_type,
                target_user_id,
                setor_id,
                quantity,
                reason,
                total_users,
                metadata_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            grantUid,
            req.user.empresa_id,
            req.user.id,
            targetType,
            targetType === "user" ? targetUserId : null,
            targetType === "department" ? setorId : null,
            quantity,
            reason || null,
            users.length,
            serializarJson({
                users: users.map((user) => ({ id: user.id, nome: user.nome, setor_id: user.setor_id })),
            }),
        ]);

        await registrarAdminLog(connection, req, {
            action: "CONCEDER_GIROS",
            entity: "spin_grant",
            entityId: grantResult.insertId,
            after: {
                grant_uid: grantUid,
                target_type: targetType,
                target_user_id: targetType === "user" ? targetUserId : null,
                setor_id: targetType === "department" ? setorId : null,
                quantity,
                reason,
                total_users: users.length,
            },
        });

        const notificationsToEmit = await criarNotificacoes(connection, {
            empresaId: req.user.empresa_id,
            userIds: users.map((user) => user.id),
            type: "spins_granted",
            title: "Você recebeu giros na roleta",
            message: `${quantity} giro${quantity > 1 ? "s" : ""} concedido${quantity > 1 ? "s" : ""}${reason ? `: ${reason}` : "."}`,
            metadata: {
                grant_uid: grantUid,
                quantity,
                reason,
            },
        });

        await connection.commit();
        emitirNotificacoes(req, notificationsToEmit);

        res.status(201).json({
            success: true,
            grant_uid: grantUid,
            total_users: users.length,
            quantity,
        });
    } catch (err) {
        await connection.rollback();
        const statusCode = err.statusCode || 500;
        console.error("roulette.admin.grant.failed", err);
        res.status(statusCode).json({ error: err.statusCode ? err.message : "Erro ao conceder giros." });
    } finally {
        connection.release();
    }
});

router.get("/admin/redemptions", requireRouletteAdmin, async (req, res) => {
    try {
        await garantirTabelasRoleta();

        const [rows] = await db.query(`
            ${montarSelectResgates()}
            WHERE r.empresa_id = ?
            ORDER BY r.updated_at DESC, r.id DESC
            LIMIT 200
        `, [req.user.empresa_id]);

        res.json(rows.map(serializarResgate));
    } catch (err) {
        console.error("roulette.admin.redemptions.failed", err);
        res.status(500).json({ error: "Erro ao listar resgates." });
    }
});

router.patch("/admin/redemptions/:id/status", requireRouletteAdmin, async (req, res) => {
    await garantirTabelasRoleta();

    const connection = await db.getConnection();
    const notificationsToEmit = [];

    try {
        const redemptionId = Number(req.params.id);
        const status = normalizarStatusResgate(req.body?.status);
        const adminNote = limitarTexto(req.body?.admin_note || req.body?.observacao || "", 500);

        if (!Number.isInteger(redemptionId) || redemptionId <= 0) {
            return res.status(400).json({ error: "Resgate inválido." });
        }

        if (!status) {
            return res.status(400).json({ error: "Status de resgate inválido." });
        }

        await connection.beginTransaction();

        const [beforeRows] = await connection.query(`
            SELECT *
            FROM roulette_redemptions
            WHERE id = ?
              AND empresa_id = ?
            LIMIT 1
            FOR UPDATE
        `, [redemptionId, req.user.empresa_id]);

        if (!beforeRows.length) {
            throw criarErroHttp(404, "Resgate não encontrado.", "roulette.redemption_not_found");
        }

        const before = beforeRows[0];
        const updates = [
            "status = ?",
            "admin_note = ?",
            "updated_by = ?",
        ];
        const values = [status, adminNote || null, req.user.id];

        if (status === "RESGATE_SOLICITADO") {
            updates.push("requested_at = COALESCE(requested_at, NOW())");
        }
        if (status === "EM_PROCESSAMENTO") {
            updates.push("processed_at = COALESCE(processed_at, NOW())");
        }
        if (status === "DISPONIVEL_PARA_RETIRADA") {
            updates.push("processed_at = COALESCE(processed_at, NOW())");
        }
        if (FINAL_REDEMPTION_STATUSES.includes(status)) {
            updates.push("delivered_at = COALESCE(delivered_at, NOW())");
        }

        values.push(redemptionId, req.user.empresa_id);

        await connection.query(`
            UPDATE roulette_redemptions
            SET ${updates.join(", ")}
            WHERE id = ?
              AND empresa_id = ?
        `, values);

        await registrarAdminLog(connection, req, {
            action: "ALTERAR_STATUS_RESGATE",
            entity: "redemption",
            entityId: redemptionId,
            before,
            after: {
                ...before,
                status,
                admin_note: adminNote || null,
                updated_by: req.user.id,
            },
        });

        const [prizeRows] = await connection.query(`
            SELECT p.name, p.public_name, p.real_name, p.is_mystery, r.user_id
            FROM roulette_redemptions r
            JOIN roulette_prizes p ON p.id = r.prize_id
            WHERE r.id = ?
            LIMIT 1
        `, [redemptionId]);
        const prizeInfo = prizeRows[0];

        if (prizeInfo) {
            notificationsToEmit.push(...await criarNotificacoes(connection, {
                empresaId: req.user.empresa_id,
                userIds: [prizeInfo.user_id],
                type: "redemption_status",
                title: "Status do seu prêmio atualizado",
                message: `Seu prêmio ${prizeInfo.real_name || prizeInfo.name} agora está como ${status.replaceAll("_", " ").toLowerCase()}.`,
                metadata: {
                    redemption_id: redemptionId,
                    status,
                },
            }));
        }

        await connection.commit();
        emitirNotificacoes(req, notificationsToEmit);

        const [rows] = await db.query(`
            ${montarSelectResgates()}
            WHERE r.id = ?
              AND r.empresa_id = ?
            LIMIT 1
        `, [redemptionId, req.user.empresa_id]);

        res.json(serializarResgate(rows[0]));
    } catch (err) {
        await connection.rollback();
        const statusCode = err.statusCode || 500;
        console.error("roulette.admin.redemption_status.failed", err);
        res.status(statusCode).json({ error: err.statusCode ? err.message : "Erro ao atualizar resgate." });
    } finally {
        connection.release();
    }
});

router.get("/admin/history", requireRouletteAdmin, async (req, res) => {
    try {
        await garantirTabelasRoleta();

        const [rows] = await db.query(`
            SELECT
                h.id,
                h.spin_uid,
                h.request_id,
                h.status,
                h.ip,
                h.user_agent,
                h.created_at,
                u.id AS user_id,
                u.nome AS user_name,
                s.nome AS setor_nome,
                c.id AS campaign_id,
                c.name AS campaign_name,
                p.name AS prize_name,
                p.public_name AS prize_public_name,
                p.real_name AS prize_real_name,
                p.is_mystery,
                p.is_jackpot,
                r.status AS redemption_status
            FROM roulette_spin_history h
            JOIN usuarios u ON u.id = h.user_id
            LEFT JOIN setores s ON s.id = u.setor_id
            JOIN roulette_campaigns c ON c.id = h.campaign_id
            LEFT JOIN roulette_prizes p ON p.id = h.prize_id
            LEFT JOIN roulette_redemptions r ON r.spin_history_id = h.id
            WHERE h.empresa_id = ?
            ORDER BY h.created_at DESC, h.id DESC
            LIMIT 250
        `, [req.user.empresa_id]);

        res.json(rows);
    } catch (err) {
        console.error("roulette.admin.history.failed", err);
        res.status(500).json({ error: "Erro ao listar histórico da roleta." });
    }
});

router.get("/admin/grants", requireRouletteAdmin, async (req, res) => {
    try {
        await garantirTabelasRoleta();

        const [rows] = await db.query(`
            SELECT
                g.*,
                a.nome AS admin_name,
                u.nome AS target_user_name,
                s.nome AS setor_nome
            FROM roulette_spin_grants g
            LEFT JOIN usuarios a ON a.id = g.admin_id
            LEFT JOIN usuarios u ON u.id = g.target_user_id
            LEFT JOIN setores s ON s.id = g.setor_id
            WHERE g.empresa_id = ?
            ORDER BY g.created_at DESC, g.id DESC
            LIMIT 180
        `, [req.user.empresa_id]);

        res.json(rows.map((row) => ({
            ...row,
            metadata: parseJson(row.metadata_json, null),
            metadata_json: undefined,
        })));
    } catch (err) {
        console.error("roulette.admin.grants_history.failed", err);
        res.status(500).json({ error: "Erro ao listar concessões de giros." });
    }
});

router.get("/admin/audit", requireRouletteAdmin, async (req, res) => {
    try {
        await garantirTabelasRoleta();

        const [rows] = await db.query(`
            SELECT
                l.*,
                u.nome AS admin_name,
                u.email AS admin_email
            FROM roulette_admin_logs l
            LEFT JOIN usuarios u ON u.id = l.admin_id
            WHERE l.empresa_id = ?
            ORDER BY l.created_at DESC, l.id DESC
            LIMIT 250
        `, [req.user.empresa_id]);

        res.json(rows.map((row) => ({
            ...row,
            before: parseJson(row.before_json, null),
            after: parseJson(row.after_json, null),
            metadata: parseJson(row.metadata_json, null),
            before_json: undefined,
            after_json: undefined,
            metadata_json: undefined,
        })));
    } catch (err) {
        console.error("roulette.admin.audit.failed", err);
        res.status(500).json({ error: "Erro ao listar auditoria da roleta." });
    }
});

router.get("/admin/users", requireRouletteAdmin, async (req, res) => {
    try {
        await garantirTabelasRoleta();
        res.json(await listarUsuariosEmpresa(req.user.empresa_id));
    } catch (err) {
        console.error("roulette.admin.users.failed", err);
        res.status(500).json({ error: "Erro ao listar funcionários." });
    }
});

router.get("/admin/departments", requireRouletteAdmin, async (req, res) => {
    try {
        await garantirTabelasRoleta();
        res.json(await listarSetoresEmpresa(req.user.empresa_id));
    } catch (err) {
        console.error("roulette.admin.departments.failed", err);
        res.status(500).json({ error: "Erro ao listar setores." });
    }
});

export default router;
