import test from "node:test";
import assert from "node:assert/strict";
import { extrairJson, quizDaResposta, sistemaDuvida, textoDaAula } from "../src/services/cursosIa.js";

test("texto da aula: junta o conteúdo, sem gabarito de quiz e sem dados pessoais", () => {
    const t = textoDaAula([
        { tipo: "titulo", texto: "Cabos de rede" },
        { tipo: "paragrafo", texto: "O cabo UTP tem 4 pares. Fale com joao@exemplo.com" },
        { tipo: "lista", itens: ["CAT5e", "CAT6"] },
        { tipo: "quiz", enunciado: "Quantos pares?", opcoes: [{ id: "a", texto: "4" }], correta: "a" },
        { tipo: "codigo", linguagem: "bash", codigo: "ping 8.8.8.8" },
    ]);
    assert.match(t, /## Cabos de rede/);
    assert.match(t, /- CAT6/);
    assert.match(t, /ping 8\.8\.8\.8/);
    assert.doesNotMatch(t, /Quantos pares/);
    assert.doesNotMatch(t, /joao@exemplo\.com/);
});

test("texto da aula respeita o limite", () => {
    assert.equal(textoDaAula([{ tipo: "paragrafo", texto: "x".repeat(2900) }, { tipo: "paragrafo", texto: "y".repeat(2900) }], 3000).length <= 3000, true);
});

test("o prompt do tutor prende a IA ao conteúdo da aula", () => {
    const s = sistemaDuvida("Cabos", "conteúdo");
    assert.match(s, /SOMENTE o conteúdo/);
    assert.match(s, /=== CONTEÚDO DA AULA ===\nconteúdo/);
});

test("extrai JSON mesmo dentro de cerca de código", () => {
    assert.deepEqual(extrairJson('```json\n[{"a":1}]\n```'), [{ a: 1 }]);
    assert.equal(extrairJson("sem json"), null);
    assert.equal(extrairJson("[quebrado"), null);
});

test("quiz: monta blocos válidos e descarta perguntas ruins", () => {
    const resposta = JSON.stringify([
        { enunciado: "Quantos pares tem o UTP?", opcoes: ["2", "4", "6", "8"], correta: 1, explicacao: "São 4 pares." },
        { enunciado: "Sem opções", opcoes: ["só uma"], correta: 0 },
        { enunciado: "Índice fora", opcoes: ["a", "b"], correta: 5 },
        { enunciado: "Repetidas", opcoes: ["a", "A"], correta: 0 },
        { opcoes: ["a", "b"], correta: 0 },
    ]);
    const blocos = quizDaResposta(resposta);
    assert.equal(blocos.length, 1);
    const [b] = blocos;
    assert.equal(b.tipo, "quiz");
    assert.equal(b.opcoes.length, 4);
    assert.equal(b.opcoes.find((o) => o.id === b.correta).texto, "4");
    assert.equal(quizDaResposta("lixo").length, 0);
    assert.equal(quizDaResposta(JSON.stringify(Array(20).fill({ enunciado: "q", opcoes: ["a", "b"], correta: 0 })), 3).length, 3);
});
