// Controle da IA pela administração. Montado em /admin/ia, já atrás de authMiddleware + requireAdmin.
import { Router } from "express";
import db from "../db/db.js";
import { configuracao } from "../services/assistenteIa.js";
import { provedoresBusca } from "../services/buscaWeb.js";
import {
  FONTES, definirFonteDoSetor, garantirTabelasIa, gravarConfig, lerConfig, saldoSerper, saudeDosProvedores, usoPorDia, usoPorPessoa,
} from "../services/iaAdminService.js";
import { dispararComoAssistente, redigirMensagem } from "../services/disparoAssistente.js";
import { BOT_EMAIL, configDoBriefing, destinatarios, enviarBriefing } from "../services/briefingService.js";

export default function criarIaAdminRoutes({ requireAdmin }) {
  const router = Router();
  router.use(requireAdmin);
  const empresa = (req) => req.user.empresa_id;
  const falha = (res, e, padrao) => {
    if (e?.status && e.status < 500) return res.status(e.status).json({ error: e.message });
    console.error("[ia-admin]", e?.message);
    return res.status(500).json({ error: padrao });
  };

  router.get("/", async (req, res) => {
    try {
      await garantirTabelasIa();
      const dias = Math.min(90, Math.max(1, Number(req.query.dias) || 30));
      const [setores] = await db.query("SELECT id, nome FROM setores ORDER BY nome ASC");
      const [bloqueios] = await db.query("SELECT setor_id, fonte FROM ia_fontes_setor WHERE empresa_id = ? AND permitido = 0", [empresa(req)]);
      const bloqueadas = {};
      for (const b of bloqueios) (bloqueadas[b.setor_id] ??= []).push(b.fonte);
      const cfg = configuracao();
      const [pessoas] = await db.query("SELECT u.id, u.nome, u.perfil, s.nome AS setor, u.setor_id FROM usuarios u LEFT JOIN setores s ON s.id = u.setor_id WHERE u.empresa_id = ? AND u.deletado_em IS NULL AND u.email <> ? ORDER BY u.nome ASC", [empresa(req), BOT_EMAIL]);
      const [escolhidos] = await db.query("SELECT usuario_id FROM briefing_destinatarios WHERE empresa_id = ? AND ativo = 1", [empresa(req)]);
      const [uso, porDia, provedores, saldo, config, quem] = await Promise.all([
        usoPorPessoa(empresa(req), dias), usoPorDia(empresa(req), 14), saudeDosProvedores(empresa(req), 7), saldoSerper(),
        lerConfig(empresa(req)), destinatarios(empresa(req)),
      ]);
      res.json({
        fontes: FONTES,
        setores: setores.map((s) => ({ id: s.id, nome: s.nome, bloqueadas: bloqueadas[s.id] ?? [] })),
        uso, porDia, dias, provedores,
        saldos: { serper: saldo },
        modelos: cfg.catalogo, busca: provedoresBusca(),
        briefing: { ...configDoBriefing(config), destinatarios: quem, escolhidos: escolhidos.map((x) => x.usuario_id), pessoas },
      });
    } catch (e) { falha(res, e, "Não foi possível carregar o controle da IA."); }
  });

  router.put("/fontes", async (req, res) => {
    try {
      await definirFonteDoSetor({ empresaId: empresa(req), setorId: req.body?.setorId, fonte: String(req.body?.fonte || ""), permitido: req.body?.permitido !== false });
      res.json({ ok: true });
    } catch (e) { falha(res, e, "Não foi possível salvar."); }
  });

  router.put("/briefing", async (req, res) => {
    try {
      const { ativo, hora, dias, usuarios } = req.body || {};
      if (hora !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(hora))) return res.status(400).json({ error: "Horário inválido." });
      if (dias !== undefined && (!Array.isArray(dias) || dias.some((d) => !Number.isInteger(d) || d < 0 || d > 6))) return res.status(400).json({ error: "Dias inválidos." });
      await garantirTabelasIa();
      if (ativo !== undefined) await gravarConfig(empresa(req), "briefing_ativo", ativo ? "1" : "0");
      if (hora !== undefined) await gravarConfig(empresa(req), "briefing_hora", String(hora));
      if (dias !== undefined) await gravarConfig(empresa(req), "briefing_dias", dias.join(","));
      if (Array.isArray(usuarios)) {
        const ids = [...new Set(usuarios.map(Number).filter(Number.isInteger))].slice(0, 100);
        await db.query("DELETE FROM briefing_destinatarios WHERE empresa_id = ?", [empresa(req)]);
        for (const id of ids) await db.query("INSERT INTO briefing_destinatarios (empresa_id, usuario_id, ativo) VALUES (?, ?, 1)", [empresa(req), id]);
      }
      res.json({ ok: true });
    } catch (e) { falha(res, e, "Não foi possível salvar o briefing."); }
  });

  // Teste: manda o briefing agora, só para quem clicou.
  router.post("/briefing/testar", async (req, res) => {
    try {
      const r = await enviarBriefing({ io: req.app.get("io"), empresaId: empresa(req), para: req.user.id });
      res.json({ ok: true, enviados: r.enviados });
    } catch (e) { falha(res, e, "Não foi possível enviar o teste."); }
  });

  // Disparo pela conta do Assistente: texto e/ou imagem para as pessoas escolhidas.
  router.post("/disparo", async (req, res) => {
    try {
      const { usuarios, mensagem, imagem, anexo } = req.body || {};
      const r = await dispararComoAssistente({ io: req.app.get("io"), empresaId: empresa(req), usuarios, texto: mensagem, imagem, anexo });
      res.json({ ok: true, ...r });
    } catch (e) { res.status(400).json({ error: e?.message || "Não foi possível enviar o disparo." }); }
  });

  // Rascunho da mensagem do disparo, escrito pela IA a partir da ideia (e do texto atual, se houver).
  router.post("/disparo/redigir", async (req, res) => {
    try {
      const texto = await redigirMensagem({ empresaId: empresa(req), usuarioId: req.user.id, pedido: req.body?.pedido, rascunho: req.body?.rascunho });
      res.json({ texto });
    } catch (e) { res.status(400).json({ error: e?.message || "Não foi possível escrever a mensagem." }); }
  });

  // Envio manual: manda agora para todos os destinatários, sem mexer no envio automático do dia.
  router.post("/briefing/enviar", async (req, res) => {
    try {
      const r = await enviarBriefing({ io: req.app.get("io"), empresaId: empresa(req) });
      res.json({ ok: true, enviados: r.enviados });
    } catch (e) { falha(res, e, "Não foi possível enviar o briefing."); }
  });

  return router;
}
