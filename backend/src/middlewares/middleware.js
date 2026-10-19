import jwt from "jsonwebtoken";
import db from "../db/db.js";
import { getJwtSecret } from "../config/authSecrets.js";
import { definirSessaoAgenda, lerCookieAgenda, validarSessaoAgenda } from "../services/agendaSessionService.js";


const getSecret = () => getJwtSecret();

// Rotas que o widget de chat da Agenda Técnicos pode usar com a sessão da agenda
// (assinada pelo próprio chat). Qualquer outra rota continua exigindo o JWT do chat.
const ROTAS_WIDGET_AGENDA = [
  /^GET \/chat\/conversas-diretas$/,
  /^GET \/chat\/grupos$/,
  /^GET \/chat\/conversa-direta\/\d+$/,
  /^GET \/chat\/grupo\/\d+$/,
  /^POST \/chat\/enviar-direto$/,
  /^POST \/chat\/enviar-grupo$/,
];

const buscarUsuario = async (id) => {
  const [rows] = await db.query(`
    SELECT u.id, u.nome, u.email, u.empresa_id, u.setor_id, s.nome AS setor_nome, u.perfil
    FROM usuarios u
    LEFT JOIN setores s ON s.id = u.setor_id
    WHERE u.id = ? AND u.deletado_em IS NULL
    LIMIT 1
  `, [id]);
  return rows[0] || null;
};

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Token não enviado" });
  }

  // 🔥 remove o Bearer
  const token = authHeader.split(" ")[1];

  if (String(token || "").startsWith("agenda.")) {
    const sessao = validarSessaoAgenda(token);
    const rota = `${req.method} ${req.path}`;
    if (!sessao || !ROTAS_WIDGET_AGENDA.some(padrao => padrao.test(rota))) {
      return res.status(401).json({ error: "Sessão da agenda inválida para esta rota" });
    }
    try {
      const usuario = await buscarUsuario(sessao.id);
      if (!usuario) return res.status(401).json({ error: "Usuário removido ou inválido" });
      req.user = { ...usuario, exp: sessao.exp, origem: "agenda-widget" };
      return next();
    } catch (err) {
      console.error("Erro ao validar sessão da agenda:", err);
      return res.status(500).json({ error: "Erro ao validar sessão" });
    }
  }

  try {
    const decoded = jwt.verify(token, getSecret());
    const usuario = await buscarUsuario(decoded.id);

    if (!usuario) {
      return res.status(401).json({ error: "Usuário removido ou inválido" });
    }

    req.user = { ...decoded, ...usuario };
    // Inclui abas do chat abertas antes da integração, que ainda não executam a sincronização nova.
    const sessaoAgenda = validarSessaoAgenda(lerCookieAgenda(req.headers.cookie));
    if (sessaoAgenda?.id !== Number(req.user.id) || sessaoAgenda.exp < Date.now() / 1000 + 60) {
      definirSessaoAgenda(req, res);
    }
    next();
  } catch (err) {
    console.error("Erro ao validar token:", err);
    return res.status(401).json({ error: "Token inválido" });
  }
};

export default authMiddleware;
