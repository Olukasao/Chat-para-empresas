import { test } from "node:test";
import assert from "node:assert/strict";
import { definirSessaoAgenda, validarSessaoAgenda, lerCookieAgenda } from "./agendaSessionService.js";

function emitir(id, cookie = "", exp = Math.floor(Date.now() / 1000) + 60) {
    let saved;
    const token = definirSessaoAgenda({ user: { id, exp }, headers: { cookie } }, {
        cookie(name, value, options) { saved = { name, value, options }; }
    });
    return { token, saved };
}

test("sessão assinada identifica usuário sem compartilhar o JWT do chat", () => {
    const { token, saved } = emitir(12);
    assert.equal(validarSessaoAgenda(token).id, 12);
    assert.equal(saved.options.httpOnly, true);
    assert.equal(saved.options.sameSite, "lax");
    assert.equal(lerCookieAgenda(`outro=x; ${saved.name}=${token}`), token);
    assert.equal(validarSessaoAgenda(token.slice(0, -2) + "xx"), null);
    assert.equal(validarSessaoAgenda("eyJhbGciOiJIUzI1NiJ9.fake.jwt"), null);
});

test("renovação preserva entrada, troca de usuário cria outra sessão", () => {
    const first = emitir(12).token;
    const cookie = `agenda_chat_session=${first}`;
    assert.equal(validarSessaoAgenda(emitir(12, cookie).token).sid, validarSessaoAgenda(first).sid);
    const swapped = validarSessaoAgenda(emitir(13, cookie).token);
    assert.equal(swapped.id, 13);
    assert.notEqual(swapped.sid, validarSessaoAgenda(first).sid);
});

test("sessão expirada não é emitida nem aceita", () => {
    assert.equal(emitir(12, "", 1).token, undefined);
    const { token } = emitir(12);
    const original = Date.now;
    try {
        Date.now = () => original() + 120000;
        assert.equal(validarSessaoAgenda(token), null);
    } finally { Date.now = original; }
});
