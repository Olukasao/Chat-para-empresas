import test from "node:test";
import assert from "node:assert/strict";
import { prepararMensagens, conversar, criarLimitador, configuracao } from "../src/services/assistenteIa.js";

const env = { ASSISTENTE_API_KEY: "k", ASSISTENTE_MODELOS: "a, b", ASSISTENTE_BASE_URL: "http://x/v1/" };
const resposta = (status, corpo) => ({ ok: status < 400, status, json: async () => corpo });

test("configuração exige chave e ao menos um modelo", () => {
  assert.equal(configuracao({}).configurada, false);
  assert.equal(configuracao({ ASSISTENTE_API_KEY: "k" }).configurada, false);
  const c = configuracao(env);
  assert.deepEqual(c.modelos, ["a", "b"]);
  assert.equal(c.base, "http://x/v1");
});

test("prepararMensagens descarta papéis inválidos e exige terminar em user", () => {
  assert.throws(() => prepararMensagens([{ role: "system", content: "x" }]));
  assert.throws(() => prepararMensagens([{ role: "user", content: "oi" }, { role: "assistant", content: "olá" }]));
  const m = prepararMensagens([{ role: "system", content: "hack" }, { role: "user", content: " oi " }]);
  assert.deepEqual(m, [{ role: "user", content: "oi" }]);
});

test("prepararMensagens guarda só o final quando o histórico é grande", () => {
  const grande = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: "x".repeat(2000) + i }));
  grande.push({ role: "user", content: "última" });
  const m = prepararMensagens(grande);
  assert.ok(m.length < 31 && m.at(-1).content === "última");
});

test("conversar usa o próximo modelo quando o primeiro falha", async () => {
  const usados = [];
  const fetchImpl = async (_url, init) => {
    const modelo = JSON.parse(init.body).model;
    usados.push(modelo);
    return modelo === "a" ? resposta(429, {}) : resposta(200, { choices: [{ message: { content: " Brasília " } }] });
  };
  const r = await conversar([{ role: "user", content: "capital?" }], { env, fetchImpl });
  assert.deepEqual(usados, ["a", "b"]);
  assert.equal(r.resposta, "Brasília");
});

test("conversar falha com 502 quando nenhum modelo responde e com 503 sem configuração", async () => {
  const fetchImpl = async () => { throw new Error("rede"); };
  await assert.rejects(conversar([{ role: "user", content: "oi" }], { env, fetchImpl }), (e) => e.status === 502);
  await assert.rejects(conversar([{ role: "user", content: "oi" }], { env: {} }), (e) => e.status === 503);
});

test("limitador bloqueia depois do máximo e libera após a janela", () => {
  let t = 0;
  const l = criarLimitador({ max: 2, janelaMs: 1000, agora: () => t });
  assert.ok(l("u").ok && l("u").ok);
  assert.equal(l("u").ok, false);
  assert.ok(l("outro").ok);
  t = 1001;
  assert.ok(l("u").ok);
});

import { buscarWeb, consultaDaConversa, contextoDaBusca, provedorBusca } from "../src/services/buscaWeb.js";

test("provedorBusca escolhe pela chave disponível", () => {
  assert.equal(provedorBusca({}), null);
  assert.equal(provedorBusca({ TAVILY_API_KEY: "t" }), "tavily");
  assert.equal(provedorBusca({ SERPER_API_KEY: "s", TAVILY_API_KEY: "t" }), "serper");
});

test("buscarWeb (serper) normaliza resultados e descarta URLs inválidas", async () => {
  const fetchImpl = async (url, init) => {
    assert.match(url, /serper/);
    assert.equal(JSON.parse(init.body).q, "dólar hoje");
    return resposta(200, { organic: [{ title: "A", link: "https://a.com", snippet: "sa" }, { title: "B", link: "javascript:x", snippet: "sb" }], answerBox: { answer: "R$ 5,00" } });
  };
  const r = await buscarWeb("dólar hoje", { env: { SERPER_API_KEY: "s" }, fetchImpl });
  assert.deepEqual(r.resultados, [{ titulo: "A", url: "https://a.com", resumo: "sa" }]);
  assert.equal(r.destaque, "R$ 5,00");
});

