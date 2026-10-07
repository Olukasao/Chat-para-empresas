import { Router } from "express";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import db from "../db/db.js";
import authMiddleware from "../middlewares/middleware.js";

const router = Router();

const PERFIL_ADMIN = "admin";
const PERFIS_VALIDOS = ["admin", "admin_comercial", "usuario"];

export const PURCHASE_PERMISSION_KEYS = [
    "purchase_module.access",
    "purchase_panel.view",
    "purchase_request.create",
    "purchase_request.view_own",
    "purchase_request.view_department",
    "purchase_request.view_all",
    "purchase_request.assign",
    "purchase_request.change_status",
    "purchase_quote.manage",
    "purchase_approval.manage",
    "purchase_order.manage",
    "purchase_receipt.manage",
    "purchase_financial.view",
    "purchase_attachment.view",
    "purchase_report.view",
    "purchase_report.export",
    "purchase_settings.manage",
    "purchase_permissions.manage",
];

const PURCHASE_PERMISSION_CATALOG = [
    ["purchase_module.access", "Acessar a página de compras"],
    ["purchase_panel.view", "Acessar o painel do almoxarifado"],
    ["purchase_request.create", "Criar solicitações"],
    ["purchase_request.view_own", "Visualizar somente as próprias solicitações"],
    ["purchase_request.view_department", "Visualizar solicitações do próprio departamento"],
    ["purchase_request.view_all", "Visualizar todas as solicitações"],
    ["purchase_request.assign", "Atender solicitações como almoxarifado"],
    ["purchase_request.change_status", "Alterar status das solicitações"],
    ["purchase_quote.manage", "Registrar cotações"],
    ["purchase_order.manage", "Registrar compras"],
    ["purchase_receipt.manage", "Registrar recebimento de materiais"],
    ["purchase_financial.view", "Visualizar valores financeiros"],
    ["purchase_attachment.view", "Visualizar anexos e comprovantes"],
    ["purchase_approval.manage", "Aprovar ou rejeitar compras"],
    ["purchase_report.export", "Exportar relatórios"],
    ["purchase_settings.manage", "Gerenciar configurações do módulo"],
    ["purchase_permissions.manage", "Gerenciar permissões de outros usuários"],
].map(([key, label]) => ({ key, label }));

const ALL_PURCHASE_PERMISSIONS = Object.fromEntries(
    PURCHASE_PERMISSION_KEYS.map((permission) => [permission, true])
);

const PURCHASE_DEFAULT_PROFILES = [
    {
        slug: "solicitante",
        name: "Solicitante",
        description: "Cria solicitações, acompanha os próprios pedidos e conversa com o almoxarifado.",
        permissions: [
            "purchase_module.access",
            "purchase_request.create",
            "purchase_request.view_own",
            "purchase_attachment.view",
        ],
    },
    {
        slug: "almoxarifado",
        name: "Almoxarifado",
        description: "Assume solicitações, atualiza status, registra cotações, compras e recebimentos.",
        permissions: [
            "purchase_module.access",
            "purchase_panel.view",
            "purchase_request.view_all",
            "purchase_request.assign",
            "purchase_request.change_status",
            "purchase_quote.manage",
            "purchase_order.manage",
            "purchase_receipt.manage",
            "purchase_attachment.view",
        ],
    },
    {
        slug: "aprovador",
        name: "Aprovador",
        description: "Visualiza valores, analisa aprovações e acompanha relatórios financeiros.",
        permissions: [
            "purchase_module.access",
            "purchase_panel.view",
            "purchase_request.view_all",
            "purchase_approval.manage",
            "purchase_financial.view",
            "purchase_report.view",
            "purchase_attachment.view",
        ],
    },
    {
        slug: "administrador_modulo",
        name: "Administrador do módulo",
        description: "Acessa e configura todas as funções de compras e almoxarifado.",
        permissions: PURCHASE_PERMISSION_KEYS,
    },
];

const PURCHASE_REQUEST_STATUS = [
    "rascunho",
    "aguardando_almoxarifado",
    "em_analise",
    "aguardando_informacoes",
    "em_cotacao",
    "aguardando_aprovacao",
    "aprovada_para_compra",
    "compra_realizada",
    "recebida_parcialmente",
    "concluida",
    "rejeitada",
    "cancelada",
];

const PURCHASE_ITEM_STATUS = [
    "pendente",
    "em_analise",
    "aguardando_informacoes",
    "em_cotacao",
    "aguardando_aprovacao",
    "aprovado",
    "comprado",
    "recebido_parcialmente",
    "recebido",
    "disponivel_estoque",
    "rejeitado",
    "cancelado",
];

const PURCHASE_FINAL_REQUEST_STATUS = ["concluida", "rejeitada", "cancelada"];
const PURCHASE_FINAL_ITEM_STATUS = ["recebido", "disponivel_estoque", "rejeitado", "cancelado"];
const PURCHASE_OPEN_REQUEST_STATUS = [
    "aguardando_almoxarifado",
    "em_analise",
    "aguardando_informacoes",
    "em_cotacao",
    "aguardando_aprovacao",
    "aprovada_para_compra",
    "compra_realizada",
    "recebida_parcialmente",
];

const PURCHASE_STATUS_TRANSITIONS = {
    rascunho: ["aguardando_almoxarifado", "cancelada"],
    aguardando_almoxarifado: ["em_analise", "aguardando_informacoes", "em_cotacao", "cancelada"],
    em_analise: ["aguardando_informacoes", "em_cotacao", "aguardando_aprovacao", "aprovada_para_compra", "rejeitada", "cancelada"],
    aguardando_informacoes: ["em_analise", "em_cotacao", "cancelada"],
    em_cotacao: ["aguardando_aprovacao", "aprovada_para_compra", "compra_realizada", "rejeitada", "cancelada"],
    aguardando_aprovacao: ["aprovada_para_compra", "rejeitada", "cancelada"],
    aprovada_para_compra: ["compra_realizada", "cancelada"],
    compra_realizada: ["recebida_parcialmente", "concluida", "cancelada"],
    recebida_parcialmente: ["compra_realizada", "concluida", "cancelada"],
    concluida: [],
    rejeitada: [],
    cancelada: [],
};

const PURCHASE_ITEM_STATUS_TRANSITIONS = {
    pendente: ["em_analise", "aguardando_informacoes", "em_cotacao", "aprovado", "disponivel_estoque", "rejeitado", "cancelado"],
    em_analise: ["aguardando_informacoes", "em_cotacao", "aprovado", "disponivel_estoque", "rejeitado", "cancelado"],
    aguardando_informacoes: ["em_analise", "em_cotacao", "rejeitado", "cancelado"],
    em_cotacao: ["aguardando_aprovacao", "aprovado", "comprado", "rejeitado", "cancelado"],
    aguardando_aprovacao: ["aprovado", "rejeitado", "cancelado"],
    aprovado: ["comprado", "recebido_parcialmente", "recebido", "cancelado"],
    comprado: ["recebido_parcialmente", "recebido", "cancelado"],
    recebido_parcialmente: ["comprado", "recebido", "cancelado"],
    recebido: [],
    disponivel_estoque: [],
    rejeitado: [],
    cancelado: [],
};

const PURCHASE_REQUEST_TYPES = ["normal", "urgente", "mensal"];
const PURCHASE_UNITS = ["unidade", "caixa", "pacote", "metro", "rolo", "quilograma", "litro", "outro"];
const PURCHASE_QUOTE_STATUS = ["aguardando_retorno", "selecionada", "descartada"];
const PURCHASE_RECEIPT_CONDITIONS = ["correto", "incorreto", "danificado", "quantidade_incompleta"];
const DEFAULT_PURCHASE_CATEGORIES = [
    "Material de escritório",
    "Equipamentos",
    "Ferramentas",
    "Limpeza",
    "EPIs",
    "Peças e manutenção",
    "Serviços",
    "Outros",
];
const PURCHASE_UPLOAD_MAX_SIZE_MB = 50;
const PURCHASE_UPLOAD_MAX_SIZE_BYTES = PURCHASE_UPLOAD_MAX_SIZE_MB * 1024 * 1024;
const PURCHASE_EXPORT_MAX_ROWS = 5000;
const PURCHASE_EXPORT_PURCHASE_SITUATIONS = ["sem_compra", "com_compra", "compra_parcial", "compra_total"];
const PURCHASE_EXPORT_RECEIPT_SITUATIONS = ["sem_recebimento", "recebimento_parcial", "recebido_total"];
const PURCHASE_ALLOWED_EXTENSIONS = new Set([
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".csv",
    ".txt",
]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PURCHASE_UPLOAD_ROOT = path.resolve(__dirname, "../../../uploads/compras");

let purchaseTablesEnsured = false;
let purchaseTablesEnsuredPromise = null;

const limitText = (value, limit = 255) => String(value || "").trim().replace(/\s+/g, " ").slice(0, limit);
const normalizeLongText = (value, limit = 5000) => String(value || "").trim().slice(0, limit);
const toNullableNumber = (value) => {
    if (value === undefined || value === null || value === "" || value === "null") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};
const toPositiveNumber = (value, fallback = 0) => {
    const number = Number(String(value ?? "").replace(",", "."));
    return Number.isFinite(number) && number >= 0 ? number : fallback;
};
const normalizeBoolean = (value, fallback = false) => {
    if (value === undefined || value === null || value === "") return fallback;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;
    return ["1", "true", "sim", "yes", "on"].includes(String(value).trim().toLowerCase());
};
const parseJson = (value, fallback) => {
    if (value === undefined || value === null || value === "") return fallback;
    if (typeof value === "object") return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
};
const stringifyJson = (value) => JSON.stringify(value || {});
const normalizeDate = (value) => {
    const text = String(value || "").trim();
    if (!text) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
};
const normalizeDateTime = (value) => {
    const text = String(value || "").trim();
    if (!text) return null;
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 19).replace("T", " ");
};
const normalizeUrl = (value) => {
    const text = limitText(value, 1000);
    if (!text) return "";
    try {
        const url = new URL(text);
        return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
    } catch {
        return "";
    }
};

const normalizeEnum = (value, allowed, fallback) => {
    const text = String(value || "").trim().toLowerCase();
    return allowed.includes(text) ? text : fallback;
};
const normalizePermissionsObject = (permissions = {}) => {
    const input = permissions && typeof permissions === "object" ? permissions : {};
    return Object.fromEntries(
        Object.entries(input)
            .filter(([key]) => PURCHASE_PERMISSION_KEYS.includes(key))
            .map(([key, value]) => [key, Boolean(value)])
    );
};
const permissionsArrayToObject = (permissions = []) => (
    Object.fromEntries(
        permissions
            .filter((permission) => PURCHASE_PERMISSION_KEYS.includes(permission))
            .map((permission) => [permission, true])
    )
);
const normalizeFileName = (name = "arquivo") => {
    const baseName = path.basename(String(name || "arquivo"));
    const ext = path.extname(baseName).replace(/[^a-zA-Z0-9.]/g, "").slice(0, 24);
    const base = path.basename(baseName, path.extname(baseName))
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 90) || "arquivo";
    return `${base}${ext}`;
};
const normalizeUploadSegment = (value = "geral") => (
    String(value || "geral").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "geral"
);
const buildUploadUrl = (empresaId, filename) => (
    `/uploads/compras/${normalizeUploadSegment(empresaId)}/${filename}`
);
const buildPurchaseItemImageSelect = (requestAlias = "pr") => `
            (
                SELECT image_attachment.file_url
                FROM purchase_attachments image_attachment
                JOIN purchase_request_items image_item ON image_item.id = image_attachment.request_item_id
                WHERE image_item.request_id = ${requestAlias}.id
                  AND image_item.deleted_at IS NULL
                  AND image_attachment.deleted_at IS NULL
                  AND image_attachment.request_item_id IS NOT NULL
                  AND (
                    LOWER(COALESCE(image_attachment.file_mime, '')) LIKE 'image/%'
                    OR LOWER(COALESCE(image_attachment.file_name, '')) LIKE '%.jpg'
                    OR LOWER(COALESCE(image_attachment.file_name, '')) LIKE '%.jpeg'
                    OR LOWER(COALESCE(image_attachment.file_name, '')) LIKE '%.png'
                    OR LOWER(COALESCE(image_attachment.file_name, '')) LIKE '%.webp'
                  )
                ORDER BY image_item.id ASC, image_attachment.id ASC
                LIMIT 1
            ) AS item_image_url,
            (
                SELECT image_attachment.file_name
                FROM purchase_attachments image_attachment
                JOIN purchase_request_items image_item ON image_item.id = image_attachment.request_item_id
                WHERE image_item.request_id = ${requestAlias}.id
                  AND image_item.deleted_at IS NULL
                  AND image_attachment.deleted_at IS NULL
                  AND image_attachment.request_item_id IS NOT NULL
                  AND (
                    LOWER(COALESCE(image_attachment.file_mime, '')) LIKE 'image/%'
                    OR LOWER(COALESCE(image_attachment.file_name, '')) LIKE '%.jpg'
                    OR LOWER(COALESCE(image_attachment.file_name, '')) LIKE '%.jpeg'
                    OR LOWER(COALESCE(image_attachment.file_name, '')) LIKE '%.png'
                    OR LOWER(COALESCE(image_attachment.file_name, '')) LIKE '%.webp'
                  )
                ORDER BY image_item.id ASC, image_attachment.id ASC
                LIMIT 1
            ) AS item_image_name,
            (
                SELECT image_attachment.file_mime
                FROM purchase_attachments image_attachment
                JOIN purchase_request_items image_item ON image_item.id = image_attachment.request_item_id
                WHERE image_item.request_id = ${requestAlias}.id
                  AND image_item.deleted_at IS NULL
                  AND image_attachment.deleted_at IS NULL
                  AND image_attachment.request_item_id IS NOT NULL
                  AND (
                    LOWER(COALESCE(image_attachment.file_mime, '')) LIKE 'image/%'
                    OR LOWER(COALESCE(image_attachment.file_name, '')) LIKE '%.jpg'
                    OR LOWER(COALESCE(image_attachment.file_name, '')) LIKE '%.jpeg'
                    OR LOWER(COALESCE(image_attachment.file_name, '')) LIKE '%.png'
                    OR LOWER(COALESCE(image_attachment.file_name, '')) LIKE '%.webp'
                  )
                ORDER BY image_item.id ASC, image_attachment.id ASC
                LIMIT 1
            ) AS item_image_mime
`;
const resolvePurchaseUploadPath = (fileUrl = "") => {
    const prefix = "/uploads/compras/";
    const value = String(fileUrl || "");
    if (!value.startsWith(prefix)) return null;

    const relativePath = value
        .slice(prefix.length)
        .split("/")
        .map((segment, index, parts) => {
            const decoded = path.basename(decodeURIComponent(segment));
            if (index === parts.length - 1) {
                return decoded.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 180);
            }
            return normalizeUploadSegment(decoded);
        })
        .filter(Boolean);

    if (!relativePath.length) return null;
    return path.resolve(PURCHASE_UPLOAD_ROOT, ...relativePath);
};
const removeUploadedFiles = (files = []) => {
    files.filter(Boolean).forEach((file) => {
        if (file?.path) fs.rmSync(file.path, { force: true });
    });
};
const removeStoredPurchaseFiles = (fileUrls = []) => {
    fileUrls
        .map(resolvePurchaseUploadPath)
        .filter((filePath) => filePath && filePath.startsWith(PURCHASE_UPLOAD_ROOT))
        .forEach((filePath) => fs.rmSync(filePath, { force: true }));
};
const formatUser = (row, prefix) => {
    const id = row?.[`${prefix}_id`];
    if (!id) return null;
    return {
        id,
        nome: row?.[`${prefix}_nome`] || null,
        email: row?.[`${prefix}_email`] || null,
    };
};

