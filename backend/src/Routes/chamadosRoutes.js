// Chamados abertos pelo site, para a aba Chamados do Workspace. Montado em /api/chamados.
import { Router } from "express";
import authMiddleware from "../middlewares/middleware.js";
import { criarServicoChamados } from "../services/chamadosSiteService.js";
import { ErroMarketing } from "../services/marketingSiteService.js";

export function criarRotasChamados({ auth = authMiddleware, servico = criarServicoChamados() } = {}) {
    const router = Router();
    router.use(auth);

    router.get("/site", async (req, res) => {
        try {
            res.setHeader("Cache-Control", "no-store");
            res.json(await servico.listar(req.query));
        } catch (e) {
            if (e instanceof ErroMarketing) return res.status(e.status).json({ error: e.message });
            console.error("[chamados] falha inesperada:", e?.message);
            res.status(500).json({ error: "Não foi possível carregar os chamados do site." });
        }
    });

    router.get("/site/:protocolo", async (req, res) => {
        try {
            res.setHeader("Cache-Control", "no-store");
            res.json(await servico.detalhe(req.params.protocolo));
        } catch (e) {
            if (e instanceof ErroMarketing) return res.status(e.status).json({ error: e.message });
            console.error("[chamados] falha inesperada:", e?.message);
            res.status(500).json({ error: "Não foi possível carregar o chamado." });
        }
    });

    return router;
}

export default criarRotasChamados();