test("consultaDaConversa junta o assunto anterior em perguntas curtas", () => {
  const m = [{ role: "user", content: "quem ganhou o jogo do flamengo ontem" }, { role: "assistant", content: "x" }, { role: "user", content: "e o placar?" }];
  assert.match(consultaDaConversa(m), /flamengo.*placar/);
});

test("conversar com web injeta resultados e devolve as fontes", async () => {
  let enviado;
  const fetchImpl = async (_u, init) => { enviado = JSON.parse(init.body); return resposta(200, { choices: [{ message: { content: "ok [1]" } }] }); };
  const buscar = async () => ({ resultados: [{ titulo: "T", url: "https://t.com", resumo: "r" }], destaque: "" });
  const r = await conversar([{ role: "user", content: "notícias de hoje sobre fibra óptica" }], { env: { ...env, SERPER_API_KEY: "s" }, fetchImpl, web: true, buscar });
  assert.equal(r.busca, "ok");
  assert.deepEqual(r.fontes, [{ titulo: "T", url: "https://t.com" }]);
  assert.ok(enviado.messages.some((m) => m.role === "system" && m.content.includes("https://t.com")));
});

test("conversar com web mas sem provedor ou com busca falhando ainda responde", async () => {
  const fetchImpl = async () => resposta(200, { choices: [{ message: { content: "ok" } }] });
  const sem = await conversar([{ role: "user", content: "oi tudo bem" }], { env, fetchImpl, web: true });
  assert.equal(sem.busca, "nao_configurada");
  const falha = await conversar([{ role: "user", content: "oi tudo bem" }], { env: { ...env, SERPER_API_KEY: "s" }, fetchImpl, web: true, buscar: async () => { throw new Error("x"); } });
  assert.equal(falha.busca, "falhou");
  assert.equal(falha.resposta, "ok");
});

test("catálogo aceita nomes amigáveis e mantém ids", () => {
  const c = configuracao({ ASSISTENTE_API_KEY: "k", ASSISTENTE_MODELOS: "a|Modelo A, b" });
  assert.deepEqual(c.modelos, ["a", "b"]);
  assert.deepEqual(c.catalogo, [{ id: "a", nome: "Modelo A", visao: false }, { id: "b", nome: "b", visao: false }]);
});

test("modelo escolhido é usado sozinho, sem cair para outro, e precisa estar na lista", async () => {
  const usados = [];
  const fetchImpl = async (_u, init) => { usados.push(JSON.parse(init.body).model); return resposta(429, {}); };
  await assert.rejects(conversar([{ role: "user", content: "oi" }], { env, fetchImpl, modelo: "b" }), (e) => e.status === 502);
  assert.deepEqual(usados, ["b"]);
  await assert.rejects(conversar([{ role: "user", content: "oi" }], { env, fetchImpl, modelo: "x" }), /Modelo inválido/);
  usados.length = 0;
  await assert.rejects(conversar([{ role: "user", content: "oi" }], { env, fetchImpl, modelo: "auto" }));
  assert.deepEqual(usados, ["a", "b"]);
});

import { provedoresBusca } from "../src/services/buscaWeb.js";

test("provedoresBusca respeita a ordem padrão e BUSCA_ORDEM", () => {
  const env = { SEARXNG_URL: "http://x", SERPER_API_KEY: "s", TAVILY_API_KEY: "t" };
  assert.deepEqual(provedoresBusca(env), ["searxng", "serper", "tavily"]);
  assert.deepEqual(provedoresBusca({ ...env, BUSCA_ORDEM: "tavily,serper" }), ["tavily", "serper"]);
  assert.deepEqual(provedoresBusca({}), []);
});

test("buscarWeb troca para o próximo provedor quando o primeiro falha ou vem vazio", async () => {
  const chamados = [];
  const fetchImpl = async (url) => {
    chamados.push(new URL(url).host);
    if (url.includes("searx.local")) return resposta(200, { results: [] });
    return resposta(200, { organic: [{ title: "A", link: "https://a.com", snippet: "s" }] });
  };
  const env = { SEARXNG_URL: "http://searx.local:8888", SERPER_API_KEY: "s" };
  const r = await buscarWeb("qualquer coisa", { env, fetchImpl });
  assert.equal(r.provedor, "serper");
  assert.deepEqual(chamados, ["searx.local:8888", "google.serper.dev"]);
});

