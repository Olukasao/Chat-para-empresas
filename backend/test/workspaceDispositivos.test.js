import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  compararVersao, dispositivoValido, gravarSinal, lerSinal, lerVersaoPublicada, limparIp, montarSinal, nomeComputador, situacaoDaVersao, versaoValida,
} from "../src/services/workspaceDispositivosService.js";

const novaPasta = (versao = "0.5.58") => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "canal-"));
  if (versao) fs.writeFileSync(path.join(dir, "latest.yml"), `version: ${versao}\nfiles:\n  - url: x\n`);
  return dir;
};

test("compara versões como números, não como texto", () => {
  assert.ok(compararVersao("0.5.10", "0.5.9") > 0);
  assert.ok(compararVersao("0.5.9", "0.5.58") < 0);
  assert.equal(compararVersao("0.5.58", "0.5.58"), 0);
});

test("situação da versão: atualizado, desatualizado ou desconhecida", () => {
  assert.equal(situacaoDaVersao("0.5.58", "0.5.58"), "atualizado");
  assert.equal(situacaoDaVersao("0.6.0", "0.5.58"), "atualizado");
  assert.equal(situacaoDaVersao("0.5.57", "0.5.58"), "desatualizado");
  assert.equal(situacaoDaVersao(null, "0.5.58"), "desconhecida");
  assert.equal(situacaoDaVersao("lixo", "0.5.58"), "desconhecida");
  assert.equal(situacaoDaVersao("0.5.58", null), "desconhecida");
});

test("valida o identificador do computador, a versão e limpa nome e IP", () => {
  assert.equal(dispositivoValido("3F2504E0-4F89-41D3-9A0C-0305E82C3301"), "3f2504e0-4f89-41d3-9a0c-0305e82c3301");
  assert.equal(dispositivoValido("nao-e-uuid"), null);
  assert.equal(dispositivoValido(123), null);
  assert.equal(versaoValida("0.5.58"), "0.5.58");
  assert.equal(versaoValida("0.5"), null);
  assert.equal(nomeComputador("  PC-Ed<script>  "), "PC-Edscript");
  assert.equal(nomeComputador("x".repeat(200)).length, 80);
  assert.equal(limparIp("::ffff:192.168.2.108"), "192.168.2.108");
});

test("lê a versão publicada do latest.yml e devolve null sem ele", () => {
  assert.equal(lerVersaoPublicada(novaPasta("0.5.58")), "0.5.58");
  assert.equal(lerVersaoPublicada(novaPasta(null)), null);
});

test("monta o sinal no mesmo formato do force-update.mjs", () => {
  const s = montarSinal({ versao: "0.5.58", obrigatoria: true, mensagem: "  Atualize agora  " }, new Date("2026-10-24T15:00:00Z"));
  assert.equal(s.versao, "0.5.58");
  assert.equal(s.obrigatoria, true);
  assert.equal(s.mensagem, "Atualize agora");
  assert.equal(s.criadoEm, "2026-10-24T15:00:00.000Z");
  assert.match(s.id, /^[0-9a-z]+-[0-9a-f]{8}$/);
  assert.equal("mensagem" in montarSinal({ versao: "1.0.0" }), false);
  assert.equal(montarSinal({ versao: "1.0.0", obrigatoria: "sim" }).obrigatoria, true, "só true de verdade vale; texto vira booleano aqui");
});

test("grava o sinal na pasta do canal, com a versão publicada, e o app consegue lê-lo de volta", () => {
  const dir = novaPasta("0.5.58");
  const s = gravarSinal({ obrigatoria: false }, dir);
  assert.equal(s.versao, "0.5.58");
  assert.deepEqual(lerSinal(dir), s);
  assert.equal(fs.existsSync(path.join(dir, "signal.json.tmp")), false, "não deixa arquivo temporário");
  const outro = gravarSinal({ obrigatoria: true, mensagem: "Nova versão" }, dir);
  assert.notEqual(outro.id, s.id, "cada forçada tem um id novo, para os PCs reagirem");
  assert.equal(lerSinal(dir).obrigatoria, true);
});

test("sem versão publicada não grava sinal nenhum", () => {
  const dir = novaPasta(null);
  assert.throws(() => gravarSinal({}, dir), (e) => e.status === 409);
  assert.equal(fs.existsSync(path.join(dir, "signal.json")), false);
});
