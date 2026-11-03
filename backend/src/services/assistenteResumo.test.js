import test from "node:test";
import assert from "node:assert/strict";
import { resumoDoDia } from "./assistenteIa.js";

const env = { ASSISTENTE_API_KEY: "k", ASSISTENTE_MODELOS: "lento|Lento|visao,kr/claude-haiku-4.5|Haiku,outro|Outro" };
const resposta = (texto) => ({ ok: true, json: async () => ({ choices: [{ message: { content: texto } }] }) });

test("o resumo usa primeiro o modelo rápido e não o primeiro da lista", async () => {
    const chamados = [];
    const fetchImpl = async (_u, init) => { chamados.push(JSON.parse(init.body)); return resposta("- tudo calmo"); };
    const r = await resumoDoDia("Mensagens não lidas no chat: 0\nFilas de suporte agora: 4", { env, fetchImpl });
    assert.equal(r.resposta, "- tudo calmo");
    assert.equal(chamados[0].model, "kr/claude-haiku-4.5");
    assert.equal(chamados[0].max_tokens, 380);
});

test("pedidos iguais compartilham a resposta (um só chamado à IA)", async () => {
    let n = 0;
    const fetchImpl = async () => { n += 1; await new Promise((r) => setTimeout(r, 30)); return resposta("- igual para todos"); };
    const texto = "Alertas de massivo em aberto: DAS (2)\nFilas de suporte agora: 9 (teste do cache)";
    const [a, b] = await Promise.all([resumoDoDia(texto, { env, fetchImpl }), resumoDoDia(texto, { env, fetchImpl })]);
    const c = await resumoDoDia(texto, { env, fetchImpl });
    assert.equal(n, 1);
    assert.equal(a.resposta, b.resposta);
    assert.equal(c.doCache, true);
});

test("se o modelo rápido falha, cai para o próximo", async () => {
    const ordem = [];
    const fetchImpl = async (_u, init) => {
        const m = JSON.parse(init.body).model; ordem.push(m);
        return m === "kr/claude-haiku-4.5" ? { ok: false, status: 500 } : resposta("- reserva");
    };
    const r = await resumoDoDia("Mensagens não lidas no chat: 7 (teste de reserva)", { env, fetchImpl });
    assert.equal(r.resposta, "- reserva");
    assert.equal(ordem[0], "kr/claude-haiku-4.5");
    assert.ok(ordem.length >= 2);
});
