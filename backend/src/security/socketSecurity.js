// Autenticação e autorização do Socket.IO do chat.
//
// Toda a lógica que decide "quem é este socket" e "ele pode entrar/falar nesta sala" fica aqui,
// sem depender do server.js, para poder ser testada com dependências injetadas.
//
// SOCKET_AUTH_MODE:
//   enforce (padrão) - sem JWT válido no handshake (auth.token) a conexão é recusada.
//                      Exceção: widget da Agenda Técnicos, que se identifica pelo cookie de sessão assinado.
//   log              - não recusa ninguém; registra no log cada conexão sem token / com token inválido.
//                      Sockets sem identidade continuam com o comportamento antigo (migração).
//   off              - comportamento antigo, sem registro. Não recomendado.
import jwt from "jsonwebtoken";

export const SOCKET_AUTH_MODES = ["enforce", "log", "off"];

export const lerModoAutenticacaoSocket = (valor = process.env.SOCKET_AUTH_MODE) => {
    const modo = String(valor || "").trim().toLowerCase();
    return SOCKET_AUTH_MODES.includes(modo) ? modo : "enforce";
};

const idValido = (valor) => {
    const numero = Number(valor);
    return Number.isInteger(numero) && numero > 0 ? numero : null;
};

export const normalizarIdSocket = idValido;

const enderecoDoHandshake = (socket) => {
    const encaminhado = socket.handshake?.headers?.["x-forwarded-for"];
    return String(encaminhado || socket.handshake?.address || "").split(",")[0].trim() || "desconhecido";
};

export const descreverOrigemSocket = (socket) => ({
    socket: socket.id,
    ip: enderecoDoHandshake(socket),
    origin: socket.handshake?.headers?.origin || null,
    userAgent: String(socket.handshake?.headers?.["user-agent"] || "").slice(0, 120) || null,
});

/**
 * Cria o middleware `io.use(...)`.
 * deps: { verificarToken(token)->payload (lança se inválido), buscarUsuario(id)->usuario|null,
 *         sessaoAgenda(socket)->{id}|null, modo, logger }
 */
export const criarMiddlewareAutenticacaoSocket = ({
    verificarToken,
    buscarUsuario,
    sessaoAgenda = () => null,
    modo = lerModoAutenticacaoSocket(),
    logger = console,
} = {}) => async (socket, next) => {
    const recusar = (motivo, mensagem) => {
        if (modo === "enforce") {
            logger.warn(`[SOCKET-AUTH] Conexão recusada (${motivo})`, descreverOrigemSocket(socket));
            return next(Object.assign(new Error(mensagem), { data: { code: "UNAUTHORIZED" } }));
        }
        if (modo === "log") {
            logger.warn(`[SOCKET-AUTH] (modo log) conexão ${motivo}; seria recusada em enforce`, descreverOrigemSocket(socket));
        }
        socket.data.legado = true;
        return next();
    };

    try {
        const token = socket.handshake?.auth?.token;

        if (typeof token === "string" && token) {
            let decoded;
            try {
                decoded = verificarToken(token);
            } catch {
                return recusar("com token inválido ou expirado", "Token inválido");
            }

            const usuario = await buscarUsuario(decoded?.id);
            if (!usuario) return recusar("com usuário removido ou inexistente", "Usuário inválido");

            socket.data.user = { ...usuario, id: Number(usuario.id), empresa_id: Number(usuario.empresa_id), origem: "jwt" };
            return next();
        }

        // Widget da Agenda Técnicos: sem JWT, mas com a sessão assinada pelo próprio chat.
        const sessao = sessaoAgenda(socket);
        if (sessao?.id) {
            const usuario = await buscarUsuario(sessao.id);
            if (usuario) {
                socket.data.user = { ...usuario, id: Number(usuario.id), empresa_id: Number(usuario.empresa_id), origem: "agenda-widget" };
                return next();
            }
        }

        return recusar("sem token", "Token não enviado");
    } catch (err) {
        logger.error("[SOCKET-AUTH] Erro ao autenticar socket:", err?.message);
        if (modo === "enforce") {
            return next(Object.assign(new Error("Erro ao autenticar"), { data: { code: "AUTH_ERROR" } }));
        }
        socket.data.legado = true;
        return next();
    }
};

