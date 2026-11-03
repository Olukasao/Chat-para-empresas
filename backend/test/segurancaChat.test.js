import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { io as clientIo } from "socket.io-client";
import {
    criarAutorizadorSocket,
    criarMiddlewareAutenticacaoSocket,
    identidadeDoSocket,
    lerModoAutenticacaoSocket,
    verificarJwtHS256,
} from "../src/security/socketSecurity.js";
import { criarLimitadorLogin } from "../src/security/loginRateLimit.js";
import { criarParsersDeCorpo } from "../src/security/bodyLimits.js";
import { aplicarCabecalhosUpload, lerExtensoesPermitidas, validarArquivoChat } from "../src/security/uploadSecurity.js";

const SEGREDO = "segredo-de-teste-com-mais-de-32-caracteres!!";
const silencioso = { warn() {}, error() {}, log() {} };
const USUARIOS = {
    1: { id: 1, nome: "Ana", email: "a@x", empresa_id: 10, setor_id: 5, perfil: "usuario", avatar: null },
    2: { id: 2, nome: "Beto", email: "b@x", empresa_id: 10, setor_id: 5, perfil: "usuario", avatar: null },
};
const buscarUsuario = async (id) => USUARIOS[id] || null;
const tokenDe = (id, opts = {}) => jwt.sign({ id }, SEGREDO, { expiresIn: "1h", ...opts });