const purchaseUploadStorage = multer.diskStorage({
    destination: (req, _file, callback) => {
        const empresaDir = normalizeUploadSegment(req.user?.empresa_id || req.admin?.empresa_id);
        const destination = path.join(PURCHASE_UPLOAD_ROOT, empresaDir);
        fs.mkdirSync(destination, { recursive: true });
        callback(null, destination);
    },
    filename: (_req, file, callback) => {
        callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${normalizeFileName(file.originalname)}`);
    },
});

const purchaseUpload = multer({
    storage: purchaseUploadStorage,
    limits: {
        fileSize: PURCHASE_UPLOAD_MAX_SIZE_BYTES,
        files: 12,
    },
    fileFilter: (_req, file, callback) => {
        const ext = path.extname(file.originalname || "").toLowerCase();
        if (PURCHASE_ALLOWED_EXTENSIONS.has(ext)) {
            callback(null, true);
            return;
        }
        callback(new Error("Arquivo inválido. Envie imagens, PDF, documentos, planilhas, CSV ou TXT."));
    },
});

const uploadPurchaseFiles = (req, res, next) => {
    purchaseUpload.any()(req, res, (err) => {
        if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({ error: `Arquivo muito grande. Envie anexos de até ${PURCHASE_UPLOAD_MAX_SIZE_MB} MB.` });
        }
        if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_COUNT") {
            return res.status(413).json({ error: "Muitos arquivos enviados de uma vez." });
        }
        if (err) {
            console.error("Erro ao processar anexos de compras:", err);
            return res.status(400).json({ error: err.message || "Não foi possível anexar o arquivo." });
        }
        return next();
    });
};

export const ensurePurchaseTables = async () => {
    if (purchaseTablesEnsured) return;
    if (purchaseTablesEnsuredPromise) return purchaseTablesEnsuredPromise;

    purchaseTablesEnsuredPromise = (async () => {
        await db.query(`
            CREATE TABLE IF NOT EXISTS purchase_permission_profiles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                empresa_id INT NOT NULL,
                name VARCHAR(120) NOT NULL,
                slug VARCHAR(80) NOT NULL,
                description VARCHAR(500) DEFAULT NULL,
                permissions_json LONGTEXT NOT NULL,
                is_builtin TINYINT(1) NOT NULL DEFAULT 0,
                created_by INT DEFAULT NULL,
                updated_by INT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
                FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL,
                FOREIGN KEY (updated_by) REFERENCES usuarios(id) ON DELETE SET NULL,
                UNIQUE KEY unique_purchase_profile_empresa_slug (empresa_id, slug),
                INDEX idx_purchase_profiles_empresa (empresa_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS purchase_permissions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                empresa_id INT NOT NULL,
                subject_type ENUM('user', 'role', 'department') NOT NULL,
                subject_id INT NOT NULL DEFAULT 0,
                subject_key VARCHAR(100) NOT NULL DEFAULT '',
                profile_id INT DEFAULT NULL,
                permissions_json LONGTEXT DEFAULT NULL,
                access_blocked TINYINT(1) NOT NULL DEFAULT 0,
                created_by INT DEFAULT NULL,
                updated_by INT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
                FOREIGN KEY (profile_id) REFERENCES purchase_permission_profiles(id) ON DELETE SET NULL,
                FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL,
                FOREIGN KEY (updated_by) REFERENCES usuarios(id) ON DELETE SET NULL,
                UNIQUE KEY unique_purchase_permission_subject (empresa_id, subject_type, subject_id, subject_key),
                INDEX idx_purchase_permissions_empresa_subject (empresa_id, subject_type),
                INDEX idx_purchase_permissions_profile (profile_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await db.query(`
            UPDATE purchase_permissions
            SET subject_id = 0
            WHERE subject_id IS NULL
        `);

        await db.query(`
            UPDATE purchase_permissions
            SET subject_key = ''
            WHERE subject_key IS NULL
        `);

        await db.query(`
            ALTER TABLE purchase_permissions
            MODIFY COLUMN subject_id INT NOT NULL DEFAULT 0,
            MODIFY COLUMN subject_key VARCHAR(100) NOT NULL DEFAULT ''
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS purchase_categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                empresa_id INT NOT NULL,
                name VARCHAR(160) NOT NULL,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                created_by INT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
                FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL,
                UNIQUE KEY unique_purchase_category_empresa_name (empresa_id, name),
                INDEX idx_purchase_categories_empresa_active (empresa_id, is_active, name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS purchase_suppliers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                empresa_id INT NOT NULL,
                name VARCHAR(180) NOT NULL,
                cnpj VARCHAR(32) DEFAULT NULL,
                contact_name VARCHAR(160) DEFAULT NULL,
                phone VARCHAR(80) DEFAULT NULL,
                email VARCHAR(160) DEFAULT NULL,
                notes TEXT DEFAULT NULL,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                created_by INT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
                FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL,
                UNIQUE KEY unique_purchase_supplier_empresa_name (empresa_id, name),
                INDEX idx_purchase_suppliers_empresa_active (empresa_id, is_active, name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS purchase_sequences (
                empresa_id INT NOT NULL,
                sequence_year INT NOT NULL,
                last_number INT NOT NULL DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (empresa_id, sequence_year),
                FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS purchase_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                empresa_id INT NOT NULL,
                code VARCHAR(30) DEFAULT NULL,
                requester_id INT NOT NULL,
                department_id INT DEFAULT NULL,
                assigned_user_id INT DEFAULT NULL,
                status VARCHAR(40) NOT NULL DEFAULT 'rascunho',
                request_type VARCHAR(20) NOT NULL DEFAULT 'normal',
                priority VARCHAR(20) NOT NULL DEFAULT 'normal',
                is_monthly TINYINT(1) NOT NULL DEFAULT 0,
                needed_at DATE DEFAULT NULL,
                cost_center VARCHAR(120) DEFAULT NULL,
                company_unit VARCHAR(160) DEFAULT NULL,
                justification TEXT DEFAULT NULL,
                notes TEXT DEFAULT NULL,
                estimated_total DECIMAL(14,2) NOT NULL DEFAULT 0,
                actual_total DECIMAL(14,2) NOT NULL DEFAULT 0,
                submitted_at TIMESTAMP NULL DEFAULT NULL,
                completed_at TIMESTAMP NULL DEFAULT NULL,
                cancelled_at TIMESTAMP NULL DEFAULT NULL,
                cancellation_reason TEXT DEFAULT NULL,
                deleted_at TIMESTAMP NULL DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
                FOREIGN KEY (requester_id) REFERENCES usuarios(id),
                FOREIGN KEY (department_id) REFERENCES setores(id) ON DELETE SET NULL,
                FOREIGN KEY (assigned_user_id) REFERENCES usuarios(id) ON DELETE SET NULL,
                UNIQUE KEY unique_purchase_request_code (code),
                INDEX idx_purchase_requests_empresa_status (empresa_id, status, updated_at),
                INDEX idx_purchase_requests_requester (requester_id, created_at),
                INDEX idx_purchase_requests_department (department_id, created_at),
                INDEX idx_purchase_requests_assigned (assigned_user_id, status),
                INDEX idx_purchase_requests_needed (needed_at),
                INDEX idx_purchase_requests_deleted (deleted_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS purchase_request_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                request_id INT NOT NULL,
                category_id INT DEFAULT NULL,
                description VARCHAR(500) NOT NULL,
                brand VARCHAR(160) DEFAULT NULL,
                model VARCHAR(160) DEFAULT NULL,
                unit VARCHAR(40) NOT NULL DEFAULT 'unidade',
                stock_quantity DECIMAL(14,3) NOT NULL DEFAULT 0,
                requested_quantity DECIMAL(14,3) NOT NULL DEFAULT 0,
                approved_quantity DECIMAL(14,3) NOT NULL DEFAULT 0,
                purchased_quantity DECIMAL(14,3) NOT NULL DEFAULT 0,
                received_quantity DECIMAL(14,3) NOT NULL DEFAULT 0,
                reference_url VARCHAR(1000) DEFAULT NULL,
                estimated_unit_price DECIMAL(14,2) NOT NULL DEFAULT 0,
                requester_notes TEXT DEFAULT NULL,
                purchase_reason TEXT DEFAULT NULL,
                item_status VARCHAR(40) NOT NULL DEFAULT 'pendente',
                supplier_id INT DEFAULT NULL,
                unit_price DECIMAL(14,2) NOT NULL DEFAULT 0,
                shipping_price DECIMAL(14,2) NOT NULL DEFAULT 0,
                discount DECIMAL(14,2) NOT NULL DEFAULT 0,
                total_price DECIMAL(14,2) NOT NULL DEFAULT 0,
                supplier_order_number VARCHAR(120) DEFAULT NULL,
                purchased_at DATE DEFAULT NULL,
                expected_delivery_at DATE DEFAULT NULL,
                received_at DATE DEFAULT NULL,
                rejection_reason TEXT DEFAULT NULL,
                deleted_at TIMESTAMP NULL DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE,
                FOREIGN KEY (category_id) REFERENCES purchase_categories(id) ON DELETE SET NULL,
                FOREIGN KEY (supplier_id) REFERENCES purchase_suppliers(id) ON DELETE SET NULL,
                INDEX idx_purchase_items_request (request_id, item_status),
                INDEX idx_purchase_items_category (category_id),
                INDEX idx_purchase_items_deleted (deleted_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS purchase_quotes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                request_item_id INT NOT NULL,
                supplier_id INT DEFAULT NULL,
                supplier_name VARCHAR(180) DEFAULT NULL,
                cnpj VARCHAR(32) DEFAULT NULL,
                seller_name VARCHAR(160) DEFAULT NULL,
                phone VARCHAR(80) DEFAULT NULL,
                email VARCHAR(160) DEFAULT NULL,
                link VARCHAR(1000) DEFAULT NULL,
                quantity DECIMAL(14,3) NOT NULL DEFAULT 0,
                unit_price DECIMAL(14,2) NOT NULL DEFAULT 0,
                shipping_price DECIMAL(14,2) NOT NULL DEFAULT 0,
                discount DECIMAL(14,2) NOT NULL DEFAULT 0,
                subtotal DECIMAL(14,2) NOT NULL DEFAULT 0,
                total_price DECIMAL(14,2) NOT NULL DEFAULT 0,
                delivery_days INT DEFAULT NULL,
                valid_until DATE DEFAULT NULL,
                payment_method VARCHAR(160) DEFAULT NULL,
                status VARCHAR(40) NOT NULL DEFAULT 'aguardando_retorno',
                discard_reason TEXT DEFAULT NULL,
                notes TEXT DEFAULT NULL,
                created_by INT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (request_item_id) REFERENCES purchase_request_items(id) ON DELETE CASCADE,
                FOREIGN KEY (supplier_id) REFERENCES purchase_suppliers(id) ON DELETE SET NULL,
                FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL,
                INDEX idx_purchase_quotes_item (request_item_id, status),
                INDEX idx_purchase_quotes_supplier (supplier_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS purchase_orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                request_id INT NOT NULL,
                supplier_id INT DEFAULT NULL,
                supplier_name VARCHAR(180) DEFAULT NULL,
                quote_id INT DEFAULT NULL,
                order_number VARCHAR(120) DEFAULT NULL,
                purchase_date DATE DEFAULT NULL,
                expected_delivery_at DATE DEFAULT NULL,
                payment_method VARCHAR(160) DEFAULT NULL,
                subtotal DECIMAL(14,2) NOT NULL DEFAULT 0,
                shipping_price DECIMAL(14,2) NOT NULL DEFAULT 0,
                discount DECIMAL(14,2) NOT NULL DEFAULT 0,
                total_price DECIMAL(14,2) NOT NULL DEFAULT 0,
                notes TEXT DEFAULT NULL,
                created_by INT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE,
                FOREIGN KEY (supplier_id) REFERENCES purchase_suppliers(id) ON DELETE SET NULL,
                FOREIGN KEY (quote_id) REFERENCES purchase_quotes(id) ON DELETE SET NULL,
                FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL,
                INDEX idx_purchase_orders_request (request_id, created_at),
                INDEX idx_purchase_orders_supplier (supplier_id),
                INDEX idx_purchase_orders_date (purchase_date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS purchase_order_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                purchase_order_id INT NOT NULL,
                request_item_id INT NOT NULL,
                quantity DECIMAL(14,3) NOT NULL DEFAULT 0,
                unit_price DECIMAL(14,2) NOT NULL DEFAULT 0,
                shipping_price DECIMAL(14,2) NOT NULL DEFAULT 0,
                discount DECIMAL(14,2) NOT NULL DEFAULT 0,
                total_price DECIMAL(14,2) NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
                FOREIGN KEY (request_item_id) REFERENCES purchase_request_items(id) ON DELETE CASCADE,
                INDEX idx_purchase_order_items_order (purchase_order_id),
                INDEX idx_purchase_order_items_item (request_item_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS purchase_receipts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                request_item_id INT NOT NULL,
                purchase_order_id INT DEFAULT NULL,
                quantity_received DECIMAL(14,3) NOT NULL DEFAULT 0,
                condition_status VARCHAR(40) NOT NULL DEFAULT 'correto',
                storage_location VARCHAR(180) DEFAULT NULL,
                received_by INT DEFAULT NULL,
                received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                notes TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (request_item_id) REFERENCES purchase_request_items(id) ON DELETE CASCADE,
                FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE SET NULL,
                FOREIGN KEY (received_by) REFERENCES usuarios(id) ON DELETE SET NULL,
                INDEX idx_purchase_receipts_item (request_item_id, received_at),
                INDEX idx_purchase_receipts_order (purchase_order_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS purchase_approvals (
                id INT AUTO_INCREMENT PRIMARY KEY,
                request_id INT NOT NULL,
                approver_id INT NOT NULL,
                decision ENUM('aprovado', 'rejeitado', 'ajustes') NOT NULL,
                justification TEXT DEFAULT NULL,
                approved_value DECIMAL(14,2) NOT NULL DEFAULT 0,
                decided_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE,
                FOREIGN KEY (approver_id) REFERENCES usuarios(id),
                INDEX idx_purchase_approvals_request (request_id, decided_at),
                INDEX idx_purchase_approvals_approver (approver_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS purchase_comments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                request_id INT NOT NULL,
                parent_id INT DEFAULT NULL,
                user_id INT NOT NULL,
                message TEXT NOT NULL,
                is_important TINYINT(1) NOT NULL DEFAULT 0,
                deleted_at TIMESTAMP NULL DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE,
                FOREIGN KEY (parent_id) REFERENCES purchase_comments(id) ON DELETE SET NULL,
                FOREIGN KEY (user_id) REFERENCES usuarios(id),
                INDEX idx_purchase_comments_request (request_id, created_at),
                INDEX idx_purchase_comments_user (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS purchase_attachments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                request_id INT NOT NULL,
                request_item_id INT DEFAULT NULL,
                comment_id INT DEFAULT NULL,
                quote_id INT DEFAULT NULL,
                order_id INT DEFAULT NULL,
                receipt_id INT DEFAULT NULL,
                file_url VARCHAR(1000) NOT NULL,
                file_name VARCHAR(255) NOT NULL,
                file_mime VARCHAR(180) DEFAULT NULL,
                file_size BIGINT DEFAULT NULL,
                attachment_type VARCHAR(60) NOT NULL DEFAULT 'geral',
                uploaded_by INT DEFAULT NULL,
                deleted_at TIMESTAMP NULL DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE,
                FOREIGN KEY (request_item_id) REFERENCES purchase_request_items(id) ON DELETE CASCADE,
                FOREIGN KEY (comment_id) REFERENCES purchase_comments(id) ON DELETE SET NULL,
                FOREIGN KEY (quote_id) REFERENCES purchase_quotes(id) ON DELETE SET NULL,
                FOREIGN KEY (order_id) REFERENCES purchase_orders(id) ON DELETE SET NULL,
                FOREIGN KEY (receipt_id) REFERENCES purchase_receipts(id) ON DELETE SET NULL,
                FOREIGN KEY (uploaded_by) REFERENCES usuarios(id) ON DELETE SET NULL,
                INDEX idx_purchase_attachments_request (request_id, deleted_at),
                INDEX idx_purchase_attachments_item (request_item_id),
                INDEX idx_purchase_attachments_comment (comment_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS purchase_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                empresa_id INT NOT NULL,
                request_id INT DEFAULT NULL,
                entity_type VARCHAR(80) NOT NULL DEFAULT 'request',
                entity_id INT DEFAULT NULL,
                user_id INT DEFAULT NULL,
                action VARCHAR(120) NOT NULL,
                old_value LONGTEXT DEFAULT NULL,
                new_value LONGTEXT DEFAULT NULL,
                ip_address VARCHAR(80) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
                FOREIGN KEY (request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE SET NULL,
                INDEX idx_purchase_history_request (request_id, created_at),
                INDEX idx_purchase_history_empresa (empresa_id, created_at),
                INDEX idx_purchase_history_entity (entity_type, entity_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS purchase_notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                empresa_id INT NOT NULL,
                user_id INT NOT NULL,
                request_id INT DEFAULT NULL,
                type VARCHAR(80) NOT NULL,
                title VARCHAR(180) NOT NULL,
                message VARCHAR(500) DEFAULT NULL,
                read_at TIMESTAMP NULL DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
                FOREIGN KEY (request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE,
                INDEX idx_purchase_notifications_user_read (user_id, read_at, created_at),
                INDEX idx_purchase_notifications_request (request_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS purchase_recurring_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                request_id INT NOT NULL,
                recreate_next_month TINYINT(1) NOT NULL DEFAULT 0,
                day_of_month INT DEFAULT NULL,
                reviewer_user_id INT DEFAULT NULL,
                repeat_items TINYINT(1) NOT NULL DEFAULT 1,
                keep_quantities TINYINT(1) NOT NULL DEFAULT 1,
                keep_links_values TINYINT(1) NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE,
                FOREIGN KEY (reviewer_user_id) REFERENCES usuarios(id) ON DELETE SET NULL,
                UNIQUE KEY unique_purchase_recurring_request (request_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        purchaseTablesEnsured = true;
    })();

    try {
        await purchaseTablesEnsuredPromise;
    } finally {
        purchaseTablesEnsuredPromise = null;
    }
};

const seedPurchaseDefaults = async (empresaId, userId = null, connection = db) => {
    await ensurePurchaseTables();

    for (const profile of PURCHASE_DEFAULT_PROFILES) {
        await connection.query(`
            INSERT INTO purchase_permission_profiles (
                empresa_id,
                name,
                slug,
                description,
                permissions_json,
                is_builtin,
                created_by,
                updated_by
            )
            VALUES (?, ?, ?, ?, ?, 1, ?, ?)
            ON DUPLICATE KEY UPDATE
                slug = VALUES(slug),
                is_builtin = 1
        `, [
            empresaId,
            profile.name,
            profile.slug,
            profile.description,
            stringifyJson(permissionsArrayToObject(profile.permissions)),
            userId,
            userId,
        ]);
    }

    for (const category of DEFAULT_PURCHASE_CATEGORIES) {
        await connection.query(`
            INSERT INTO purchase_categories (empresa_id, name, created_by)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE name = VALUES(name)
        `, [empresaId, category, userId]);
    }
};

const fetchPurchaseProfiles = async (empresaId) => {
    await seedPurchaseDefaults(empresaId);
    const [rows] = await db.query(`
        SELECT id, name, slug, description, permissions_json, is_builtin, created_at, updated_at
        FROM purchase_permission_profiles
        WHERE empresa_id = ?
        ORDER BY is_builtin DESC, name ASC
    `, [empresaId]);

    return rows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description || "",
        permissions: normalizePermissionsObject(parseJson(row.permissions_json, {})),
        is_builtin: Boolean(row.is_builtin),
        created_at: row.created_at,
        updated_at: row.updated_at,
    }));
};

const resolvePurchasePermissions = async (user = {}) => {
    await seedPurchaseDefaults(user.empresa_id);

    if (user?.perfil === PERFIL_ADMIN) {
        return {
            permissions: { ...ALL_PURCHASE_PERMISSIONS },
            blocked: false,
            grants: [],
            is_admin: true,
        };
    }

    const [rows] = await db.query(`
        SELECT
            pp.*,
            ppp.permissions_json AS profile_permissions_json,
            ppp.name AS profile_name,
            ppp.slug AS profile_slug
        FROM purchase_permissions pp
        LEFT JOIN purchase_permission_profiles ppp ON ppp.id = pp.profile_id
        WHERE pp.empresa_id = ?
          AND (
            (pp.subject_type = 'role' AND pp.subject_key = ?)
            OR (pp.subject_type = 'department' AND pp.subject_id = ?)
            OR (pp.subject_type = 'user' AND pp.subject_id = ?)
          )
        ORDER BY FIELD(pp.subject_type, 'role', 'department', 'user'), pp.id ASC
    `, [
        user.empresa_id,
        user.perfil || "",
        user.setor_id || 0,
        user.id,
    ]);

    const resolved = {};
    let blocked = false;

    rows.forEach((row) => {
        if (row.subject_type === "user" && row.access_blocked) {
            blocked = true;
        }

        const profilePermissions = normalizePermissionsObject(parseJson(row.profile_permissions_json, {}));
        const directPermissions = normalizePermissionsObject(parseJson(row.permissions_json, {}));

        [profilePermissions, directPermissions].forEach((permissions) => {
            Object.entries(permissions).forEach(([key, enabled]) => {
                if (enabled) {
                    resolved[key] = true;
                } else {
                    delete resolved[key];
                }
            });
        });
    });

    if (blocked) {
        return {
            permissions: {},
            blocked: true,
            grants: rows,
            is_admin: false,
        };
    }

    return {
        permissions: resolved,
        blocked: false,
        grants: rows,
        is_admin: false,
    };
};

export const userHasPurchasePermission = async (user = {}, permission) => {
    const access = await resolvePurchasePermissions(user);
    return Boolean(access.permissions?.[permission]);
};

const requirePurchasePermission = (permission) => async (req, res, next) => {
    try {
        const access = await resolvePurchasePermissions(req.user);
        req.purchaseAccess = access;

        if (!access.permissions?.[permission]) {
            return res.status(403).json({ error: "Acesso negado" });
        }

        next();
    } catch (err) {
        console.error("Erro ao validar permissão de compras:", err);
        res.status(500).json({ error: "Erro ao validar permissões." });
    }
};

const requirePurchaseAdmin = async (req, res, next) => {
    try {
        const access = await resolvePurchasePermissions(req.user);
        req.purchaseAccess = access;

        if (req.user.perfil !== PERFIL_ADMIN && !access.permissions["purchase_permissions.manage"]) {
            return res.status(403).json({ error: "Acesso negado" });
        }

        next();
    } catch (err) {
        console.error("Erro ao validar administrador de compras:", err);
        res.status(500).json({ error: "Erro ao validar permissões." });
    }
};

const getViewScope = (permissions = {}) => {
    if (permissions["purchase_request.view_all"]) return "all";
    if (permissions["purchase_request.view_department"]) return "department";
    if (permissions["purchase_request.view_own"]) return "own";
    return "none";
};

const appendVisibilityFilter = (filters, params, user, access, alias = "pr") => {
    const scope = getViewScope(access.permissions || {});

    if (scope === "all") return;
    if (scope === "department" && user.setor_id) {
        filters.push(`(${alias}.requester_id = ? OR ${alias}.department_id = ?)`);
        params.push(user.id, user.setor_id);
        return;
    }
    if (scope === "own") {
        filters.push(`${alias}.requester_id = ?`);
        params.push(user.id);
        return;
    }

    filters.push("1 = 0");
};

const canViewRequestRow = (row, user, access) => {
    if (!row) return false;
    const scope = getViewScope(access.permissions || {});
    if (scope === "all") return true;
    if (scope === "department" && Number(row.department_id) === Number(user.setor_id)) return true;
    if (Number(row.requester_id) === Number(user.id) && scope !== "none") return true;
    return false;
};

const canAccessPurchasePanel = (access = {}, user = {}) => {
    const permissions = access.permissions || {};
    return Boolean(
        access.is_admin ||
        user?.perfil === PERFIL_ADMIN ||
        permissions["purchase_panel.view"] ||
        permissions["purchase_request.view_all"] ||
        permissions["purchase_request.view_department"] ||
        permissions["purchase_request.assign"] ||
        permissions["purchase_request.change_status"] ||
        permissions["purchase_quote.manage"] ||
        permissions["purchase_approval.manage"] ||
        permissions["purchase_order.manage"] ||
        permissions["purchase_receipt.manage"] ||
        permissions["purchase_report.view"] ||
        permissions["purchase_settings.manage"] ||
        permissions["purchase_permissions.manage"]
    );
};

const canAccessRequesterPurchases = (access = {}) => {
    const permissions = access.permissions || {};
    return Boolean(
        permissions["purchase_module.access"] &&
        (
            permissions["purchase_request.create"] ||
            permissions["purchase_request.view_own"] ||
            permissions["purchase_request.view_department"] ||
            permissions["purchase_request.view_all"]
        )
    );
};

const requirePurchasePanelAccess = async (req, res, next) => {
    try {
        const access = await resolvePurchasePermissions(req.user);
        req.purchaseAccess = access;

        if (!canAccessPurchasePanel(access, req.user)) {
            return res.status(403).json({ error: "Você não possui cargo para acessar este recurso." });
        }

        next();
    } catch (err) {
        console.error("Erro ao validar acesso ao painel do almoxarifado:", err);
        res.status(500).json({ error: "Erro ao validar permissões." });
    }
};

const requireRequesterPurchaseAccess = async (req, res, next) => {
    try {
        const access = await resolvePurchasePermissions(req.user);
        req.purchaseAccess = access;

        if (!canAccessRequesterPurchases(access)) {
            return res.status(403).json({ error: "Você não possui cargo para acessar este recurso." });
        }

        next();
    } catch (err) {
        console.error("Erro ao validar acesso às solicitações do usuário:", err);
        res.status(500).json({ error: "Erro ao validar permissões." });
    }
};

const logPurchaseHistory = async (connection, {
    empresaId,
    requestId = null,
    entityType = "request",
    entityId = null,
    userId = null,
    action,
    oldValue = null,
    newValue = null,
    req = null,
}) => {
    await connection.query(`
        INSERT INTO purchase_history (
            empresa_id,
            request_id,
            entity_type,
            entity_id,
            user_id,
            action,
            old_value,
            new_value,
            ip_address
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        empresaId,
        requestId,
        entityType,
        entityId,
        userId,
        action,
        oldValue === null ? null : stringifyJson(oldValue),
        newValue === null ? null : stringifyJson(newValue),
        req?.ip || req?.headers?.["x-forwarded-for"] || null,
    ]);
};

const fetchUsersWithAnyPurchasePermission = async (empresaId, permissions = []) => {
    const [users] = await db.query(`
        SELECT id, nome, email, empresa_id, setor_id, perfil
        FROM usuarios
        WHERE empresa_id = ?
          AND deletado_em IS NULL
    `, [empresaId]);

    const result = [];
    for (const user of users) {
        const access = await resolvePurchasePermissions(user);
        if (permissions.some((permission) => access.permissions?.[permission])) {
            result.push(user);
        }
    }

    return result;
};

const createPurchaseNotifications = async (req, {
    requestId,
    recipients = [],
    type,
    title,
    message = "",
}) => {
    const uniqueRecipients = [...new Set(recipients.map((id) => Number(id)).filter(Boolean))];
    if (!uniqueRecipients.length) return;

    const values = uniqueRecipients.map((userId) => [
        req.user.empresa_id,
        userId,
        requestId || null,
        limitText(type, 80),
        limitText(title, 180),
        limitText(message, 500),
    ]);

    await db.query(`
        INSERT INTO purchase_notifications (
            empresa_id,
            user_id,
            request_id,
            type,
            title,
            message
        )
        VALUES ?
    `, [values]);

    const io = req.app?.get?.("io");
    if (io) {
        uniqueRecipients.forEach((userId) => {
            io.to(`user_${userId}`).emit("purchase_notification", {
                request_id: requestId || null,
                type,
                title,
                message,
                created_at: new Date().toISOString(),
            });
        });
    }
};

const notifyStockTeam = async (req, payload) => {
    const users = await fetchUsersWithAnyPurchasePermission(req.user.empresa_id, [
        "purchase_request.assign",
        "purchase_request.change_status",
        "purchase_quote.manage",
        "purchase_order.manage",
    ]);
    await createPurchaseNotifications(req, {
        ...payload,
        recipients: users.map((user) => user.id),
    });
};

const validateUserInCompany = async (userId, empresaId) => {
    if (!userId) return null;
    const [rows] = await db.query(`
        SELECT id, nome, email, setor_id
        FROM usuarios
        WHERE id = ?
          AND empresa_id = ?
          AND deletado_em IS NULL
        LIMIT 1
    `, [userId, empresaId]);

    return rows[0] || null;
};

const validateDepartmentInCompany = async (departmentId, empresaId) => {
    if (!departmentId) return null;
    const [rows] = await db.query(`
        SELECT id, nome
        FROM setores
        WHERE id = ?
          AND empresa_id = ?
        LIMIT 1
    `, [departmentId, empresaId]);

    return rows[0] || null;
};

const findDepartmentByName = async (departmentName, empresaId) => {
    const name = limitText(departmentName, 160);
    if (!name) return null;
    const [rows] = await db.query(`
        SELECT id, nome
        FROM setores
        WHERE empresa_id = ?
          AND LOWER(nome) = LOWER(?)
        LIMIT 1
    `, [empresaId, name]);

    return rows[0] || null;
};

const findOrCreateCategory = async (connection, empresaId, name, userId) => {
    const categoryName = limitText(name, 160) || "Outros";
    await connection.query(`
        INSERT INTO purchase_categories (empresa_id, name, created_by)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE name = VALUES(name)
    `, [empresaId, categoryName, userId]);

    const [rows] = await connection.query(`
        SELECT id, name
        FROM purchase_categories
        WHERE empresa_id = ?
          AND name = ?
        LIMIT 1
    `, [empresaId, categoryName]);

    return rows[0] || null;
};

const findOrCreateSupplier = async (connection, empresaId, supplier = {}, userId = null) => {
    const name = limitText(supplier.name || supplier.supplier_name || supplier.fornecedor, 180);
    if (!name) return null;

    await connection.query(`
        INSERT INTO purchase_suppliers (
            empresa_id,
            name,
            cnpj,
            contact_name,
            phone,
            email,
            notes,
            created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            cnpj = COALESCE(VALUES(cnpj), cnpj),
            contact_name = COALESCE(VALUES(contact_name), contact_name),
            phone = COALESCE(VALUES(phone), phone),
            email = COALESCE(VALUES(email), email)
    `, [
        empresaId,
        name,
        limitText(supplier.cnpj, 32) || null,
        limitText(supplier.seller_name || supplier.contact_name, 160) || null,
        limitText(supplier.phone, 80) || null,
        limitText(supplier.email, 160) || null,
        normalizeLongText(supplier.notes, 1000) || null,
        userId,
    ]);

    const [rows] = await connection.query(`
        SELECT id, name
        FROM purchase_suppliers
        WHERE empresa_id = ?
          AND name = ?
        LIMIT 1
    `, [empresaId, name]);

    return rows[0] || null;
};

const generatePurchaseCode = async (connection, empresaId) => {
    const year = new Date().getFullYear();
    await connection.query(`
        INSERT INTO purchase_sequences (empresa_id, sequence_year, last_number)
        VALUES (?, ?, LAST_INSERT_ID(1))
        ON DUPLICATE KEY UPDATE last_number = LAST_INSERT_ID(last_number + 1)
    `, [empresaId, year]);

    const [rows] = await connection.query("SELECT LAST_INSERT_ID() AS next_number");
    const nextNumber = Number(rows[0]?.next_number || 1);
    return `SC-${year}-${String(nextNumber).padStart(4, "0")}`;
};

const recalculateRequestTotals = async (connection, requestId) => {
    await connection.query(`
        UPDATE purchase_requests pr
        SET
            estimated_total = COALESCE((
                SELECT SUM(pi.requested_quantity * pi.estimated_unit_price)
                FROM purchase_request_items pi
                WHERE pi.request_id = pr.id
                  AND pi.deleted_at IS NULL
            ), 0),
            actual_total = COALESCE((
                SELECT SUM(poi.total_price)
                FROM purchase_order_items poi
                JOIN purchase_request_items pi ON pi.id = poi.request_item_id
                WHERE pi.request_id = pr.id
                  AND pi.deleted_at IS NULL
            ), 0)
        WHERE pr.id = ?
    `, [requestId]);
};

const refreshRequestCompletion = async (connection, requestId) => {
    const [rows] = await connection.query(`
        SELECT
            COUNT(*) AS total_items,
            SUM(CASE WHEN item_status IN (?) THEN 1 ELSE 0 END) AS final_items,
            SUM(CASE WHEN purchased_quantity > 0 THEN 1 ELSE 0 END) AS purchased_items,
            SUM(CASE WHEN received_quantity > 0 AND received_quantity < requested_quantity THEN 1 ELSE 0 END) AS partial_received_items
        FROM purchase_request_items
        WHERE request_id = ?
          AND deleted_at IS NULL
    `, [PURCHASE_FINAL_ITEM_STATUS, requestId]);

    const row = rows[0] || {};
    const totalItems = Number(row.total_items || 0);
    const finalItems = Number(row.final_items || 0);
    const purchasedItems = Number(row.purchased_items || 0);
    const partialItems = Number(row.partial_received_items || 0);

    const [requestRows] = await connection.query(`
        SELECT status
        FROM purchase_requests
        WHERE id = ?
        LIMIT 1
    `, [requestId]);
    const currentStatus = requestRows[0]?.status;

    if (totalItems > 0 && totalItems === finalItems && !["cancelada", "rejeitada"].includes(currentStatus)) {
        await connection.query(`
            UPDATE purchase_requests
            SET status = 'concluida',
                completed_at = COALESCE(completed_at, NOW())
            WHERE id = ?
        `, [requestId]);
        return;
    }

    if (partialItems > 0 && !PURCHASE_FINAL_REQUEST_STATUS.includes(currentStatus)) {
        await connection.query(`
            UPDATE purchase_requests
            SET status = 'recebida_parcialmente'
            WHERE id = ?
              AND status IN ('compra_realizada', 'recebida_parcialmente')
        `, [requestId]);
        return;
    }

    if (purchasedItems > 0 && !PURCHASE_FINAL_REQUEST_STATUS.includes(currentStatus)) {
        await connection.query(`
            UPDATE purchase_requests
            SET status = 'compra_realizada'
            WHERE id = ?
              AND status IN ('aprovada_para_compra', 'em_cotacao', 'aguardando_aprovacao', 'compra_realizada')
        `, [requestId]);
    }
};

const fetchPurchaseRequestRow = async (requestId, empresaId) => {
    const [rows] = await db.query(`
        SELECT
            pr.*,
            requester.nome AS requester_nome,
            requester.email AS requester_email,
            department.nome AS department_name,
            assigned.nome AS assigned_nome,
            assigned.email AS assigned_email,
            SUBSTRING_INDEX(GROUP_CONCAT(pi.requested_quantity ORDER BY pi.id ASC SEPARATOR ' | '), ' | ', 1) AS first_item_requested_quantity,
            SUBSTRING_INDEX(GROUP_CONCAT(pi.unit ORDER BY pi.id ASC SEPARATOR ' | '), ' | ', 1) AS first_item_unit,
            ${buildPurchaseItemImageSelect("pr")},
            COUNT(DISTINCT pi.id) AS items_count,
            COUNT(DISTINCT pa.id) AS attachments_count,
            COUNT(DISTINCT pc.id) AS comments_count
        FROM purchase_requests pr
        JOIN usuarios requester ON requester.id = pr.requester_id
        LEFT JOIN setores department ON department.id = pr.department_id
        LEFT JOIN usuarios assigned ON assigned.id = pr.assigned_user_id
        LEFT JOIN purchase_request_items pi ON pi.request_id = pr.id AND pi.deleted_at IS NULL
        LEFT JOIN purchase_attachments pa ON pa.request_id = pr.id AND pa.deleted_at IS NULL
        LEFT JOIN purchase_comments pc ON pc.request_id = pr.id AND pc.deleted_at IS NULL
        WHERE pr.id = ?
          AND pr.empresa_id = ?
          AND pr.deleted_at IS NULL
        GROUP BY pr.id
        LIMIT 1
    `, [requestId, empresaId]);

    return rows[0] || null;
};

const getRowItemName = (row = {}) => (
    row.item_name
    || row.first_item_description
    || row.item_description
    || row.description
    || ""
);

const getRowItemQuantity = (row = {}) => (
    row.first_item_requested_quantity
    ?? row.requested_quantity
    ?? row.item_requested_quantity
    ?? null
);

const getRowItemUnit = (row = {}) => (
    row.first_item_unit
    || row.unit
    || row.item_unit
    || ""
);

const getRowItemImage = (row = {}) => {
    const url = row.item_image_url || row.imagem_url || row.foto_url || row.imageUrl || "";
    if (!url) return null;

    return {
        url,
        name: row.item_image_name || row.image_name || row.file_name || "",
        mime: row.item_image_mime || row.image_mime || "",
    };
};

const formatPurchaseRequest = (row, { includeFinancial = false } = {}) => ({
    id: row.id,
    code: row.code || null,
    status: row.status,
    request_type: row.request_type,
    priority: row.priority,
    is_monthly: Boolean(row.is_monthly),
    needed_at: row.needed_at,
    cost_center: row.cost_center || "",
    company_unit: row.company_unit || "",
    justification: row.justification || "",
    notes: row.notes || "",
    estimated_total: includeFinancial ? Number(row.estimated_total || 0) : null,
    actual_total: includeFinancial ? Number(row.actual_total || 0) : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    submitted_at: row.submitted_at,
    completed_at: row.completed_at,
    cancelled_at: row.cancelled_at,
    cancellation_reason: row.cancellation_reason || "",
    item_name: getRowItemName(row),
    first_item_description: getRowItemName(row),
    summary: getRowItemName(row) || row.justification || row.notes || "",
    requested_quantity: getRowItemQuantity(row) === null ? null : Number(getRowItemQuantity(row) || 0),
    unit: getRowItemUnit(row),
    item_image_url: getRowItemImage(row)?.url || null,
    item_image_name: getRowItemImage(row)?.name || "",
    item_image_mime: getRowItemImage(row)?.mime || "",
    item_image: getRowItemImage(row),
    items_count: Number(row.items_count || 0),
    attachments_count: Number(row.attachments_count || 0),
    comments_count: Number(row.comments_count || 0),
    unread_comments_count: 0,
    requester: {
        id: row.requester_id,
        nome: row.requester_nome || null,
        email: row.requester_email || null,
        department_id: row.department_id || null,
        department_name: row.department_name || null,
    },
    department: row.department_id ? {
        id: row.department_id,
        name: row.department_name || null,
    } : null,
    assigned_user: row.assigned_user_id ? {
        id: row.assigned_user_id,
        nome: row.assigned_nome || null,
        email: row.assigned_email || null,
    } : null,
});

const formatRequesterPurchaseRequest = (row) => ({
    id: row.id,
    code: row.code || null,
    status: row.status,
    request_type: row.request_type,
    priority: row.priority,
    is_monthly: Boolean(row.is_monthly),
    needed_at: row.needed_at,
    cost_center: row.cost_center || "",
    company_unit: row.company_unit || "",
    justification: row.justification || "",
    notes: row.notes || "",
    created_at: row.created_at,
    updated_at: row.updated_at,
    submitted_at: row.submitted_at,
    completed_at: row.completed_at,
    cancelled_at: row.cancelled_at,
    cancellation_reason: row.cancellation_reason || "",
    item_name: getRowItemName(row),
    first_item_description: getRowItemName(row),
    summary: getRowItemName(row) || row.justification || row.notes || "",
    requested_quantity: getRowItemQuantity(row) === null ? null : Number(getRowItemQuantity(row) || 0),
    unit: getRowItemUnit(row),
    item_image_url: getRowItemImage(row)?.url || null,
    item_image_name: getRowItemImage(row)?.name || "",
    item_image_mime: getRowItemImage(row)?.mime || "",
    item_image: getRowItemImage(row),
    items_count: Number(row.items_count || 0),
    attachments_count: Number(row.attachments_count || 0),
    comments_count: Number(row.comments_count || 0),
    department: row.department_id ? {
        id: row.department_id,
        name: row.department_name || null,
    } : null,
});

function buildPurchaseRequestFilters(query = {}, user, access, { forceRequesterId = null } = {}) {
    const filters = ["pr.empresa_id = ?", "pr.deleted_at IS NULL"];
    const params = [user.empresa_id];

    if (forceRequesterId) {
        filters.push("pr.requester_id = ?");
        params.push(forceRequesterId);
    } else {
        appendVisibilityFilter(filters, params, user, access, "pr");
    }

    const q = limitText(query.q, 120);
    if (q) {
        filters.push(`(
            pr.code LIKE ?
            OR requester.nome LIKE ?
            OR department.nome LIKE ?
            OR pi.description LIKE ?
            OR pr.justification LIKE ?
            OR EXISTS (
                SELECT 1
                FROM purchase_orders q_order
                LEFT JOIN purchase_suppliers q_supplier ON q_supplier.id = q_order.supplier_id
                WHERE q_order.request_id = pr.id
                  AND (q_order.supplier_name LIKE ? OR q_supplier.name LIKE ?)
            )
        )`);
        const like = `%${q}%`;
        params.push(like, like, like, like, like, like, like);
    }

    if (query.code) {
        filters.push("pr.code LIKE ?");
        params.push(`%${limitText(query.code, 30)}%`);
    }
    if (query.status && PURCHASE_REQUEST_STATUS.includes(String(query.status))) {
        filters.push("pr.status = ?");
        params.push(query.status);
    } else if (normalizeBoolean(query.open, false)) {
        filters.push("pr.status IN (?)");
        params.push(PURCHASE_OPEN_REQUEST_STATUS);
    }
    if (query.priority && ["normal", "urgente"].includes(String(query.priority))) {
        filters.push("pr.priority = ?");
        params.push(query.priority);
    }
    if (query.department_id) {
        filters.push("pr.department_id = ?");
        params.push(toNullableNumber(query.department_id));
    }
    if (query.requester_id && !forceRequesterId) {
        filters.push("pr.requester_id = ?");
        params.push(toNullableNumber(query.requester_id));
    }
    if (query.assigned_user_id) {
        filters.push("pr.assigned_user_id = ?");
        params.push(toNullableNumber(query.assigned_user_id));
    }
    if (query.supplier_id) {
        const supplierId = toNullableNumber(query.supplier_id);
        filters.push(`(
            EXISTS (
                SELECT 1
                FROM purchase_orders supplier_order
                WHERE supplier_order.request_id = pr.id
                  AND supplier_order.supplier_id = ?
            )
            OR EXISTS (
                SELECT 1
                FROM purchase_request_items supplier_item
                WHERE supplier_item.request_id = pr.id
                  AND supplier_item.deleted_at IS NULL
                  AND supplier_item.supplier_id = ?
            )
        )`);
        params.push(supplierId, supplierId);
    }
    if (query.category_id) {
        filters.push("pi.category_id = ?");
        params.push(toNullableNumber(query.category_id));
    }
    if (normalizeBoolean(query.monthly, false)) {
        filters.push("pr.is_monthly = 1");
    }
    if (normalizeBoolean(query.urgent, false)) {
        filters.push("(pr.priority = 'urgente' OR pr.request_type = 'urgente')");
    }
    if (normalizeBoolean(query.overdue, false)) {
        filters.push("pr.needed_at < CURDATE() AND pr.status NOT IN ('concluida', 'rejeitada', 'cancelada')");
    }

    const receiptDate = normalizeDate(query.receipt_date);
    if (receiptDate) {
        filters.push(`EXISTS (
            SELECT 1
            FROM purchase_orders receipt_filter
            WHERE receipt_filter.request_id = pr.id
              AND DATE(receipt_filter.expected_delivery_at) = ?
        )`);
        params.push(receiptDate);
    }

    if (normalizeBoolean(query.has_quotes, false)) {
        filters.push(`EXISTS (
            SELECT 1
            FROM purchase_request_items quote_item
            JOIN purchase_quotes quote_filter ON quote_filter.request_item_id = quote_item.id
            WHERE quote_item.request_id = pr.id
              AND quote_item.deleted_at IS NULL
              AND quote_filter.status <> 'descartada'
        )`);
    }

    const purchaseStatus = String(query.purchase_status || "").trim();
    if (PURCHASE_EXPORT_PURCHASE_SITUATIONS.includes(purchaseStatus)) {
        if (purchaseStatus === "sem_compra") {
            filters.push("NOT EXISTS (SELECT 1 FROM purchase_orders purchase_filter WHERE purchase_filter.request_id = pr.id)");
        }
        if (purchaseStatus === "com_compra") {
            filters.push("EXISTS (SELECT 1 FROM purchase_orders purchase_filter WHERE purchase_filter.request_id = pr.id)");
        }
        if (purchaseStatus === "compra_parcial") {
            filters.push(`EXISTS (
                SELECT 1
                FROM purchase_request_items purchase_item
                WHERE purchase_item.request_id = pr.id
                  AND purchase_item.deleted_at IS NULL
                  AND purchase_item.purchased_quantity > 0
                  AND purchase_item.purchased_quantity < purchase_item.requested_quantity
            )`);
        }
        if (purchaseStatus === "compra_total") {
            filters.push(`EXISTS (
                SELECT 1
                FROM purchase_request_items purchase_item
                WHERE purchase_item.request_id = pr.id
                  AND purchase_item.deleted_at IS NULL
            )`);
            filters.push(`NOT EXISTS (
                SELECT 1
                FROM purchase_request_items purchase_item
                WHERE purchase_item.request_id = pr.id
                  AND purchase_item.deleted_at IS NULL
                  AND purchase_item.purchased_quantity < purchase_item.requested_quantity
            )`);
        }
    }

    const receiptStatus = String(query.receipt_status || "").trim();
    if (PURCHASE_EXPORT_RECEIPT_SITUATIONS.includes(receiptStatus)) {
        if (receiptStatus === "sem_recebimento") {
            filters.push(`NOT EXISTS (
                SELECT 1
                FROM purchase_request_items receipt_item
                WHERE receipt_item.request_id = pr.id
                  AND receipt_item.deleted_at IS NULL
                  AND receipt_item.received_quantity > 0
            )`);
        }
        if (receiptStatus === "recebimento_parcial") {
            filters.push(`EXISTS (
                SELECT 1
                FROM purchase_request_items receipt_item
                WHERE receipt_item.request_id = pr.id
                  AND receipt_item.deleted_at IS NULL
                  AND receipt_item.received_quantity > 0
                  AND receipt_item.received_quantity < receipt_item.requested_quantity
            )`);
        }
        if (receiptStatus === "recebido_total") {
            filters.push(`EXISTS (
                SELECT 1
                FROM purchase_request_items receipt_item
                WHERE receipt_item.request_id = pr.id
                  AND receipt_item.deleted_at IS NULL
            )`);
            filters.push(`NOT EXISTS (
                SELECT 1
                FROM purchase_request_items receipt_item
                WHERE receipt_item.request_id = pr.id
                  AND receipt_item.deleted_at IS NULL
                  AND receipt_item.received_quantity < receipt_item.requested_quantity
            )`);
        }
    }

    const startDate = normalizeDate(query.start_date);
    const endDate = normalizeDate(query.end_date);
    if (startDate) {
        filters.push("DATE(pr.created_at) >= ?");
        params.push(startDate);
    }
    if (endDate) {
        filters.push("DATE(pr.created_at) <= ?");
        params.push(endDate);
    }
    const neededAt = normalizeDate(query.needed_at);
    if (neededAt) {
        filters.push("pr.needed_at = ?");
        params.push(neededAt);
    }

    return { where: filters.join(" AND "), params };
}

function getPurchaseExportItemTitle(row = {}) {
    const candidates = [row.item_descricao, row.item_nome, row.first_item_description, row.first_item_name];
    const title = candidates
        .map((value) => String(value || "").trim())
        .find((value) => value && value !== "0" && value.toLowerCase() !== "item sem nome");
    return title || "Item não identificado";
}

function toExcelDate(value) {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date;
}

function getPurchaseSituationLabel(row = {}) {
    const requested = Number(row.total_requested_quantity || 0);
    const purchased = Number(row.total_purchased_quantity || 0);
    const orders = Number(row.purchase_orders_count || 0);
    if (!orders && purchased <= 0) return "Sem compra";
    if (requested > 0 && purchased >= requested) return "Compra total";
    if (purchased > 0) return "Compra parcial";
    return "Com compra";
}

function getReceiptSituationLabel(row = {}) {
    const requested = Number(row.total_requested_quantity || 0);
    const received = Number(row.total_received_quantity || 0);
    if (received <= 0) return "Sem recebimento";
    if (requested > 0 && received >= requested) return "Recebido total";
    return "Recebimento parcial";
}

async function buildPurchaseExportWorkbook(rows = [], { includeFinancial = false } = {}) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Chat Interno";
    workbook.created = new Date();
    workbook.modified = new Date();

    const worksheet = workbook.addWorksheet("Pedidos");
    worksheet.columns = [
        { header: "Descrição do item", key: "item_title", width: 36 },
        { header: "Número do pedido", key: "code", width: 18 },
        { header: "Status", key: "status", width: 24 },
        { header: "Prioridade", key: "priority", width: 14 },
        { header: "Solicitante", key: "requester", width: 28 },
        { header: "Setor", key: "department", width: 24 },
        { header: "Responsável", key: "assigned", width: 24 },
        { header: "Fornecedor", key: "supplier", width: 32 },
        { header: "Situação da compra", key: "purchase_situation", width: 20 },
        { header: "Situação do recebimento", key: "receipt_situation", width: 24 },
        { header: "Itens", key: "items_count", width: 10 },
        { header: "Quantidade solicitada", key: "requested_quantity", width: 20 },
        { header: "Quantidade comprada", key: "purchased_quantity", width: 20 },
        { header: "Quantidade recebida", key: "received_quantity", width: 20 },
        { header: "Valor estimado", key: "estimated_total", width: 18 },
        { header: "Valor realizado", key: "actual_total", width: 18 },
        { header: "Data da solicitação", key: "created_at", width: 20 },
        { header: "Data de envio", key: "submitted_at", width: 20 },
        { header: "Data necessária", key: "needed_at", width: 18 },
        { header: "Data de cancelamento", key: "cancelled_at", width: 22 },
        { header: "Justificativa", key: "justification", width: 42 },
        { header: "Observações", key: "notes", width: 42 },
    ];

    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B1E35" } };
    worksheet.views = [{ state: "frozen", ySplit: 1 }];

    rows.forEach((row) => {
        worksheet.addRow({
            item_title: getPurchaseExportItemTitle(row),
            code: row.code || "Pedido sem código",
            status: row.status || "",
            priority: row.priority || "",
            requester: row.requester_nome || "",
            department: row.department_name || "",
            assigned: row.assigned_nome || "",
            supplier: row.supplier_names || "",
            purchase_situation: getPurchaseSituationLabel(row),
            receipt_situation: getReceiptSituationLabel(row),
            items_count: Number(row.items_count || 0),
            requested_quantity: Number(row.total_requested_quantity || 0),
            purchased_quantity: Number(row.total_purchased_quantity || 0),
            received_quantity: Number(row.total_received_quantity || 0),
            estimated_total: includeFinancial ? Number(row.estimated_total || 0) : "",
            actual_total: includeFinancial ? Number(row.actual_total || 0) : "",
            created_at: toExcelDate(row.created_at),
            submitted_at: toExcelDate(row.submitted_at),
            needed_at: toExcelDate(row.needed_at),
            cancelled_at: toExcelDate(row.cancelled_at),
            justification: row.justification || "",
            notes: row.notes || "",
        });
    });

    ["estimated_total", "actual_total"].forEach((key) => {
        worksheet.getColumn(key).numFmt = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
    });
    ["created_at", "submitted_at", "needed_at", "cancelled_at"].forEach((key) => {
        worksheet.getColumn(key).numFmt = "dd/mm/yyyy hh:mm";
    });
    worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: worksheet.columns.length },
    };

    return workbook;
}

async function sendPurchaseRequestsExcelExport(req, res, { forceRequesterId = null } = {}) {
    await seedPurchaseDefaults(req.user.empresa_id);
    const includeFinancial = !forceRequesterId && Boolean(req.purchaseAccess.permissions["purchase_financial.view"]);
    const { where, params } = buildPurchaseRequestFilters(req.query, req.user, req.purchaseAccess, { forceRequesterId });

    const [rows] = await db.query(`
        SELECT
            pr.*,
            requester.nome AS requester_nome,
            department.nome AS department_name,
            assigned.nome AS assigned_nome,
            item_summary.first_item_description,
            item_summary.first_item_description AS item_descricao,
            item_summary.items_count,
            item_summary.total_requested_quantity,
            item_summary.total_purchased_quantity,
            item_summary.total_received_quantity,
            order_summary.supplier_names,
            order_summary.purchase_orders_count
        FROM purchase_requests pr
        JOIN usuarios requester ON requester.id = pr.requester_id
        LEFT JOIN setores department ON department.id = pr.department_id
        LEFT JOIN usuarios assigned ON assigned.id = pr.assigned_user_id
        LEFT JOIN purchase_request_items pi ON pi.request_id = pr.id AND pi.deleted_at IS NULL
        LEFT JOIN (
            SELECT
                request_id,
                SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(TRIM(description), '') ORDER BY id ASC SEPARATOR ' | '), ' | ', 1) AS first_item_description,
                COUNT(*) AS items_count,
                SUM(requested_quantity) AS total_requested_quantity,
                SUM(purchased_quantity) AS total_purchased_quantity,
                SUM(received_quantity) AS total_received_quantity
            FROM purchase_request_items
            WHERE deleted_at IS NULL
            GROUP BY request_id
        ) item_summary ON item_summary.request_id = pr.id
        LEFT JOIN (
            SELECT
                po.request_id,
                COUNT(DISTINCT po.id) AS purchase_orders_count,
                GROUP_CONCAT(DISTINCT COALESCE(ps.name, po.supplier_name) ORDER BY COALESCE(ps.name, po.supplier_name) SEPARATOR ' | ') AS supplier_names
            FROM purchase_orders po
            LEFT JOIN purchase_suppliers ps ON ps.id = po.supplier_id
            GROUP BY po.request_id
        ) order_summary ON order_summary.request_id = pr.id
        WHERE ${where}
        GROUP BY pr.id
        ORDER BY
            FIELD(pr.status, 'aguardando_almoxarifado', 'em_analise', 'aguardando_informacoes', 'em_cotacao', 'aguardando_aprovacao', 'aprovada_para_compra', 'compra_realizada', 'recebida_parcialmente', 'rascunho', 'concluida', 'rejeitada', 'cancelada'),
            CASE WHEN pr.priority = 'urgente' THEN 0 ELSE 1 END,
            pr.updated_at DESC,
            pr.id DESC
    `, params);

    const workbook = await buildPurchaseExportWorkbook(rows, { includeFinancial });
    const buffer = await workbook.xlsx.writeBuffer();
    const scope = forceRequesterId ? "minhas-solicitacoes" : "pedidos";
    const date = new Date().toISOString().slice(0, 10);
    const filename = `${scope}-${date}.xlsx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
}

const formatRequesterDetail = (detail = {}) => ({
    request: detail.request ? {
        id: detail.request.id,
        code: detail.request.code,
        status: detail.request.status,
        request_type: detail.request.request_type,
        priority: detail.request.priority,
        is_monthly: detail.request.is_monthly,
        needed_at: detail.request.needed_at,
        cost_center: detail.request.cost_center,
        company_unit: detail.request.company_unit,
        justification: detail.request.justification,
        notes: detail.request.notes,
        created_at: detail.request.created_at,
        updated_at: detail.request.updated_at,
        submitted_at: detail.request.submitted_at,
        completed_at: detail.request.completed_at,
        cancelled_at: detail.request.cancelled_at,
        cancellation_reason: detail.request.cancellation_reason,
        items_count: detail.request.items_count,
        attachments_count: detail.request.attachments_count,
        comments_count: detail.request.comments_count,
        department: detail.request.department,
    } : null,
    items: (detail.items || []).map((item) => ({
        id: item.id,
        category_name: item.category_name || "",
        description: item.description,
        brand: item.brand || "",
        model: item.model || "",
        unit: item.unit,
        requested_quantity: item.requested_quantity,
        approved_quantity: item.approved_quantity,
        purchased_quantity: item.purchased_quantity,
        received_quantity: item.received_quantity,
        pending_quantity: item.pending_quantity,
        reference_url: item.reference_url || "",
        requester_notes: item.requester_notes || "",
        purchase_reason: item.purchase_reason || "",
        item_status: item.item_status,
        expected_delivery_at: item.expected_delivery_at,
        received_at: item.received_at,
        attachments: item.attachments || [],
        created_at: item.created_at,
        updated_at: item.updated_at,
    })),
    attachments: detail.attachments || [],
    comments: (detail.comments || []).map((comment) => ({
        id: comment.id,
        parent_id: comment.parent_id,
        message: comment.message,
        is_important: Boolean(comment.is_important),
        user: comment.user,
        attachments: comment.attachments || [],
        created_at: comment.created_at,
        updated_at: comment.updated_at,
    })),
    history: (detail.history || []).map((item) => ({
        id: item.id,
        action: item.action,
        user: item.user,
        created_at: item.created_at,
    })),
    permissions: detail.permissions || {},
});

const fetchRequestDetail = async (requestId, user, access) => {
    const row = await fetchPurchaseRequestRow(requestId, user.empresa_id);

    if (!row) {
        const err = new Error("Solicitação não encontrada.");
        err.statusCode = 404;
        throw err;
    }

    if (!canViewRequestRow(row, user, access)) {
        const err = new Error("Acesso negado");
        err.statusCode = 403;
        throw err;
    }

    const includeFinancial = Boolean(access.permissions["purchase_financial.view"]);
    const includeAttachments = Boolean(access.permissions["purchase_attachment.view"]);
    const request = formatPurchaseRequest(row, { includeFinancial });

    const [items] = await db.query(`
        SELECT
            pi.*,
            pc.name AS category_name,
            ps.name AS supplier_name
        FROM purchase_request_items pi
        LEFT JOIN purchase_categories pc ON pc.id = pi.category_id
        LEFT JOIN purchase_suppliers ps ON ps.id = pi.supplier_id
        WHERE pi.request_id = ?
          AND pi.deleted_at IS NULL
        ORDER BY pi.id ASC
    `, [requestId]);

    const [quotes] = await db.query(`
        SELECT
            pq.*,
            ps.name AS supplier_saved_name,
            u.nome AS created_by_name
        FROM purchase_quotes pq
        LEFT JOIN purchase_suppliers ps ON ps.id = pq.supplier_id
        LEFT JOIN usuarios u ON u.id = pq.created_by
        JOIN purchase_request_items pi ON pi.id = pq.request_item_id
        WHERE pi.request_id = ?
          AND pi.deleted_at IS NULL
        ORDER BY pq.created_at DESC, pq.id DESC
    `, [requestId]);

    const [orders] = await db.query(`
        SELECT
            po.*,
            ps.name AS supplier_saved_name,
            u.nome AS created_by_name
        FROM purchase_orders po
        LEFT JOIN purchase_suppliers ps ON ps.id = po.supplier_id
        LEFT JOIN usuarios u ON u.id = po.created_by
        WHERE po.request_id = ?
        ORDER BY po.created_at DESC, po.id DESC
    `, [requestId]);

    const [orderItems] = await db.query(`
        SELECT
            poi.*
        FROM purchase_order_items poi
        JOIN purchase_orders po ON po.id = poi.purchase_order_id
        WHERE po.request_id = ?
        ORDER BY poi.id ASC
    `, [requestId]);

    const [receipts] = await db.query(`
        SELECT
            prc.*,
            u.nome AS received_by_name
        FROM purchase_receipts prc
        LEFT JOIN usuarios u ON u.id = prc.received_by
        JOIN purchase_request_items pi ON pi.id = prc.request_item_id
        WHERE pi.request_id = ?
        ORDER BY prc.received_at DESC, prc.id DESC
    `, [requestId]);

    const [comments] = await db.query(`
        SELECT
            pc.*,
            u.nome AS user_nome,
            u.email AS user_email,
            u.avatar AS user_avatar
        FROM purchase_comments pc
        JOIN usuarios u ON u.id = pc.user_id
        WHERE pc.request_id = ?
          AND pc.deleted_at IS NULL
        ORDER BY pc.created_at ASC, pc.id ASC
    `, [requestId]);

    const [attachments] = includeAttachments ? await db.query(`
        SELECT
            pa.*,
            u.nome AS uploaded_by_name
        FROM purchase_attachments pa
        LEFT JOIN usuarios u ON u.id = pa.uploaded_by
        WHERE pa.request_id = ?
          AND pa.deleted_at IS NULL
        ORDER BY pa.created_at DESC, pa.id DESC
    `, [requestId]) : [[]];

    const [history] = await db.query(`
        SELECT
            ph.*,
            u.nome AS user_nome
        FROM purchase_history ph
        LEFT JOIN usuarios u ON u.id = ph.user_id
        WHERE ph.request_id = ?
        ORDER BY ph.created_at DESC, ph.id DESC
        LIMIT 100
    `, [requestId]);

    const quotesByItem = new Map();
    quotes.forEach((quote) => {
        const list = quotesByItem.get(quote.request_item_id) || [];
        list.push({
            id: quote.id,
            supplier_id: quote.supplier_id,
            supplier_name: quote.supplier_saved_name || quote.supplier_name || "",
            cnpj: quote.cnpj || "",
            seller_name: quote.seller_name || "",
            phone: quote.phone || "",
            email: quote.email || "",
            link: quote.link || "",
            quantity: Number(quote.quantity || 0),
            unit_price: includeFinancial ? Number(quote.unit_price || 0) : null,
            shipping_price: includeFinancial ? Number(quote.shipping_price || 0) : null,
            discount: includeFinancial ? Number(quote.discount || 0) : null,
            subtotal: includeFinancial ? Number(quote.subtotal || 0) : null,
            total_price: includeFinancial ? Number(quote.total_price || 0) : null,
            delivery_days: quote.delivery_days,
            valid_until: quote.valid_until,
            payment_method: quote.payment_method || "",
            status: quote.status,
            discard_reason: quote.discard_reason || "",
            notes: quote.notes || "",
            created_by: quote.created_by ? { id: quote.created_by, nome: quote.created_by_name || null } : null,
            created_at: quote.created_at,
        });
        quotesByItem.set(quote.request_item_id, list);
    });

    const receiptsByItem = new Map();
    receipts.forEach((receipt) => {
        const list = receiptsByItem.get(receipt.request_item_id) || [];
        list.push({
            id: receipt.id,
            purchase_order_id: receipt.purchase_order_id,
            quantity_received: Number(receipt.quantity_received || 0),
            condition_status: receipt.condition_status,
            storage_location: receipt.storage_location || "",
            received_by: receipt.received_by ? { id: receipt.received_by, nome: receipt.received_by_name || null } : null,
            received_at: receipt.received_at,
            notes: receipt.notes || "",
        });
        receiptsByItem.set(receipt.request_item_id, list);
    });

    const attachmentsByItem = new Map();
    const attachmentsByComment = new Map();
    const requestAttachments = [];
    attachments.forEach((attachment) => {
        const formatted = {
            id: attachment.id,
            request_item_id: attachment.request_item_id,
            comment_id: attachment.comment_id,
            quote_id: attachment.quote_id,
            order_id: attachment.order_id,
            receipt_id: attachment.receipt_id,
            type: attachment.attachment_type,
            url: attachment.file_url,
            name: attachment.file_name,
            mime: attachment.file_mime || "application/octet-stream",
            size: Number(attachment.file_size || 0),
            uploaded_by: attachment.uploaded_by ? { id: attachment.uploaded_by, nome: attachment.uploaded_by_name || null } : null,
            created_at: attachment.created_at,
        };

        if (attachment.request_item_id) {
            const list = attachmentsByItem.get(attachment.request_item_id) || [];
            list.push(formatted);
            attachmentsByItem.set(attachment.request_item_id, list);
            return;
        }
        if (attachment.comment_id) {
            const list = attachmentsByComment.get(attachment.comment_id) || [];
            list.push(formatted);
            attachmentsByComment.set(attachment.comment_id, list);
            return;
        }
        requestAttachments.push(formatted);
    });

    return {
        request,
        items: items.map((item) => ({
            id: item.id,
            category_id: item.category_id,
            category_name: item.category_name || "",
            description: item.description,
            brand: item.brand || "",
            model: item.model || "",
            unit: item.unit,
            stock_quantity: Number(item.stock_quantity || 0),
            requested_quantity: Number(item.requested_quantity || 0),
            approved_quantity: Number(item.approved_quantity || 0),
            purchased_quantity: Number(item.purchased_quantity || 0),
            received_quantity: Number(item.received_quantity || 0),
            pending_quantity: Math.max(0, Number(item.requested_quantity || 0) - Number(item.received_quantity || 0)),
            reference_url: item.reference_url || "",
            estimated_unit_price: includeFinancial ? Number(item.estimated_unit_price || 0) : null,
            requester_notes: item.requester_notes || "",
            purchase_reason: item.purchase_reason || "",
            item_status: item.item_status,
            supplier: item.supplier_id ? { id: item.supplier_id, name: item.supplier_name || null } : null,
            unit_price: includeFinancial ? Number(item.unit_price || 0) : null,
            shipping_price: includeFinancial ? Number(item.shipping_price || 0) : null,
            discount: includeFinancial ? Number(item.discount || 0) : null,
            total_price: includeFinancial ? Number(item.total_price || 0) : null,
            supplier_order_number: item.supplier_order_number || "",
            purchased_at: item.purchased_at,
            expected_delivery_at: item.expected_delivery_at,
            received_at: item.received_at,
            rejection_reason: item.rejection_reason || "",
            quotes: quotesByItem.get(item.id) || [],
            receipts: receiptsByItem.get(item.id) || [],
            attachments: attachmentsByItem.get(item.id) || [],
            created_at: item.created_at,
            updated_at: item.updated_at,
        })),
        orders: orders.map((order) => ({
            id: order.id,
            supplier_id: order.supplier_id,
            supplier_name: order.supplier_saved_name || order.supplier_name || "",
            quote_id: order.quote_id,
            order_number: order.order_number || "",
            purchase_date: order.purchase_date,
            expected_delivery_at: order.expected_delivery_at,
            payment_method: order.payment_method || "",
            subtotal: includeFinancial ? Number(order.subtotal || 0) : null,
            shipping_price: includeFinancial ? Number(order.shipping_price || 0) : null,
            discount: includeFinancial ? Number(order.discount || 0) : null,
            total_price: includeFinancial ? Number(order.total_price || 0) : null,
            notes: order.notes || "",
            created_by: order.created_by ? { id: order.created_by, nome: order.created_by_name || null } : null,
            items: orderItems
                .filter((item) => item.purchase_order_id === order.id)
                .map((item) => ({
                    id: item.id,
                    request_item_id: item.request_item_id,
                    quantity: Number(item.quantity || 0),
                    unit_price: includeFinancial ? Number(item.unit_price || 0) : null,
                    shipping_price: includeFinancial ? Number(item.shipping_price || 0) : null,
                    discount: includeFinancial ? Number(item.discount || 0) : null,
                    total_price: includeFinancial ? Number(item.total_price || 0) : null,
                })),
            created_at: order.created_at,
        })),
        comments: comments.map((comment) => ({
            id: comment.id,
            parent_id: comment.parent_id,
            message: comment.message,
            is_important: Boolean(comment.is_important),
            user: {
                id: comment.user_id,
                nome: comment.user_nome || null,
                email: comment.user_email || null,
                avatar: comment.user_avatar || null,
            },
            attachments: attachmentsByComment.get(comment.id) || [],
            created_at: comment.created_at,
            updated_at: comment.updated_at,
        })),
        attachments: requestAttachments,
        history: history.map((item) => ({
            id: item.id,
            entity_type: item.entity_type,
            entity_id: item.entity_id,
            action: item.action,
            old_value: parseJson(item.old_value, null),
            new_value: parseJson(item.new_value, null),
            ip_address: item.ip_address || null,
            user: item.user_id ? { id: item.user_id, nome: item.user_nome || null } : null,
            created_at: item.created_at,
        })),
        permissions: access.permissions,
    };
};

const validateRequestTransition = async (connection, requestId, currentStatus, nextStatus, justification = "") => {
    if (currentStatus === nextStatus) return;
    if (!PURCHASE_REQUEST_STATUS.includes(nextStatus)) {
        const err = new Error("Status inválido.");
        err.statusCode = 400;
        throw err;
    }
    if (!PURCHASE_STATUS_TRANSITIONS[currentStatus]?.includes(nextStatus)) {
        const err = new Error("Transição de status inválida.");
        err.statusCode = 400;
        throw err;
    }
    if (["rejeitada", "cancelada"].includes(nextStatus) && !justification) {
        const err = new Error("Informe uma justificativa para rejeitar ou cancelar.");
        err.statusCode = 400;
        throw err;
    }
    if (nextStatus === "compra_realizada") {
        const [rows] = await connection.query(`
            SELECT COUNT(*) AS total_orders
            FROM purchase_orders
            WHERE request_id = ?
        `, [requestId]);
        if (!Number(rows[0]?.total_orders || 0)) {
            const err = new Error("Registre uma compra antes de marcar como compra realizada.");
            err.statusCode = 400;
            throw err;
        }
    }
    if (nextStatus === "concluida") {
        const [rows] = await connection.query(`
            SELECT COUNT(*) AS pending_items
            FROM purchase_request_items
            WHERE request_id = ?
              AND deleted_at IS NULL
              AND item_status NOT IN (?)
        `, [requestId, PURCHASE_FINAL_ITEM_STATUS]);
        if (Number(rows[0]?.pending_items || 0) > 0) {
            const err = new Error("Não é possível concluir enquanto existirem itens pendentes.");
            err.statusCode = 400;
            throw err;
        }
    }
};

const validateItemTransition = (currentStatus, nextStatus, justification = "") => {
    if (currentStatus === nextStatus) return;
    if (!PURCHASE_ITEM_STATUS.includes(nextStatus)) {
        const err = new Error("Status do item inválido.");
        err.statusCode = 400;
        throw err;
    }
    if (!PURCHASE_ITEM_STATUS_TRANSITIONS[currentStatus]?.includes(nextStatus)) {
        const err = new Error("Transição de status do item inválida.");
        err.statusCode = 400;
        throw err;
    }
    if (nextStatus === "rejeitado" && !justification) {
        const err = new Error("Informe a justificativa para rejeitar o item.");
        err.statusCode = 400;
        throw err;
    }
};

const normalizeRequestItems = (itemsInput = []) => {
    const items = Array.isArray(itemsInput) ? itemsInput : [];
    return items.map((item) => ({
        id: toNullableNumber(item.id),
        category_name: limitText(item.category_name || item.category, 160),
        description: limitText(item.description || item.descricao, 500),
        brand: limitText(item.brand || item.marca, 160),
        model: limitText(item.model || item.modelo, 160),
        unit: normalizeEnum(item.unit || item.unidade, PURCHASE_UNITS, "unidade"),
        stock_quantity: toPositiveNumber(item.stock_quantity || item.quantidade_estoque),
        requested_quantity: toPositiveNumber(item.requested_quantity || item.quantidade_solicitada),
        approved_quantity: toPositiveNumber(item.approved_quantity || item.quantidade_aprovada),
        reference_url: normalizeUrl(item.reference_url || item.link_referencia),
        estimated_unit_price: toPositiveNumber(item.estimated_unit_price || item.valor_estimado),
        requester_notes: normalizeLongText(item.requester_notes || item.observacoes, 2000),
        purchase_reason: normalizeLongText(item.purchase_reason || item.motivo_compra, 2000),
    }));
};

const validateRequestPayload = (body, items, { submit = false } = {}) => {
    const neededAt = normalizeDate(body.needed_at);
    const justification = normalizeLongText(body.justification, 5000);

    if (submit && !neededAt) {
        const err = new Error("Informe a data em que o material será necessário.");
        err.statusCode = 400;
        throw err;
    }
    if (submit && !items.length) {
        const err = new Error("Adicione pelo menos um item.");
        err.statusCode = 400;
        throw err;
    }
    if (submit && items.some((item) => !item.description || item.requested_quantity <= 0)) {
        const err = new Error("Cada item enviado precisa ter descrição e quantidade solicitada.");
        err.statusCode = 400;
        throw err;
    }

    return {
        request_type: normalizeEnum(body.request_type || body.tipo_solicitacao, PURCHASE_REQUEST_TYPES, "normal"),
        needed_at: neededAt,
        justification,
        notes: normalizeLongText(body.notes || body.observacoes, 5000),
        department_id: toNullableNumber(body.department_id),
        department_name: limitText(body.department_name || body.departamento, 160),
        cost_center: limitText(body.cost_center || body.centro_custo, 120),
        company_unit: limitText(body.company_unit || body.unidade_empresa, 160),
        is_monthly: normalizeBoolean(body.is_monthly) || normalizeEnum(body.request_type || body.tipo_solicitacao, PURCHASE_REQUEST_TYPES, "normal") === "mensal",
    };
};

const insertPurchaseAttachment = async (connection, req, {
    requestId,
    requestItemId = null,
    commentId = null,
    quoteId = null,
    orderId = null,
    receiptId = null,
    attachmentType = "geral",
    file,
}) => {
    const fileUrl = buildUploadUrl(req.user.empresa_id, file.filename);
    await connection.query(`
        INSERT INTO purchase_attachments (
            request_id,
            request_item_id,
            comment_id,
            quote_id,
            order_id,
            receipt_id,
            file_url,
            file_name,
            file_mime,
            file_size,
            attachment_type,
            uploaded_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        requestId,
        requestItemId,
        commentId,
        quoteId,
        orderId,
        receiptId,
        fileUrl,
        file.originalname || file.filename,
        file.mimetype || "application/octet-stream",
        file.size || 0,
        attachmentType,
        req.user.id,
    ]);
};

