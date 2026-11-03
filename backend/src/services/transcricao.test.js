import test from "node:test";
import assert from "node:assert/strict";
import { converterParaWav, limparTranscricao, transcreverWav } from "./transcricao.js";

test("limparTranscricao tira aspas e trata 'sem fala'", () => {
    assert.equal(limparTranscricao('  "Beber água às nove"  '), "Beber água às nove");
    assert.equal(limparTranscricao("[sem fala]"), "");
    assert.equal(limparTranscricao("Sem fala."), "");
    assert.equal(limparTranscricao(null), "");
});

test("converterParaWav tenta o próximo caminho quando o ffmpeg não existe", async () => {
    const tentativas = [];
    const rodar = async (caminho) => {
        tentativas.push(caminho);
        if (caminho === "a") throw Object.assign(new Error("nope"), { code: "ENOENT" });
        return Buffer.from("wav");
    };
    assert.equal((await converterParaWav(Buffer.from("x"), { rodar, candidatos: ["a", "b"] })).toString(), "wav");
    assert.deepEqual(tentativas, ["a", "b"]);
});

test("converterParaWav falha com mensagem clara quando não há ffmpeg", async () => {
    const rodar = async () => { throw Object.assign(new Error("x"), { code: "ENOENT" }); };
    await assert.rejects(converterParaWav(Buffer.from("x"), { rodar, candidatos: ["a"] }), /não está disponível/);
});

test("transcreverWav usa o modelo que ouve e cai para o próximo se falhar", async () => {
    const env = { ASSISTENTE_API_KEY: "k", ASSISTENTE_MODELOS: "g1|G1|visao,g2|G2|visao,l1|L1" };
    const chamados = [];
    const fetchImpl = async (_url, init) => {
        const corpo = JSON.parse(init.body);
        chamados.push(corpo.model);
        if (corpo.model === "g1") return { ok: false, status: 500 };
        assert.equal(corpo.messages[1].content[1].type, "input_audio");
        return { ok: true, json: async () => ({ choices: [{ message: { content: "Ligar para o João amanhã" } }] }) };
    };
    assert.equal(await transcreverWav(Buffer.from("wav"), { env, fetchImpl }), "Ligar para o João amanhã");
    assert.deepEqual(chamados, ["g1", "g2"]);
});
