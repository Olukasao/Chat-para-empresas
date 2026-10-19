import { test } from "node:test";
import assert from "node:assert/strict";
import { classificarStatus, resumirAgenda } from "./agendaTecnicosResumoService.js";

const os = (tecnico, status, hora, extra = {}) => ({
    tecnico, status, hora, motivo: "OFFLINE", bairro: "JARDIM OLGA",
    cliente: "CLIENTE SIGILOSO", enderecoCompleto: "RUA X, 1", turnoHorario: "08:31 às 16:48", ...extra,
});

test("classifica status do SGP em aberta, execução e encerrada", () => {
    assert.equal(classificarStatus({ status: "Aberta" }), "aberta");
    assert.equal(classificarStatus({ status: "Em execução" }), "execucao");
    assert.equal(classificarStatus({ status: "Encerrada" }), "encerrada");
    assert.equal(classificarStatus({ status: "Aberta", data_finalizado: "09:12:33" }), "encerrada");
});

test("resume totais e situação de cada técnico sem expor dados do cliente", () => {
    const resumo = resumirAgenda([
        os("Nelson", "Encerrada", "08:00:44", { data_finalizado: "08:46:35" }),
        os("Nelson", "Em execução", "09:00:00"),
        os("Nelson", "Aberta", "11:00:09"),
        os("Alan", "Aberta", "12:00:11"),
        os("Alan", "Aberta", "10:40:43"),
        os("Lucio", "Encerrada", "08:00:29"),
    ], { data: "2026-10-17", atualizadoEm: new Date("2026-10-17T12:00:00Z") });

    assert.deepEqual(resumo.totais, { total: 6, abertas: 3, execucao: 1, encerradas: 2 });
    assert.deepEqual(resumo.tecnicos.map(t => [t.nome, t.situacao]), [
        ["Nelson", "atendimento"], ["Alan", "aguardando"], ["Lucio", "concluido"],
    ]);

    const alan = resumo.tecnicos[1];
    assert.deepEqual(alan.proxima, { hora: "10:40", motivo: "OFFLINE", bairro: "JARDIM OLGA" });
    assert.deepEqual(alan.ordens.map(o => o.hora), ["10:40", "12:00"]);
    assert.equal(resumo.tecnicos[0].atual.hora, "09:00");

    const json = JSON.stringify(resumo);
    assert.ok(!json.includes("CLIENTE SIGILOSO"));
    assert.ok(!json.includes("RUA X"));
});