const extractMentionedUsers = async (empresaId, message, requestRow, access) => {
    const normalized = String(message || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    if (!normalized.includes("@")) return [];

    const [users] = await db.query(`
        SELECT id, nome, email, empresa_id, setor_id, perfil
        FROM usuarios
        WHERE empresa_id = ?
          AND deletado_em IS NULL
    `, [empresaId]);

    const mentioned = [];
    for (const user of users) {
        const handles = String(user.nome || "")
            .split(/\s+/)
            .filter(Boolean)
            .map((part) => part.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())
            .filter(Boolean);
        const full = String(user.nome || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "");
        if (full) handles.push(full);

        if (handles.some((handle) => normalized.includes(`@${handle}`))) {
            const mentionedAccess = await resolvePurchasePermissions(user);
            if (canViewRequestRow(requestRow, user, mentionedAccess) || access.is_admin) {
                mentioned.push(user.id);
            }
        }
    }

    return [...new Set(mentioned)];
};

const upsertPermissionGrant = async (req, res, {
    subjectType,
    subjectId = null,
    subjectKey = null,
    label = "",
}) => {
    const connection = await db.getConnection();

    try {
        await seedPurchaseDefaults(req.user.empresa_id, req.user.id, connection);
        const normalizedSubjectId = subjectId || 0;
        const normalizedSubjectKey = subjectKey || "";
        const permissions = normalizePermissionsObject(req.body?.permissions || {});
        const profileId = toNullableNumber(req.body?.profile_id);
        const accessBlocked = normalizeBoolean(req.body?.access_blocked, false);

        if (profileId) {
            const [profiles] = await connection.query(`
                SELECT id
                FROM purchase_permission_profiles
                WHERE id = ?
                  AND empresa_id = ?
                LIMIT 1
            `, [profileId, req.user.empresa_id]);
            if (!profiles.length) {
                return res.status(400).json({ error: "Perfil de compras inválido." });
            }
        }

        const [currentRows] = await connection.query(`
            SELECT *
            FROM purchase_permissions
            WHERE empresa_id = ?
              AND subject_type = ?
              AND subject_id = ?
              AND subject_key = ?
            LIMIT 1
        `, [
            req.user.empresa_id,
            subjectType,
            normalizedSubjectId,
            normalizedSubjectKey,
        ]);

        await connection.beginTransaction();

        await connection.query(`
            INSERT INTO purchase_permissions (
                empresa_id,
                subject_type,
                subject_id,
                subject_key,
                profile_id,
                permissions_json,
                access_blocked,
                created_by,
                updated_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                profile_id = VALUES(profile_id),
                permissions_json = VALUES(permissions_json),
                access_blocked = VALUES(access_blocked),
                updated_by = VALUES(updated_by)
        `, [
            req.user.empresa_id,
            subjectType,
            normalizedSubjectId,
            normalizedSubjectKey,
            profileId,
            stringifyJson(permissions),
            accessBlocked ? 1 : 0,
            req.user.id,
            req.user.id,
        ]);

        await logPurchaseHistory(connection, {
            empresaId: req.user.empresa_id,
            entityType: "permission",
            entityId: subjectId,
            userId: req.user.id,
            action: accessBlocked ? "permission.access_blocked" : "permission.updated",
            oldValue: currentRows[0] ? {
                profile_id: currentRows[0].profile_id,
                permissions: parseJson(currentRows[0].permissions_json, {}),
                access_blocked: Boolean(currentRows[0].access_blocked),
            } : null,
            newValue: {
                subject_type: subjectType,
                subject_id: normalizedSubjectId,
                subject_key: normalizedSubjectKey,
                label,
                profile_id: profileId,
                permissions,
                access_blocked: accessBlocked,
            },
            req,
        });

        await connection.commit();

        res.json({ success: true });
    } catch (err) {
        await connection.rollback();
        console.error("Erro ao salvar permissões de compras:", err);
        res.status(500).json({ error: "Erro ao salvar permissões." });
    } finally {
        connection.release();
    }
};

router.get("/purchase-permissions/me", authMiddleware, async (req, res) => {
    try {
        await seedPurchaseDefaults(req.user.empresa_id);
        const access = await resolvePurchasePermissions(req.user);
        const [notificationRows] = await db.query(`
            SELECT COUNT(*) AS unread
            FROM purchase_notifications
            WHERE user_id = ?
              AND read_at IS NULL
        `, [req.user.id]);

        res.json({
            permissions: access.permissions,
            blocked: access.blocked,
            can_access: Boolean(access.permissions["purchase_module.access"]),
            can_requester_access: canAccessRequesterPurchases(access),
            can_panel_access: canAccessPurchasePanel(access, req.user),
            unread_notifications: Number(notificationRows[0]?.unread || 0),
            catalog: PURCHASE_PERMISSION_CATALOG,
        });
    } catch (err) {
        console.error("Erro ao buscar permissões de compras do usuário:", err);
        res.status(500).json({ error: "Erro ao buscar permissões." });
    }
});

router.get("/purchase-requests/my/options", authMiddleware, requireRequesterPurchaseAccess, async (req, res) => {
    try {
        await seedPurchaseDefaults(req.user.empresa_id, req.user.id);

        const [categories] = await db.query(`
            SELECT id, name
            FROM purchase_categories
            WHERE empresa_id = ?
              AND is_active = 1
            ORDER BY name ASC
        `, [req.user.empresa_id]);
        const [departments] = await db.query(`
            SELECT id, nome
            FROM setores
            WHERE empresa_id = ?
            ORDER BY nome ASC
        `, [req.user.empresa_id]);

        res.json({
            statuses: PURCHASE_REQUEST_STATUS,
            item_statuses: PURCHASE_ITEM_STATUS,
            request_types: PURCHASE_REQUEST_TYPES,
            units: PURCHASE_UNITS,
            upload_limit_mb: PURCHASE_UPLOAD_MAX_SIZE_MB,
            categories,
            departments: departments.map((department) => ({ id: department.id, name: department.nome })),
            permissions: req.purchaseAccess.permissions,
            can_panel_access: canAccessPurchasePanel(req.purchaseAccess, req.user),
        });
    } catch (err) {
        console.error("Erro ao carregar opções do solicitante:", err);
        res.status(500).json({ error: "Erro ao carregar opções." });
    }
});

router.get("/purchase-requests/options", authMiddleware, requirePurchasePanelAccess, async (req, res) => {
    try {
        await seedPurchaseDefaults(req.user.empresa_id, req.user.id);

        const [categories] = await db.query(`
            SELECT id, name
            FROM purchase_categories
            WHERE empresa_id = ?
              AND is_active = 1
            ORDER BY name ASC
        `, [req.user.empresa_id]);
        const [suppliers] = await db.query(`
            SELECT id, name, cnpj, contact_name, phone, email
            FROM purchase_suppliers
            WHERE empresa_id = ?
              AND is_active = 1
            ORDER BY name ASC
        `, [req.user.empresa_id]);
        const [users] = await db.query(`
            SELECT u.id, u.nome, u.email, u.perfil, u.setor_id, s.nome AS setor_nome
            FROM usuarios u
            LEFT JOIN setores s ON s.id = u.setor_id
            WHERE u.empresa_id = ?
              AND u.deletado_em IS NULL
            ORDER BY u.nome ASC
        `, [req.user.empresa_id]);
        const [departments] = await db.query(`
            SELECT id, nome
            FROM setores
            WHERE empresa_id = ?
            ORDER BY nome ASC
        `, [req.user.empresa_id]);

        res.json({
            statuses: PURCHASE_REQUEST_STATUS,
            item_statuses: PURCHASE_ITEM_STATUS,
            request_types: PURCHASE_REQUEST_TYPES,
            units: PURCHASE_UNITS,
            quote_statuses: PURCHASE_QUOTE_STATUS,
            receipt_conditions: PURCHASE_RECEIPT_CONDITIONS,
            upload_limit_mb: PURCHASE_UPLOAD_MAX_SIZE_MB,
            categories,
            suppliers,
            users: users.map((user) => ({
                id: user.id,
                nome: user.nome,
                email: user.email,
                perfil: user.perfil,
                setor_id: user.setor_id,
                setor_nome: user.setor_nome,
            })),
            departments: departments.map((department) => ({ id: department.id, name: department.nome })),
            permissions: req.purchaseAccess.permissions,
        });
    } catch (err) {
        console.error("Erro ao carregar opções de compras:", err);
        res.status(500).json({ error: "Erro ao carregar opções." });
    }
});

router.get("/purchase-requests/dashboard", authMiddleware, requirePurchasePanelAccess, async (req, res) => {
    try {
        await seedPurchaseDefaults(req.user.empresa_id);
        const includeFinancial = Boolean(req.purchaseAccess.permissions["purchase_financial.view"]);
        const requestValueSql = includeFinancial
            ? "COALESCE(SUM(COALESCE(NULLIF(pr.actual_total, 0), pr.estimated_total, 0)), 0)"
            : "NULL";
        const orderValueSql = includeFinancial
            ? "COALESCE(SUM(COALESCE(po.total_price, 0)), 0)"
            : "NULL";
        const filters = ["pr.empresa_id = ?", "pr.deleted_at IS NULL"];
        const params = [req.user.empresa_id];
        appendVisibilityFilter(filters, params, req.user, req.purchaseAccess, "pr");

        const where = filters.join(" AND ");
        const [statusRows] = await db.query(`
            SELECT pr.status, COUNT(*) AS total
            FROM purchase_requests pr
            WHERE ${where}
            GROUP BY pr.status
        `, params);
        const [extraRows] = await db.query(`
            SELECT
                SUM(CASE WHEN pr.status = 'aguardando_almoxarifado' THEN 1 ELSE 0 END) AS novas,
                SUM(CASE WHEN pr.priority = 'urgente' OR pr.request_type = 'urgente' THEN 1 ELSE 0 END) AS urgentes,
                SUM(CASE WHEN pr.status IN ('em_analise') THEN 1 ELSE 0 END) AS em_analise,
                SUM(CASE WHEN pr.status = 'em_cotacao' THEN 1 ELSE 0 END) AS em_cotacao,
                SUM(CASE WHEN pr.status = 'aguardando_aprovacao' THEN 1 ELSE 0 END) AS aguardando_aprovacao,
                SUM(CASE WHEN pr.status IN ('compra_realizada', 'recebida_parcialmente') THEN 1 ELSE 0 END) AS aguardando_entrega,
                SUM(CASE WHEN pr.needed_at < CURDATE() AND pr.status NOT IN ('concluida', 'rejeitada', 'cancelada') THEN 1 ELSE 0 END) AS atrasadas,
                SUM(CASE WHEN pr.status = 'concluida' AND MONTH(pr.completed_at) = MONTH(CURDATE()) AND YEAR(pr.completed_at) = YEAR(CURDATE()) THEN 1 ELSE 0 END) AS concluidas_mes
            FROM purchase_requests pr
            WHERE ${where}
        `, params);
        const [openSummaryRows] = await db.query(`
            SELECT
                COUNT(DISTINCT pr.id) AS total_orders,
                ${requestValueSql} AS total_value
            FROM purchase_requests pr
            WHERE ${where}
              AND pr.status IN (?)
        `, [...params, PURCHASE_OPEN_REQUEST_STATUS]);
        const [openGroupRows] = await db.query(`
            SELECT
                CASE
                    WHEN pr.status = 'aguardando_aprovacao' THEN 'aguardando_aprovacao'
                    WHEN pr.status = 'em_cotacao' THEN 'em_cotacao'
                    WHEN pr.status = 'aprovada_para_compra' THEN 'aguardando_emissao'
                    ELSE 'em_andamento'
                END AS group_key,
                COUNT(DISTINCT pr.id) AS total_orders,
                ${requestValueSql} AS total_value
            FROM purchase_requests pr
            WHERE ${where}
              AND pr.status IN (?)
            GROUP BY group_key
        `, [...params, PURCHASE_OPEN_REQUEST_STATUS]);
        const [openRequestRows] = await db.query(`
            SELECT
                pr.id AS request_id,
                pr.code,
                pr.status,
                pr.priority,
                pr.request_type,
                pr.created_at,
                pr.submitted_at,
                pr.needed_at,
                requester.nome AS requester_name,
                department.nome AS department_name,
                SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(TRIM(pi.description), '') ORDER BY pi.id ASC SEPARATOR ' | '), ' | ', 1) AS item_name,
                SUBSTRING_INDEX(GROUP_CONCAT(pi.requested_quantity ORDER BY pi.id ASC SEPARATOR ' | '), ' | ', 1) AS requested_quantity,
                SUBSTRING_INDEX(GROUP_CONCAT(pi.unit ORDER BY pi.id ASC SEPARATOR ' | '), ' | ', 1) AS unit,
                ${buildPurchaseItemImageSelect("pr")},
                COUNT(DISTINCT pi.id) AS items_count,
                MIN(COALESCE(pi.expected_delivery_at, next_order.expected_delivery_at, pr.needed_at)) AS expected_delivery_at
            FROM purchase_requests pr
            JOIN usuarios requester ON requester.id = pr.requester_id
            LEFT JOIN setores department ON department.id = pr.department_id
            LEFT JOIN purchase_request_items pi ON pi.request_id = pr.id AND pi.deleted_at IS NULL
            LEFT JOIN (
                SELECT request_id, MIN(expected_delivery_at) AS expected_delivery_at
                FROM purchase_orders
                WHERE expected_delivery_at IS NOT NULL
                GROUP BY request_id
            ) next_order ON next_order.request_id = pr.id
            WHERE ${where}
              AND pr.status IN (?)
            GROUP BY pr.id
            ORDER BY
                CASE WHEN pr.priority = 'urgente' OR pr.request_type = 'urgente' THEN 0 ELSE 1 END,
                COALESCE(pr.submitted_at, pr.created_at) ASC,
                pr.id ASC
            LIMIT 5
        `, [...params, PURCHASE_OPEN_REQUEST_STATUS]);
        const [dailyReceiptRows] = await db.query(`
            SELECT
                po.id,
                po.request_id,
                pr.code,
                COALESCE(ps.name, po.supplier_name, '') AS supplier_name,
                po.order_number,
                po.expected_delivery_at,
                SUBSTRING_INDEX(GROUP_CONCAT(receipt_item.description ORDER BY receipt_item.id ASC SEPARATOR ' | '), ' | ', 1) AS item_description,
                ${includeFinancial ? "po.total_price" : "NULL"} AS total_price,
                COUNT(DISTINCT poi.id) AS items_count,
                COALESCE(SUM(poi.quantity), 0) AS total_quantity,
                COALESCE(MAX(received.quantity_received), 0) AS received_quantity
            FROM purchase_orders po
            JOIN purchase_requests pr ON pr.id = po.request_id
            LEFT JOIN purchase_suppliers ps ON ps.id = po.supplier_id
            LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
            LEFT JOIN purchase_request_items receipt_item ON receipt_item.id = poi.request_item_id AND receipt_item.deleted_at IS NULL
            LEFT JOIN (
                SELECT purchase_order_id, SUM(quantity_received) AS quantity_received
                FROM purchase_receipts
                WHERE purchase_order_id IS NOT NULL
                GROUP BY purchase_order_id
            ) received ON received.purchase_order_id = po.id
            WHERE ${where}
              AND DATE(po.expected_delivery_at) = CURDATE()
            GROUP BY po.id
            ORDER BY po.expected_delivery_at ASC, po.id DESC
            LIMIT 3
        `, params);
        const [dailyReceiptSummaryRows] = await db.query(`
            SELECT
                COUNT(DISTINCT po.id) AS total_receipts,
                ${orderValueSql} AS total_value
            FROM purchase_orders po
            JOIN purchase_requests pr ON pr.id = po.request_id
            WHERE ${where}
              AND DATE(po.expected_delivery_at) = CURDATE()
        `, params);
        const [leadTimeRows] = await db.query(`
            SELECT
                AVG(CASE
                    WHEN COALESCE(pr.completed_at, latest_receipt.last_received_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                    THEN DATEDIFF(COALESCE(pr.completed_at, latest_receipt.last_received_at), COALESCE(pr.submitted_at, pr.created_at))
                END) AS average_days,
                AVG(CASE
                    WHEN COALESCE(pr.completed_at, latest_receipt.last_received_at) < DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                     AND COALESCE(pr.completed_at, latest_receipt.last_received_at) >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)
                    THEN DATEDIFF(COALESCE(pr.completed_at, latest_receipt.last_received_at), COALESCE(pr.submitted_at, pr.created_at))
                END) AS previous_average_days
            FROM purchase_requests pr
            LEFT JOIN (
                SELECT pi.request_id, MAX(prc.received_at) AS last_received_at
                FROM purchase_receipts prc
                JOIN purchase_request_items pi ON pi.id = prc.request_item_id
                WHERE pi.deleted_at IS NULL
                GROUP BY pi.request_id
            ) latest_receipt ON latest_receipt.request_id = pr.id
            WHERE ${where}
              AND COALESCE(pr.completed_at, latest_receipt.last_received_at) IS NOT NULL
        `, params);
        const [topItemRows] = await db.query(`
            SELECT
                MIN(pi.id) AS item_id,
                pi.description,
                COALESCE(pc.name, '') AS category_name,
                COUNT(DISTINCT pr.id) AS requests_count,
                COALESCE(SUM(pi.requested_quantity), 0) AS requested_quantity
            FROM purchase_request_items pi
            JOIN purchase_requests pr ON pr.id = pi.request_id
            LEFT JOIN purchase_categories pc ON pc.id = pi.category_id
            WHERE ${where}
              AND pi.deleted_at IS NULL
            GROUP BY LOWER(TRIM(pi.description)), pi.description, COALESCE(pc.name, '')
            ORDER BY requests_count DESC, requested_quantity DESC, MAX(pi.created_at) DESC
            LIMIT 5
        `, params);
        const [comparisonTargetRows] = await db.query(`
            SELECT
                pq.request_item_id
            FROM purchase_quotes pq
            JOIN purchase_request_items pi ON pi.id = pq.request_item_id
            JOIN purchase_requests pr ON pr.id = pi.request_id
            WHERE ${where}
              AND pi.deleted_at IS NULL
              AND pq.status <> 'descartada'
            GROUP BY pq.request_item_id
            ORDER BY
                MAX(CASE WHEN pq.status = 'selecionada' THEN 1 ELSE 0 END) DESC,
                COUNT(*) DESC,
                MAX(pq.created_at) DESC
            LIMIT 1
        `, params);
        let quotationRows = [];
        if (comparisonTargetRows[0]?.request_item_id) {
            [quotationRows] = await db.query(`
                SELECT
                    pq.id,
                    pq.request_item_id,
                    pi.request_id,
                    pr.code,
                    pi.description AS item_description,
                    COALESCE(ps.name, pq.supplier_name, '') AS supplier_name,
                    pq.delivery_days,
                    ${includeFinancial ? "pq.unit_price" : "NULL"} AS unit_price,
                    ${includeFinancial ? "pq.total_price" : "NULL"} AS total_price,
                    pq.status,
                    pq.created_at
                FROM purchase_quotes pq
                JOIN purchase_request_items pi ON pi.id = pq.request_item_id
                JOIN purchase_requests pr ON pr.id = pi.request_id
                LEFT JOIN purchase_suppliers ps ON ps.id = pq.supplier_id
                WHERE ${where}
                  AND pi.deleted_at IS NULL
                  AND pq.status <> 'descartada'
                  AND pq.request_item_id = ?
                ORDER BY
                    CASE WHEN pq.status = 'selecionada' THEN 0 ELSE 1 END,
                    pq.total_price ASC,
                    pq.created_at DESC
                LIMIT 6
            `, [...params, comparisonTargetRows[0].request_item_id]);
        }

        const leadTime = leadTimeRows[0] || {};
        const formatNullableNumber = (value, decimals = 1) => (
            value === null || value === undefined ? null : Number(Number(value || 0).toFixed(decimals))
        );

        res.json({
            by_status: Object.fromEntries(statusRows.map((row) => [row.status, Number(row.total || 0)])),
            indicators: Object.fromEntries(
                Object.entries(extraRows[0] || {}).map(([key, value]) => [key, Number(value || 0)])
            ),
            open_requests: {
                total: Number(openSummaryRows[0]?.total_orders || 0),
                items: openRequestRows.map((row) => ({
                    id: row.request_id,
                    request_id: row.request_id,
                    code: row.code || null,
                    item_name: row.item_name || "Item sem nome",
                    requested_quantity: Number(row.requested_quantity || 0),
                    unit: row.unit || "unidade",
                    requester_name: row.requester_name || "",
                    department_name: row.department_name || "",
                    status: row.status,
                    priority: row.priority || row.request_type || "normal",
                    created_at: row.submitted_at || row.created_at,
                    expected_delivery_at: row.expected_delivery_at || row.needed_at || null,
                    items_count: Number(row.items_count || 0),
                    item_image_url: getRowItemImage(row)?.url || null,
                    item_image_name: getRowItemImage(row)?.name || "",
                    item_image_mime: getRowItemImage(row)?.mime || "",
                    item_image: getRowItemImage(row),
                })),
            },
            open_purchases: {
                total_orders: Number(openSummaryRows[0]?.total_orders || 0),
                total_value: includeFinancial ? Number(openSummaryRows[0]?.total_value || 0) : null,
                groups: openGroupRows.map((row) => ({
                    key: row.group_key,
                    total_orders: Number(row.total_orders || 0),
                    total_value: includeFinancial ? Number(row.total_value || 0) : null,
                })),
            },
            daily_receipts: {
                total_receipts: Number(dailyReceiptSummaryRows[0]?.total_receipts || 0),
                total_value: includeFinancial ? Number(dailyReceiptSummaryRows[0]?.total_value || 0) : null,
                items: dailyReceiptRows.map((row) => {
                    const totalQuantity = Number(row.total_quantity || 0);
                    const receivedQuantity = Number(row.received_quantity || 0);
                    return {
                        id: row.id,
                        request_id: row.request_id,
                        code: row.code || null,
                        order_number: row.order_number || "",
                        item_description: row.item_description || "Item sem nome",
                        supplier_name: row.supplier_name || "",
                        expected_delivery_at: row.expected_delivery_at,
                        items_count: Number(row.items_count || 0),
                        total_quantity: totalQuantity,
                        total_value: includeFinancial ? Number(row.total_price || 0) : null,
                        status: totalQuantity > 0 && receivedQuantity >= totalQuantity ? "recebido" : "agendado",
                    };
                }),
            },
            lead_time: {
                average_days: formatNullableNumber(leadTime.average_days),
                previous_average_days: formatNullableNumber(leadTime.previous_average_days),
            },
            top_requested_items: topItemRows.map((row) => ({
                item_id: row.item_id,
                id: row.item_id,
                name: row.description || "Item sem nome",
                description: row.description,
                item_name: row.description || "Item sem nome",
                category_name: row.category_name || "",
                requests_count: Number(row.requests_count || 0),
                requested_quantity: Number(row.requested_quantity || 0),
            })),
            quotation_comparison: quotationRows.map((row) => ({
                id: row.id,
                request_item_id: row.request_item_id,
                request_id: row.request_id,
                code: row.code || null,
                item_name: row.item_description || "Item sem nome",
                item_description: row.item_description || "",
                supplier_name: row.supplier_name || "",
                delivery_days: row.delivery_days,
                unit_price: includeFinancial ? Number(row.unit_price || 0) : null,
                total_price: includeFinancial ? Number(row.total_price || 0) : null,
                status: row.status,
                created_at: row.created_at,
            })),
            // The current schema stores stock_quantity but does not expose a minimum-stock field.
            critical_items: [],
            data_gaps: {
                critical_items_minimum_stock: true,
                required_field: "purchase_request_items.minimum_stock_quantity",
    },
});

const buildPurchaseRequestFilters = (query = {}, user, access, { forceRequesterId = null } = {}) => {
    const filters = ["pr.empresa_id = ?", "pr.deleted_at IS NULL"];
    const params = [user.empresa_id];

    if (forceRequesterId) {
        filters.push("pr.requester_id = ?");
        params.push(forceRequesterId);
    } else {
        appendVisibilityFilter(filters, params, user, access, "pr");
    }

    const q = limitText(query.q, 120);
    if (q) {
        filters.push(`(
            pr.code LIKE ?
            OR requester.nome LIKE ?
            OR department.nome LIKE ?
            OR pi.description LIKE ?
            OR pr.justification LIKE ?
            OR EXISTS (
                SELECT 1
                FROM purchase_orders q_order
                LEFT JOIN purchase_suppliers q_supplier ON q_supplier.id = q_order.supplier_id
                WHERE q_order.request_id = pr.id
                  AND (q_order.supplier_name LIKE ? OR q_supplier.name LIKE ?)
            )
        )`);
        const like = `%${q}%`;
        params.push(like, like, like, like, like, like, like);
    }

    if (query.code) {
        filters.push("pr.code LIKE ?");
        params.push(`%${limitText(query.code, 30)}%`);
    }
    if (query.status && PURCHASE_REQUEST_STATUS.includes(String(query.status))) {
        filters.push("pr.status = ?");
        params.push(query.status);
    } else if (normalizeBoolean(query.open, false)) {
        filters.push("pr.status IN (?)");
        params.push(PURCHASE_OPEN_REQUEST_STATUS);
    }
    if (query.priority && ["normal", "urgente"].includes(String(query.priority))) {
        filters.push("pr.priority = ?");
        params.push(query.priority);
    }
    if (query.department_id) {
        filters.push("pr.department_id = ?");
        params.push(toNullableNumber(query.department_id));
    }
    if (query.requester_id && !forceRequesterId) {
        filters.push("pr.requester_id = ?");
        params.push(toNullableNumber(query.requester_id));
    }
    if (query.assigned_user_id) {
        filters.push("pr.assigned_user_id = ?");
        params.push(toNullableNumber(query.assigned_user_id));
    }
    if (query.supplier_id) {
        const supplierId = toNullableNumber(query.supplier_id);
        filters.push(`(
            EXISTS (
                SELECT 1
                FROM purchase_orders supplier_order
                WHERE supplier_order.request_id = pr.id
                  AND supplier_order.supplier_id = ?
            )
            OR EXISTS (
                SELECT 1
                FROM purchase_request_items supplier_item
                WHERE supplier_item.request_id = pr.id
                  AND supplier_item.deleted_at IS NULL
                  AND supplier_item.supplier_id = ?
            )
        )`);
        params.push(supplierId, supplierId);
    }
    if (query.category_id) {
        filters.push("pi.category_id = ?");
        params.push(toNullableNumber(query.category_id));
    }
    if (normalizeBoolean(query.monthly, false)) {
        filters.push("pr.is_monthly = 1");
    }
    if (normalizeBoolean(query.urgent, false)) {
        filters.push("(pr.priority = 'urgente' OR pr.request_type = 'urgente')");
    }
    if (normalizeBoolean(query.overdue, false)) {
        filters.push("pr.needed_at < CURDATE() AND pr.status NOT IN ('concluida', 'rejeitada', 'cancelada')");
    }

    const receiptDate = normalizeDate(query.receipt_date);
    if (receiptDate) {
        filters.push(`EXISTS (
            SELECT 1
            FROM purchase_orders receipt_filter
            WHERE receipt_filter.request_id = pr.id
              AND DATE(receipt_filter.expected_delivery_at) = ?
        )`);
        params.push(receiptDate);
    }

    if (normalizeBoolean(query.has_quotes, false)) {
        filters.push(`EXISTS (
            SELECT 1
            FROM purchase_request_items quote_item
            JOIN purchase_quotes quote_filter ON quote_filter.request_item_id = quote_item.id
            WHERE quote_item.request_id = pr.id
              AND quote_item.deleted_at IS NULL
              AND quote_filter.status <> 'descartada'
        )`);
    }

    const purchaseStatus = String(query.purchase_status || "").trim();
    if (PURCHASE_EXPORT_PURCHASE_SITUATIONS.includes(purchaseStatus)) {
        if (purchaseStatus === "sem_compra") {
            filters.push(`NOT EXISTS (
                SELECT 1 FROM purchase_orders purchase_filter
                WHERE purchase_filter.request_id = pr.id
            )`);
        }
        if (purchaseStatus === "com_compra") {
            filters.push(`EXISTS (
                SELECT 1 FROM purchase_orders purchase_filter
                WHERE purchase_filter.request_id = pr.id
            )`);
        }
        if (purchaseStatus === "compra_parcial") {
            filters.push(`EXISTS (
                SELECT 1
                FROM purchase_request_items purchase_item
                WHERE purchase_item.request_id = pr.id
                  AND purchase_item.deleted_at IS NULL
                  AND purchase_item.purchased_quantity > 0
                  AND purchase_item.purchased_quantity < purchase_item.requested_quantity
            )`);
        }
        if (purchaseStatus === "compra_total") {
            filters.push(`EXISTS (
                SELECT 1
                FROM purchase_request_items purchase_item
                WHERE purchase_item.request_id = pr.id
                  AND purchase_item.deleted_at IS NULL
            )`);
            filters.push(`NOT EXISTS (
                SELECT 1
                FROM purchase_request_items purchase_item
                WHERE purchase_item.request_id = pr.id
                  AND purchase_item.deleted_at IS NULL
                  AND purchase_item.purchased_quantity < purchase_item.requested_quantity
            )`);
        }
    }

    const receiptStatus = String(query.receipt_status || "").trim();
    if (PURCHASE_EXPORT_RECEIPT_SITUATIONS.includes(receiptStatus)) {
        if (receiptStatus === "sem_recebimento") {
            filters.push(`NOT EXISTS (
                SELECT 1
                FROM purchase_request_items receipt_item
                WHERE receipt_item.request_id = pr.id
                  AND receipt_item.deleted_at IS NULL
                  AND receipt_item.received_quantity > 0
            )`);
        }
        if (receiptStatus === "recebimento_parcial") {
            filters.push(`EXISTS (
                SELECT 1
                FROM purchase_request_items receipt_item
                WHERE receipt_item.request_id = pr.id
                  AND receipt_item.deleted_at IS NULL
                  AND receipt_item.received_quantity > 0
                  AND receipt_item.received_quantity < receipt_item.requested_quantity
            )`);
        }
        if (receiptStatus === "recebido_total") {
            filters.push(`EXISTS (
                SELECT 1
                FROM purchase_request_items receipt_item
                WHERE receipt_item.request_id = pr.id
                  AND receipt_item.deleted_at IS NULL
            )`);
            filters.push(`NOT EXISTS (
                SELECT 1
                FROM purchase_request_items receipt_item
                WHERE receipt_item.request_id = pr.id
                  AND receipt_item.deleted_at IS NULL
                  AND receipt_item.received_quantity < receipt_item.requested_quantity
            )`);
        }
    }

    const startDate = normalizeDate(query.start_date);
    const endDate = normalizeDate(query.end_date);
    if (startDate) {
        filters.push("DATE(pr.created_at) >= ?");
        params.push(startDate);
    }
    if (endDate) {
        filters.push("DATE(pr.created_at) <= ?");
        params.push(endDate);
    }
    const neededAt = normalizeDate(query.needed_at);
    if (neededAt) {
        filters.push("pr.needed_at = ?");
        params.push(neededAt);
    }

    return { where: filters.join(" AND "), params };
};

const getPurchaseExportItemTitle = (row = {}) => {
    const candidates = [
        row.item_descricao,
        row.item_nome,
        row.first_item_description,
        row.first_item_name,
    ];
    const title = candidates
        .map((value) => String(value || "").trim())
        .find((value) => value && value !== "0" && value.toLowerCase() !== "item sem nome");
    return title || "Item não identificado";
};

const toExcelDate = (value) => {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date;
};

const getPurchaseSituationLabel = (row = {}) => {
    const requested = Number(row.total_requested_quantity || 0);
    const purchased = Number(row.total_purchased_quantity || 0);
    const orders = Number(row.purchase_orders_count || 0);
    if (!orders && purchased <= 0) return "Sem compra";
    if (requested > 0 && purchased >= requested) return "Compra total";
    if (purchased > 0) return "Compra parcial";
    return "Com compra";
};

const getReceiptSituationLabel = (row = {}) => {
    const requested = Number(row.total_requested_quantity || 0);
    const received = Number(row.total_received_quantity || 0);
    if (received <= 0) return "Sem recebimento";
    if (requested > 0 && received >= requested) return "Recebido total";
    return "Recebimento parcial";
};

const buildPurchaseExportWorkbook = async (rows = [], { includeFinancial = false } = {}) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Chat Interno";
    workbook.created = new Date();
    workbook.modified = new Date();

    const worksheet = workbook.addWorksheet("Pedidos");
    worksheet.columns = [
        { header: "Descrição do item", key: "item_title", width: 36 },
        { header: "Número do pedido", key: "code", width: 18 },
        { header: "Status", key: "status", width: 24 },
        { header: "Prioridade", key: "priority", width: 14 },
        { header: "Solicitante", key: "requester", width: 28 },
        { header: "Setor", key: "department", width: 24 },
        { header: "Responsável", key: "assigned", width: 24 },
        { header: "Fornecedor", key: "supplier", width: 32 },
        { header: "Situação da compra", key: "purchase_situation", width: 20 },
        { header: "Situação do recebimento", key: "receipt_situation", width: 24 },
        { header: "Itens", key: "items_count", width: 10 },
        { header: "Quantidade solicitada", key: "requested_quantity", width: 20 },
        { header: "Quantidade comprada", key: "purchased_quantity", width: 20 },
        { header: "Quantidade recebida", key: "received_quantity", width: 20 },
        { header: "Valor estimado", key: "estimated_total", width: 18 },
        { header: "Valor realizado", key: "actual_total", width: 18 },
        { header: "Data da solicitação", key: "created_at", width: 20 },
        { header: "Data de envio", key: "submitted_at", width: 20 },
        { header: "Data necessária", key: "needed_at", width: 18 },
        { header: "Data de cancelamento", key: "cancelled_at", width: 22 },
        { header: "Justificativa", key: "justification", width: 42 },
        { header: "Observações", key: "notes", width: 42 },
    ];

    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B1E35" } };
    worksheet.getRow(1).alignment = { vertical: "middle" };
    worksheet.views = [{ state: "frozen", ySplit: 1 }];

    rows.forEach((row) => {
        worksheet.addRow({
            item_title: getPurchaseExportItemTitle(row),
            code: row.code || "Pedido sem código",
            status: row.status || "",
            priority: row.priority || "",
            requester: row.requester_nome || "",
            department: row.department_name || "",
            assigned: row.assigned_nome || "",
            supplier: row.supplier_names || "",
            purchase_situation: getPurchaseSituationLabel(row),
            receipt_situation: getReceiptSituationLabel(row),
            items_count: Number(row.items_count || 0),
            requested_quantity: Number(row.total_requested_quantity || 0),
            purchased_quantity: Number(row.total_purchased_quantity || 0),
            received_quantity: Number(row.total_received_quantity || 0),
            estimated_total: includeFinancial ? Number(row.estimated_total || 0) : "",
            actual_total: includeFinancial ? Number(row.actual_total || 0) : "",
            created_at: toExcelDate(row.created_at),
            submitted_at: toExcelDate(row.submitted_at),
            needed_at: toExcelDate(row.needed_at),
            cancelled_at: toExcelDate(row.cancelled_at),
            justification: row.justification || "",
            notes: row.notes || "",
        });
    });

    worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
            cell.border = {
                top: { style: "thin", color: { argb: "FFE1E8F0" } },
                left: { style: "thin", color: { argb: "FFE1E8F0" } },
                bottom: { style: "thin", color: { argb: "FFE1E8F0" } },
                right: { style: "thin", color: { argb: "FFE1E8F0" } },
            };
            if (rowNumber > 1) {
                cell.alignment = { vertical: "top", wrapText: true };
            }
        });
    });
    ["estimated_total", "actual_total"].forEach((key) => {
        worksheet.getColumn(key).numFmt = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
    });
    ["created_at", "submitted_at", "needed_at", "cancelled_at"].forEach((key) => {
        worksheet.getColumn(key).numFmt = "dd/mm/yyyy hh:mm";
    });
    worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: worksheet.columns.length },
    };

    return workbook;
};