const subirServidorSocket = async (middlewareOpts) => {
    const server = http.createServer();
    const io = new Server(server);
    io.use(criarMiddlewareAutenticacaoSocket({
        verificarToken: (t) => verificarJwtHS256(t, SEGREDO),
        buscarUsuario,
        logger: silencioso,
        ...middlewareOpts,
    }));
    io.on("connection", (socket) => {
        socket.on("quem_sou", (_payload, cb) => cb(identidadeDoSocket(socket)?.usuarioId ?? null));
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const url = `http://127.0.0.1:${server.address().port}`;
    return { io, server, url, fechar: () => { io.close(); server.close(); } };
};

const conectar = (url, auth, extra = {}) => new Promise((resolve) => {
    const c = clientIo(url, { auth, transports: ["websocket"], reconnection: false, ...extra });
    c.on("connect", () => resolve({ ok: true, c }));
    c.on("connect_error", (err) => { c.close(); resolve({ ok: false, err }); });
});

// ---------------------------------------------------------------- C1: handshake
test("SOCKET_AUTH_MODE: padrão é enforce e valores inválidos viram enforce", () => {
    assert.equal(lerModoAutenticacaoSocket(undefined), "enforce");
    assert.equal(lerModoAutenticacaoSocket(""), "enforce");
    assert.equal(lerModoAutenticacaoSocket("qualquer"), "enforce");
    assert.equal(lerModoAutenticacaoSocket("LOG"), "log");
    assert.equal(lerModoAutenticacaoSocket("off"), "off");
});

test("enforce: socket sem token, com token falso, expirado ou de outro algoritmo é recusado", async () => {
    const s = await subirServidorSocket({ modo: "enforce" });
    try {
        assert.equal((await conectar(s.url, {})).ok, false, "sem token");
        assert.equal((await conectar(s.url, { token: "lixo" })).ok, false, "token lixo");
        assert.equal((await conectar(s.url, { token: jwt.sign({ id: 1 }, "outro-segredo-qualquer-123456789012345") })).ok, false, "assinatura errada");
        assert.equal((await conectar(s.url, { token: tokenDe(1, { expiresIn: -10 }) })).ok, false, "expirado");
        assert.equal((await conectar(s.url, { token: jwt.sign({ id: 1 }, SEGREDO, { algorithm: "HS512" }) })).ok, false, "HS512 não aceito (M2)");
        const semAlg = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url")}.${Buffer.from('{"id":1}').toString("base64url")}.`;
        assert.equal((await conectar(s.url, { token: semAlg })).ok, false, "alg none");
        assert.equal((await conectar(s.url, { token: tokenDe(99) })).ok, false, "usuário inexistente/removido");
    } finally { s.fechar(); }
});

test("enforce: token válido conecta e a identidade vem do token, não do payload", async () => {
    const s = await subirServidorSocket({ modo: "enforce" });
    try {
        const r = await conectar(s.url, { token: tokenDe(1) });
        assert.equal(r.ok, true);
        const quem = await new Promise((res) => r.c.emit("quem_sou", { usuario_id: 2, empresa_id: 99 }, res));
        assert.equal(quem, 1, "payload tentando ser o usuário 2 é ignorado");
        r.c.close();
    } finally { s.fechar(); }
});

test("modo log: não derruba ninguém, mas registra conexão sem token", async () => {
    const avisos = [];
    const s = await subirServidorSocket({ modo: "log", logger: { warn: (...a) => avisos.push(a.join(" ")), error() {}, log() {} } });
    try {
        const sem = await conectar(s.url, {});
        assert.equal(sem.ok, true);
        assert.equal(await new Promise((res) => sem.c.emit("quem_sou", {}, res)), null);
        sem.c.close();
        assert.equal((await conectar(s.url, { token: "lixo" })).ok, true);
        assert.ok(avisos.some((a) => a.includes("sem token")), "registrou sem token");
        assert.ok(avisos.some((a) => a.includes("token inválido")), "registrou token inválido");
        const bom = await conectar(s.url, { token: tokenDe(2) });
        assert.equal(await new Promise((res) => bom.c.emit("quem_sou", {}, res)), 2);
        bom.c.close();
    } finally { s.fechar(); }
});

test("widget da agenda (cookie assinado, sem JWT) continua conectando em enforce", async () => {
    const s = await subirServidorSocket({ modo: "enforce", sessaoAgenda: (socket) => (socket.handshake.headers["x-teste-agenda"] === "ok" ? { id: 2 } : null) });
    try {
        const r = await conectar(s.url, {}, { extraHeaders: { "x-teste-agenda": "ok" } });
        assert.equal(r.ok, true);
        assert.equal(await new Promise((res) => r.c.emit("quem_sou", {}, res)), 2);
        r.c.close();
        assert.equal((await conectar(s.url, {})).ok, false);
    } finally { s.fechar(); }
});

// ---------------------------------------------------------------- C1: autorização de salas
test("autorizador: conversa direta só para participantes; grupo só para membros", async () => {
    const consultas = [];
    const db = {
        async query(sql, params) {
            consultas.push({ sql, params });
            if (/FROM conversas_diretas/.test(sql)) {
                const [cid, u1, u2] = params;
                return [cid === 7 && (u1 === 1 || u1 === 2) ? [{ id: 7, usuario1_id: 1, usuario2_id: 2 }] : []];
            }
            if (/FROM grupo_membros/.test(sql)) return [params[0] === 3 && params[1] === 1 ? [{ grupo_id: 3 }] : []];
            if (/FROM mensagens/.test(sql)) {
                return [params[0] === 100 ? [{ id: 100, remetente_id: 1, conversa_direta_id: 7, grupo_id: null }]
                    : params[0] === 200 ? [{ id: 200, remetente_id: 1, conversa_direta_id: null, grupo_id: 3 }] : []];
            }
            return [[]];
        },
    };
    const a = criarAutorizadorSocket(db);
    assert.deepEqual(await a.participanteDaConversa(1, "7"), { id: 7, outroId: 2 });
    assert.deepEqual(await a.participanteDaConversa(2, 7), { id: 7, outroId: 1 });
    assert.equal(await a.participanteDaConversa(3, 7), null, "estranho não entra");
    assert.equal(await a.participanteDaConversa(1, "7 OR 1=1"), null, "id malformado");
    assert.equal(await a.participanteDaConversa(null, 7), null);
    assert.equal(await a.membroDoGrupo(1, 3), true);
    assert.equal(await a.membroDoGrupo(2, 3), false);
    assert.equal(await a.membroDoGrupo(1, "abc"), false);
    // mensagem relayada precisa ser do remetente, na conversa/grupo informado
    assert.equal(await a.mensagemPertenceAoRemetente({ mensagemId: 100, remetenteId: 1, conversaId: 7 }), true);
    assert.equal(await a.mensagemPertenceAoRemetente({ mensagemId: 100, remetenteId: 2, conversaId: 7 }), false, "outro usuário não relaya mensagem alheia");
    assert.equal(await a.mensagemPertenceAoRemetente({ mensagemId: 100, remetenteId: 1, conversaId: 8 }), false, "conversa diferente");
    assert.equal(await a.mensagemPertenceAoRemetente({ mensagemId: 200, remetenteId: 1, grupoId: 3 }), true);
    assert.equal(await a.mensagemPertenceAoRemetente({ mensagemId: 999, remetenteId: 1, conversaId: 7 }), false);
    // exclusão: autor ou admin
    assert.equal(await a.podeAnunciarExclusao({ usuario: { id: 1, perfil: "usuario" }, mensagemId: 100, conversaId: 7 }), true);
    assert.equal(await a.podeAnunciarExclusao({ usuario: { id: 2, perfil: "usuario" }, mensagemId: 100, conversaId: 7 }), false);
    assert.equal(await a.podeAnunciarExclusao({ usuario: { id: 2, perfil: "admin" }, mensagemId: 100, conversaId: 7 }), true);
    // as consultas usam parâmetros, nunca interpolação
    assert.ok(consultas.every((c) => !/7 OR 1=1/.test(c.sql)));
});

// ---------------------------------------------------------------- A3: login
test("rate limit de login: bloqueia por e-mail após o limite, com backoff, sem afetar outros e-mails", () => {
    let t = 1_000_000;
    const l = criarLimitadorLogin({ maxPorEmail: 3, maxPorIp: 100, janelaMs: 15 * 60_000, bloqueioBaseMs: 60_000, agora: () => t });
    const ctx = { ip: "10.0.0.1", email: "Alvo@X.com" };
    for (let i = 0; i < 3; i++) { assert.equal(l.verificar(ctx).permitido, true); l.registrarFalha(ctx); }
    const bloqueado = l.verificar({ ip: "10.0.0.9", email: "alvo@x.com" });
    assert.equal(bloqueado.permitido, false, "outro IP, mesmo e-mail (case-insensitive) também bloqueia");
    assert.ok(bloqueado.tentarEmSeg > 0 && bloqueado.tentarEmSeg <= 60);
    assert.equal(l.verificar({ ip: "10.0.0.9", email: "outro@x.com" }).permitido, true);
    t += 61_000;
    assert.equal(l.verificar(ctx).permitido, true, "libera após o bloqueio");
    for (let i = 0; i < 3; i++) l.registrarFalha(ctx);
    const segundo = l.verificar(ctx);
    assert.equal(segundo.permitido, false);
    assert.ok(segundo.tentarEmSeg > 60, "backoff dobra o segundo bloqueio");
    t += 3_600_000 * 2;
    l.registrarSucesso(ctx);
    assert.equal(l.verificar(ctx).permitido, true);
});

test("rate limit de login: bloqueia por IP", () => {
    const l = criarLimitadorLogin({ maxPorEmail: 100, maxPorIp: 5 });
    for (let i = 0; i < 5; i++) l.registrarFalha({ ip: "1.1.1.1", email: `u${i}@x.com` });
    assert.equal(l.verificar({ ip: "1.1.1.1", email: "novo@x.com" }).permitido, false);
    assert.equal(l.verificar({ ip: "2.2.2.2", email: "novo@x.com" }).permitido, true);
});

// ---------------------------------------------------------------- A4: limites de corpo
test("corpo: 1 MB por padrão; rota grande só com JWT de assinatura válida", async () => {
    const parsers = criarParsersDeCorpo({
        limitePadrao: "1mb", limiteGrande: "5mb",
        verificarAssinatura: (t) => { try { verificarJwtHS256(t, SEGREDO); return true; } catch { return false; } },
    });
    const app = express();
    app.use(parsers.json);
    app.use(parsers.urlencoded);
    app.post("/api/qualquer", (req, res) => res.json({ ok: true }));
    app.post("/api/chat/enviar-direto", (req, res) => res.json({ ok: true }));
    app.use((err, _req, res, _next) => res.status(err.status || 500).json({ erro: err.type }));
    const server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const enviar = (rota, bytes, headers = {}) => fetch(base + rota, {
        method: "POST", headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify({ x: "a".repeat(bytes) }),
    }).then((r) => r.status);
    try {
        assert.equal(await enviar("/api/qualquer", 100), 200);
        assert.equal(await enviar("/api/qualquer", 2 * 1024 * 1024), 413, "2 MB em rota comum");
        assert.equal(await enviar("/api/qualquer", 2 * 1024 * 1024, { authorization: `Bearer ${tokenDe(1)}` }), 413, "token não libera rota comum");
        assert.equal(await enviar("/api/chat/enviar-direto", 2 * 1024 * 1024), 413, "rota grande sem token");
        assert.equal(await enviar("/api/chat/enviar-direto", 2 * 1024 * 1024, { authorization: "Bearer lixo" }), 413, "rota grande com token falso");
        assert.equal(await enviar("/api/chat/enviar-direto", 2 * 1024 * 1024, { authorization: `Bearer ${tokenDe(1)}` }), 200, "rota grande com token válido");
        assert.equal(await enviar("/api/chat/enviar-direto", 6 * 1024 * 1024, { authorization: `Bearer ${tokenDe(1)}` }), 413, "acima do limite grande");
    } finally { server.close(); }
});

// ---------------------------------------------------------------- A1/A6: uploads
test("upload do chat: allowlist de extensão e bloqueio de conteúdo ativo", () => {
    const ok = (originalname, mimetype = "application/octet-stream") => validarArquivoChat({ originalname, mimetype });
    for (const nome of ["foto.PNG", "a.jpg", "b.jfif", "doc.pdf", "p.xlsx", "x.docx", "v.mp4", "a.mp3", "z.zip", "t.txt", "setup.exe"]) {
        assert.equal(ok(nome), null, nome);
    }
    for (const nome of ["x.html", "x.htm", "x.svg", "x.js", "x.mjs", "x.xhtml", "x.php", "x.url", "semextensao", "x.png.html", "x.HTML"]) {
        assert.notEqual(ok(nome), null, nome);
    }
    assert.notEqual(ok("foto.png", "text/html"), null, "MIME html mesmo com extensão boa");
    assert.notEqual(ok("foto.png", "image/svg+xml"), null);
    assert.notEqual(ok("doc.pdf", "image/png"), null, "extensão que não é imagem declarada como imagem");
    // extras por env não destravam conteúdo ativo
    const permitidas = lerExtensoesPermitidas({ CHAT_UPLOAD_EXTRA_EXTENSIONS: "html,svg,.bak", CHAT_UPLOAD_ALLOW_EXECUTABLES: "false" });
    assert.equal(permitidas.has(".bak"), true);
    assert.equal(permitidas.has(".html"), false);
    assert.equal(permitidas.has(".svg"), false);
    assert.equal(permitidas.has(".exe"), false);
});

test("/uploads: imagens inline; o resto attachment + Content-Type fixo + CSP sandbox", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uploads-teste-"));
    const arquivos = {
        "a.png": "PNG", "b.webp": "WEBP", "ataque.html": "<script>alert(1)</script>", "ataque.svg": "<svg onload=alert(1)>",
        "doc.pdf": "%PDF", "musica.mp3": "ID3", "sem-extensao": "x", "ataque.HTML": "<b>x</b>",
    };
    for (const [nome, conteudo] of Object.entries(arquivos)) fs.writeFileSync(path.join(dir, nome), conteudo);
    const app = express();
    app.use("/uploads/chat", express.static(dir, { setHeaders: (res, caminho) => aplicarCabecalhosUpload(res, caminho) }));
    const server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const base = `http://127.0.0.1:${server.address().port}/uploads/chat/`;
    try {
        for (const nome of ["a.png", "b.webp"]) {
            const r = await fetch(base + nome);
            assert.equal(r.status, 200);
            assert.equal(r.headers.get("content-disposition"), null, `${nome} segue inline`);
            assert.match(r.headers.get("content-type"), /^image\//);
            assert.equal(r.headers.get("content-security-policy"), "sandbox");
            assert.equal(r.headers.get("x-content-type-options"), "nosniff");
        }
        for (const nome of ["ataque.html", "ataque.svg", "ataque.HTML", "doc.pdf", "sem-extensao"]) {
            const r = await fetch(base + nome);
            assert.equal(r.headers.get("content-disposition"), "attachment", nome);
            assert.equal(r.headers.get("content-type"), "application/octet-stream", nome);
            assert.equal(r.headers.get("content-security-policy"), "sandbox", nome);
        }
        const audio = await fetch(base + "musica.mp3");
        assert.equal(audio.headers.get("content-type"), "audio/mpeg", "áudio mantém tipo para tocar no <audio>");
        assert.equal(audio.headers.get("content-disposition"), "attachment");
    } finally { server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---------------------------------------------------------------- C2/A2/A3/M2/M3: rotas (checagem estática)
// Routes.js abre o pool do MySQL ao ser importado; por isso estas garantias são conferidas no código-fonte.
const rotas = fs.readFileSync(new URL("../src/Routes/Routes.js", import.meta.url), "utf8");
const middleware = fs.readFileSync(new URL("../src/middlewares/middleware.js", import.meta.url), "utf8");
const servidor = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");

test("rotas sensíveis exigem autenticação", () => {
    assert.match(rotas, /route\.post\("\/register", authMiddleware, requireAdmin,/);
    assert.match(rotas, /route\.post\("\/setores\/:empresa_id", authMiddleware,/);
    assert.match(rotas, /route\.post\("\/usuarios\/:empresa_id", authMiddleware,/);
    const setores = rotas.slice(rotas.indexOf('route.post("/setores/:empresa_id"'), rotas.indexOf('route.post("/setores/:empresa_id"') + 600);
    assert.match(setores, /req\.user\.empresa_id/);
    assert.doesNotMatch(setores, /req\.params/);
    const usuarios = rotas.slice(rotas.indexOf('route.post("/usuarios/:empresa_id"'), rotas.indexOf('route.post("/usuarios/:empresa_id"') + 600);
    assert.match(usuarios, /req\.user\.empresa_id/);
    assert.doesNotMatch(usuarios, /req\.params/);
    const registro = rotas.slice(rotas.indexOf('route.post("/register"'), rotas.indexOf("// USER LOGADO"));
    assert.match(registro, /req\.admin\.empresa_id/);
    assert.doesNotMatch(registro, /req\.body\??\.empresa_id/);
    assert.match(registro, /status\(409\)/);
});

test("login: limitador, mensagem única e sem enumeração", () => {
    const login = rotas.slice(rotas.indexOf('route.post("/login"'), rotas.indexOf('route.post("/usuarios/:empresa_id"'));
    assert.match(login, /limitadorLogin\.verificar/);
    assert.match(login, /status\(429\)/);
    assert.doesNotMatch(login, /Usuário não encontrado|Senha inválida/);
    assert.match(login, /HASH_FALSO_LOGIN/);
});

test("JWT: HS256 explícito no HTTP e no socket; force-refresh local exige segredo", () => {
    assert.match(middleware, /jwt\.verify\(token, getSecret\(\), \{ algorithms: \["HS256"\] \}\)/);
    assert.doesNotMatch(servidor, /jwt\.verify\(/);
    const local = rotas.slice(rotas.indexOf('route.post("/local/force-refresh-chat"'), rotas.indexOf('route.post("/admin/force-refresh-chat"'));
    assert.match(local, /x-local-secret/);
    assert.match(local, /timingSafeEqual|segredoLocalConfere/);
});

test("server.js: io.use de autenticação, buffer 10 MB e sem confiar no payload", () => {
    assert.match(servidor, /io\.use\(criarMiddlewareAutenticacaoSocket/);
    assert.doesNotMatch(servidor, /750/);
    assert.match(servidor, /SOCKET_MAX_BUFFER_MB\) \|\| 10\)/);
    // nenhum handler de envio lê remetente_id do payload
    const envio = servidor.slice(servidor.indexOf("socket.on('send_direct_message'"), servidor.indexOf("socket.on('mark_conversa_read'"));
    assert.match(envio, /const remetente_id = ident\.usuarioId/);
    assert.doesNotMatch(envio, /remetente_id,\s*\n\s*usuario_id,\s*\n\s*conversa_id,\s*\n\s*mensagem,\s*\n\s*remetente_nome/);
    const grupo = servidor.slice(servidor.indexOf("socket.on('send_group_message'"), servidor.indexOf("socket.on('typing_direct'"));
    assert.match(grupo, /membroDoGrupo/);
    assert.match(grupo, /const remetente_id = ident\.usuarioId/);
});
