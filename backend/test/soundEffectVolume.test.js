import test from "node:test";
import assert from "node:assert/strict";
import { limitarVolumePercent, resolverVolumePercent, VOLUME_ABSOLUTO_PERCENT } from "../src/services/soundEffectVolume.js";

test("limitarVolumePercent aceita 0 a 200 e usa o padrão para valor inválido", () => {
  assert.equal(limitarVolumePercent(150), 150);
  assert.equal(limitarVolumePercent(999), VOLUME_ABSOLUTO_PERCENT);
  assert.equal(limitarVolumePercent(-5), 0);
  assert.equal(limitarVolumePercent("80"), 80);
  assert.equal(limitarVolumePercent(undefined), 70);
  assert.equal(limitarVolumePercent("abc", 55), 55);
});

test("volume_percent novo respeita o teto de quem dispara", () => {
  assert.equal(resolverVolumePercent({ volume_percent: 150 }, 200), 150);
  assert.equal(resolverVolumePercent({ volume_percent: 150 }, 70), 70, "quem só pode 70% fica em 70%");
  assert.equal(resolverVolumePercent({ volume_percent: 500 }, 200), 200, "nunca passa do teto absoluto");
  assert.equal(resolverVolumePercent({ volume_percent: 0 }, 70), 0);
  assert.equal(resolverVolumePercent({ volume_percent: -10 }, 70), 0);
});

test("o campo antigo volume (fração de 0 a 1, ou % se maior que 1) continua funcionando", () => {
  assert.equal(resolverVolumePercent({ volume: 0.5 }, 70), 50);
  assert.equal(resolverVolumePercent({ volume: 1 }, 100), 100);
  assert.equal(resolverVolumePercent({ volume: 1 }, 70), 70);
  assert.equal(resolverVolumePercent({ volume: 80 }, 200), 80);
  assert.equal(resolverVolumePercent({ volume: 30 }, 70), 30);
});

test("sem volume pedido usa o padrão de 60%, limitado pelo teto", () => {
  assert.equal(resolverVolumePercent({}, 70), 60);
  assert.equal(resolverVolumePercent({}, 40), 40);
  assert.equal(resolverVolumePercent({ volume: "abc" }, 70), 60);
  assert.equal(resolverVolumePercent({ volume_percent: "" , volume: 0.3 }, 70), 30);
});

test("o campo novo tem prioridade sobre o antigo quando os dois vêm juntos", () => {
  assert.equal(resolverVolumePercent({ volume_percent: 120, volume: 0.5 }, 200), 120);
});