const sendPurchaseRequestsExcelExport = async (req, res, { forceRequesterId = null } = {}) => {
    await seedPurchaseDefaults(req.user.empresa_id);
    const includeFinancial = !forceRequesterId && Boolean(req.purchaseAccess.permissions["purchase_financial.view"]);
    const { where, params } = buildPurchaseRequestFilters(req.query, req.user, req.purchaseAccess, { forceRequesterId });

    const [rows] = await db.query(`
        SELECT
            pr.*,
            requester.nome AS requester_nome,
            department.nome AS department_name,
            assigned.nome AS assigned_nome,
            item_summary.first_item_description,
            item_summary.first_item_description AS item_descricao,
            item_summary.items_count,
            item_summary.total_requested_quantity,
            item_summary.total_purchased_quantity,
            item_summary.total_received_quantity,
            order_summary.supplier_names,
            order_summary.purchase_orders_count
        FROM purchase_requests pr
        JOIN usuarios requester ON requester.id = pr.requester_id
        LEFT JOIN setores department ON department.id = pr.department_id
        LEFT JOIN usuarios assigned ON assigned.id = pr.assigned_user_id
        LEFT JOIN purchase_request_items pi ON pi.request_id = pr.id AND pi.deleted_at IS NULL
        LEFT JOIN (
            SELECT
                request_id,
                SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(TRIM(description), '') ORDER BY id ASC SEPARATOR ' | '), ' | ', 1) AS first_item_description,
                COUNT(*) AS items_count,
                SUM(requested_quantity) AS total_requested_quantity,
                SUM(purchased_quantity) AS total_purchased_quantity,
                SUM(received_quantity) AS total_received_quantity
            FROM purchase_request_items
            WHERE deleted_at IS NULL
            GROUP BY request_id
        ) item_summary ON item_summary.request_id = pr.id
        LEFT JOIN (
            SELECT
                po.request_id,
                COUNT(DISTINCT po.id) AS purchase_orders_count,
                GROUP_CONCAT(DISTINCT COALESCE(ps.name, po.supplier_name) ORDER BY COALESCE(ps.name, po.supplier_name) SEPARATOR ' | ') AS supplier_names
            FROM purchase_orders po
            LEFT JOIN purchase_suppliers ps ON ps.id = po.supplier_id
            GROUP BY po.request_id
        ) order_summary ON order_summary.request_id = pr.id
        WHERE ${where}
        GROUP BY pr.id
        ORDER BY
            FIELD(pr.status, 'aguardando_almoxarifado', 'em_analise', 'aguardando_informacoes', 'em_cotacao', 'aguardando_aprovacao', 'aprovada_para_compra', 'compra_realizada', 'recebida_parcialmente', 'rascunho', 'concluida', 'rejeitada', 'cancelada'),
            CASE WHEN pr.priority = 'urgente' THEN 0 ELSE 1 END,
            pr.updated_at DESC,
            pr.id DESC
    `, params);

    const workbook = await buildPurchaseExportWorkbook(rows, { includeFinancial });
    const buffer = await workbook.xlsx.writeBuffer();
    const scope = forceRequesterId ? "minhas-solicitacoes" : "pedidos";
    const date = new Date().toISOString().slice(0, 10);
    const filename = `${scope}-${date}.xlsx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
};
    } catch (err) {
        console.error("Erro ao carregar painel de compras:", err);
        res.status(500).json({ error: "Erro ao carregar painel." });
    }
});

router.get("/purchase-requests/my/summary", authMiddleware, requireRequesterPurchaseAccess, async (req, res) => {
    try {
        await seedPurchaseDefaults(req.user.empresa_id);
        const baseFilters = [
            "pr.empresa_id = ?",
            "pr.deleted_at IS NULL",
            "pr.requester_id = ?",
        ];
        const baseParams = [req.user.empresa_id, req.user.id];
        const where = baseFilters.join(" AND ");

        const [summaryRows] = await db.query(`
            SELECT
                COUNT(DISTINCT pr.id) AS total,
                SUM(CASE WHEN pr.status = 'em_analise' THEN 1 ELSE 0 END) AS em_analise,
                SUM(CASE WHEN pr.status = 'em_cotacao' THEN 1 ELSE 0 END) AS em_cotacao,
                SUM(CASE WHEN pr.status IN ('compra_realizada', 'recebida_parcialmente') THEN 1 ELSE 0 END) AS aguardando_entrega,
                SUM(CASE WHEN pr.status = 'concluida' THEN 1 ELSE 0 END) AS concluidas
            FROM purchase_requests pr
            WHERE ${where}
        `, baseParams);
        const [recentRows] = await db.query(`
            SELECT
                pr.*,
                department.nome AS department_name,
                SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(TRIM(pi.description), '') ORDER BY pi.id ASC SEPARATOR ' | '), ' | ', 1) AS first_item_description,
                SUBSTRING_INDEX(GROUP_CONCAT(pi.requested_quantity ORDER BY pi.id ASC SEPARATOR ' | '), ' | ', 1) AS first_item_requested_quantity,
                SUBSTRING_INDEX(GROUP_CONCAT(pi.unit ORDER BY pi.id ASC SEPARATOR ' | '), ' | ', 1) AS first_item_unit,
                ${buildPurchaseItemImageSelect("pr")},
                COUNT(DISTINCT pi.id) AS items_count,
                COUNT(DISTINCT pa.id) AS attachments_count,
                COUNT(DISTINCT pc.id) AS comments_count
            FROM purchase_requests pr
            LEFT JOIN setores department ON department.id = pr.department_id
            LEFT JOIN purchase_request_items pi ON pi.request_id = pr.id AND pi.deleted_at IS NULL
            LEFT JOIN purchase_attachments pa ON pa.request_id = pr.id AND pa.deleted_at IS NULL
            LEFT JOIN purchase_comments pc ON pc.request_id = pr.id AND pc.deleted_at IS NULL
            WHERE ${where}
            GROUP BY pr.id
            ORDER BY pr.updated_at DESC, pr.id DESC
            LIMIT 5
        `, baseParams);

        const summary = summaryRows[0] || {};
        res.json({
            summary: {
                total: Number(summary.total || 0),
                em_analise: Number(summary.em_analise || 0),
                em_cotacao: Number(summary.em_cotacao || 0),
                aguardando_entrega: Number(summary.aguardando_entrega || 0),
                concluidas: Number(summary.concluidas || 0),
            },
            recent: recentRows.map(formatRequesterPurchaseRequest),
            permissions: req.purchaseAccess.permissions,
            can_panel_access: canAccessPurchasePanel(req.purchaseAccess, req.user),
        });
    } catch (err) {
        console.error("Erro ao carregar resumo do solicitante:", err);
        res.status(500).json({ error: "Erro ao carregar suas solicitações." });
    }
});

router.get("/purchase-requests/my", authMiddleware, requireRequesterPurchaseAccess, async (req, res) => {
    try {
        await seedPurchaseDefaults(req.user.empresa_id);
        const filters = [
            "pr.empresa_id = ?",
            "pr.deleted_at IS NULL",
            "pr.requester_id = ?",
        ];
        const params = [req.user.empresa_id, req.user.id];

        const q = limitText(req.query.q, 120);
        if (q) {
            filters.push(`(
                pr.code LIKE ?
                OR pi.description LIKE ?
                OR pr.justification LIKE ?
                OR pr.notes LIKE ?
            )`);
            const like = `%${q}%`;
            params.push(like, like, like, like);
        }
        if (req.query.status && PURCHASE_REQUEST_STATUS.includes(String(req.query.status))) {
            filters.push("pr.status = ?");
            params.push(req.query.status);
        }
        const startDate = normalizeDate(req.query.start_date);
        const endDate = normalizeDate(req.query.end_date);
        if (startDate) {
            filters.push("DATE(pr.created_at) >= ?");
            params.push(startDate);
        }
        if (endDate) {
            filters.push("DATE(pr.created_at) <= ?");
            params.push(endDate);
        }

        const page = Math.max(1, Number(req.query.page || 1));
        const limit = Math.min(80, Math.max(5, Number(req.query.limit || 5)));
        const offset = (page - 1) * limit;
        const where = filters.join(" AND ");

        const [countRows] = await db.query(`
            SELECT COUNT(DISTINCT pr.id) AS total
            FROM purchase_requests pr
            LEFT JOIN purchase_request_items pi ON pi.request_id = pr.id AND pi.deleted_at IS NULL
            WHERE ${where}
        `, params);
        const [rows] = await db.query(`
            SELECT
                pr.*,
                department.nome AS department_name,
                SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(TRIM(pi.description), '') ORDER BY pi.id ASC SEPARATOR ' | '), ' | ', 1) AS first_item_description,
                SUBSTRING_INDEX(GROUP_CONCAT(pi.requested_quantity ORDER BY pi.id ASC SEPARATOR ' | '), ' | ', 1) AS first_item_requested_quantity,
                SUBSTRING_INDEX(GROUP_CONCAT(pi.unit ORDER BY pi.id ASC SEPARATOR ' | '), ' | ', 1) AS first_item_unit,
                ${buildPurchaseItemImageSelect("pr")},
                COUNT(DISTINCT pi.id) AS items_count,
                COUNT(DISTINCT pa.id) AS attachments_count,
                COUNT(DISTINCT pc.id) AS comments_count
            FROM purchase_requests pr
            LEFT JOIN setores department ON department.id = pr.department_id
            LEFT JOIN purchase_request_items pi ON pi.request_id = pr.id AND pi.deleted_at IS NULL
            LEFT JOIN purchase_attachments pa ON pa.request_id = pr.id AND pa.deleted_at IS NULL
            LEFT JOIN purchase_comments pc ON pc.request_id = pr.id AND pc.deleted_at IS NULL
            WHERE ${where}
            GROUP BY pr.id
            ORDER BY pr.updated_at DESC, pr.id DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);

        res.json({
            page,
            limit,
            total: Number(countRows[0]?.total || 0),
            requests: rows.map(formatRequesterPurchaseRequest),
            permissions: req.purchaseAccess.permissions,
            can_panel_access: canAccessPurchasePanel(req.purchaseAccess, req.user),
        });
    } catch (err) {
        console.error("Erro ao listar solicitações do solicitante:", err);
        res.status(500).json({ error: "Erro ao listar suas solicitações." });
    }
});

