import test from "node:test";
import assert from "node:assert/strict";
import * as L from "./cursosLogic.js";

const prova = L.validarProva({
  notaMinima: 70,
  questoes: [
    { id: "q1", tipo: "unica", enunciado: "A?", pontos: 20, opcoes: [{ id: "a", texto: "1" }, { id: "b", texto: "2" }], correta: ["b"] },
    { id: "q2", tipo: "multipla", enunciado: "B?", pontos: 20, opcoes: [{ id: "a", texto: "1" }, { id: "b", texto: "2" }, { id: "c", texto: "3" }], correta: ["a", "b"] },
    { id: "q3", tipo: "vf", enunciado: "C?", pontos: 20, correta: true },
    { id: "q4", tipo: "ordenacao", enunciado: "D?", pontos: 20, itens: [{ id: "i1", texto: "x" }, { id: "i2", texto: "y" }] },
    { id: "q5", tipo: "curta", enunciado: "E?", pontos: 20, aceitas: ["Fibra Óptica"] },
  ],
});

test("nota 100 quando tudo certo e 0 quando tudo errado", () => {
  const certas = { q1: "b", q2: ["a", "b"], q3: true, q4: ["i1", "i2"], q5: "fibra optica" };
  const r = L.corrigirTentativa(prova, certas);
  assert.equal(r.nota, 100);
  assert.equal(r.aprovado, true);
  const erradas = L.corrigirTentativa(prova, { q1: "a", q2: ["c"], q3: false, q4: ["i2", "i1"], q5: "x" });
  assert.equal(erradas.nota, 0);
  assert.equal(erradas.aprovado, false);
});

test("múltipla escolha parcial penaliza marcações erradas", () => {
  const q = prova.questoes[1];
  assert.equal(L.corrigirQuestao(q, ["a"]), 0.5);
  assert.equal(L.corrigirQuestao(q, ["a", "b", "c"]), 0.5);
  assert.equal(L.corrigirQuestao(q, ["c"]), 0);
});

test("discursiva deixa a prova pendente até a correção manual", () => {
  const p = L.validarProva({ questoes: [
    { id: "d", tipo: "discursiva", enunciado: "Explique", pontos: 50 },
    { id: "v", tipo: "vf", enunciado: "ok", pontos: 50, correta: false },
  ] });
  const pend = L.corrigirTentativa(p, { d: "texto", v: false });
  assert.equal(pend.pendente, true);
  assert.equal(pend.nota, null);
  const fim = L.corrigirTentativa(p, { d: "texto", v: false }, { d: { pontos: 30 } });
  assert.equal(fim.nota, 80);
  assert.equal(fim.aprovado, true);
});

test("questão obrigatória em branco reprova mesmo com nota alta", () => {
  const p = L.validarProva({ notaMinima: 10, questoes: [
    { id: "a", tipo: "vf", enunciado: "1", pontos: 90, correta: true },
    { id: "b", tipo: "vf", enunciado: "2", pontos: 10, correta: true, obrigatoria: true },
  ] });
  assert.equal(L.corrigirTentativa(p, { a: true }).aprovado, false);
});

test("a prova do aluno não vaza o gabarito", () => {
  const json = JSON.stringify(L.provaParaAluno(prova, L.sortearOrdem(prova, 5)));
  assert.ok(!json.includes("correta"));
  assert.ok(!json.includes("aceitas"));
  assert.ok(!json.includes("Fibra"));
});

test("gabarito respeita a configuração de feedback", () => {
  const c = L.corrigirTentativa(prova, {});
  assert.equal(L.gabaritoVisivel({ ...prova, feedback: "nunca" }, c), null);
  assert.ok(L.gabaritoVisivel({ ...prova, feedback: "final" }, c).q1.correta);
});

