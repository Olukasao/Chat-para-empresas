import crypto from "node:crypto";
import { getJwtSecret } from "../config/authSecrets.js";

export const AGENDA_SESSION_COOKIE = "agenda_chat_session";

export function lerCookieAgenda(header = "") {
    return String(header).split(";").map(item => item.trim())
        .find(item => item.startsWith(`${AGENDA_SESSION_COOKIE}=`))?.slice(AGENDA_SESSION_COOKIE.length + 1) || "";
}

function assinar(body) {
    return crypto.createHmac("sha256", getJwtSecret()).update(`agenda-session:${body}`).digest("base64url");
}

export function validarSessaoAgenda(token) {
    const [prefix, body, signature, extra] = String(token || "").split(".");
    if (prefix !== "agenda" || !body || !signature || extra) return null;
    const esperado = Buffer.from(assinar(body));
    const recebido = Buffer.from(signature);
    if (esperado.length !== recebido.length || !crypto.timingSafeEqual(esperado, recebido)) return null;
    try {
        const payload = JSON.parse(Buffer.from(body, "base64url").toString());
        if (!Number.isInteger(payload.id) || payload.id <= 0 || !payload.sid
            || !Number.isFinite(payload.exp) || payload.exp <= Date.now() / 1000) return null;
        return payload;
    } catch { return null; }
}

export function definirSessaoAgenda(req, res) {
    const anterior = validarSessaoAgenda(lerCookieAgenda(req.headers.cookie));
    const exp = Math.min(Number(req.user.exp) || 0, Math.floor(Date.now() / 1000) + 7 * 86400);
    if (exp <= Date.now() / 1000) return;
    const body = Buffer.from(JSON.stringify({
        id: Number(req.user.id), exp,
        sid: anterior?.id === Number(req.user.id) ? anterior.sid : crypto.randomUUID()
    })).toString("base64url");
    // Cookie do host: compartilhado entre as portas do chat e da agenda, sem expor o JWT do chat.
    const token = `agenda.${body}.${assinar(body)}`;
    res.cookie(AGENDA_SESSION_COOKIE, token, {
        httpOnly: true, sameSite: "lax", path: "/", maxAge: Math.max(0, exp * 1000 - Date.now())
    });
    return token;
}
