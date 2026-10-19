import test from "node:test";
import assert from "node:assert/strict";
import { normalizarFeed, selecionarNovos } from "./contratacoesPendentesService.js";

test("normalizarFeed ordena do mais novo, descarta lixo e limita texto", () => {
    const { pendentes, itens } = normalizarFeed({
        pendingCount: 3,
        items: [
            { id: 5, protocol: "P5", customerName: "Ana", planName: "800 Mega", city: "Caieiras", createdAt: "2026-10-19T10:00:00Z" },
            { id: "x", customerName: "invalido" },
            { id: 7, protocol: "P7", customerName: "B".repeat(200), planName: "700 Mega", city: "Morato" },
        ],
    });
    assert.equal(pendentes, 3);
    assert.deepEqual(itens.map((item) => item.id), [7, 5]);
    assert.equal(itens[0].cliente.length, 80);
});

test("selecionarNovos: primeira leitura nao avisa; depois so ids maiores", () => {
    const itens = [{ id: 9 }, { id: 8 }, { id: 4 }];
    assert.deepEqual(selecionarNovos(itens, null), []);
    assert.deepEqual(selecionarNovos(itens, 8).map((item) => item.id), [9]);
    assert.deepEqual(selecionarNovos(itens, 9), []);
});
