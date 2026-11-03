import test from "node:test";
import assert from "node:assert/strict";
import { filtrarBlocosPorFonte, fonteDoBloco, fontesLiberadas, IDS_FONTES } from "../src/services/iaAdminService.js";
import { configDoBriefing, deveEnviarAgora, montarDados, redigirBriefing, relogioSaoPaulo } from "../src/services/briefingService.js";

test("tudo é liberado, menos o que foi bloqueado", () => {
    assert.deepEqual(fontesLiberadas([]), IDS_FONTES);
    assert.ok(!fontesLiberadas([{ fonte: "web", permitido: 0 }]).includes("web"));
    assert.ok(fontesLiberadas([{ fonte: "web", permitido: 1 }]).includes("web"));
});

test("fonte do bloco: a declarada ou deduzida do título", () => {
    assert.equal(fonteDoBloco({ fonte: "rede", titulo: "x" }), "rede");
    assert.equal(fonteDoBloco({ titulo: "Agenda de técnicos, hoje" }), "agenda");
    assert.equal(fonteDoBloco({ titulo: "Últimas mudanças na agenda (3 dias)" }), "mudancas");
    assert.equal(fonteDoBloco({ titulo: "Chamados do site (30 dias)" }), "chamados");
    assert.equal(fonteDoBloco({ titulo: "Rede (OLT): alertas ativos" }), "rede");
    assert.equal(fonteDoBloco({ titulo: "outra coisa" }), null);
});

test("filtra os blocos de fontes bloqueadas", () => {
    const blocos = [{ titulo: "Agenda de técnicos, hoje", texto: "a" }, { titulo: "Rede (OLT)", texto: "b" }, { fonte: "painel", titulo: "p", texto: "c" }];
    const r = filtrarBlocosPorFonte(blocos, ["agenda", "painel"]);
    assert.equal(r.blocos.length, 2);
    assert.deepEqual(r.removidos, ["rede"]);
    assert.deepEqual(filtrarBlocosPorFonte("x", []).blocos, []);
});

test("configuração do briefing tem padrões seguros", () => {
    assert.deepEqual(configDoBriefing({}), { ativo: false, hora: "08:00", dias: [1, 2, 3, 4, 5] });
    assert.equal(configDoBriefing({ briefing_hora: "25:00" }).hora, "08:00");
    assert.equal(configDoBriefing({ briefing_ativo: "1", briefing_dias: "0,6" }).dias.length, 2);
});

test("relógio e momento do envio (Brasília)", () => {
    const segunda8h = new Date("2026-10-26T11:00:00Z"); // 08:00 em Brasília
    assert.deepEqual(relogioSaoPaulo(segunda8h), { dia: 1, hora: "08:00" });
    const config = { ativo: true, hora: "08:00", dias: [1, 2, 3, 4, 5] };
    assert.equal(deveEnviarAgora(config, new Date("2026-10-26T10:59:00Z")), false);
    assert.equal(deveEnviarAgora(config, segunda8h), true);
    assert.equal(deveEnviarAgora(config, new Date("2026-10-26T20:00:00Z")), true, "servidor que voltou à tarde ainda envia");
    assert.equal(deveEnviarAgora(config, new Date("2026-10-25T12:00:00Z")), false, "domingo");
    assert.equal(deveEnviarAgora({ ...config, ativo: false }, segunda8h), false);
});

