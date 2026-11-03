import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { criarServicoMarketing, lerConfigMarketing, validarConsulta, ErroMarketing } from "../src/services/marketingSiteService.js";
import { criarRotasMarketing } from "../src/Routes/marketingRoutes.js";

const ENV = { MARKETING_FEED_TOKEN: "t".repeat(40), CONTRATACOES_FEED_URL: "https://site.exemplo.com.br/api/integracoes/contratacoes/pendentes" };
const resposta = (corpo, status = 200) => ({ ok: status < 400, status, json: async () => corpo });

test("a URL do resumo é derivada do feed de contratações e o token é obrigatório", () => {
  assert.equal(lerConfigMarketing(ENV).url, "https://site.exemplo.com.br/api/integracoes/marketing/resumo");
  assert.equal(lerConfigMarketing({}).url, "");
  assert.equal(criarServicoMarketing({ env: {} }).configurado(), false);
});

test("sem configuração devolve 503 e nunca chama o site", async () => {
  let chamou = false;
  const s = criarServicoMarketing({ env: {}, fetchImpl: async () => { chamou = true; } });
  await assert.rejects(() => s.resumo({}), (e) => e.status === 503);
  assert.equal(chamou, false);
});

test("valida período e datas; custom inclui o dia final", () => {
  assert.throws(() => validarConsulta({ periodo: "ano" }), ErroMarketing);
  assert.throws(() => validarConsulta({ periodo: "custom", de: "x", ate: "y" }), ErroMarketing);
  const c = validarConsulta({ periodo: "custom", de: "2026-10-01", ate: "2026-10-10" });
  assert.equal(c.period, "custom");
  assert.equal(c.to, new Date("2026-10-11T00:00:00-03:00").toISOString());
});

test("envia o token em cabeçalho, repassa os dados e usa cache de 30 s", async () => {
  let chamadas = 0, ultima;
  let t = 1000;
  const s = criarServicoMarketing({ env: ENV, agora: () => t, fetchImpl: async (url, opts) => { chamadas++; ultima = { url: String(url), auth: opts.headers.Authorization }; return resposta({ customers: { accesses: 7 } }); } });
  const a = await s.resumo({ periodo: "7d" });
  assert.equal(a.customers.accesses, 7);
  assert.equal(a.emCache, false);
  assert.equal(ultima.auth, `Bearer ${ENV.MARKETING_FEED_TOKEN}`);
  assert.ok(ultima.url.includes("period=7d"));
  assert.ok(!ultima.url.includes(ENV.MARKETING_FEED_TOKEN)); // token nunca na URL
  assert.equal((await s.resumo({ periodo: "7d" })).emCache, true);
  assert.equal(chamadas, 1);
  t += 31_000;
  await s.resumo({ periodo: "7d" });
  assert.equal(chamadas, 2);
});

test("falhas do site viram 502 sem vazar detalhes", async () => {
  const caiu = criarServicoMarketing({ env: ENV, fetchImpl: async () => { throw new Error("ECONNREFUSED 10.0.0.5:443 segredo"); } });
  await assert.rejects(() => caiu.resumo({}), (e) => e.status === 502 && !/10\.0\.0\.5|segredo/.test(e.message));
  const recusou = criarServicoMarketing({ env: ENV, fetchImpl: async () => resposta({}, 401) });
  await assert.rejects(() => recusou.resumo({}), (e) => e.status === 502 && /token/i.test(e.message));
});

test("rota: só admin e admin_comercial veem; sem login nada", async () => {
  const servico = { resumo: async () => ({ ok: true }), configurado: () => true };
  const auth = (req, res, next) => {
    const perfil = req.headers["x-perfil"];
    if (!perfil) return res.status(401).json({ error: "Token não enviado" });
    req.user = { perfil };
    next();
  };
  const app = express();
  app.use("/api/marketing", criarRotasMarketing({ auth, servico }));
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}/api/marketing`;
  const ver = async (perfil, rota = "/site/resumo") => (await fetch(base + rota, { headers: perfil ? { "x-perfil": perfil } : {} })).status;
  assert.equal(await ver(null), 401);
  assert.equal(await ver("usuario"), 200);
  assert.equal(await ver("admin"), 200);
  assert.equal(await ver("admin_comercial"), 200);
  assert.equal(await ver("usuario", "/site/status"), 200);
  server.close();
});