test("buscarWeb (searxng) usa o JSON local e falha com 502 se todos falharem", async () => {
  const ok = await buscarWeb("dólar", {
    env: { SEARXNG_URL: "http://127.0.0.1:8888/" },
    fetchImpl: async (url) => { assert.match(url, /127\.0\.0\.1:8888\/search\?.*format=json/); return resposta(200, { results: [{ title: "T", url: "https://t.com", content: "c" }] }); },
  });
  assert.equal(ok.provedor, "searxng");
  await assert.rejects(buscarWeb("x", { env: { SEARXNG_URL: "http://z" }, fetchImpl: async () => resposta(500, {}) }), (e) => e.status === 502);
});

import { mascararSensivel, contextoWorkspace } from "../src/services/assistenteIa.js";

test("mascararSensivel apaga CPF, CNPJ, telefone e e-mail", () => {
  const t = mascararSensivel("CPF 123.456.789-09, cnpj 12.345.678/0001-90, fone (24) 99876-5432 ou 24 3333-4444, mail joao@x.com.br, OS 123456");
  assert.doesNotMatch(t, /123\.456|12\.345|99876|3333-4444|joao@/);
  assert.match(t, /OS 123456/);
});

test("contextoWorkspace valida blocos, mascara e informa as fontes usadas", () => {
  const r = contextoWorkspace([
    { titulo: "Agenda de hoje", texto: "OS 1 | Maria S. | 11999998888" },
    { titulo: "", texto: "ignorado" },
    { titulo: "Vazio", texto: "   " },
    null,
  ]);
  assert.deepEqual(r.fontes, ["Agenda de hoje"]);
  assert.match(r.texto, /Agenda de hoje/);
  assert.doesNotMatch(r.texto, /11999998888/);
  assert.deepEqual(contextoWorkspace(undefined), { texto: "", fontes: [] });
});

test("contextoWorkspace limita tamanho total e quantidade de blocos", () => {
  const blocos = Array.from({ length: 10 }, (_, i) => ({ titulo: `B${i}`, texto: "x".repeat(9000) }));
  const r = contextoWorkspace(blocos);
  assert.equal(r.fontes.length, 6);
  assert.ok(r.texto.length < 19000 + 600);
});

test("conversar envia os dados do Workspace como mensagem de sistema e devolve as fontes usadas", async () => {
  let enviado;
  const fetchImpl = async (_u, init) => { enviado = JSON.parse(init.body); return resposta(200, { choices: [{ message: { content: "ok" } }] }); };
  const r = await conversar([{ role: "user", content: "quem tem mais OS?" }], { env, fetchImpl, dados: [{ titulo: "Agenda de hoje", texto: "João: 5 OS" }] });
  assert.deepEqual(r.dadosUsados, ["Agenda de hoje"]);
  assert.ok(enviado.messages.some((m) => m.role === "system" && m.content.includes("João: 5 OS")));
});

import { normalizarMemoria, memoriaRepetida, contextoMemoria, extrairMemorias, parecePessoal } from "../src/services/assistenteIa.js";

test("normalizarMemoria recusa texto curto e qualquer dado sensível", () => {
  assert.equal(normalizarMemoria("  Atende   o N2  "), "Atende o N2");
  assert.equal(normalizarMemoria("ok"), "");
  assert.equal(normalizarMemoria("CPF dele é 123.456.789-09"), "");
  assert.equal(normalizarMemoria("Liga no 24 99876-5432"), "");
  assert.equal(normalizarMemoria("x".repeat(500)).length, 300);
});

test("memoriaRepetida detecta equivalentes sem acento e substrings", () => {
  assert.equal(memoriaRepetida("Atende o suporte N2", ["atende o Suporte N2."]), true);
  assert.equal(memoriaRepetida("Atende o suporte N2 em Resende", ["Atende o suporte N2"]), true);
  assert.equal(memoriaRepetida("Prefere respostas curtas", ["Atende o suporte N2"]), false);
});