test("tentativas: limite, retomada e expiração", () => {
  const p = { ...prova, maxTentativas: 2 };
  assert.deepEqual(L.podeIniciarTentativa(p, []), { ok: true });
  assert.equal(L.podeIniciarTentativa(p, [{ status: "finalizada" }, { status: "finalizada" }]).motivo, "limite");
  assert.equal(L.podeIniciarTentativa({ ...p, maxTentativas: 0 }, new Array(9).fill({ status: "finalizada" })).ok, true);
  const aberta = { status: "em_andamento", expira_em: new Date(Date.now() + 60000) };
  assert.equal(L.podeIniciarTentativa(p, [aberta]).retomar, aberta);
  assert.equal(L.podeIniciarTentativa(p, [{ ...aberta, expira_em: new Date(Date.now() - 1000) }]).ok, false);
});

test("embaralhamento é determinístico por semente", () => {
  const l = [1, 2, 3, 4, 5, 6, 7, 8];
  assert.deepEqual(L.embaralhar(l, 42), L.embaralhar(l, 42));
  assert.notDeepEqual(L.embaralhar(l, 42), L.embaralhar(l, 43));
});

test("validação de prova recusa questões incompletas", () => {
  assert.throws(() => L.validarProva({ questoes: [{ tipo: "unica", enunciado: "x", opcoes: [{ texto: "a" }], correta: [] }] }));
  assert.throws(() => L.validarProva({ questoes: [{ tipo: "vf", enunciado: "" }] }));
});

test("blocos: tipo inválido, links perigosos e vídeos fora da lista", () => {
  assert.throws(() => L.validarBlocos([{ tipo: "script" }]));
  assert.throws(() => L.validarBlocos([{ tipo: "video", url: "https://evil.example/v" }]));
  assert.equal(L.urlSegura("javascript:alert(1)"), "");
  assert.equal(L.urlSegura("data:text/html,x"), "");
  const [v] = L.validarBlocos([{ tipo: "video", url: "https://youtu.be/abc123" }]);
  assert.equal(v.embed, "https://www.youtube-nocookie.com/embed/abc123");
});

test("quiz embutido não entrega a resposta ao aluno", () => {
  const [q] = L.validarBlocos([{ tipo: "quiz", enunciado: "?", opcoes: [{ id: "a", texto: "x" }, { id: "b", texto: "y" }], correta: "b", explicacao: "porque" }]);
  const aluno = L.blocosParaAluno([q])[0];
  assert.equal(aluno.correta, undefined);
  assert.equal(L.corrigirQuizBloco(q, "b").acertou, true);
});

test("progresso, bloqueio por pré-requisito e próxima aula", () => {
  const aulas = [{ id: 1 }, { id: 2, exige_anterior: 1 }, { id: 3 }];
  assert.equal(L.aulaBloqueada(aulas, new Set(), 2), true);
  assert.equal(L.aulaBloqueada(aulas, new Set([1]), 2), false);
  assert.equal(L.proximaAula(aulas, new Set([1]))?.id, 2);
  assert.deepEqual(L.calcularProgresso(aulas, new Set([1, 2, 3])), { total: 3, feitas: 3, percentual: 100, concluido: true });
  assert.equal(L.calcularProgresso([], new Set()).concluido, false);
});

test("código do certificado tem formato verificável e nome público é reduzido", () => {
  assert.match(L.gerarCodigoCertificado(), L.CODIGO_CERTIFICADO);
  assert.notEqual(L.gerarCodigoCertificado(), L.gerarCodigoCertificado());
  assert.equal(L.nomeReduzido("Lucas Silva Santos"), "Lucas S.");
});

test("saudação, pontos e sequência de dias", () => {
  assert.equal(L.saudacaoPorHora(8), "Bom dia");
  assert.equal(L.saudacaoPorHora(15), "Boa tarde");
  assert.equal(L.saudacaoPorHora(21), "Boa noite");
  assert.equal(L.calcularPontos({ aulasConcluidas: 2, provasAprovadas: 1, cursosConcluidos: 1 }), 170);
  assert.equal(L.sequenciaDias(["2026-10-21", "2026-10-22", "2026-10-23"], new Date("2026-10-23T12:00:00Z")), 3);
  assert.equal(L.sequenciaDias(["2026-10-20"], new Date("2026-10-23T12:00:00Z")), 0);
});