/**
 * Identidade efetiva do socket. Com socket autenticado, o payload do cliente é IGNORADO.
 * Sem identidade (só ocorre em modo log/off) devolve null: o chamador decide se aceita o legado.
 */
export const identidadeDoSocket = (socket) => {
    const user = socket.data?.user;
    if (!user?.id) return null;
    return { usuarioId: Number(user.id), empresaId: Number(user.empresa_id), user };
};

// ---------------------------------------------------------------------------
// Autorização de salas e retransmissões (consultas ao banco injetadas via `db`).
// ---------------------------------------------------------------------------

export const criarAutorizadorSocket = (db) => {
    // Devolve { id, outroId } se o usuário participa da conversa direta; senão null.
    const participanteDaConversa = async (usuarioId, conversaId) => {
        const uid = idValido(usuarioId);
        const cid = idValido(conversaId);
        if (!uid || !cid) return null;

        const [rows] = await db.query(
            `SELECT id, usuario1_id, usuario2_id
             FROM conversas_diretas
             WHERE id = ? AND (usuario1_id = ? OR usuario2_id = ?)
             LIMIT 1`,
            [cid, uid, uid]
        );
        const conversa = rows?.[0];
        if (!conversa) return null;

        const outroId = Number(conversa.usuario1_id) === uid ? Number(conversa.usuario2_id) : Number(conversa.usuario1_id);
        return { id: Number(conversa.id), outroId };
    };

    const membroDoGrupo = async (usuarioId, grupoId) => {
        const uid = idValido(usuarioId);
        const gid = idValido(grupoId);
        if (!uid || !gid) return false;

        const [rows] = await db.query(
            `SELECT gm.grupo_id
             FROM grupo_membros gm
             JOIN grupos g ON g.id = gm.grupo_id
             WHERE gm.grupo_id = ? AND gm.usuario_id = ? AND g.deletado_em IS NULL
             LIMIT 1`,
            [gid, uid]
        );
        return Boolean(rows?.length);
    };

    // A mensagem relayada precisa existir e pertencer ao remetente autenticado naquela conversa/grupo.
    const mensagemPertenceAoRemetente = async ({ mensagemId, remetenteId, conversaId = null, grupoId = null }) => {
        const mid = idValido(mensagemId);
        if (!mid) return false;

        const [rows] = await db.query(
            `SELECT id, remetente_id, conversa_direta_id, grupo_id
             FROM mensagens
             WHERE id = ?
             LIMIT 1`,
            [mid]
        );
        const msg = rows?.[0];
        if (!msg || Number(msg.remetente_id) !== Number(remetenteId)) return false;
        if (conversaId && Number(msg.conversa_direta_id) !== Number(conversaId)) return false;
        if (grupoId && Number(msg.grupo_id) !== Number(grupoId)) return false;
        return true;
    };

    // Quem apaga para todos: o autor da mensagem (ou administrador da empresa).
    const podeAnunciarExclusao = async ({ usuario, mensagemId, conversaId = null, grupoId = null }) => {
        const mid = idValido(mensagemId);
        if (!mid) return false;
        const [rows] = await db.query(
            `SELECT id, remetente_id, conversa_direta_id, grupo_id FROM mensagens WHERE id = ? LIMIT 1`,
            [mid]
        );
        const msg = rows?.[0];
        if (!msg) return false;
        if (conversaId && Number(msg.conversa_direta_id) !== Number(conversaId)) return false;
        if (grupoId && Number(msg.grupo_id) !== Number(grupoId)) return false;
        if (Number(msg.remetente_id) === Number(usuario.id)) return true;
        return usuario.perfil === "admin";
    };

    return { participanteDaConversa, membroDoGrupo, mensagemPertenceAoRemetente, podeAnunciarExclusao };
};

export const verificarJwtHS256 = (token, secret) => jwt.verify(token, secret, { algorithms: ["HS256"] });
