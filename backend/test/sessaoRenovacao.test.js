import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { inicioDaSessao, maximoDeDias, montarPayloadRenovado, podeRenovar } from "../src/services/sessaoRenovacaoService.js";

const DIA = 86400;
const agora = 2_000_000_000;

test("o início da sessão é o do login original e se mantém nas renovações", () => {
  assert.equal(inicioDaSessao({ iat: 100 }), 100);
  assert.equal(inicioDaSessao({ iat: 500, sessao_inicio: 100 }), 100);
  assert.equal(inicioDaSessao({}), 0);
  assert.equal(inicioDaSessao({ iat: "lixo" }), 0);
});

test("pode renovar dentro do limite de dias e não depois", () => {
  assert.equal(podeRenovar({ iat: agora - 5 * DIA }, agora, 30), true);
  assert.equal(podeRenovar({ iat: agora - 29 * DIA }, agora, 30), true);
  assert.equal(podeRenovar({ iat: agora - 31 * DIA }, agora, 30), false);
  assert.equal(podeRenovar({ iat: agora - 1 * DIA, sessao_inicio: agora - 40 * DIA }, agora, 30), false, "o limite conta desde o login original, não desde a última renovação");
  assert.equal(podeRenovar({}, agora, 30), false, "sem data de início não renova");
});

test("o limite de dias vem do ambiente, com padrão de 30 e teto de 365", () => {
  assert.equal(maximoDeDias({}), 30);
  assert.equal(maximoDeDias({ SESSAO_MAX_DIAS: "7" }), 7);
  assert.equal(maximoDeDias({ SESSAO_MAX_DIAS: "9999" }), 365);
  assert.equal(maximoDeDias({ SESSAO_MAX_DIAS: "0" }), 30);
  assert.equal(maximoDeDias({ SESSAO_MAX_DIAS: "abc" }), 30);
});

test("o token renovado usa o cadastro atual e leva o início da sessão", () => {
  const p = montarPayloadRenovado({ id: 7, nome: "Ana", empresa_id: 1, setor_id: 4, perfil: "gerente", email: "x@y" }, { iat: 1234, perfil: "usuario" });
  assert.deepEqual(p, { id: 7, nome: "Ana", empresa_id: 1, setor_id: 4, perfil: "gerente", sessao_inicio: 1234 });
});

test("um token renovado de verdade é válido e a renovação seguinte mantém o mesmo início", () => {
  const segredo = "x".repeat(40);
  const login = jwt.sign({ id: 1, nome: "A", empresa_id: 1, setor_id: 1, perfil: "usuario" }, segredo, { expiresIn: "7d" });
  const dec1 = jwt.verify(login, segredo);
  const renovado = jwt.sign(montarPayloadRenovado({ id: 1, nome: "A", empresa_id: 1, setor_id: 1, perfil: "usuario" }, dec1), segredo, { expiresIn: "7d" });
  const dec2 = jwt.verify(renovado, segredo);
  assert.equal(dec2.sessao_inicio, dec1.iat);
  assert.ok(dec2.exp >= dec1.exp);
  const renovado2 = jwt.verify(jwt.sign(montarPayloadRenovado({ id: 1, nome: "A", empresa_id: 1, setor_id: 1, perfil: "usuario" }, dec2), segredo, { expiresIn: "7d" }), segredo);
  assert.equal(renovado2.sessao_inicio, dec1.iat, "o início nunca anda para frente");
});