router.get("/purchase-requests/my/export", authMiddleware, requireRequesterPurchaseAccess, async (req, res) => {
    try {
        await sendPurchaseRequestsExcelExport(req, res, { forceRequesterId: req.user.id });
    } catch (err) {
        console.error("Erro ao exportar solicitações do solicitante:", err);
        res.status(500).json({ error: "Erro ao exportar suas solicitações." });
    }
});

router.get("/purchase-requests/my/:id", authMiddleware, requireRequesterPurchaseAccess, async (req, res) => {
    try {
        await seedPurchaseDefaults(req.user.empresa_id);
        const requestId = Number(req.params.id);
        if (!Number.isInteger(requestId) || requestId <= 0) {
            return res.status(400).json({ error: "Solicitação inválida." });
        }
        const requestRow = await fetchPurchaseRequestRow(requestId, req.user.empresa_id);
        if (!requestRow) {
            return res.status(404).json({ error: "Solicitação não encontrada." });
        }
        if (Number(requestRow.requester_id) !== Number(req.user.id)) {
            return res.status(403).json({ error: "Acesso negado." });
        }

        const requesterAccess = {
            ...req.purchaseAccess,
            permissions: {
                ...(req.purchaseAccess.permissions || {}),
                "purchase_request.view_own": true,
            },
        };
        const detail = await fetchRequestDetail(requestId, req.user, requesterAccess);
        res.json(formatRequesterDetail(detail));
    } catch (err) {
        console.error("Erro ao buscar detalhe do solicitante:", err);
        res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : "Erro ao buscar solicitação." });
    }
});