test("dados do briefing: filas, agenda e rede, sem nome de cliente", () => {
    const t = montarDados({
        painel: { total: 809, grupos: { "SUPORTE TÉCNICO": 10, "SUPORTE N1": 1, "SUPORTE N2": 9, "SUPORTE N3": 0, "RETIRADA DE EQUIPAMENTO - SUSPENSOS": 430, OFFLINE: 2 } },
        agenda: { totais: { total: 10, abertas: 4, execucao: 2, encerradas: 4 }, tecnicos: [{ nome: "João", total: 5, encerradas: 2 }, { nome: "Ana", total: 3, encerradas: 3 }] },
        rede: [{ tipo: "pon_down", olt: "OLT-1", pon: "3", dispositivosAtivos: 20 }],
    });
    assert.match(t, /suporte abertos.*: 20\./);
    assert.match(t, /SUPORTE TÉCNICO 10; SUPORTE N2 9; SUPORTE N1 1/);
    assert.doesNotMatch(t, /RETIRADA|OFFLINE|809/);
    assert.match(t, /João 3 de 5/);
    assert.doesNotMatch(t, /Ana/);
    assert.match(t, /1 alertas ativos/);
    const comRecados = montarDados({ painel: null, agenda: { totais: { total: 0, abertas: 0, execucao: 0, encerradas: 0 }, tecnicos: [], observacoes: [{ tecnico: "Alan", hora: "08:15", descricao: "Leonardo Silva: Alan irá atuar entre 08 e 16:48 h", finalizado: false }] }, rede: null });
    assert.match(comRecados, /Recados da agenda de técnicos hoje \(1\):\n- Alan \(08:15\): Leonardo Silva: Alan irá atuar entre 08 e 16:48 h/);
    assert.match(montarDados({ painel: null, agenda: null, rede: [] }), /nenhum alerta ativo/);
});

test("briefing usa a IA e, se ela falhar, entrega os números", async () => {
    const agora = new Date("2026-10-26T11:00:00Z");
    const ok = await redigirBriefing("dados", { agora, ia: async () => ({ resposta: "Resumo do dia." }) });
    assert.match(ok, /Bom dia!/);
    assert.match(await redigirBriefing("dados", { agora, nome: "Lucas Silva", ia: async () => ({ resposta: "x" }) }), /^☀️ Bom dia, Lucas! Briefing/);
    assert.match(ok, /Resumo do dia\./);
    const falhou = await redigirBriefing("Painel NOC: 3.", { agora, ia: async () => { throw new Error("fora"); } });
    assert.match(falhou, /Painel NOC: 3\./);
});

test("disparo do assistente: valida texto, imagem pronta e anexo", async () => {
    const { montarDisparo } = await import("../src/services/disparoAssistente.js");
    assert.throws(() => montarDisparo({ texto: "  ", empresaId: 1 }), /Escreva uma mensagem/);
    assert.throws(() => montarDisparo({ imagem: "nao-existe", empresaId: 1 }), /Imagem desconhecida/);
    assert.throws(() => montarDisparo({ anexo: { url: "/etc/passwd" }, empresaId: 1 }), /Arquivo inválido/);
    assert.throws(() => montarDisparo({ anexo: { url: "/uploads/chat/1/../../x.png" }, empresaId: 1 }), /Arquivo inválido/);
    const ok = montarDisparo({ texto: "Oi", anexo: { url: "/uploads/chat/1/a-b.png", nome: "a.png", mime: "image/png" }, empresaId: 1 });
    assert.equal(ok.arquivo.tipo, "imagem");
    assert.equal(ok.msg, "Oi");
});

test("disparo: rascunho da IA vem limpo e o pedido é obrigatório", async () => {
    const { limparRascunho, redigirMensagem } = await import("../src/services/disparoAssistente.js");
    assert.equal(limparRascunho('"**Atenção:** reunião às 14h"'), "Atenção: reunião às 14h");
    await assert.rejects(redigirMensagem({ empresaId: 1, usuarioId: 1, pedido: " " }), /Conte o que a mensagem/);
    let enviado = "";
    const t = await redigirMensagem({ empresaId: 1, usuarioId: 1, pedido: "avisar da reunião às 14h, CPF 123.456.789-09", ia: async (m, o) => { enviado = m[0].content + o.sistema; return { resposta: "Pessoal, reunião às 14h." }; } });
    assert.equal(t, "Pessoal, reunião às 14h.");
    assert.doesNotMatch(enviado, /123\.456\.789-09/);
    await assert.rejects(redigirMensagem({ empresaId: 1, usuarioId: 1, pedido: "oi tudo", ia: async () => { throw new Error("fora"); } }), /não conseguiu escrever/);
});
