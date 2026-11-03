// Teste de integração do módulo Cursos. Precisa de um MariaDB descartável:
//   LMS_TEST_DB=127.0.0.1:3399 node --test test/cursos.integration.test.js
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

const alvo = process.env.LMS_TEST_DB;
const pular = !alvo;
if (!pular) {
  const [host, port] = alvo.split(":");
  Object.assign(process.env, { DB_HOST: host, DB_PORT: port, DB_USER: "root", DB_PASSWORD: "", DB_NAME: "lms_test", JWT_SECRET: "x".repeat(40) });
}

let server, base, db, jwt, express;
const tokens = {};
const chamar = async (quem, metodo, caminho, corpo) => {
  const r = await fetch(`${base}/api/cursos${caminho}`, {
    method: metodo, headers: { "content-type": "application/json", ...(quem ? { authorization: `Bearer ${tokens[quem]}` } : {}) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const tipo = r.headers.get("content-type") || "";
  return { status: r.status, body: tipo.includes("json") ? await r.json() : await r.text(), headers: r.headers };
};

before(async () => {
  if (pular) return;
  db = (await import("../src/db/db.js")).default;
  jwt = (await import("jsonwebtoken")).default;
  express = (await import("express")).default;
  await db.query("CREATE TABLE IF NOT EXISTS empresas (id INT PRIMARY KEY, nome VARCHAR(50))");
  await db.query("CREATE TABLE IF NOT EXISTS setores (id INT PRIMARY KEY, nome VARCHAR(50), empresa_id INT)");
  await db.query(`CREATE TABLE IF NOT EXISTS usuarios (id INT PRIMARY KEY, nome VARCHAR(100), email VARCHAR(100), empresa_id INT, setor_id INT, perfil ENUM('admin','admin_comercial','usuario') DEFAULT 'usuario', deletado_em TIMESTAMP NULL)`);
  await db.query("INSERT IGNORE INTO empresas VALUES (1,'AcessaNet')");
  await db.query("INSERT IGNORE INTO setores VALUES (1,'NOC',1),(2,'Dev',1)");
  await db.query("INSERT IGNORE INTO usuarios (id,nome,email,empresa_id,setor_id,perfil) VALUES (1,'Lucas Silva Santos','a@x',1,2,'admin'),(2,'Maria Souza','m@x',1,1,'usuario'),(3,'Joao Lima','j@x',1,2,'usuario')");
  const rotas = (await import("../src/Routes/cursosRoutes.js")).default;
  const app = express();
  app.use(express.json());
  app.use("/api/cursos", rotas);
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const [nome, id] of [["admin", 1], ["maria", 2], ["joao", 3]]) tokens[nome] = jwt.sign({ id }, process.env.JWT_SECRET);
});
after(async () => { if (pular) return; server.close(); await db.end(); });

const opts = { skip: pular && "defina LMS_TEST_DB" };
let cursoId, aulaId, provaId, codigo;

test("categorias iniciais e permissões", opts, async () => {
  const c = await chamar("maria", "GET", "/categorias");
  assert.equal(c.body.categorias.length, 8);
  assert.equal((await chamar("maria", "GET", "/permissoes")).body.gestor, false);
  assert.equal((await chamar("admin", "GET", "/permissoes")).body.gestor, true);
  assert.equal((await chamar("maria", "POST", "/admin/cursos", { titulo: "x" })).status, 403);
  assert.equal((await chamar("maria", "GET", "/admin/relatorios")).status, 403);
  assert.equal((await chamar(null, "GET", "/painel")).status, 401);
});

test("administrador cria curso, aulas e avaliação, e só publica quando completo", opts, async () => {
  const c = await chamar("admin", "POST", "/admin/cursos", { titulo: "Fundamentos de Redes", cargaHorariaMin: 90, nivel: "basico", emiteCertificado: true });
  assert.equal(c.status, 200);
  cursoId = c.body.id;
  assert.equal((await chamar("admin", "PUT", `/admin/cursos/${cursoId}/status`, { status: "publicado" })).status, 409); // sem aulas
  const a = await chamar("admin", "POST", `/admin/modulos/${c.body.moduloId}/aulas`, { titulo: "O que é uma rede" });
  aulaId = a.body.id;
  const salvar = await chamar("admin", "PUT", `/admin/aulas/${aulaId}`, {
    versao: 1, duracaoMin: 10,
    blocos: [
      { tipo: "titulo", texto: "Redes", nivel: 1 }, { tipo: "paragrafo", texto: "Texto **forte**" },
      { tipo: "codigo", linguagem: "bash", codigo: "ping 8.8.8.8" },
      { tipo: "quiz", enunciado: "2+2?", opcoes: [{ id: "a", texto: "3" }, { id: "b", texto: "4" }], correta: "b", explicacao: "soma" },
    ],
  });
  assert.equal(salvar.status, 200);
  assert.equal(salvar.body.versao, 2);
  assert.equal((await chamar("admin", "PUT", `/admin/aulas/${aulaId}`, { versao: 1, blocos: [] })).status, 409); // edição concorrente
  assert.equal((await chamar("admin", "PUT", `/admin/aulas/${aulaId}`, { versao: 2, blocos: [{ tipo: "script" }] })).status, 400);
  assert.equal((await chamar("admin", "GET", `/admin/aulas/${aulaId}/versoes`)).body.versoes.length, 1);

  const det = await chamar("admin", "GET", `/admin/cursos/${cursoId}`);
  const p = await chamar("admin", "POST", `/admin/modulos/${det.body.modulos[0].id}/aulas`, { titulo: "Prova 1", tipo: "prova" });
  provaId = p.body.id;
  assert.equal((await chamar("admin", "PUT", `/admin/cursos/${cursoId}/status`, { status: "publicado" })).status, 409); // prova vazia
  const ps = await chamar("admin", "PUT", `/admin/aulas/${provaId}`, { exigeAnterior: true, prova: {
    notaMinima: 70, maxTentativas: 2, feedback: "final",
    questoes: [
      { id: "q1", tipo: "unica", enunciado: "Camada 3?", pontos: 50, opcoes: [{ id: "a", texto: "Enlace" }, { id: "b", texto: "Rede" }], correta: ["b"] },
      { id: "q2", tipo: "vf", enunciado: "Fibra usa luz", pontos: 50, correta: true },
    ] } });
  assert.equal(ps.status, 200);
  assert.equal((await chamar("admin", "PUT", `/admin/cursos/${cursoId}/status`, { status: "publicado" })).status, 200);
});

test("rascunho não aparece para o aluno; publicado aparece", opts, async () => {
  const r = await chamar("admin", "POST", "/admin/cursos", { titulo: "Rascunho secreto" });
  assert.equal((await chamar("maria", "GET", `/curso/${r.body.id}`)).status, 404);
  const cat = await chamar("maria", "GET", "/catalogo");
  assert.deepEqual(cat.body.cursos.map((c) => c.titulo), ["Fundamentos de Redes"]);
  assert.equal((await chamar("maria", "GET", "/catalogo?q=fundamentos")).body.cursos.length, 1);
  assert.equal((await chamar("maria", "GET", "/catalogo?q=zzz")).body.cursos.length, 0);
});

test("aula entrega o conteúdo sem a resposta do quiz e confere no servidor", opts, async () => {
  const a = await chamar("maria", "GET", `/aula/${aulaId}`);
  assert.equal(a.status, 200);
  assert.equal(JSON.stringify(a.body).includes('"correta"'), false);
  const quiz = a.body.blocos.find((b) => b.tipo === "quiz");
  assert.equal((await chamar("maria", "POST", `/aula/${aulaId}/quiz`, { blocoId: quiz.id, resposta: "a" })).body.acertou, false);
  assert.equal((await chamar("maria", "POST", `/aula/${aulaId}/quiz`, { blocoId: quiz.id, resposta: "b" })).body.acertou, true);
});

test("avaliação bloqueada até concluir a aula anterior; progresso persiste", opts, async () => {
  assert.equal((await chamar("maria", "GET", `/aula/${provaId}/prova`)).status, 423);
  // o tempo estudado cresce no máximo 120 s por chamada
  await chamar("maria", "POST", `/aula/${aulaId}/progresso`, { segundos: 99999, posicao: 42 });
  const [[p]] = await db.query("SELECT segundos, posicao FROM cursos_progresso WHERE usuario_id = 2 AND aula_id = ?", [aulaId]);
  assert.equal(p.segundos, 120);
  assert.equal((await chamar("maria", "POST", `/aula/${provaId}/concluir`)).status, 400); // prova não se conclui "no clique"
  assert.equal((await chamar("maria", "POST", `/aula/${aulaId}/concluir`)).status, 200);
  const curso = await chamar("maria", "GET", `/curso/${cursoId}`);
  assert.equal(curso.body.progresso.percentual, 50);
  assert.equal(curso.body.ultimaAulaId, aulaId);
  assert.equal(curso.body.proximaAulaId, provaId);
});

test("prova: sem gabarito, tentativas limitadas, nota no servidor e certificado ao passar", opts, async () => {
  const info = await chamar("maria", "GET", `/aula/${provaId}/prova`);
  assert.equal(info.body.config.maxTentativas, 2);
  const ini = await chamar("maria", "POST", `/aula/${provaId}/prova/iniciar`);
  assert.equal(ini.status, 200);
  assert.equal(JSON.stringify(ini.body).includes('"correta"'), false);
  const t1 = ini.body.id;
  // reiniciar retoma a mesma tentativa
  assert.equal((await chamar("maria", "POST", `/aula/${provaId}/prova/iniciar`)).body.id, t1);
  const errada = await chamar("maria", "POST", `/tentativa/${t1}/finalizar`, { respostas: { q1: "a", q2: false } });
  assert.equal(errada.body.nota, 0);
  assert.equal(errada.body.aprovado, false);
  assert.equal((await chamar("maria", "PUT", `/tentativa/${t1}/respostas`, { respostas: {} })).status, 409); // já finalizada
  assert.equal((await chamar("joao", "GET", `/tentativa/${t1}`)).status, 404); // só o dono vê

  const t2 = (await chamar("maria", "POST", `/aula/${provaId}/prova/iniciar`)).body.id;
  assert.notEqual(t2, t1);
  const certa = await chamar("maria", "POST", `/tentativa/${t2}/finalizar`, { respostas: { q1: "b", q2: true } });
  assert.equal(certa.body.nota, 100);
  assert.equal(certa.body.aprovado, true);
  assert.equal(certa.body.curso.concluido, true);
  codigo = certa.body.curso.certificado;
  assert.match(codigo, /^ACN-/);
  assert.equal((await chamar("maria", "POST", `/aula/${provaId}/prova/iniciar`)).status, 409); // sem tentativas
  assert.equal((await chamar("maria", "GET", "/certificados")).body.certificados[0].codigo, codigo);
});

test("verificação pública não expõe dados privados", opts, async () => {
  const v = await chamar(null, "GET", `/verificar/${codigo}`);
  assert.equal(v.status, 200);
  assert.equal(v.body.aluno, "Maria S.");
  assert.equal(JSON.stringify(v.body).includes("Souza"), false);
  assert.equal((await chamar(null, "GET", "/verificar/ACN-AAAA-BBBB-CCCC")).status, 404);
  assert.equal((await chamar("joao", "GET", `/certificados/${codigo}`)).status, 404);
});

test("discursiva fica pendente até o gestor corrigir", opts, async () => {
  const c = await chamar("admin", "POST", "/admin/cursos", { titulo: "Atendimento" });
  const m = c.body.moduloId;
  const p = (await chamar("admin", "POST", `/admin/modulos/${m}/aulas`, { titulo: "Prova", tipo: "prova" })).body.id;
  await chamar("admin", "PUT", `/admin/aulas/${p}`, { prova: { notaMinima: 60, questoes: [{ id: "d", tipo: "discursiva", enunciado: "Explique", pontos: 100 }] } });
  await chamar("admin", "PUT", `/admin/cursos/${c.body.id}/status`, { status: "publicado" });
  const t = (await chamar("joao", "POST", `/aula/${p}/prova/iniciar`)).body.id;
  const fim = await chamar("joao", "POST", `/tentativa/${t}/finalizar`, { respostas: { d: "minha resposta" } });
  assert.equal(fim.body.status, "aguardando_correcao");
  assert.equal(fim.body.nota, null);
  assert.equal((await chamar("admin", "GET", "/admin/correcoes")).body.correcoes.length, 1);
  assert.equal((await chamar("joao", "PUT", `/admin/tentativas/${t}/corrigir`, { manuais: { d: { pontos: 100 } } })).status, 403);
  const ok = await chamar("admin", "PUT", `/admin/tentativas/${t}/corrigir`, { manuais: { d: { pontos: 80, comentario: "bom" } } });
  assert.equal(ok.body.nota, 80);
  assert.equal(ok.body.aprovado, true);
  assert.equal((await chamar("joao", "GET", `/curso/${c.body.id}`)).body.progresso.percentual, 100);
});

test("atribuição por setor matricula automaticamente e controla relatórios", opts, async () => {
  const c = await chamar("admin", "POST", "/admin/cursos", { titulo: "Treinamento NOC", obrigatorio: true });
  const a = (await chamar("admin", "POST", `/admin/modulos/${c.body.moduloId}/aulas`, { titulo: "Aula" })).body.id;
  await chamar("admin", "PUT", `/admin/aulas/${a}`, { blocos: [{ tipo: "paragrafo", texto: "x" }] });
  await chamar("admin", "PUT", `/admin/cursos/${c.body.id}/status`, { status: "publicado" });
  await chamar("admin", "PUT", `/admin/cursos/${c.body.id}/atribuicoes`, { atribuicoes: [{ tipo: "setor", alvoId: 1, obrigatorio: true, prazoEm: "2020-01-01" }] });
  const painelMaria = await chamar("maria", "GET", "/painel");
  assert.ok(painelMaria.body.continuar.some((x) => x.titulo === "Treinamento NOC" && x.obrigatorio));
  assert.ok(painelMaria.body.proximas.some((x) => x.titulo === "Treinamento NOC")); // prazo vencido aparece nas atividades
  assert.equal(painelMaria.body.usuario.nome, "Maria Souza");
  const painelJoao = await chamar("joao", "GET", "/painel");
  assert.ok(!painelJoao.body.continuar.some((x) => x.titulo === "Treinamento NOC")); // outro setor não recebe
  assert.equal((await chamar("joao", "GET", `/aula/${a}`)).status, 200); // mas pode estudar livremente

  const rel = await chamar("admin", "GET", "/admin/relatorios");
  assert.equal(rel.status, 200);
  assert.ok(rel.body.kpis.cursosPublicados >= 3);
  assert.ok(rel.body.pendentes.some((p) => p.nome === "Maria Souza" && p.atrasados === 1));
  const csv = await chamar("admin", "GET", "/admin/relatorios.csv");
  assert.match(csv.headers.get("content-type"), /text\/csv/);
  assert.ok(csv.body.includes("Maria Souza"));
  const alunos = await chamar("admin", "GET", "/admin/alunos");
  assert.ok(alunos.body.alunos.find((x) => x.nome === "Maria Souza").atrasados >= 1);
  assert.equal((await chamar("maria", "GET", "/admin/alunos")).status, 403);
});

test("anotações são privadas; favoritos e feedback funcionam", opts, async () => {
  await chamar("maria", "PUT", `/aula/${aulaId}/anotacao`, { texto: "lembrar disto" });
  assert.equal((await chamar("maria", "GET", `/aula/${aulaId}`)).body.anotacao, "lembrar disto");
  assert.equal((await chamar("joao", "GET", `/aula/${aulaId}`)).body.anotacao, "");
  await chamar("maria", "PUT", `/curso/${cursoId}/favorito`, { favorito: true });
  assert.equal((await chamar("maria", "GET", "/catalogo?favoritos=1")).body.cursos.length, 1);
  assert.equal((await chamar("maria", "PUT", `/curso/${cursoId}/feedback`, { nota: 9 })).status, 400);
  assert.equal((await chamar("maria", "PUT", `/curso/${cursoId}/feedback`, { nota: 5, comentario: "ótimo" })).status, 200);
});

test("uploads: aceita imagem real, recusa disfarçado, links assinados", opts, async () => {
  const enviar = async (quem, nome, bytes, tipo) => {
    const fd = new FormData();
    fd.append("cursoId", String(cursoId));
    fd.append("arquivo", new Blob([bytes], { type: tipo }), nome);
    const r = await fetch(`${base}/api/cursos/admin/arquivos`, { method: "POST", headers: { authorization: `Bearer ${tokens[quem]}` }, body: fd });
    return { status: r.status, body: await r.json() };
  };
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
  assert.equal((await enviar("maria", "a.png", png, "image/png")).status, 403);
  assert.equal((await enviar("admin", "malware.png", Buffer.from("MZ\x90\x00 executavel"), "image/png")).status, 400);
  assert.equal((await enviar("admin", "pagina.html", Buffer.from("<script>1</script>"), "text/html")).status, 400);
  assert.equal((await enviar("admin", "icone.svg", Buffer.from("<svg onload=alert(1)>"), "image/svg+xml")).status, 400);
  const ok = await enviar("admin", "capa.png", png, "image/png");
  assert.equal(ok.status, 200);
  const r = await fetch(`${base}${ok.body.url}`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "image/png");
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.equal((await fetch(`${base}${ok.body.url.replace(/t=.{4}/, "t=AAAA")}`)).status, 403);
  assert.equal((await fetch(`${base}/api/cursos/arquivos/${ok.body.id}`)).status, 403);
});

test("feedback imediato confere por questão e trava a resposta conferida", opts, async () => {
  const c = await chamar("admin", "POST", "/admin/cursos", { titulo: "Feedback imediato" });
  const p = (await chamar("admin", "POST", `/admin/modulos/${c.body.moduloId}/aulas`, { titulo: "Prova", tipo: "prova" })).body.id;
  await chamar("admin", "PUT", `/admin/aulas/${p}`, { prova: { notaMinima: 50, feedback: "imediato", questoes: [
    { id: "a", tipo: "vf", enunciado: "Verdadeiro?", pontos: 50, correta: true }, { id: "b", tipo: "curta", enunciado: "Sigla?", pontos: 50, aceitas: ["OLT"] } ] } });
  await chamar("admin", "PUT", `/admin/cursos/${c.body.id}/status`, { status: "publicado" });
  const t = (await chamar("joao", "POST", `/aula/${p}/prova/iniciar`)).body.id;
  const r1 = await chamar("joao", "POST", `/tentativa/${t}/conferir`, { questaoId: "a", resposta: false });
  assert.equal(r1.body.acertou, false);
  assert.equal(r1.body.correta, true);
  // tenta trocar a resposta depois de ver o gabarito: não vale
  assert.equal((await chamar("joao", "POST", `/tentativa/${t}/conferir`, { questaoId: "a", resposta: true })).body.acertou, false);
  await chamar("joao", "PUT", `/tentativa/${t}/respostas`, { respostas: { a: true } });
  const fim = await chamar("joao", "POST", `/tentativa/${t}/finalizar`, { respostas: { a: true, b: "olt" } });
  assert.equal(fim.body.nota, 50); // "a" ficou errada, "b" certa
  // provas no modo "final" não oferecem conferência durante a tentativa
  const t3 = (await chamar("maria", "GET", `/aula/${provaId}/prova`)).body;
  assert.equal(t3.config.feedback, "final");
});

test("categorias editáveis, auditoria e exclusão protegida", opts, async () => {
  const n = await chamar("admin", "POST", "/admin/categorias", { nome: "Financeiro" });
  assert.equal((await chamar("admin", "POST", "/admin/categorias", { nome: "Financeiro" })).status, 409);
  assert.equal((await chamar("admin", "PUT", `/admin/categorias/${n.body.id}`, { nome: "Finanças" })).status, 200);
  assert.equal((await chamar("admin", "DELETE", `/admin/cursos/${cursoId}`)).status, 409); // publicado com matrículas
  const aud = await chamar("admin", "GET", "/admin/auditoria");
  assert.ok(aud.body.registros.some((r) => r.acao === "publicar"));
  assert.ok(aud.body.registros.some((r) => r.acao === "renomear"));
});
