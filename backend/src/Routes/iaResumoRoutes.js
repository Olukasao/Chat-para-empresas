// Histórico diário das filas de suporte, para o "Resumo da semana" da IA local
// do Workspace (electron/localAi.ts) ter números reais em vez de só o instante
// atual. Nenhum dado de cliente aqui, só contagens agregadas. Montado em /api/ia.
import { Router } from "express";
import db from "../db/db.js";
import authMiddleware from "../middlewares/middleware.js";

let schemaPronto = null;
function garantirSchema() {
  schemaPronto ??= db.query(
    `CREATE TABLE IF NOT EXISTS ia_resumo_diario (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NOT NULL,
      dia DATE NOT NULL,
      suporte_tecnico INT NULL,
      n1 INT NULL,
      n2 INT NULL,
      n3 INT NULL,
      atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_ia_resumo_diario (empresa_id, dia)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ).catch((e) => { schemaPronto = null; throw e; });
  return schemaPronto;
}

const numeroOuNulo = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v)) : null);
const hojeSaoPaulo = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

const router = Router();
router.use(authMiddleware);

router.post("/resumo-diario/registrar", async (req, res) => {
  try {
    await garantirSchema();
    const b = req.body || {};
    const valores = {
      suporte_tecnico: numeroOuNulo(b.suporteTecnico),
      n1: numeroOuNulo(b.n1),
      n2: numeroOuNulo(b.n2),
      n3: numeroOuNulo(b.n3),
    };
    await db.query(
      `INSERT INTO ia_resumo_diario (empresa_id, dia, suporte_tecnico, n1, n2, n3) VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE suporte_tecnico = VALUES(suporte_tecnico), n1 = VALUES(n1), n2 = VALUES(n2), n3 = VALUES(n3)`,
      [req.user.empresa_id, hojeSaoPaulo(), valores.suporte_tecnico, valores.n1, valores.n2, valores.n3],
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("[ia-resumo] falha ao registrar:", e?.message);
    res.status(500).json({ error: "Não foi possível registrar o resumo de hoje." });
  }
});

router.get("/resumo-diario/semana", async (req, res) => {
  try {
    await garantirSchema();
    const [linhas] = await db.query(
      `SELECT dia, suporte_tecnico, n1, n2, n3 FROM ia_resumo_diario
        WHERE empresa_id = ? AND dia >= DATE_SUB(?, INTERVAL 6 DAY) ORDER BY dia ASC`,
      [req.user.empresa_id, hojeSaoPaulo()],
    );
    res.json({ dias: linhas });
  } catch (e) {
    console.error("[ia-resumo] falha ao listar a semana:", e?.message);
    res.status(500).json({ error: "Não foi possível carregar o histórico da semana." });
  }
});

export default router;
