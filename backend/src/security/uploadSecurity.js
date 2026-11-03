// Política de arquivos enviados ao chat (entrada) e de entrega de /uploads/* (saída).
import path from "path";

// Imagens exibidas inline. SVG fica de fora de propósito: é XML com script.
export const IMAGENS_INLINE = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".jfif": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".avif": "image/avif",
};

// Mídia: entregue com tipo fixo para <audio>/<video> tocarem, sempre como attachment.
export const MIDIA_TIPOS = {
    ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg", ".oga": "audio/ogg", ".opus": "audio/ogg",
    ".m4a": "audio/mp4", ".aac": "audio/aac", ".flac": "audio/flac", ".weba": "audio/webm",
    ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".mkv": "video/x-matroska",
    ".avi": "video/x-msvideo", ".m4v": "video/mp4", ".3gp": "video/3gpp",
};

const DOCUMENTOS = [
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt", ".ods", ".odp", ".rtf", ".txt", ".csv", ".md",
    ".log", ".json", ".xml", ".yaml", ".yml", ".ini", ".cfg", ".conf", ".sql", ".rsc", ".backup", ".pcap", ".pcapng",
];
const COMPACTADOS = [".zip", ".7z", ".rar", ".gz", ".tgz", ".tar", ".bz2", ".xz"];
const EXECUTAVEIS = [".exe", ".msi"];

// Nunca aceitos, mesmo se alguém colocar em CHAT_UPLOAD_EXTRA_EXTENSIONS: conteúdo ativo no navegador.
const SEMPRE_BLOQUEADAS = new Set([
    ".html", ".htm", ".xhtml", ".shtml", ".svg", ".svgz", ".js", ".mjs", ".cjs", ".jsx", ".css", ".swf", ".xsl", ".xslt",
    ".hta", ".php", ".jsp", ".asp", ".aspx", ".url", ".webloc",
]);

const MIMES_ATIVOS = /^(text\/html|application\/xhtml\+xml|image\/svg\+xml|text\/xml-external-parsed-entity|text\/(x-)?javascript|application\/(x-)?javascript|application\/ecmascript|text\/css|application\/x-shockwave-flash)\b/i;

export const lerExtensoesPermitidas = (env = process.env) => {
    const extras = String(env.CHAT_UPLOAD_EXTRA_EXTENSIONS || "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
        .map((e) => (e.startsWith(".") ? e : `.${e}`));
    const permitirExe = String(env.CHAT_UPLOAD_ALLOW_EXECUTABLES ?? "true").toLowerCase() !== "false";

    const conjunto = new Set([
        ...Object.keys(IMAGENS_INLINE), ...Object.keys(MIDIA_TIPOS), ...DOCUMENTOS, ...COMPACTADOS,
        ...(permitirExe ? EXECUTAVEIS : []), ...extras,
    ]);
    SEMPRE_BLOQUEADAS.forEach((e) => conjunto.delete(e));
    return conjunto;
};

// Retorna null se aceito, ou a mensagem de recusa.
export const validarArquivoChat = ({ originalname = "", mimetype = "" } = {}, permitidas = lerExtensoesPermitidas()) => {
    const extensao = path.extname(String(originalname)).toLowerCase();
    if (!extensao || !permitidas.has(extensao)) {
        return "Tipo de arquivo não permitido. Compacte em .zip se precisar enviar este formato.";
    }
    if (MIMES_ATIVOS.test(String(mimetype || ""))) {
        return "Tipo de arquivo não permitido.";
    }
    // Imagem declarada com extensão que não é de imagem (ou o contrário) é sinal de disfarce.
    const mime = String(mimetype || "").toLowerCase();
    if (mime.startsWith("image/") && !IMAGENS_INLINE[extensao]) {
        return "A extensão do arquivo não corresponde a uma imagem.";
    }
    return null;
};

// Cabeçalhos para qualquer arquivo servido de /uploads/*.
export const aplicarCabecalhosUpload = (res, caminhoArquivo) => {
    const extensao = path.extname(String(caminhoArquivo)).toLowerCase();
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "sandbox");

    if (IMAGENS_INLINE[extensao]) {
        res.setHeader("Content-Type", IMAGENS_INLINE[extensao]);
        return;
    }

    res.setHeader("Content-Type", MIDIA_TIPOS[extensao] || "application/octet-stream");
    res.setHeader("Content-Disposition", "attachment");
};