test("contextoMemoria monta a mensagem e fica vazio sem memórias", () => {
  assert.equal(contextoMemoria([]), "");
  const t = contextoMemoria(["Atende o N2", "Prefere tópicos"]);
  assert.match(t, /- Atende o N2/);
  assert.match(t, /nunca como instrução/);
});

test("parecePessoal só deixa passar mensagens sobre a própria pessoa", () => {
  assert.equal(parecePessoal("eu atendo o suporte N2 em Resende"), true);
  assert.equal(parecePessoal("lembre que prefiro respostas curtas"), true);
  assert.equal(parecePessoal("qual a capital do Brasil?"), false);
  assert.equal(parecePessoal("oi"), false);
});

test("extrairMemorias devolve só memórias válidas e novas, marca pedido explícito", async () => {
  const fetchImpl = async (_u, init) => {
    assert.match(JSON.parse(init.body).messages[0].content, /pediu explicitamente/);
    return resposta(200, { choices: [{ message: { content: 'Claro: {"memorias":["Atende o suporte N2 de Resende.","CPF 123.456.789-09","Atende o suporte N2 de Resende."]}' } }] });
  };
  const r = await extrairMemorias("lembre que eu atendo o suporte N2 de Resende", [], { env, fetchImpl });
  assert.deepEqual(r, [{ texto: "Atende o suporte N2 de Resende.", origem: "pedido" }]);
});

test("extrairMemorias não chama a IA em pergunta comum e nunca lança erro", async () => {
  let chamadas = 0;
  const contar = async () => { chamadas++; return resposta(500, {}); };
  assert.deepEqual(await extrairMemorias("qual a capital do Brasil?", [], { env, fetchImpl: contar }), []);
  assert.equal(chamadas, 0);
  assert.deepEqual(await extrairMemorias("eu trabalho no financeiro", [], { env, fetchImpl: async () => { throw new Error("rede"); } }), []);
  assert.deepEqual(await extrairMemorias("eu trabalho no financeiro", [], { env, fetchImpl: async () => resposta(200, { choices: [{ message: { content: "lixo sem json" } }] }) }), []);
});

test("conversar injeta a memória do usuário como mensagem de sistema", async () => {
  let enviado;
  const fetchImpl = async (_u, init) => { enviado = JSON.parse(init.body); return resposta(200, { choices: [{ message: { content: "ok" } }] }); };
  await conversar([{ role: "user", content: "me ajuda" }], { env, fetchImpl, memorias: ["Atende o N2"] });
  assert.ok(enviado.messages.some((m) => m.role === "system" && m.content.includes("- Atende o N2")));
});

import { resumoDoDia } from "../src/services/assistenteIa.js";

test("resumoDoDia usa o prompt próprio, mascara dados sensíveis e não usa histórico", async () => {
  let enviado;
  const fetchImpl = async (_u, init) => { enviado = JSON.parse(init.body); return resposta(200, { choices: [{ message: { content: "- Tudo calmo" } }] }); };
  const r = await resumoDoDia("Mensagens não lidas: 3. Contato 24 99876-5432. Filas: N1 4.", { env, fetchImpl });
  assert.equal(r.resposta, "- Tudo calmo");
  assert.match(enviado.messages[0].content, /resumo curto/);
  assert.match(enviado.messages[1].content, /Mensagens não lidas: 3/);
  assert.doesNotMatch(enviado.messages[1].content, /99876/);
  assert.equal(enviado.messages.length, 2);
});

test("resumoDoDia recusa texto vazio", async () => {
  await assert.rejects(resumoDoDia("  ", { env }), (e) => e.status === 400);
});


import { validarImagens, comImagens } from "../src/services/assistenteIa.js";

const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const envVisao = { ASSISTENTE_API_KEY: "k", ASSISTENTE_MODELOS: "texto|Só texto,olho|Com visão|visao,olho2|Outro|visao", ASSISTENTE_BASE_URL: "http://x/v1" };

test("catálogo marca os modelos que leem imagem pelo terceiro campo", () => {
  const c = configuracao(envVisao);
  assert.deepEqual(c.modelosVisao, ["olho", "olho2"]);
  assert.equal(c.catalogo[0].visao, false);
  assert.equal(c.catalogo[1].visao, true);
});