router.get("/purchase-requests", authMiddleware, requirePurchasePanelAccess, async (req, res) => {
    try {
        await seedPurchaseDefaults(req.user.empresa_id);
        const includeFinancial = Boolean(req.purchaseAccess.permissions["purchase_financial.view"]);
        const { where, params } = buildPurchaseRequestFilters(req.query, req.user, req.purchaseAccess);

        const page = Math.max(1, Number(req.query.page || 1));
        const limit = Math.min(200, Math.max(10, Number(req.query.limit || 80)));
        const offset = (page - 1) * limit;

        const [countRows] = await db.query(`
            SELECT COUNT(DISTINCT pr.id) AS total
            FROM purchase_requests pr
            JOIN usuarios requester ON requester.id = pr.requester_id
            LEFT JOIN setores department ON department.id = pr.department_id
            LEFT JOIN purchase_request_items pi ON pi.request_id = pr.id AND pi.deleted_at IS NULL
            WHERE ${where}
        `, params);
        const [rows] = await db.query(`
            SELECT
                pr.*,
                requester.nome AS requester_nome,
                requester.email AS requester_email,
                department.nome AS department_name,
                assigned.nome AS assigned_nome,
                assigned.email AS assigned_email,
                SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(TRIM(pi.description), '') ORDER BY pi.id ASC SEPARATOR ' | '), ' | ', 1) AS first_item_description,
                SUBSTRING_INDEX(GROUP_CONCAT(pi.requested_quantity ORDER BY pi.id ASC SEPARATOR ' | '), ' | ', 1) AS first_item_requested_quantity,
                SUBSTRING_INDEX(GROUP_CONCAT(pi.unit ORDER BY pi.id ASC SEPARATOR ' | '), ' | ', 1) AS first_item_unit,
                ${buildPurchaseItemImageSelect("pr")},
                COUNT(DISTINCT pi.id) AS items_count,
                COUNT(DISTINCT pa.id) AS attachments_count,
                COUNT(DISTINCT pc.id) AS comments_count
            FROM purchase_requests pr
            JOIN usuarios requester ON requester.id = pr.requester_id
            LEFT JOIN setores department ON department.id = pr.department_id
            LEFT JOIN usuarios assigned ON assigned.id = pr.assigned_user_id
            LEFT JOIN purchase_request_items pi ON pi.request_id = pr.id AND pi.deleted_at IS NULL
            LEFT JOIN purchase_attachments pa ON pa.request_id = pr.id AND pa.deleted_at IS NULL
            LEFT JOIN purchase_comments pc ON pc.request_id = pr.id AND pc.deleted_at IS NULL
            WHERE ${where}
            GROUP BY pr.id
            ORDER BY
                FIELD(pr.status, 'aguardando_almoxarifado', 'em_analise', 'aguardando_informacoes', 'em_cotacao', 'aguardando_aprovacao', 'aprovada_para_compra', 'compra_realizada', 'recebida_parcialmente', 'rascunho', 'concluida', 'rejeitada', 'cancelada'),
                CASE WHEN pr.priority = 'urgente' THEN 0 ELSE 1 END,
                pr.updated_at DESC,
                pr.id DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);

        res.json({
            page,
            limit,
            total: Number(countRows[0]?.total || 0),
            requests: rows.map((row) => formatPurchaseRequest(row, { includeFinancial })),
            permissions: req.purchaseAccess.permissions,
        });
    } catch (err) {
        console.error("Erro ao listar solicitações de compras:", err);
        res.status(500).json({ error: "Erro ao listar solicitações." });
    }
});

router.get("/purchase-requests/export", authMiddleware, requirePurchasePanelAccess, async (req, res) => {
    try {
        await sendPurchaseRequestsExcelExport(req, res);
    } catch (err) {
        console.error("Erro ao exportar solicitações de compras:", err);
        res.status(500).json({ error: "Erro ao exportar solicitações." });
    }
});

router.get("/purchase-requests/search", authMiddleware, requirePurchasePanelAccess, async (req, res) => {
    try {
        await seedPurchaseDefaults(req.user.empresa_id);
        const q = limitText(req.query.q, 120);
        const limit = Math.min(8, Math.max(3, Number(req.query.limit || 6)));

        if (q.length < 2) {
            return res.json({ results: [] });
        }

        const includeFinancial = Boolean(req.purchaseAccess.permissions["purchase_financial.view"]);
        const like = `%${q}%`;
        const prefixLike = `${q}%`;
        const baseFilters = ["pr.empresa_id = ?", "pr.deleted_at IS NULL"];
        const baseParams = [req.user.empresa_id];
        appendVisibilityFilter(baseFilters, baseParams, req.user, req.purchaseAccess, "pr");
        const baseWhere = baseFilters.join(" AND ");

        const [itemRows] = await db.query(`
            SELECT
                MIN(pi.id) AS item_id,
                SUBSTRING_INDEX(GROUP_CONCAT(pr.id ORDER BY pr.updated_at DESC, pr.id DESC SEPARATOR ','), ',', 1) AS request_id,
                pi.description AS item_name,
                COALESCE(pc.name, '') AS category_name,
                COUNT(DISTINCT pr.id) AS requests_count,
                SUM(pi.requested_quantity) AS requested_quantity,
                MAX(pr.updated_at) AS updated_at
            FROM purchase_request_items pi
            JOIN purchase_requests pr ON pr.id = pi.request_id
            LEFT JOIN purchase_categories pc ON pc.id = pi.category_id
            WHERE ${baseWhere}
              AND pi.deleted_at IS NULL
              AND (
                pi.description LIKE ?
                OR pi.brand LIKE ?
                OR pi.model LIKE ?
                OR pr.code LIKE ?
              )
            GROUP BY LOWER(TRIM(pi.description)), pi.description, COALESCE(pc.name, '')
            ORDER BY
                CASE WHEN LOWER(pi.description) LIKE LOWER(?) THEN 0 ELSE 1 END,
                requests_count DESC,
                updated_at DESC
            LIMIT ?
        `, [...baseParams, like, like, like, like, prefixLike, limit]);

        const [requestRows] = await db.query(`
            SELECT
                pr.*,
                requester.nome AS requester_nome,
                requester.email AS requester_email,
                department.nome AS department_name,
                assigned.nome AS assigned_nome,
                assigned.email AS assigned_email,
                SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(TRIM(pi.description), '') ORDER BY pi.id ASC SEPARATOR ' | '), ' | ', 1) AS first_item_description,
                SUBSTRING_INDEX(GROUP_CONCAT(pi.requested_quantity ORDER BY pi.id ASC SEPARATOR ' | '), ' | ', 1) AS first_item_requested_quantity,
                SUBSTRING_INDEX(GROUP_CONCAT(pi.unit ORDER BY pi.id ASC SEPARATOR ' | '), ' | ', 1) AS first_item_unit,
                ${buildPurchaseItemImageSelect("pr")},
                COUNT(DISTINCT pi.id) AS items_count,
                COUNT(DISTINCT pa.id) AS attachments_count,
                COUNT(DISTINCT pc.id) AS comments_count
            FROM purchase_requests pr
            JOIN usuarios requester ON requester.id = pr.requester_id
            LEFT JOIN setores department ON department.id = pr.department_id
            LEFT JOIN usuarios assigned ON assigned.id = pr.assigned_user_id
            LEFT JOIN purchase_request_items pi ON pi.request_id = pr.id AND pi.deleted_at IS NULL
            LEFT JOIN purchase_attachments pa ON pa.request_id = pr.id AND pa.deleted_at IS NULL
            LEFT JOIN purchase_comments pc ON pc.request_id = pr.id AND pc.deleted_at IS NULL
            WHERE ${baseWhere}
              AND (
                pr.code LIKE ?
                OR requester.nome LIKE ?
                OR department.nome LIKE ?
                OR pi.description LIKE ?
                OR pr.justification LIKE ?
                OR pr.notes LIKE ?
              )
            GROUP BY pr.id
            ORDER BY
                CASE WHEN pr.code LIKE ? THEN 0 ELSE 1 END,
                CASE WHEN pr.priority = 'urgente' THEN 0 ELSE 1 END,
                pr.updated_at DESC,
                pr.id DESC
            LIMIT ?
        `, [...baseParams, like, like, like, like, like, like, prefixLike, limit]);

        const [supplierRows] = await db.query(`
            SELECT
                ps.id,
                ps.name,
                ps.cnpj,
                ps.contact_name,
                ps.phone,
                ps.email,
                COUNT(DISTINCT po.id) AS orders_count,
                MAX(po.created_at) AS last_order_at
            FROM purchase_suppliers ps
            LEFT JOIN purchase_orders po ON po.supplier_id = ps.id
            WHERE ps.empresa_id = ?
              AND ps.is_active = 1
              AND (
                ps.name LIKE ?
                OR ps.cnpj LIKE ?
                OR ps.contact_name LIKE ?
                OR ps.email LIKE ?
              )
            GROUP BY ps.id
            ORDER BY
                CASE WHEN LOWER(ps.name) LIKE LOWER(?) THEN 0 ELSE 1 END,
                orders_count DESC,
                ps.name ASC
            LIMIT ?
        `, [req.user.empresa_id, like, like, like, like, prefixLike, limit]);

        const results = [
            ...itemRows.map((row) => ({
                type: "item",
                id: Number(row.item_id),
                request_id: Number(row.request_id || 0) || null,
                title: row.item_name || "Item sem nome",
                subtitle: [
                    row.category_name || "",
                    `${Number(row.requests_count || 0)} solicitação(ões)`,
                ].filter(Boolean).join(" · "),
                meta: {
                    requested_quantity: Number(row.requested_quantity || 0),
                },
            })),
            ...requestRows.map((row) => {
                const request = formatPurchaseRequest(row, { includeFinancial });
                return {
                    type: "request",
                    id: request.id,
                    request_id: request.id,
                    title: request.summary || "Item sem nome",
                    subtitle: [
                        request.code ? `Pedido ${request.code}` : "Pedido sem código",
                        request.requester?.nome || "",
                        request.department?.name || "",
                    ].filter(Boolean).join(" · "),
                    status: request.status,
                    meta: request,
                };
            }),
            ...supplierRows.map((row) => ({
                type: "supplier",
                id: Number(row.id),
                title: row.name || "Fornecedor sem nome",
                subtitle: [
                    row.cnpj || row.contact_name || row.email || "",
                    `${Number(row.orders_count || 0)} compra(s)`,
                ].filter(Boolean).join(" · "),
            })),
        ].slice(0, limit * 3);

        res.json({ results });
    } catch (err) {
        console.error("Erro ao buscar no painel de compras:", err);
        res.status(500).json({ error: "Erro ao buscar no painel." });
    }
});

router.post("/purchase-requests", authMiddleware, requirePurchasePermission("purchase_request.create"), uploadPurchaseFiles, async (req, res) => {
    const connection = await db.getConnection();

    try {
        await seedPurchaseDefaults(req.user.empresa_id, req.user.id, connection);
        const action = String(req.body.action || req.body.mode || "draft").toLowerCase();
        const submit = action === "submit" || action === "enviar";
        const items = normalizeRequestItems(parseJson(req.body.items, []));
        const payload = validateRequestPayload(req.body, items, { submit });
        const typedDepartment = payload.department_id
            ? null
            : await findDepartmentByName(payload.department_name, req.user.empresa_id);
        const departmentId = payload.department_id || typedDepartment?.id || req.user.setor_id || null;

        if (departmentId) {
            const department = await validateDepartmentInCompany(departmentId, req.user.empresa_id);
            if (!department) {
                removeUploadedFiles(req.files || []);
                return res.status(400).json({ error: "Departamento inválido." });
            }
        }

        await connection.beginTransaction();

        const code = submit ? await generatePurchaseCode(connection, req.user.empresa_id) : null;
        const status = submit ? "aguardando_almoxarifado" : "rascunho";
        const priority = payload.request_type === "urgente" ? "urgente" : "normal";

        const [result] = await connection.query(`
            INSERT INTO purchase_requests (
                empresa_id,
                code,
                requester_id,
                department_id,
                status,
                request_type,
                priority,
                is_monthly,
                needed_at,
                cost_center,
                company_unit,
                justification,
                notes,
                submitted_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${submit ? "NOW()" : "NULL"})
        `, [
            req.user.empresa_id,
            code,
            req.user.id,
            departmentId,
            status,
            payload.request_type,
            priority,
            payload.is_monthly ? 1 : 0,
            payload.needed_at,
            payload.cost_center || null,
            payload.company_unit || null,
            payload.justification || null,
            payload.notes || null,
        ]);

        const requestId = result.insertId;
        const itemIdsByIndex = [];
        for (const [index, item] of items.entries()) {
            if (!item.description && !submit) continue;
            const category = await findOrCreateCategory(connection, req.user.empresa_id, item.category_name, req.user.id);
            const [itemResult] = await connection.query(`
                INSERT INTO purchase_request_items (
                    request_id,
                    category_id,
                    description,
                    brand,
                    model,
                    unit,
                    stock_quantity,
                    requested_quantity,
                    approved_quantity,
                    reference_url,
                    estimated_unit_price,
                    requester_notes,
                    purchase_reason,
                    item_status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                requestId,
                category?.id || null,
                item.description || "Item sem descrição",
                item.brand || null,
                item.model || null,
                item.unit,
                item.stock_quantity,
                item.requested_quantity,
                item.approved_quantity || item.requested_quantity,
                item.reference_url || null,
                item.estimated_unit_price,
                item.requester_notes || null,
                item.purchase_reason || null,
                submit ? "pendente" : "pendente",
            ]);
            itemIdsByIndex[index] = itemResult.insertId;
        }

        for (const file of req.files || []) {
            const itemMatch = String(file.fieldname || "").match(/^item_attachment_(\d+)$/);
            if (itemMatch) {
                const itemId = itemIdsByIndex[Number(itemMatch[1])];
                if (itemId) {
                    await insertPurchaseAttachment(connection, req, {
                        requestId,
                        requestItemId: itemId,
                        attachmentType: "item",
                        file,
                    });
                }
                continue;
            }

            await insertPurchaseAttachment(connection, req, {
                requestId,
                attachmentType: "geral",
                file,
            });
        }

        await recalculateRequestTotals(connection, requestId);
        await logPurchaseHistory(connection, {
            empresaId: req.user.empresa_id,
            requestId,
            entityType: "request",
            entityId: requestId,
            userId: req.user.id,
            action: submit ? "request.created_submitted" : "request.created_draft",
            newValue: { code, status, items_count: itemIdsByIndex.filter(Boolean).length },
            req,
        });

        await connection.commit();

        if (submit) {
            await notifyStockTeam(req, {
                requestId,
                type: "purchase_request.created",
                title: `Nova solicitação ${code}`,
                message: `${req.user.nome} enviou uma solicitação de compras.`,
            });
        }

        const detail = await fetchRequestDetail(requestId, req.user, req.purchaseAccess);
        res.status(201).json(detail);
    } catch (err) {
        await connection.rollback();
        removeUploadedFiles(req.files || []);
        console.error("Erro ao criar solicitação de compra:", err);
        res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : "Erro ao criar solicitação." });
    } finally {
        connection.release();
    }
});

router.get("/purchase-requests/:id", authMiddleware, requirePurchasePanelAccess, async (req, res) => {
    try {
        await seedPurchaseDefaults(req.user.empresa_id);
        const requestId = Number(req.params.id);
        if (!Number.isInteger(requestId) || requestId <= 0) {
            return res.status(400).json({ error: "Solicitação inválida." });
        }
        const detail = await fetchRequestDetail(requestId, req.user, req.purchaseAccess);
        res.json(detail);
    } catch (err) {
        console.error("Erro ao buscar detalhe de compra:", err);
        res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : "Erro ao buscar solicitação." });
    }
});

const permanentlyDeletePurchaseRequest = async (req, res) => {
    const connection = await db.getConnection();
    let attachmentUrls = [];

    try {
        await seedPurchaseDefaults(req.user.empresa_id, req.user.id, connection);
        const requestId = Number(req.params.id);
        if (!Number.isInteger(requestId) || requestId <= 0) {
            return res.status(400).json({ error: "Solicitação inválida." });
        }

        const current = await fetchPurchaseRequestRow(requestId, req.user.empresa_id);
        if (!current) return res.status(404).json({ error: "Solicitação não encontrada." });
        if (current.status !== "cancelada") {
            return res.status(400).json({ error: "Apenas pedidos cancelados podem ser excluídos permanentemente." });
        }

        const confirmationCode = limitText(req.body.confirmation_code || req.body.code || req.body.codigo, 80);
        const expectedCode = current.code || `#${current.id}`;
        if (confirmationCode.trim().toUpperCase() !== expectedCode.trim().toUpperCase()) {
            return res.status(400).json({ error: `Digite ${expectedCode} para confirmar a exclusão.` });
        }

        const [attachmentRows] = await db.query(`
            SELECT file_url
            FROM purchase_attachments
            WHERE request_id = ?
        `, [requestId]);
        attachmentUrls = attachmentRows.map((row) => row.file_url).filter(Boolean);

        await connection.beginTransaction();
        await connection.query(`
            DELETE FROM purchase_requests
            WHERE id = ?
              AND empresa_id = ?
              AND status = 'cancelada'
        `, [requestId, req.user.empresa_id]);
        await connection.commit();

        removeStoredPurchaseFiles(attachmentUrls);
        res.json({ success: true, deleted_id: requestId });
    } catch (err) {
        await connection.rollback();
        console.error("Erro ao excluir solicitação permanentemente:", err);
        res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : "Erro ao excluir solicitação permanentemente." });
    } finally {
        connection.release();
    }
};

router.delete("/purchase-requests/:id/permanent", authMiddleware, requirePurchasePermission("purchase_settings.manage"), permanentlyDeletePurchaseRequest);
router.post("/purchase-requests/:id/permanent-delete", authMiddleware, requirePurchasePermission("purchase_settings.manage"), permanentlyDeletePurchaseRequest);

router.put("/purchase-requests/:id", authMiddleware, requirePurchasePermission("purchase_module.access"), uploadPurchaseFiles, async (req, res) => {
    const connection = await db.getConnection();

    try {
        await seedPurchaseDefaults(req.user.empresa_id, req.user.id, connection);
        const requestId = Number(req.params.id);
        const current = await fetchPurchaseRequestRow(requestId, req.user.empresa_id);
        if (!current) {
            removeUploadedFiles(req.files || []);
            return res.status(404).json({ error: "Solicitação não encontrada." });
        }
        const canEditDraft = current.status === "rascunho" && Number(current.requester_id) === Number(req.user.id);
        const canManage = Boolean(req.purchaseAccess.permissions["purchase_request.change_status"]);
        if (!canEditDraft && !canManage) {
            removeUploadedFiles(req.files || []);
            return res.status(403).json({ error: "Acesso negado" });
        }

        const items = normalizeRequestItems(parseJson(req.body.items, []));
        const payload = validateRequestPayload(req.body, items, { submit: false });
        const typedDepartment = payload.department_id
            ? null
            : await findDepartmentByName(payload.department_name, req.user.empresa_id);
        const departmentId = payload.department_id || typedDepartment?.id || current.department_id || req.user.setor_id || null;

        await connection.beginTransaction();
        await connection.query(`
            UPDATE purchase_requests
            SET request_type = ?,
                priority = ?,
                is_monthly = ?,
                needed_at = ?,
                department_id = ?,
                cost_center = ?,
                company_unit = ?,
                justification = ?,
                notes = ?
            WHERE id = ?
              AND empresa_id = ?
        `, [
            payload.request_type,
            payload.request_type === "urgente" ? "urgente" : "normal",
            payload.is_monthly ? 1 : 0,
            payload.needed_at,
            departmentId,
            payload.cost_center || null,
            payload.company_unit || null,
            payload.justification || null,
            payload.notes || null,
            requestId,
            req.user.empresa_id,
        ]);

        if (current.status === "rascunho" && items.length) {
            await connection.query(`
                UPDATE purchase_request_items
                SET deleted_at = NOW()
                WHERE request_id = ?
                  AND deleted_at IS NULL
            `, [requestId]);

            for (const item of items) {
                if (!item.description) continue;
                const category = await findOrCreateCategory(connection, req.user.empresa_id, item.category_name, req.user.id);
                await connection.query(`
                    INSERT INTO purchase_request_items (
                        request_id,
                        category_id,
                        description,
                        brand,
                        model,
                        unit,
                        stock_quantity,
                        requested_quantity,
                        approved_quantity,
                        reference_url,
                        estimated_unit_price,
                        requester_notes,
                        purchase_reason,
                        item_status
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente')
                `, [
                    requestId,
                    category?.id || null,
                    item.description,
                    item.brand || null,
                    item.model || null,
                    item.unit,
                    item.stock_quantity,
                    item.requested_quantity,
                    item.approved_quantity || item.requested_quantity,
                    item.reference_url || null,
                    item.estimated_unit_price,
                    item.requester_notes || null,
                    item.purchase_reason || null,
                ]);
            }
        }

        for (const file of req.files || []) {
            await insertPurchaseAttachment(connection, req, {
                requestId,
                attachmentType: "geral",
                file,
            });
        }

        await recalculateRequestTotals(connection, requestId);
        await logPurchaseHistory(connection, {
            empresaId: req.user.empresa_id,
            requestId,
            entityType: "request",
            entityId: requestId,
            userId: req.user.id,
            action: "request.updated",
            oldValue: current,
            newValue: payload,
            req,
        });
        await connection.commit();

        const detail = await fetchRequestDetail(requestId, req.user, req.purchaseAccess);
        res.json(detail);
    } catch (err) {
        await connection.rollback();
        removeUploadedFiles(req.files || []);
        console.error("Erro ao atualizar solicitação de compra:", err);
        res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : "Erro ao atualizar solicitação." });
    } finally {
        connection.release();
    }
});

router.post("/purchase-requests/:id/submit", authMiddleware, requirePurchasePermission("purchase_request.create"), async (req, res) => {
    const connection = await db.getConnection();
    try {
        await seedPurchaseDefaults(req.user.empresa_id, req.user.id, connection);
        const requestId = Number(req.params.id);
        const current = await fetchPurchaseRequestRow(requestId, req.user.empresa_id);
        if (!current) return res.status(404).json({ error: "Solicitação não encontrada." });
        if (Number(current.requester_id) !== Number(req.user.id) && !req.purchaseAccess.permissions["purchase_request.change_status"]) {
            return res.status(403).json({ error: "Acesso negado" });
        }
        if (current.status !== "rascunho") {
            return res.status(400).json({ error: "Apenas rascunhos podem ser enviados." });
        }
        const [items] = await db.query(`
            SELECT id, description, requested_quantity
            FROM purchase_request_items
            WHERE request_id = ?
              AND deleted_at IS NULL
        `, [requestId]);
        if (!items.length || items.some((item) => !item.description || Number(item.requested_quantity || 0) <= 0)) {
            return res.status(400).json({ error: "Adicione itens válidos antes de enviar." });
        }

        await connection.beginTransaction();
        const code = await generatePurchaseCode(connection, req.user.empresa_id);
        await connection.query(`
            UPDATE purchase_requests
            SET code = ?,
                status = 'aguardando_almoxarifado',
                submitted_at = NOW()
            WHERE id = ?
              AND empresa_id = ?
        `, [code, requestId, req.user.empresa_id]);
        await logPurchaseHistory(connection, {
            empresaId: req.user.empresa_id,
            requestId,
            entityType: "request",
            entityId: requestId,
            userId: req.user.id,
            action: "request.submitted",
            oldValue: { status: current.status, code: current.code },
            newValue: { status: "aguardando_almoxarifado", code },
            req,
        });
        await connection.commit();

        await notifyStockTeam(req, {
            requestId,
            type: "purchase_request.submitted",
            title: `Solicitação ${code} enviada`,
            message: `${req.user.nome} enviou uma solicitação ao almoxarifado.`,
        });

        const detail = await fetchRequestDetail(requestId, req.user, req.purchaseAccess);
        res.json(detail);
    } catch (err) {
        await connection.rollback();
        console.error("Erro ao enviar solicitação de compra:", err);
        res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : "Erro ao enviar solicitação." });
    } finally {
        connection.release();
    }
});

router.post("/purchase-requests/:id/cancel", authMiddleware, requirePurchasePermission("purchase_module.access"), async (req, res) => {
    const connection = await db.getConnection();
    try {
        await seedPurchaseDefaults(req.user.empresa_id, req.user.id, connection);
        const requestId = Number(req.params.id);
        const reason = normalizeLongText(req.body.reason || req.body.justification, 2000);
        if (!reason) return res.status(400).json({ error: "Informe o motivo do cancelamento." });

        const current = await fetchPurchaseRequestRow(requestId, req.user.empresa_id);
        if (!current) return res.status(404).json({ error: "Solicitação não encontrada." });
        const canCancel = Number(current.requester_id) === Number(req.user.id)
            || req.purchaseAccess.permissions["purchase_request.change_status"];
        if (!canCancel) return res.status(403).json({ error: "Acesso negado" });
        if (current.status === "compra_realizada" || current.status === "recebida_parcialmente") {
            return res.status(400).json({ error: "Solicitações já compradas não podem ser canceladas por este fluxo." });
        }

        await connection.beginTransaction();
        await validateRequestTransition(connection, requestId, current.status, "cancelada", reason);
        await connection.query(`
            UPDATE purchase_requests
            SET status = 'cancelada',
                cancelled_at = NOW(),
                cancellation_reason = ?
            WHERE id = ?
              AND empresa_id = ?
        `, [reason, requestId, req.user.empresa_id]);
        await logPurchaseHistory(connection, {
            empresaId: req.user.empresa_id,
            requestId,
            entityType: "request",
            entityId: requestId,
            userId: req.user.id,
            action: "request.cancelled",
            oldValue: { status: current.status },
            newValue: { status: "cancelada", reason },
            req,
        });
        await connection.commit();

        await createPurchaseNotifications(req, {
            requestId,
            recipients: [current.requester_id, current.assigned_user_id].filter(Boolean),
            type: "purchase_request.cancelled",
            title: `Solicitação ${current.code || requestId} cancelada`,
            message: reason,
        });

        const detail = await fetchRequestDetail(requestId, req.user, req.purchaseAccess);
        res.json(detail);
    } catch (err) {
        await connection.rollback();
        console.error("Erro ao cancelar solicitação:", err);
        res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : "Erro ao cancelar solicitação." });
    } finally {
        connection.release();
    }
});

router.post("/purchase-requests/:id/assign", authMiddleware, requirePurchasePermission("purchase_request.assign"), async (req, res) => {
    const connection = await db.getConnection();
    try {
        await seedPurchaseDefaults(req.user.empresa_id, req.user.id, connection);
        const requestId = Number(req.params.id);
        const userId = toNullableNumber(req.body.assigned_user_id) || req.user.id;
        const assigned = await validateUserInCompany(userId, req.user.empresa_id);
        if (!assigned) return res.status(400).json({ error: "Responsável inválido." });

        const current = await fetchPurchaseRequestRow(requestId, req.user.empresa_id);
        if (!current) return res.status(404).json({ error: "Solicitação não encontrada." });
        if (!canViewRequestRow(current, req.user, req.purchaseAccess)) return res.status(403).json({ error: "Acesso negado" });

        await connection.beginTransaction();
        await connection.query(`
            UPDATE purchase_requests
            SET assigned_user_id = ?
            WHERE id = ?
              AND empresa_id = ?
        `, [assigned.id, requestId, req.user.empresa_id]);
        await logPurchaseHistory(connection, {
            empresaId: req.user.empresa_id,
            requestId,
            entityType: "request",
            entityId: requestId,
            userId: req.user.id,
            action: "request.assigned",
            oldValue: { assigned_user_id: current.assigned_user_id },
            newValue: { assigned_user_id: assigned.id, assigned_name: assigned.nome },
            req,
        });
        await connection.commit();

        await createPurchaseNotifications(req, {
            requestId,
            recipients: [assigned.id, current.requester_id].filter(Boolean),
            type: "purchase_request.assigned",
            title: `Responsável definido para ${current.code || requestId}`,
            message: `${assigned.nome} assumiu a solicitação.`,
        });

        const detail = await fetchRequestDetail(requestId, req.user, req.purchaseAccess);
        res.json(detail);
    } catch (err) {
        await connection.rollback();
        console.error("Erro ao atribuir solicitação:", err);
        res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : "Erro ao atribuir solicitação." });
    } finally {
        connection.release();
    }
});

