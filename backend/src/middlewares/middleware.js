import jwt from "jsonwebtoken";
import db from "../db/db.js";
import { getJwtSecret } from "../config/authSecrets.js";


const getSecret = () => getJwtSecret();


const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Token não enviado" });
  }

  // 🔥 remove o Bearer
  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, getSecret());
    const [rows] = await db.query(`
      SELECT u.id, u.nome, u.email, u.empresa_id, u.setor_id, s.nome AS setor_nome, u.perfil
      FROM usuarios u
      LEFT JOIN setores s ON s.id = u.setor_id
      WHERE u.id = ? AND u.deletado_em IS NULL
      LIMIT 1
    `, [decoded.id]);

    if (!rows.length) {
      return res.status(401).json({ error: "Usuário removido ou inválido" });
    }

    req.user = { ...decoded, ...rows[0] };
    next();
  } catch (err) {
    console.error("Erro ao validar token:", err);
    return res.status(401).json({ error: "Token inválido" });
  }
};

export default authMiddleware;