test("validarImagens aceita tipos permitidos e recusa o resto", () => {
  assert.deepEqual(validarImagens(undefined), []);
  assert.deepEqual(validarImagens([{ tipo: "image/png", dados: PNG }]), [{ tipo: "image/png", dados: PNG }]);
  assert.deepEqual(validarImagens([{ tipo: "image/jpeg", dados: `data:image/jpeg;base64,${PNG}` }])[0].dados, PNG);
  assert.throws(() => validarImagens([{ tipo: "application/pdf", dados: PNG }]), /PNG, JPG/);
  assert.throws(() => validarImagens([{ tipo: "image/svg+xml", dados: PNG }]), /PNG, JPG/);
  assert.throws(() => validarImagens([{ tipo: "image/png", dados: "não é base64!" }]), /corrompida/);
  assert.throws(() => validarImagens([{ tipo: "image/png", dados: "" }]), /vazia/);
  assert.throws(() => validarImagens([{ tipo: "image/png", dados: "A".repeat(5_600_000) }]), /grande demais/);
  assert.throws(() => validarImagens(Array(4).fill({ tipo: "image/png", dados: PNG })), /no máximo 3/);
  assert.throws(() => validarImagens("x"), /inválidas/);
});

test("comImagens anexa as imagens só à última pergunta, no formato de visão", () => {
  const h = [{ role: "user", content: "oi" }, { role: "assistant", content: "olá" }, { role: "user", content: "o que é isso?" }];
  const r = comImagens(h, [{ tipo: "image/png", dados: PNG }]);
  assert.equal(r[0].content, "oi");
  assert.equal(r[2].content[0].text, "o que é isso?");
  assert.equal(r[2].content[1].type, "image_url");
  assert.match(r[2].content[1].image_url.url, /^data:image\/png;base64,/);
  assert.equal(comImagens(h, []), h, "sem imagens, o histórico segue igual");
});

test("com imagem, só os modelos que leem imagem entram na fila", async () => {
  const usados = [];
  const fetchImpl = async (_u, init) => { usados.push(JSON.parse(init.body).model); return resposta(200, { choices: [{ message: { content: "vi" } }] }); };
  const r = await conversar([{ role: "user", content: "o que diz?" }], { env: envVisao, fetchImpl, imagens: [{ tipo: "image/png", dados: PNG }] });
  assert.deepEqual(usados, ["olho"]);
  assert.equal(r.resposta, "vi");
});

test("se o primeiro modelo de visão falhar, tenta o próximo de visão (nunca o de texto)", async () => {
  const usados = [];
  const fetchImpl = async (_u, init) => { const m = JSON.parse(init.body).model; usados.push(m); return m === "olho" ? resposta(429, {}) : resposta(200, { choices: [{ message: { content: "ok" } }] }); };
  await conversar([{ role: "user", content: "x" }], { env: envVisao, fetchImpl, imagens: [{ tipo: "image/png", dados: PNG }] });
  assert.deepEqual(usados, ["olho", "olho2"]);
});

test("pedir um modelo sem visão com imagem dá erro claro; sem modelos de visão configurados dá 503", async () => {
  const fetchImpl = async () => resposta(200, { choices: [{ message: { content: "x" } }] });
  await assert.rejects(conversar([{ role: "user", content: "x" }], { env: envVisao, fetchImpl, modelo: "texto", imagens: [{ tipo: "image/png", dados: PNG }] }), /não lê imagens/);
  await assert.rejects(conversar([{ role: "user", content: "x" }], { env, fetchImpl, imagens: [{ tipo: "image/png", dados: PNG }] }), (e) => e.status === 503);
});

test("o corpo enviado ao modelo leva a imagem na última mensagem", async () => {
  let corpo;
  const fetchImpl = async (_u, init) => { corpo = JSON.parse(init.body); return resposta(200, { choices: [{ message: { content: "ok" } }] }); };
  await conversar([{ role: "user", content: "leia" }], { env: envVisao, fetchImpl, imagens: [{ tipo: "image/png", dados: PNG }] });
  const ultima = corpo.messages.at(-1);
  assert.equal(ultima.role, "user");
  assert.equal(ultima.content[1].image_url.url.startsWith("data:image/png;base64,"), true);
});
