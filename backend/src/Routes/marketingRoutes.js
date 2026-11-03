// Dados do site para a aba Marketing do Workspace. Montado em /api/marketing.
import { Router } from "express";
import authMiddleware from "../middlewares/middleware.js";
import { criarServicoMarketing, ErroMarketing } from "../services/marketingSiteService.js";

export function criarRotasMarketing({ auth = authMiddleware, servico = criarServicoMarketing() } = {}) {
    const router = Router();
    router.use(auth);

    router.get("/site/resumo", async (req, res) => {
        try {
            res.setHeader("Cache-Control", "no-store");
            res.json(await servico.resumo(req.query));
        } catch (e) {
            if (e instanceof ErroMarketing) return res.status(e.status).json({ error: e.message });
            console.error("[marketing] falha inesperada:", e?.message);
            res.status(500).json({ error: "Não foi possível carregar os dados do site." });
        }
    });

    router.get("/site/status", (req, res) => {
        res.json({ configurado: servico.configurado() });
    });

    return router;
}

export default criarRotasMarketing();
