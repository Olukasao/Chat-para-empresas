import test from "node:test";
import assert from "node:assert/strict";
import { descreverRegra, horariosNoDia, normalizarHorario, normalizarRegra, proximaOcorrencia } from "./lembretesLogica.js";

test("horários em vários formatos", () => {
    assert.equal(normalizarHorario("9h"), "09:00");
    assert.equal(normalizarHorario("21h30"), "21:30");
    assert.equal(normalizarHorario("8:5"), "08:05");
    assert.equal(normalizarHorario("25:00"), null);
    assert.equal(normalizarHorario("amanhã"), null);
});

test("normalizarRegra valida cada tipo", () => {
    assert.deepEqual(normalizarRegra({ texto: " Beber  água ", tipo: "diario", horarios: ["15h", "9h", "9:00"] }).horarios, ["09:00", "15:00"]);
    assert.throws(() => normalizarRegra({ texto: "", tipo: "diario", horarios: ["9h"] }), /mensagem/);
    assert.throws(() => normalizarRegra({ texto: "x", tipo: "semanal", horarios: ["9h"], dias_semana: [] }), /dia da semana/);
    assert.throws(() => normalizarRegra({ texto: "x", tipo: "mensal", horarios: ["9h"], dia_mes: 40 }), /dia do mês/);
    assert.throws(() => normalizarRegra({ texto: "x", tipo: "unico", horarios: ["9h"], data: "2026-02-31" }), /data/);
    assert.throws(() => normalizarRegra({ texto: "x", tipo: "diario", horarios: [] }), /horário/);
});

test("próxima ocorrência diária", () => {
    const r = normalizarRegra({ texto: "x", tipo: "diario", horarios: ["09:00", "15:00"] });
    assert.equal(proximaOcorrencia(r, "2026-10-26 08:00:00"), "2026-10-26 09:00:00");
    assert.equal(proximaOcorrencia(r, "2026-10-26 09:00:00"), "2026-10-26 15:00:00");
    assert.equal(proximaOcorrencia(r, "2026-10-26 15:00:00"), "2026-10-27 09:00:00");
});

test("próxima ocorrência semanal (segunda a sexta) pula o fim de semana", () => {
    const r = normalizarRegra({ texto: "x", tipo: "semanal", horarios: ["08:30"], dias_semana: [1, 2, 3, 4, 5] });
    assert.equal(proximaOcorrencia(r, "2026-10-30 09:00:00"), "2026-11-02 08:30:00"); // sexta -> segunda
    assert.equal(descreverRegra(r), "De segunda a sexta às 08:30");
});

test("mensal usa o último dia quando o mês é curto", () => {
    const r = normalizarRegra({ texto: "x", tipo: "mensal", horarios: ["10:00"], dia_mes: 31 });
    assert.equal(proximaOcorrencia(r, "2026-02-01 00:00:00"), "2026-02-28 10:00:00");
    assert.equal(proximaOcorrencia(r, "2026-02-28 10:00:00"), "2026-03-31 10:00:00");
});

test("único toca uma vez e depois acaba", () => {
    const r = normalizarRegra({ texto: "x", tipo: "unico", horarios: ["15:00"], data: "2026-10-27" });
    assert.equal(proximaOcorrencia(r, "2026-10-26 10:00:00"), "2026-10-27 15:00:00");
    assert.equal(proximaOcorrencia(r, "2026-10-27 15:00:00"), null);
    assert.equal(proximaOcorrencia(r, "2026-10-28 08:00:00"), null);
});

test("horariosNoDia e descrições", () => {
    const r = normalizarRegra({ texto: "x", tipo: "semanal", horarios: ["17:00"], dias_semana: [5] });
    assert.deepEqual(horariosNoDia(r, "2026-10-30"), ["17:00"]);
    assert.deepEqual(horariosNoDia(r, "2026-10-29"), []);
    assert.equal(descreverRegra(r), "Toda sexta-feira às 17:00");
    assert.equal(descreverRegra(normalizarRegra({ texto: "x", tipo: "semanal", horarios: ["09:00", "14:00"], dias_semana: [1, 3] })), "Segundas e quartas às 09:00 e 14:00");
    assert.equal(descreverRegra(normalizarRegra({ texto: "x", tipo: "diario", horarios: ["09:00"] })), "Todos os dias às 09:00");
});
