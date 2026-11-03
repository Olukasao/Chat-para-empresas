import test from "node:test";
import assert from "node:assert/strict";
import { ehRecadoDeChamado, recadosImportantes } from "./recadosLogica.js";

test("recados de chamados são reconhecidos", () => {
    for (const t of [
        "Agendamento de cliente com LOS/LOBI na Vila Rosina",
        "Offline por rompimento de Twistnet na Travessa da Rua Brasil Cairesas",
        "Cliente com LOS/LOBI na Região Central",
        "Cliente sem sinal desde cedo",
    ]) assert.equal(ehRecadoDeChamado(t), true, t);
});

test("avisos da equipe e da operação continuam", () => {
    for (const t of [
        "Técnico sem veículo, atuando em dupla com Nelson",
        "Alan irá atuar entre 08 e 16:48",
        "Folga do Diego na sexta",
        "Saída mais cedo às 15h por consulta",
    ]) assert.equal(ehRecadoDeChamado(t), false, t);
});

test("recadosImportantes filtra a lista", () => {
    const lista = [
        { tecnico: "Washington", hora: "12:00", descricao: "Agendamento de cliente com LOS/LOBI na Vila Rosina" },
        { tecnico: "Alex", hora: "08:15", descricao: "Técnico sem veículo, atuando em dupla com Nelson" },
        { tecnico: "X", descricao: "" },
    ];
    assert.deepEqual(recadosImportantes(lista).map((r) => r.tecnico), ["Alex"]);
});
