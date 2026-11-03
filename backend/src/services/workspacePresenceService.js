// Quem está com o aplicativo Acessa Workspace aberto agora. Fica só em memória: cada conexão do app
// se anuncia pelo socket (identidade conferida pelo token) e sai da lista ao desconectar.
const conexoes = new Map(); // socket.id -> { usuarioId, empresaId, versao, desde }

const versaoValida = (v) => (typeof v === "string" && /^\d{1,3}\.\d{1,3}\.\d{1,4}$/.test(v) ? v : null);

export function registrarWorkspace(socketId, { usuarioId, empresaId, versao, dispositivo = null }) {
    const atual = conexoes.get(socketId);
    conexoes.set(socketId, {
        usuarioId: Number(usuarioId),
        empresaId: Number(empresaId),
        versao: versaoValida(versao),
        dispositivo,
        desde: atual?.desde || new Date().toISOString(),
    });
}

export function removerWorkspace(socketId) {
    const atual = conexoes.get(socketId);
    conexoes.delete(socketId);
    return atual || null;
}

/** Identificadores de computador que estão conectados agora (para marcar "online" na lista de computadores). */
export function dispositivosOnline(empresaId) {
    const ids = new Set();
    for (const c of conexoes.values()) if (c.empresaId === Number(empresaId) && c.dispositivo) ids.add(`${c.usuarioId}:${c.dispositivo}`);
    return ids;
}

/** Uma linha por usuário: a conexão mais antiga dá o "desde", a versão mais nova é a exibida. */
export function listarWorkspace(empresaId) {
    const porUsuario = new Map();
    for (const c of conexoes.values()) {
        if (c.empresaId !== Number(empresaId)) continue;
        const u = porUsuario.get(c.usuarioId) || { usuario_id: c.usuarioId, versoes: new Set(), desde: c.desde, janelas: 0 };
        if (c.versao) u.versoes.add(c.versao);
        if (c.desde < u.desde) u.desde = c.desde;
        u.janelas += 1;
        porUsuario.set(c.usuarioId, u);
    }
    return [...porUsuario.values()].map((u) => ({
        usuario_id: u.usuario_id,
        versoes: [...u.versoes].sort(compararVersao).reverse(),
        desde: u.desde,
        janelas: u.janelas,
    }));
}

export function compararVersao(a, b) {
    const pa = String(a).split(".").map(Number), pb = String(b).split(".").map(Number);
    for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
    return 0;
}