router.post("/purchase-requests/:id/status", authMiddleware, requirePurchasePermission("purchase_request.change_status"), async (req, res) => {
    const connection = await db.getConnection();
    try {
        await seedPurchaseDefaults(req.user.empresa_id, req.user.id, connection);
        const requestId = Number(req.params.id);
        const nextStatus = normalizeEnum(req.body.status, PURCHASE_REQUEST_STATUS, "");
        const justification = normalizeLongText(req.body.justification || req.body.reason, 2000);
        const current = await fetchPurchaseRequestRow(requestId, req.user.empresa_id);
        if (!current) return res.status(404).json({ error: "Solicitação não encontrada." });
        if (!canViewRequestRow(current, req.user, req.purchaseAccess)) return res.status(403).json({ error: "Acesso negado" });

        await connection.beginTransaction();
        await validateRequestTransition(connection, requestId, current.status, nextStatus, justification);
        await connection.query(`
            UPDATE purchase_requests
            SET status = ?,
                completed_at = CASE WHEN ? = 'concluida' THEN NOW() ELSE completed_at END,
                cancelled_at = CASE WHEN ? = 'cancelada' THEN NOW() ELSE cancelled_at END,
                cancellation_reason = CASE WHEN ? = 'cancelada' THEN ? ELSE cancellation_reason END
            WHERE id = ?
              AND empresa_id = ?
        `, [nextStatus, nextStatus, nextStatus, nextStatus, justification || null, requestId, req.user.empresa_id]);
        await logPurchaseHistory(connection, {
            empresaId: req.user.empresa_id,
            requestId,
            entityType: "request",
            entityId: requestId,
            userId: req.user.id,
            action: "request.status_changed",
            oldValue: { status: current.status },
            newValue: { status: nextStatus, justification },
            req,
        });
        await connection.commit();

        await createPurchaseNotifications(req, {
            requestId,
            recipients: [current.requester_id, current.assigned_user_id].filter(Boolean),
            type: "purchase_request.status",
            title: `Status alterado em ${current.code || requestId}`,
            message: `Novo status: ${nextStatus.replace(/_/g, " ")}`,
        });

        const detail = await fetchRequestDetail(requestId, req.user, req.purchaseAccess);
        res.json(detail);
    } catch (err) {
        await connection.rollback();
        console.error("Erro ao alterar status da solicitação:", err);
        res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : "Erro ao alterar status." });
    } finally {
        connection.release();
    }
});

router.post("/purchase-requests/:id/items", authMiddleware, requirePurchasePermission("purchase_request.create"), async (req, res) => {
    const connection = await db.getConnection();
    try {
        await seedPurchaseDefaults(req.user.empresa_id, req.user.id, connection);
        const requestId = Number(req.params.id);
        const current = await fetchPurchaseRequestRow(requestId, req.user.empresa_id);
        if (!current) return res.status(404).json({ error: "Solicitação não encontrada." });
        if (Number(current.requester_id) !== Number(req.user.id) && !req.purchaseAccess.permissions["purchase_request.change_status"]) {
            return res.status(403).json({ error: "Acesso negado" });
        }
        const [item] = normalizeRequestItems([req.body]);
        if (!item.description || item.requested_quantity <= 0) return res.status(400).json({ error: "Informe descrição e quantidade." });

        await connection.beginTransaction();
        const category = await findOrCreateCategory(connection, req.user.empresa_id, item.category_name, req.user.id);
        const [result] = await connection.query(`
            INSERT INTO purchase_request_items (
                request_id,
                category_id,
                description,
                brand,
                model,
                unit,
                stock_quantity,
                requested_quantity,
                approved_quantity,
                reference_url,
                estimated_unit_price,
                requester_notes,
                purchase_reason
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            requestId,
            category?.id || null,
            item.description,
            item.brand || null,
            item.model || null,
            item.unit,
            item.stock_quantity,
            item.requested_quantity,
            item.approved_quantity || item.requested_quantity,
            item.reference_url || null,
            item.estimated_unit_price,
            item.requester_notes || null,
            item.purchase_reason || null,
        ]);
        await recalculateRequestTotals(connection, requestId);
        await logPurchaseHistory(connection, {
            empresaId: req.user.empresa_id,
            requestId,
            entityType: "item",
            entityId: result.insertId,
            userId: req.user.id,
            action: "item.added",
            newValue: item,
            req,
        });
        await connection.commit();

        const detail = await fetchRequestDetail(requestId, req.user, req.purchaseAccess);
        res.status(201).json(detail);
    } catch (err) {
        await connection.rollback();
        console.error("Erro ao adicionar item:", err);
        res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : "Erro ao adicionar item." });
    } finally {
        connection.release();
    }
});

router.put("/purchase-request-items/:id", authMiddleware, requirePurchasePermission("purchase_module.access"), async (req, res) => {
    const connection = await db.getConnection();
    try {
        await seedPurchaseDefaults(req.user.empresa_id, req.user.id, connection);
        const itemId = Number(req.params.id);
        const [rows] = await db.query(`
            SELECT pi.*, pr.empresa_id, pr.requester_id, pr.status AS request_status
            FROM purchase_request_items pi
            JOIN purchase_requests pr ON pr.id = pi.request_id
            WHERE pi.id = ?
              AND pr.empresa_id = ?
              AND pi.deleted_at IS NULL
            LIMIT 1
        `, [itemId, req.user.empresa_id]);
        const current = rows[0];
        if (!current) return res.status(404).json({ error: "Item não encontrado." });
        const canEdit = (current.request_status === "rascunho" && Number(current.requester_id) === Number(req.user.id))
            || req.purchaseAccess.permissions["purchase_request.change_status"];
        if (!canEdit) return res.status(403).json({ error: "Acesso negado" });
        const [item] = normalizeRequestItems([req.body]);
        if (!item.description || item.requested_quantity <= 0) return res.status(400).json({ error: "Informe descrição e quantidade." });

        await connection.beginTransaction();
        const category = await findOrCreateCategory(connection, req.user.empresa_id, item.category_name, req.user.id);
        await connection.query(`
            UPDATE purchase_request_items
            SET category_id = ?,
                description = ?,
                brand = ?,
                model = ?,
                unit = ?,
                stock_quantity = ?,
                requested_quantity = ?,
                approved_quantity = ?,
                reference_url = ?,
                estimated_unit_price = ?,
                requester_notes = ?,
                purchase_reason = ?
            WHERE id = ?
        `, [
            category?.id || null,
            item.description,
            item.brand || null,
            item.model || null,
            item.unit,
            item.stock_quantity,
            item.requested_quantity,
            item.approved_quantity || item.requested_quantity,
            item.reference_url || null,
            item.estimated_unit_price,
            item.requester_notes || null,
            item.purchase_reason || null,
            itemId,
        ]);
        await recalculateRequestTotals(connection, current.request_id);
        await logPurchaseHistory(connection, {
            empresaId: req.user.empresa_id,
            requestId: current.request_id,
            entityType: "item",
            entityId: itemId,
            userId: req.user.id,
            action: "item.updated",
            oldValue: current,
            newValue: item,
            req,
        });
        await connection.commit();
        const detail = await fetchRequestDetail(current.request_id, req.user, req.purchaseAccess);
        res.json(detail);
    } catch (err) {
        await connection.rollback();
        console.error("Erro ao atualizar item:", err);
        res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : "Erro ao atualizar item." });
    } finally {
        connection.release();
    }
});

router.delete("/purchase-request-items/:id", authMiddleware, requirePurchasePermission("purchase_module.access"), async (req, res) => {
    const connection = await db.getConnection();
    try {
        const itemId = Number(req.params.id);
        await seedPurchaseDefaults(req.user.empresa_id, req.user.id, connection);
        const [rows] = await db.query(`
            SELECT pi.*, pr.empresa_id, pr.requester_id, pr.status AS request_status
            FROM purchase_request_items pi
            JOIN purchase_requests pr ON pr.id = pi.request_id
            WHERE pi.id = ?
              AND pr.empresa_id = ?
              AND pi.deleted_at IS NULL
            LIMIT 1
        `, [itemId, req.user.empresa_id]);
        const current = rows[0];
        if (!current) return res.status(404).json({ error: "Item não encontrado." });
        const canDelete = current.request_status === "rascunho" && Number(current.requester_id) === Number(req.user.id);
        if (!canDelete) return res.status(403).json({ error: "Somente itens de rascunho podem ser removidos pelo solicitante." });

        await connection.beginTransaction();
        await connection.query("UPDATE purchase_request_items SET deleted_at = NOW() WHERE id = ?", [itemId]);
        await recalculateRequestTotals(connection, current.request_id);
        await logPurchaseHistory(connection, {
            empresaId: req.user.empresa_id,
            requestId: current.request_id,
            entityType: "item",
            entityId: itemId,
            userId: req.user.id,
            action: "item.removed",
            oldValue: current,
            req,
        });
        await connection.commit();
        res.json({ success: true });
    } catch (err) {
        await connection.rollback();
        console.error("Erro ao remover item:", err);
        res.status(500).json({ error: "Erro ao remover item." });
    } finally {
        connection.release();
    }
});

router.post("/purchase-request-items/:id/status", authMiddleware, requirePurchasePermission("purchase_request.change_status"), async (req, res) => {
    const connection = await db.getConnection();
    try {
        await seedPurchaseDefaults(req.user.empresa_id, req.user.id, connection);
        const itemId = Number(req.params.id);
        const nextStatus = normalizeEnum(req.body.status, PURCHASE_ITEM_STATUS, "");
        const justification = normalizeLongText(req.body.justification || req.body.reason, 2000);
        const [rows] = await db.query(`
            SELECT pi.*, pr.empresa_id, pr.requester_id
            FROM purchase_request_items pi
            JOIN purchase_requests pr ON pr.id = pi.request_id
            WHERE pi.id = ?
              AND pr.empresa_id = ?
              AND pi.deleted_at IS NULL
            LIMIT 1
        `, [itemId, req.user.empresa_id]);
        const current = rows[0];
        if (!current) return res.status(404).json({ error: "Item não encontrado." });
        validateItemTransition(current.item_status, nextStatus, justification);

        await connection.beginTransaction();
        await connection.query(`
            UPDATE purchase_request_items
            SET item_status = ?,
                rejection_reason = CASE WHEN ? = 'rejeitado' THEN ? ELSE rejection_reason END
            WHERE id = ?
        `, [nextStatus, nextStatus, justification || null, itemId]);
        await refreshRequestCompletion(connection, current.request_id);
        await logPurchaseHistory(connection, {
            empresaId: req.user.empresa_id,
            requestId: current.request_id,
            entityType: "item",
            entityId: itemId,
            userId: req.user.id,
            action: "item.status_changed",
            oldValue: { status: current.item_status },
            newValue: { status: nextStatus, justification },
            req,
        });
        await connection.commit();
        await createPurchaseNotifications(req, {
            requestId: current.request_id,
            recipients: [current.requester_id].filter(Boolean),
            type: "purchase_item.status",
            title: "Status de item alterado",
            message: `${current.description}: ${nextStatus.replace(/_/g, " ")}`,
        });
        const detail = await fetchRequestDetail(current.request_id, req.user, req.purchaseAccess);
        res.json(detail);
    } catch (err) {
        await connection.rollback();
        console.error("Erro ao alterar status do item:", err);
        res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : "Erro ao alterar status do item." });
    } finally {
        connection.release();
    }
});

router.post("/purchase-request-items/:id/quotes", authMiddleware, requirePurchasePermission("purchase_quote.manage"), uploadPurchaseFiles, async (req, res) => {
    const connection = await db.getConnection();
    try {
        await seedPurchaseDefaults(req.user.empresa_id, req.user.id, connection);
        const itemId = Number(req.params.id);
        const [rows] = await db.query(`
            SELECT pi.*, pr.empresa_id, pr.requester_id
            FROM purchase_request_items pi
            JOIN purchase_requests pr ON pr.id = pi.request_id
            WHERE pi.id = ?
              AND pr.empresa_id = ?
              AND pi.deleted_at IS NULL
            LIMIT 1
        `, [itemId, req.user.empresa_id]);
        const item = rows[0];
        if (!item) {
            removeUploadedFiles(req.files || []);
            return res.status(404).json({ error: "Item não encontrado." });
        }

        const quantity = toPositiveNumber(req.body.quantity, item.requested_quantity || 0);
        const unitPrice = toPositiveNumber(req.body.unit_price);
        const shipping = toPositiveNumber(req.body.shipping_price);
        const discount = toPositiveNumber(req.body.discount);
        const subtotal = quantity * unitPrice;
        const total = Math.max(0, subtotal + shipping - discount);
        const status = normalizeEnum(req.body.status, PURCHASE_QUOTE_STATUS, "aguardando_retorno");
        const supplierPayload = {
            name: req.body.supplier_name,
            cnpj: req.body.cnpj,
            seller_name: req.body.seller_name,
            phone: req.body.phone,
            email: req.body.email,
        };

        await connection.beginTransaction();
        const supplier = await findOrCreateSupplier(connection, req.user.empresa_id, supplierPayload, req.user.id);
        const [result] = await connection.query(`
            INSERT INTO purchase_quotes (
                request_item_id,
                supplier_id,
                supplier_name,
                cnpj,
                seller_name,
                phone,
                email,
                link,
                quantity,
                unit_price,
                shipping_price,
                discount,
                subtotal,
                total_price,
                delivery_days,
                valid_until,
                payment_method,
                status,
                discard_reason,
                notes,
                created_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            itemId,
            supplier?.id || null,
            supplier?.name || limitText(req.body.supplier_name, 180) || null,
            limitText(req.body.cnpj, 32) || null,
            limitText(req.body.seller_name, 160) || null,
            limitText(req.body.phone, 80) || null,
            limitText(req.body.email, 160) || null,
            normalizeUrl(req.body.link) || null,
            quantity,
            unitPrice,
            shipping,
            discount,
            subtotal,
            total,
            toNullableNumber(req.body.delivery_days),
            normalizeDate(req.body.valid_until),
            limitText(req.body.payment_method, 160) || null,
            status,
            status === "descartada" ? normalizeLongText(req.body.discard_reason, 1000) || null : null,
            normalizeLongText(req.body.notes, 2000) || null,
            req.user.id,
        ]);

        if (status === "selecionada") {
            await connection.query(`
                UPDATE purchase_quotes
                SET status = 'descartada'
                WHERE request_item_id = ?
                  AND id <> ?
                  AND status = 'selecionada'
            `, [itemId, result.insertId]);
        }

        for (const file of req.files || []) {
            await insertPurchaseAttachment(connection, req, {
                requestId: item.request_id,
                requestItemId: itemId,
                quoteId: result.insertId,
                attachmentType: "cotacao",
                file,
            });
        }

        await connection.query(`
            UPDATE purchase_request_items
            SET item_status = CASE
                    WHEN item_status IN ('pendente', 'em_analise') THEN 'em_cotacao'
                    ELSE item_status
                END
            WHERE id = ?
        `, [itemId]);
        await connection.query(`
            UPDATE purchase_requests
            SET status = CASE
                    WHEN status IN ('aguardando_almoxarifado', 'em_analise') THEN 'em_cotacao'
                    ELSE status
                END
            WHERE id = ?
        `, [item.request_id]);
        await logPurchaseHistory(connection, {
            empresaId: req.user.empresa_id,
            requestId: item.request_id,
            entityType: "quote",
            entityId: result.insertId,
            userId: req.user.id,
            action: "quote.added",
            newValue: { supplier_name: supplier?.name || req.body.supplier_name, total_price: total, status },
            req,
        });
        await connection.commit();

        await createPurchaseNotifications(req, {
            requestId: item.request_id,
            recipients: [item.requester_id].filter(Boolean),
            type: "purchase_quote.added",
            title: "Cotação registrada",
            message: item.description,
        });

        const detail = await fetchRequestDetail(item.request_id, req.user, req.purchaseAccess);
        res.status(201).json(detail);
    } catch (err) {
        await connection.rollback();
        removeUploadedFiles(req.files || []);
        console.error("Erro ao registrar cotação:", err);
        res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : "Erro ao registrar cotação." });
    } finally {
        connection.release();
    }
});

router.put("/purchase-quotes/:id", authMiddleware, requirePurchasePermission("purchase_quote.manage"), async (req, res) => {
    const connection = await db.getConnection();
    try {
        await seedPurchaseDefaults(req.user.empresa_id, req.user.id, connection);
        const quoteId = Number(req.params.id);
        const [rows] = await db.query(`
            SELECT pq.*, pi.request_id
            FROM purchase_quotes pq
            JOIN purchase_request_items pi ON pi.id = pq.request_item_id
            JOIN purchase_requests pr ON pr.id = pi.request_id
            WHERE pq.id = ?
              AND pr.empresa_id = ?
            LIMIT 1
        `, [quoteId, req.user.empresa_id]);
        const current = rows[0];
        if (!current) return res.status(404).json({ error: "Cotação não encontrada." });
        const quantity = toPositiveNumber(req.body.quantity, current.quantity);
        const unitPrice = toPositiveNumber(req.body.unit_price, current.unit_price);
        const shipping = toPositiveNumber(req.body.shipping_price, current.shipping_price);
        const discount = toPositiveNumber(req.body.discount, current.discount);
        const subtotal = quantity * unitPrice;
        const total = Math.max(0, subtotal + shipping - discount);
        const status = normalizeEnum(req.body.status, PURCHASE_QUOTE_STATUS, current.status);

        await connection.beginTransaction();
        await connection.query(`
            UPDATE purchase_quotes
            SET quantity = ?,
                unit_price = ?,
                shipping_price = ?,
                discount = ?,
                subtotal = ?,
                total_price = ?,
                delivery_days = ?,
                valid_until = ?,
                payment_method = ?,
                status = ?,
                discard_reason = ?,
                notes = ?
            WHERE id = ?
        `, [
            quantity,
            unitPrice,
            shipping,
            discount,
            subtotal,
            total,
            toNullableNumber(req.body.delivery_days),
            normalizeDate(req.body.valid_until),
            limitText(req.body.payment_method, 160) || null,
            status,
            status === "descartada" ? normalizeLongText(req.body.discard_reason, 1000) || null : null,
            normalizeLongText(req.body.notes, 2000) || null,
            quoteId,
        ]);
        await logPurchaseHistory(connection, {
            empresaId: req.user.empresa_id,
            requestId: current.request_id,
            entityType: "quote",
            entityId: quoteId,
            userId: req.user.id,
            action: "quote.updated",
            oldValue: current,
            newValue: { total_price: total, status },
            req,
        });
        await connection.commit();
        const detail = await fetchRequestDetail(current.request_id, req.user, req.purchaseAccess);
        res.json(detail);
    } catch (err) {
        await connection.rollback();
        console.error("Erro ao atualizar cotação:", err);
        res.status(500).json({ error: "Erro ao atualizar cotação." });
    } finally {
        connection.release();
    }
});

router.post("/purchase-quotes/:id/select", authMiddleware, requirePurchasePermission("purchase_quote.manage"), async (req, res) => {
    const connection = await db.getConnection();
    try {
        await seedPurchaseDefaults(req.user.empresa_id, req.user.id, connection);
        const quoteId = Number(req.params.id);
        const [rows] = await db.query(`
            SELECT pq.*, pi.request_id
            FROM purchase_quotes pq
            JOIN purchase_request_items pi ON pi.id = pq.request_item_id
            JOIN purchase_requests pr ON pr.id = pi.request_id
            WHERE pq.id = ?
              AND pr.empresa_id = ?
            LIMIT 1
        `, [quoteId, req.user.empresa_id]);
        const quote = rows[0];
        if (!quote) return res.status(404).json({ error: "Cotação não encontrada." });

        await connection.beginTransaction();
        await connection.query(`
            UPDATE purchase_quotes
            SET status = CASE WHEN id = ? THEN 'selecionada' ELSE 'descartada' END
            WHERE request_item_id = ?
        `, [quoteId, quote.request_item_id]);
        await connection.query(`
            UPDATE purchase_request_items
            SET item_status = 'aprovado',
                supplier_id = ?,
                unit_price = ?,
                shipping_price = ?,
                discount = ?,
                total_price = ?
            WHERE id = ?
        `, [quote.supplier_id, quote.unit_price, quote.shipping_price, quote.discount, quote.total_price, quote.request_item_id]);
        await logPurchaseHistory(connection, {
            empresaId: req.user.empresa_id,
            requestId: quote.request_id,
            entityType: "quote",
            entityId: quoteId,
            userId: req.user.id,
            action: "quote.selected",
            newValue: { quote_id: quoteId, total_price: quote.total_price },
            req,
        });
        await connection.commit();
        const detail = await fetchRequestDetail(quote.request_id, req.user, req.purchaseAccess);
        res.json(detail);
    } catch (err) {
        await connection.rollback();
        console.error("Erro ao selecionar cotação:", err);
        res.status(500).json({ error: "Erro ao selecionar cotação." });
    } finally {
        connection.release();
    }
});

router.post("/purchase-requests/:id/approvals", authMiddleware, requirePurchasePermission("purchase_approval.manage"), async (req, res) => {
    const connection = await db.getConnection();
    try {
        await seedPurchaseDefaults(req.user.empresa_id, req.user.id, connection);
        const requestId = Number(req.params.id);
        const decision = normalizeEnum(req.body.decision, ["aprovado", "rejeitado", "ajustes"], "");
        if (!decision) return res.status(400).json({ error: "Decisão inválida." });
        const justification = normalizeLongText(req.body.justification, 2000);
        if (decision === "rejeitado" && !justification) return res.status(400).json({ error: "Informe a justificativa da rejeição." });
        const current = await fetchPurchaseRequestRow(requestId, req.user.empresa_id);
        if (!current) return res.status(404).json({ error: "Solicitação não encontrada." });

        await connection.beginTransaction();
        await connection.query(`
            INSERT INTO purchase_approvals (
                request_id,
                approver_id,
                decision,
                justification,
                approved_value
            )
            VALUES (?, ?, ?, ?, ?)
        `, [
            requestId,
            req.user.id,
            decision,
            justification || null,
            toPositiveNumber(req.body.approved_value, current.actual_total || current.estimated_total || 0),
        ]);
        const nextStatus = decision === "aprovado"
            ? "aprovada_para_compra"
            : decision === "rejeitado"
                ? "rejeitada"
                : "aguardando_informacoes";
        await connection.query("UPDATE purchase_requests SET status = ? WHERE id = ?", [nextStatus, requestId]);
        await logPurchaseHistory(connection, {
            empresaId: req.user.empresa_id,
            requestId,
            entityType: "approval",
            entityId: requestId,
            userId: req.user.id,
            action: "approval.decided",
            newValue: { decision, justification, status: nextStatus },
            req,
        });
        await connection.commit();
        await createPurchaseNotifications(req, {
            requestId,
            recipients: [current.requester_id, current.assigned_user_id].filter(Boolean),
            type: `purchase_approval.${decision}`,
            title: `Compra ${decision}`,
            message: justification || `Decisão registrada por ${req.user.nome}.`,
        });
        const detail = await fetchRequestDetail(requestId, req.user, req.purchaseAccess);
        res.status(201).json(detail);
    } catch (err) {
        await connection.rollback();
        console.error("Erro ao registrar aprovação:", err);
        res.status(500).json({ error: "Erro ao registrar aprovação." });
    } finally {
        connection.release();
    }
});

router.post("/purchase-requests/:id/purchases", authMiddleware, requirePurchasePermission("purchase_order.manage"), uploadPurchaseFiles, async (req, res) => {
    const connection = await db.getConnection();
    try {
        await seedPurchaseDefaults(req.user.empresa_id, req.user.id, connection);
        const requestId = Number(req.params.id);
        const current = await fetchPurchaseRequestRow(requestId, req.user.empresa_id);
        if (!current) {
            removeUploadedFiles(req.files || []);
            return res.status(404).json({ error: "Solicitação não encontrada." });
        }
        const items = Array.isArray(parseJson(req.body.items, []))
            ? parseJson(req.body.items, [])
            : [];
        if (!items.length) {
            removeUploadedFiles(req.files || []);
            return res.status(400).json({ error: "Informe os itens comprados." });
        }
        const supplier = await findOrCreateSupplier(connection, req.user.empresa_id, {
            name: req.body.supplier_name,
        }, req.user.id);
        const subtotal = items.reduce((total, item) => (
            total + toPositiveNumber(item.quantity) * toPositiveNumber(item.unit_price)
        ), 0);
        const shipping = toPositiveNumber(req.body.shipping_price);
        const discount = toPositiveNumber(req.body.discount);
        const total = Math.max(0, subtotal + shipping - discount);

        await connection.beginTransaction();
        const [orderResult] = await connection.query(`
            INSERT INTO purchase_orders (
                request_id,
                supplier_id,
                supplier_name,
                quote_id,
                order_number,
                purchase_date,
                expected_delivery_at,
                payment_method,
                subtotal,
                shipping_price,
                discount,
                total_price,
                notes,
                created_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            requestId,
            supplier?.id || null,
            supplier?.name || limitText(req.body.supplier_name, 180) || null,
            toNullableNumber(req.body.quote_id),
            limitText(req.body.order_number, 120) || null,
            normalizeDate(req.body.purchase_date) || new Date().toISOString().slice(0, 10),
            normalizeDate(req.body.expected_delivery_at),
            limitText(req.body.payment_method, 160) || null,
            subtotal,
            shipping,
            discount,
            total,
            normalizeLongText(req.body.notes, 2000) || null,
            req.user.id,
        ]);
        const orderId = orderResult.insertId;

        for (const item of items) {
            const itemId = toNullableNumber(item.request_item_id || item.item_id);
            const quantity = toPositiveNumber(item.quantity);
            const unitPrice = toPositiveNumber(item.unit_price);
            const itemShipping = toPositiveNumber(item.shipping_price);
            const itemDiscount = toPositiveNumber(item.discount);
            const itemTotal = Math.max(0, quantity * unitPrice + itemShipping - itemDiscount);
            if (!itemId || quantity <= 0) continue;

            const [validItems] = await connection.query(`
                SELECT id, requested_quantity, purchased_quantity
                FROM purchase_request_items
                WHERE id = ?
                  AND request_id = ?
                  AND deleted_at IS NULL
                LIMIT 1
            `, [itemId, requestId]);
            if (!validItems.length) {
                throw Object.assign(new Error("Há item inválido na compra."), { statusCode: 400 });
            }

            await connection.query(`
                INSERT INTO purchase_order_items (
                    purchase_order_id,
                    request_item_id,
                    quantity,
                    unit_price,
                    shipping_price,
                    discount,
                    total_price
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [orderId, itemId, quantity, unitPrice, itemShipping, itemDiscount, itemTotal]);
            await connection.query(`
                UPDATE purchase_request_items
                SET purchased_quantity = purchased_quantity + ?,
                    approved_quantity = GREATEST(approved_quantity, ?),
                    item_status = 'comprado',
                    supplier_id = COALESCE(?, supplier_id),
                    unit_price = ?,
                    shipping_price = ?,
                    discount = ?,
                    total_price = ?,
                    supplier_order_number = ?,
                    purchased_at = ?,
                    expected_delivery_at = ?
                WHERE id = ?
            `, [
                quantity,
                quantity,
                supplier?.id || null,
                unitPrice,
                itemShipping,
                itemDiscount,
                itemTotal,
                limitText(req.body.order_number, 120) || null,
                normalizeDate(req.body.purchase_date) || new Date().toISOString().slice(0, 10),
                normalizeDate(req.body.expected_delivery_at),
                itemId,
            ]);
        }

        for (const file of req.files || []) {
            await insertPurchaseAttachment(connection, req, {
                requestId,
                orderId,
                attachmentType: file.fieldname === "invoice" ? "nota_fiscal" : "comprovante",
                file,
            });
        }

        await connection.query(`
            UPDATE purchase_requests
            SET status = 'compra_realizada'
            WHERE id = ?
              AND status NOT IN ('concluida', 'rejeitada', 'cancelada')
        `, [requestId]);
        await recalculateRequestTotals(connection, requestId);
        await logPurchaseHistory(connection, {
            empresaId: req.user.empresa_id,
            requestId,
            entityType: "purchase_order",
            entityId: orderId,
            userId: req.user.id,
            action: "purchase.registered",
            newValue: { supplier_name: supplier?.name || req.body.supplier_name, total_price: total },
            req,
        });
        await connection.commit();

        await createPurchaseNotifications(req, {
            requestId,
            recipients: [current.requester_id, current.assigned_user_id].filter(Boolean),
            type: "purchase_order.created",
            title: `Compra registrada em ${current.code || requestId}`,
            message: supplier?.name || limitText(req.body.supplier_name, 180) || "Fornecedor registrado",
        });

        const detail = await fetchRequestDetail(requestId, req.user, req.purchaseAccess);
        res.status(201).json(detail);
    } catch (err) {
        await connection.rollback();
        removeUploadedFiles(req.files || []);
        console.error("Erro ao registrar compra:", err);
        res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : "Erro ao registrar compra." });
    } finally {
        connection.release();
    }
});

router.post("/purchase-request-items/:id/receive", authMiddleware, requirePurchasePermission("purchase_receipt.manage"), uploadPurchaseFiles, async (req, res) => {
    const connection = await db.getConnection();
    try {
        await seedPurchaseDefaults(req.user.empresa_id, req.user.id, connection);
        const itemId = Number(req.params.id);
        const [rows] = await db.query(`
            SELECT pi.*, pr.empresa_id, pr.requester_id
            FROM purchase_request_items pi
            JOIN purchase_requests pr ON pr.id = pi.request_id
            WHERE pi.id = ?
              AND pr.empresa_id = ?
              AND pi.deleted_at IS NULL
            LIMIT 1
        `, [itemId, req.user.empresa_id]);
        const item = rows[0];
        if (!item) {
            removeUploadedFiles(req.files || []);
            return res.status(404).json({ error: "Item não encontrado." });
        }
        if (Number(item.purchased_quantity || 0) <= 0) {
            removeUploadedFiles(req.files || []);
            return res.status(400).json({ error: "Registre uma compra antes do recebimento." });
        }
        const quantity = toPositiveNumber(req.body.quantity_received);
        if (quantity <= 0) {
            removeUploadedFiles(req.files || []);
            return res.status(400).json({ error: "Informe a quantidade recebida." });
        }
        const condition = normalizeEnum(req.body.condition_status, PURCHASE_RECEIPT_CONDITIONS, "correto");

        await connection.beginTransaction();
        const [result] = await connection.query(`
            INSERT INTO purchase_receipts (
                request_item_id,
                purchase_order_id,
                quantity_received,
                condition_status,
                storage_location,
                received_by,
                received_at,
                notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            itemId,
            toNullableNumber(req.body.purchase_order_id),
            quantity,
            condition,
            limitText(req.body.storage_location, 180) || null,
            req.user.id,
            normalizeDateTime(req.body.received_at) || new Date().toISOString().slice(0, 19).replace("T", " "),
            normalizeLongText(req.body.notes, 2000) || null,
        ]);
        const newReceived = Number(item.received_quantity || 0) + quantity;
        const itemStatus = newReceived >= Number(item.requested_quantity || 0)
            ? "recebido"
            : "recebido_parcialmente";
        await connection.query(`
            UPDATE purchase_request_items
            SET received_quantity = ?,
                item_status = ?,
                received_at = CURDATE()
            WHERE id = ?
        `, [newReceived, itemStatus, itemId]);

        for (const file of req.files || []) {
            await insertPurchaseAttachment(connection, req, {
                requestId: item.request_id,
                requestItemId: itemId,
                receiptId: result.insertId,
                attachmentType: file.fieldname === "invoice" ? "nota_fiscal" : "recebimento",
                file,
            });
        }

        await refreshRequestCompletion(connection, item.request_id);
        await logPurchaseHistory(connection, {
            empresaId: req.user.empresa_id,
            requestId: item.request_id,
            entityType: "receipt",
            entityId: result.insertId,
            userId: req.user.id,
            action: "receipt.registered",
            newValue: { quantity_received: quantity, condition_status: condition, item_status: itemStatus },
            req,
        });
        await connection.commit();

        await createPurchaseNotifications(req, {
            requestId: item.request_id,
            recipients: [item.requester_id].filter(Boolean),
            type: "purchase_receipt.created",
            title: "Material recebido",
            message: `${item.description}: ${quantity} ${item.unit}`,
        });

        const detail = await fetchRequestDetail(item.request_id, req.user, req.purchaseAccess);
        res.status(201).json(detail);
    } catch (err) {
        await connection.rollback();
        removeUploadedFiles(req.files || []);
        console.error("Erro ao registrar recebimento:", err);
        res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : "Erro ao registrar recebimento." });
    } finally {
        connection.release();
    }
});

router.get("/purchase-requests/:id/comments", authMiddleware, requirePurchasePermission("purchase_module.access"), async (req, res) => {
    try {
        const requestId = Number(req.params.id);
        const detail = await fetchRequestDetail(requestId, req.user, req.purchaseAccess);
        res.json({ comments: detail.comments });
    } catch (err) {
        console.error("Erro ao listar comentários:", err);
        res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : "Erro ao listar comentários." });
    }
});

router.post("/purchase-requests/:id/comments", authMiddleware, requirePurchasePermission("purchase_module.access"), uploadPurchaseFiles, async (req, res) => {
    const connection = await db.getConnection();
    try {
        await seedPurchaseDefaults(req.user.empresa_id, req.user.id, connection);
        const requestId = Number(req.params.id);
        const current = await fetchPurchaseRequestRow(requestId, req.user.empresa_id);
        if (!current) {
            removeUploadedFiles(req.files || []);
            return res.status(404).json({ error: "Solicitação não encontrada." });
        }
        if (!canViewRequestRow(current, req.user, req.purchaseAccess)) {
            removeUploadedFiles(req.files || []);
            return res.status(403).json({ error: "Acesso negado" });
        }
        const message = normalizeLongText(req.body.message || req.body.mensagem, 5000);
        if (!message && !(req.files || []).length) {
            removeUploadedFiles(req.files || []);
            return res.status(400).json({ error: "Escreva uma mensagem ou envie um anexo." });
        }

        await connection.beginTransaction();
        const [result] = await connection.query(`
            INSERT INTO purchase_comments (
                request_id,
                parent_id,
                user_id,
                message,
                is_important
            )
            VALUES (?, ?, ?, ?, ?)
        `, [
            requestId,
            toNullableNumber(req.body.parent_id),
            req.user.id,
            message || "[Anexo]",
            normalizeBoolean(req.body.is_important, false) ? 1 : 0,
        ]);
        const commentId = result.insertId;

        for (const file of req.files || []) {
            await insertPurchaseAttachment(connection, req, {
                requestId,
                commentId,
                attachmentType: "comentario",
                file,
            });
        }

        await logPurchaseHistory(connection, {
            empresaId: req.user.empresa_id,
            requestId,
            entityType: "comment",
            entityId: commentId,
            userId: req.user.id,
            action: "comment.added",
            newValue: { message, is_important: normalizeBoolean(req.body.is_important, false) },
            req,
        });
        await connection.commit();

        const mentionedUsers = await extractMentionedUsers(req.user.empresa_id, message, current, req.purchaseAccess);
        await createPurchaseNotifications(req, {
            requestId,
            recipients: [
                current.requester_id,
                current.assigned_user_id,
                ...mentionedUsers,
            ].filter((id) => Number(id) !== Number(req.user.id)),
            type: "purchase_comment.created",
            title: `Novo comentário em ${current.code || requestId}`,
            message: message.slice(0, 160),
        });

        const detail = await fetchRequestDetail(requestId, req.user, req.purchaseAccess);
        res.status(201).json(detail);
    } catch (err) {
        await connection.rollback();
        removeUploadedFiles(req.files || []);
        console.error("Erro ao comentar solicitação:", err);
        res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : "Erro ao comentar." });
    } finally {
        connection.release();
    }
});

router.post("/purchase-requests/:id/attachments", authMiddleware, requirePurchasePermission("purchase_module.access"), uploadPurchaseFiles, async (req, res) => {
    const connection = await db.getConnection();
    try {
        await seedPurchaseDefaults(req.user.empresa_id, req.user.id, connection);
        const requestId = Number(req.params.id);
        const current = await fetchPurchaseRequestRow(requestId, req.user.empresa_id);
        if (!current) {
            removeUploadedFiles(req.files || []);
            return res.status(404).json({ error: "Solicitação não encontrada." });
        }
        if (!canViewRequestRow(current, req.user, req.purchaseAccess)) {
            removeUploadedFiles(req.files || []);
            return res.status(403).json({ error: "Acesso negado" });
        }
        if (!(req.files || []).length) return res.status(400).json({ error: "Envie pelo menos um arquivo." });

        await connection.beginTransaction();
        for (const file of req.files || []) {
            await insertPurchaseAttachment(connection, req, {
                requestId,
                requestItemId: toNullableNumber(req.body.request_item_id),
                attachmentType: limitText(req.body.attachment_type, 60) || "geral",
                file,
            });
        }
        await logPurchaseHistory(connection, {
            empresaId: req.user.empresa_id,
            requestId,
            entityType: "attachment",
            entityId: requestId,
            userId: req.user.id,
            action: "attachment.added",
            newValue: { files: (req.files || []).map((file) => file.originalname) },
            req,
        });
        await connection.commit();
        const detail = await fetchRequestDetail(requestId, req.user, req.purchaseAccess);
        res.status(201).json(detail);
    } catch (err) {
        await connection.rollback();
        removeUploadedFiles(req.files || []);
        console.error("Erro ao anexar arquivo:", err);
        res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : "Erro ao anexar arquivo." });
    } finally {
        connection.release();
    }
});

router.delete("/purchase-attachments/:id", authMiddleware, requirePurchasePermission("purchase_module.access"), async (req, res) => {
    const connection = await db.getConnection();
    try {
        const attachmentId = Number(req.params.id);
        await seedPurchaseDefaults(req.user.empresa_id, req.user.id, connection);
        const [rows] = await db.query(`
            SELECT pa.*, pr.requester_id, pr.empresa_id
            FROM purchase_attachments pa
            JOIN purchase_requests pr ON pr.id = pa.request_id
            WHERE pa.id = ?
              AND pr.empresa_id = ?
              AND pa.deleted_at IS NULL
            LIMIT 1
        `, [attachmentId, req.user.empresa_id]);
        const attachment = rows[0];
        if (!attachment) return res.status(404).json({ error: "Anexo não encontrado." });
        const canDelete = Number(attachment.uploaded_by) === Number(req.user.id)
            || req.purchaseAccess.permissions["purchase_request.change_status"];
        if (!canDelete) return res.status(403).json({ error: "Acesso negado" });

        await connection.beginTransaction();
        await connection.query("UPDATE purchase_attachments SET deleted_at = NOW() WHERE id = ?", [attachmentId]);
        await logPurchaseHistory(connection, {
            empresaId: req.user.empresa_id,
            requestId: attachment.request_id,
            entityType: "attachment",
            entityId: attachmentId,
            userId: req.user.id,
            action: "attachment.removed",
            oldValue: { file_name: attachment.file_name },
            req,
        });
        await connection.commit();
        res.json({ success: true });
    } catch (err) {
        await connection.rollback();
        console.error("Erro ao remover anexo:", err);
        res.status(500).json({ error: "Erro ao remover anexo." });
    } finally {
        connection.release();
    }
});

router.get("/purchase-reports", authMiddleware, requirePurchasePermission("purchase_report.view"), async (req, res) => {
    try {
        await seedPurchaseDefaults(req.user.empresa_id);
        const includeFinancial = Boolean(req.purchaseAccess.permissions["purchase_financial.view"]);
        const filters = ["pr.empresa_id = ?", "pr.deleted_at IS NULL"];
        const params = [req.user.empresa_id];
        appendVisibilityFilter(filters, params, req.user, req.purchaseAccess, "pr");
        const startDate = normalizeDate(req.query.start_date);
        const endDate = normalizeDate(req.query.end_date);
        if (startDate) {
            filters.push("DATE(pr.created_at) >= ?");
            params.push(startDate);
        }
        if (endDate) {
            filters.push("DATE(pr.created_at) <= ?");
            params.push(endDate);
        }

        const [summaryRows] = await db.query(`
            SELECT
                COUNT(DISTINCT pr.id) AS total_requests,
                SUM(CASE WHEN pr.priority = 'urgente' THEN 1 ELSE 0 END) AS urgent_requests,
                SUM(CASE WHEN pr.needed_at < CURDATE() AND pr.status NOT IN ('concluida', 'rejeitada', 'cancelada') THEN 1 ELSE 0 END) AS overdue_requests,
                SUM(CASE WHEN pr.status = 'rejeitada' THEN 1 ELSE 0 END) AS rejected_requests,
                SUM(CASE WHEN pr.status = 'cancelada' THEN 1 ELSE 0 END) AS cancelled_requests,
                SUM(pr.estimated_total) AS estimated_total,
                SUM(pr.actual_total) AS actual_total
            FROM purchase_requests pr
            WHERE ${filters.join(" AND ")}
        `, params);
        const [departmentRows] = await db.query(`
            SELECT COALESCE(s.nome, 'Sem departamento') AS department, COUNT(*) AS total
            FROM purchase_requests pr
            LEFT JOIN setores s ON s.id = pr.department_id
            WHERE ${filters.join(" AND ")}
            GROUP BY COALESCE(s.nome, 'Sem departamento')
            ORDER BY total DESC
        `, params);
        const [supplierRows] = await db.query(`
            SELECT COALESCE(po.supplier_name, ps.name, 'Sem fornecedor') AS supplier, COUNT(*) AS total_orders, SUM(po.total_price) AS total_value
            FROM purchase_orders po
            JOIN purchase_requests pr ON pr.id = po.request_id
            LEFT JOIN purchase_suppliers ps ON ps.id = po.supplier_id
            WHERE ${filters.join(" AND ")}
            GROUP BY COALESCE(po.supplier_name, ps.name, 'Sem fornecedor')
            ORDER BY total_orders DESC
            LIMIT 20
        `, params);

        const summary = summaryRows[0] || {};
        res.json({
            summary: {
                total_requests: Number(summary.total_requests || 0),
                urgent_requests: Number(summary.urgent_requests || 0),
                overdue_requests: Number(summary.overdue_requests || 0),
                rejected_requests: Number(summary.rejected_requests || 0),
                cancelled_requests: Number(summary.cancelled_requests || 0),
                estimated_total: includeFinancial ? Number(summary.estimated_total || 0) : null,
                actual_total: includeFinancial ? Number(summary.actual_total || 0) : null,
                savings: includeFinancial ? Number(summary.estimated_total || 0) - Number(summary.actual_total || 0) : null,
            },
            by_department: departmentRows.map((row) => ({ department: row.department, total: Number(row.total || 0) })),
            suppliers: supplierRows.map((row) => ({
                supplier: row.supplier,
                total_orders: Number(row.total_orders || 0),
                total_value: includeFinancial ? Number(row.total_value || 0) : null,
            })),
        });
    } catch (err) {
        console.error("Erro ao gerar relatório de compras:", err);
        res.status(500).json({ error: "Erro ao gerar relatório." });
    }
});

router.get("/purchase-reports/export", authMiddleware, requirePurchasePermission("purchase_report.export"), async (req, res) => {
    try {
        await seedPurchaseDefaults(req.user.empresa_id);
        const includeFinancial = Boolean(req.purchaseAccess.permissions["purchase_financial.view"]);
        const filters = ["pr.empresa_id = ?", "pr.deleted_at IS NULL"];
        const params = [req.user.empresa_id];
        appendVisibilityFilter(filters, params, req.user, req.purchaseAccess, "pr");

        const [rows] = await db.query(`
            SELECT
                pr.code,
                requester.nome AS requester,
                department.nome AS department,
                pr.status,
                pr.priority,
                pr.request_type,
                pr.needed_at,
                pr.created_at,
                pr.estimated_total,
                pr.actual_total
            FROM purchase_requests pr
            JOIN usuarios requester ON requester.id = pr.requester_id
            LEFT JOIN setores department ON department.id = pr.department_id
            WHERE ${filters.join(" AND ")}
            ORDER BY pr.created_at DESC
            LIMIT 5000
        `, params);

        const columns = [
            "codigo",
            "solicitante",
            "departamento",
            "status",
            "prioridade",
            "tipo",
            "data_necessaria",
            "criado_em",
            ...(includeFinancial ? ["valor_estimado", "valor_comprado"] : []),
        ];
        const csvRows = [
            columns.join(";"),
            ...rows.map((row) => {
                const values = [
                    row.code || "",
                    row.requester || "",
                    row.department || "",
                    row.status || "",
                    row.priority || "",
                    row.request_type || "",
                    row.needed_at || "",
                    row.created_at || "",
                    ...(includeFinancial ? [row.estimated_total || 0, row.actual_total || 0] : []),
                ];
                return values.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(";");
            }),
        ];

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", "attachment; filename=relatorio-compras.csv");
        res.send(`\uFEFF${csvRows.join("\n")}`);
    } catch (err) {
        console.error("Erro ao exportar relatório de compras:", err);
        res.status(500).json({ error: "Erro ao exportar relatório." });
    }
});

router.get("/purchase-notifications", authMiddleware, requirePurchasePermission("purchase_module.access"), async (req, res) => {
    try {
        await seedPurchaseDefaults(req.user.empresa_id);
        const [rows] = await db.query(`
            SELECT id, request_id, type, title, message, read_at, created_at
            FROM purchase_notifications
            WHERE user_id = ?
            ORDER BY created_at DESC, id DESC
            LIMIT 80
        `, [req.user.id]);
        res.json({
            notifications: rows.map((row) => ({
                ...row,
                read: Boolean(row.read_at),
            })),
        });
    } catch (err) {
        console.error("Erro ao listar notificações de compras:", err);
        res.status(500).json({ error: "Erro ao listar notificações." });
    }
});

router.post("/purchase-notifications/read", authMiddleware, requirePurchasePermission("purchase_module.access"), async (req, res) => {
    try {
        await db.query(`
            UPDATE purchase_notifications
            SET read_at = COALESCE(read_at, NOW())
            WHERE user_id = ?
              AND read_at IS NULL
        `, [req.user.id]);
        res.json({ success: true });
    } catch (err) {
        console.error("Erro ao marcar notificações de compras:", err);
        res.status(500).json({ error: "Erro ao marcar notificações." });
    }
});

router.get("/admin/purchase-permission-profiles", authMiddleware, requirePurchaseAdmin, async (req, res) => {
    try {
        const profiles = await fetchPurchaseProfiles(req.user.empresa_id);
        res.json({ profiles, catalog: PURCHASE_PERMISSION_CATALOG });
    } catch (err) {
        console.error("Erro ao listar perfis de compras:", err);
        res.status(500).json({ error: "Erro ao listar perfis." });
    }
});

router.post("/admin/purchase-permission-profiles", authMiddleware, requirePurchaseAdmin, async (req, res) => {
    const connection = await db.getConnection();
    try {
        await seedPurchaseDefaults(req.user.empresa_id, req.user.id, connection);
        const name = limitText(req.body.name, 120);
        const slug = limitText(req.body.slug || name, 80)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "");
        if (!name || !slug) return res.status(400).json({ error: "Informe nome e identificador do perfil." });
        const permissions = normalizePermissionsObject(req.body.permissions || {});

        await connection.beginTransaction();
        const [result] = await connection.query(`
            INSERT INTO purchase_permission_profiles (
                empresa_id,
                name,
                slug,
                description,
                permissions_json,
                is_builtin,
                created_by,
                updated_by
            )
            VALUES (?, ?, ?, ?, ?, 0, ?, ?)
        `, [
            req.user.empresa_id,
            name,
            slug,
            normalizeLongText(req.body.description, 500) || null,
            stringifyJson(permissions),
            req.user.id,
            req.user.id,
        ]);
        await logPurchaseHistory(connection, {
            empresaId: req.user.empresa_id,
            entityType: "permission_profile",
            entityId: result.insertId,
            userId: req.user.id,
            action: "permission_profile.created",
            newValue: { name, slug, permissions },
            req,
        });
        await connection.commit();
        res.status(201).json({ profiles: await fetchPurchaseProfiles(req.user.empresa_id) });
    } catch (err) {
        await connection.rollback();
        console.error("Erro ao criar perfil de compras:", err);
        res.status(500).json({ error: "Erro ao criar perfil." });
    } finally {
        connection.release();
    }
});

router.put("/admin/purchase-permission-profiles/:id", authMiddleware, requirePurchaseAdmin, async (req, res) => {
    const connection = await db.getConnection();
    try {
        await seedPurchaseDefaults(req.user.empresa_id, req.user.id, connection);
        const profileId = Number(req.params.id);
        const [rows] = await db.query(`
            SELECT *
            FROM purchase_permission_profiles
            WHERE id = ?
              AND empresa_id = ?
            LIMIT 1
        `, [profileId, req.user.empresa_id]);
        const current = rows[0];
        if (!current) return res.status(404).json({ error: "Perfil não encontrado." });

        const name = limitText(req.body.name || current.name, 120);
        const permissions = normalizePermissionsObject(req.body.permissions || parseJson(current.permissions_json, {}));
        await connection.beginTransaction();
        await connection.query(`
            UPDATE purchase_permission_profiles
            SET name = ?,
                description = ?,
                permissions_json = ?,
                updated_by = ?
            WHERE id = ?
              AND empresa_id = ?
        `, [
            name,
            normalizeLongText(req.body.description ?? current.description, 500) || null,
            stringifyJson(permissions),
            req.user.id,
            profileId,
            req.user.empresa_id,
        ]);
        await logPurchaseHistory(connection, {
            empresaId: req.user.empresa_id,
            entityType: "permission_profile",
            entityId: profileId,
            userId: req.user.id,
            action: "permission_profile.updated",
            oldValue: {
                name: current.name,
                description: current.description,
                permissions: parseJson(current.permissions_json, {}),
            },
            newValue: { name, description: req.body.description, permissions },
            req,
        });
        await connection.commit();
        res.json({ profiles: await fetchPurchaseProfiles(req.user.empresa_id) });
    } catch (err) {
        await connection.rollback();
        console.error("Erro ao atualizar perfil de compras:", err);
        res.status(500).json({ error: "Erro ao atualizar perfil." });
    } finally {
        connection.release();
    }
});

router.get("/admin/purchase-permissions", authMiddleware, requirePurchaseAdmin, async (req, res) => {
    try {
        await seedPurchaseDefaults(req.user.empresa_id, req.user.id);
        const [users] = await db.query(`
            SELECT u.id, u.nome, u.email, u.perfil, u.setor_id, s.nome AS setor_nome
            FROM usuarios u
            LEFT JOIN setores s ON s.id = u.setor_id
            WHERE u.empresa_id = ?
              AND u.deletado_em IS NULL
            ORDER BY u.nome ASC
        `, [req.user.empresa_id]);
        const [departments] = await db.query(`
            SELECT id, nome
            FROM setores
            WHERE empresa_id = ?
            ORDER BY nome ASC
        `, [req.user.empresa_id]);
        const profiles = await fetchPurchaseProfiles(req.user.empresa_id);
        const [grants] = await db.query(`
            SELECT
                pp.*,
                ppp.name AS profile_name
            FROM purchase_permissions pp
            LEFT JOIN purchase_permission_profiles ppp ON ppp.id = pp.profile_id
            WHERE pp.empresa_id = ?
            ORDER BY FIELD(pp.subject_type, 'user', 'department', 'role'), pp.updated_at DESC
        `, [req.user.empresa_id]);
        const [history] = await db.query(`
            SELECT ph.*, u.nome AS user_nome
            FROM purchase_history ph
            LEFT JOIN usuarios u ON u.id = ph.user_id
            WHERE ph.empresa_id = ?
              AND ph.entity_type IN ('permission', 'permission_profile')
            ORDER BY ph.created_at DESC, ph.id DESC
            LIMIT 80
        `, [req.user.empresa_id]);

        res.json({
            catalog: PURCHASE_PERMISSION_CATALOG,
            profiles,
            roles: PERFIS_VALIDOS.map((perfil) => ({ id: perfil, name: perfil })),
            departments: departments.map((department) => ({ id: department.id, name: department.nome })),
            users: users.map((user) => ({
                id: user.id,
                nome: user.nome,
                email: user.email,
                perfil: user.perfil,
                setor_id: user.setor_id,
                setor_nome: user.setor_nome,
            })),
            grants: grants.map((grant) => ({
                id: grant.id,
                subject_type: grant.subject_type,
                subject_id: grant.subject_id,
                subject_key: grant.subject_key,
                profile_id: grant.profile_id,
                profile_name: grant.profile_name || "",
                permissions: normalizePermissionsObject(parseJson(grant.permissions_json, {})),
                access_blocked: Boolean(grant.access_blocked),
                updated_at: grant.updated_at,
            })),
            history: history.map((entry) => ({
                id: entry.id,
                action: entry.action,
                entity_type: entry.entity_type,
                entity_id: entry.entity_id,
                old_value: parseJson(entry.old_value, null),
                new_value: parseJson(entry.new_value, null),
                user: entry.user_id ? { id: entry.user_id, nome: entry.user_nome || null } : null,
                created_at: entry.created_at,
            })),
        });
    } catch (err) {
        console.error("Erro ao listar permissões de compras:", err);
        res.status(500).json({ error: "Erro ao listar permissões." });
    }
});

router.put("/admin/purchase-permissions/users/:userId", authMiddleware, requirePurchaseAdmin, async (req, res) => {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: "Usuário inválido." });
    const user = await validateUserInCompany(userId, req.user.empresa_id);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado." });
    return upsertPermissionGrant(req, res, {
        subjectType: "user",
        subjectId: userId,
        subjectKey: null,
        label: user.nome,
    });
});

router.put("/admin/purchase-permissions/roles/:roleId", authMiddleware, requirePurchaseAdmin, async (req, res) => {
    const roleId = limitText(req.params.roleId, 100);
    if (!PERFIS_VALIDOS.includes(roleId)) return res.status(400).json({ error: "Cargo inválido." });
    return upsertPermissionGrant(req, res, {
        subjectType: "role",
        subjectId: null,
        subjectKey: roleId,
        label: roleId,
    });
});

router.put("/admin/purchase-permissions/departments/:departmentId", authMiddleware, requirePurchaseAdmin, async (req, res) => {
    const departmentId = Number(req.params.departmentId);
    if (!Number.isInteger(departmentId) || departmentId <= 0) return res.status(400).json({ error: "Departamento inválido." });
    const department = await validateDepartmentInCompany(departmentId, req.user.empresa_id);
    if (!department) return res.status(404).json({ error: "Departamento não encontrado." });
    return upsertPermissionGrant(req, res, {
        subjectType: "department",
        subjectId: departmentId,
        subjectKey: null,
        label: department.nome,
    });
});

export default router;
