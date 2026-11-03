// Briefing do dia no chat: todo dia útil, no horário combinado, cada gestor recebe uma mensagem direta do
// "Assistente Acessa" com filas, alertas da rede e agenda. Os números vêm do próprio servidor (sem passar pelo
// app de ninguém); só o texto resumido sai para a IA, já sem dados pessoais.
import { recadosImportantes } from "./recadosLogica.js";
import db from "../db/db.js";
import { dashboardRelay } from "./dashboardRelayService.js";
import { obterResumoAgendaTecnicos } from "./agendaTecnicosResumoService.js";
import { listarIncidentesAtivos, oltCloudConfigurada } from "./oltCloudService.js";
import { conversar, mascararSensivel } from "./assistenteIa.js";
import { alertasIgnorados, garantirTabelasIa, gravarConfig, hojeSaoPaulo, lerConfig, registrarProvedor } from "./iaAdminService.js";

export const BOT_EMAIL = "assistente.ia@acessanet.interno";
export const BOT_NOME = "Assistente Acessa";
const PADRAO = { ativo: "0", hora: "08:00", dias: "1,2,3,4,5" };

export const configDoBriefing = (cfg = {}) => ({
    ativo: (cfg.briefing_ativo ?? PADRAO.ativo) === "1",
    hora: /^([01]\d|2[0-3]):[0-5]\d$/.test(cfg.briefing_hora || "") ? cfg.briefing_hora : PADRAO.hora,
    dias: String(cfg.briefing_dias ?? PADRAO.dias).split(",").map(Number).filter((d) => d >= 0 && d <= 6),
});

/** Dia da semana (0 = domingo) e hora "HH:MM" em Brasília. */
export function relogioSaoPaulo(agora = new Date()) {
    const partes = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(agora).map((p) => [p.type, p.value]));
    const dia = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(partes.weekday);
    return { dia, hora: `${partes.hour}:${partes.minute}` };
}

/** Já passou da hora combinada, num dia marcado? (Vale o dia todo: se o servidor estava fora às 8h, envia ao voltar.) */
export function deveEnviarAgora(config, agora = new Date()) {
    if (!config.ativo) return false;
    const { dia, hora } = relogioSaoPaulo(agora);
    return config.dias.includes(dia) && hora >= config.hora;
}

const semAcento = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
const FILAS_SUPORTE = /^SUPORTE (TECNICO|N[123])$/;
const numero = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Texto com os números do dia, sem nomes de clientes, para a IA resumir (ou para ser enviado como está). */
export function montarDados({ painel, agenda, rede }) {
    const linhas = [];
    if (painel?.grupos) {
        // Só as filas de suporte: o total do painel inclui retiradas, cancelamentos e outras filas que não são atendimento.
        const filas = Object.entries(painel.grupos).filter(([k]) => FILAS_SUPORTE.test(semAcento(k))).sort((a, b) => numero(b[1]) - numero(a[1]));
        const total = filas.reduce((soma, [, n]) => soma + numero(n), 0);
        linhas.push(`Chamados de suporte abertos (Suporte Técnico, N1, N2 e N3): ${total}.`);
        if (filas.length) linhas.push("Por fila: " + filas.map(([k, n]) => `${String(k).slice(0, 50)} ${numero(n)}`).join("; ") + ".");
    } else linhas.push("Chamados de suporte: sem dados no momento.");
    if (agenda?.totais) {
        const t = agenda.totais;
        linhas.push(`Agenda de técnicos de hoje: ${t.total} OS (${t.abertas} abertas, ${t.execucao} em execução, ${t.encerradas} encerradas).`);
        const pendentes = (agenda.tecnicos || []).filter((x) => x.total - x.encerradas > 0).slice(0, 8);
        if (pendentes.length) linhas.push("Técnicos com OS pendentes: " + pendentes.map((x) => `${String(x.nome).slice(0, 30)} ${x.total - x.encerradas} de ${x.total}`).join("; ") + ".");
    } else linhas.push("Agenda de técnicos: sem dados no momento.");
    // Recados da coordenação na agenda (bloco "Outro"), como "Alan irá atuar entre 08 e 16:48".
    const recados = recadosImportantes(agenda?.observacoes || []);
    if (recados.length) {
        linhas.push(`Recados da agenda de técnicos hoje (${recados.length}):`);
        for (const o of recados.slice(0, 12)) linhas.push(`- ${o.tecnico}${o.hora ? ` (${o.hora})` : ""}: ${o.descricao}${o.finalizado ? " (encerrado)" : ""}`);
    }
    if (rede) {
        if (!rede.length) linhas.push("Rede (OLT): nenhum alerta ativo.");
        else {
            linhas.push(`Rede (OLT): ${rede.length} alertas ativos.`);
            for (const i of rede.slice(0, 8)) {
                linhas.push("- " + [i.tipo, i.olt, i.slotPon && `slot ${i.slotPon}`, i.pon && `PON ${i.pon}`, i.cto, i.dispositivosAtivos != null ? `${i.dispositivosAtivos} clientes afetados` : ""].filter(Boolean).join(" "));
            }
        }
    }
    return linhas.join("\n");
}

export async function coletarDadosDoBriefing(empresaId = 1) {
    dashboardRelay.start();
    const painel = dashboardRelay.read().update;
    const agenda = obterResumoAgendaTecnicos();
    let rede = null;
    if (oltCloudConfigurada()) {
        try {
            const ignorados = await alertasIgnorados(empresaId).catch(() => new Set());
            rede = (await listarIncidentesAtivos()).incidentes.filter((i) => !ignorados.has(String(i.id)));
        } catch { rede = null; }
    }
    return { painel, agenda, rede };
}

const saudacao = (agora) => {
    const h = Number(relogioSaoPaulo(agora).hora.slice(0, 2));
    return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
};

const primeiroNome = (nome) => String(nome || "").trim().split(/\s+/)[0] || "";

/** "☀️ Bom dia, Lucas! Briefing de segunda-feira, 26 de outubro de 2026". */
export function cabecalhoDoBriefing(nome, agora = new Date()) {
    const quem = primeiroNome(nome);
    const data = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "America/Sao_Paulo" }).format(agora);
    return `☀️ ${saudacao(agora)}${quem ? `, ${quem}` : ""}! Briefing de ${data}`;
}

/** Corpo do briefing: resumo da IA; se ela falhar, os próprios números, para o briefing nunca deixar de chegar. */
export async function corpoDoBriefing(dados, { empresaId = 0, ia = conversar } = {}) {
    try {
        const r = await ia([{ role: "user", content: `Resuma o dia para a gestão em até 8 linhas curtas, destacando o que exige atenção primeiro. Não escreva saudação nem título, só o resumo. Dados de hoje:\n${mascararSensivel(dados)}` }], {
            observar: (e) => { void registrarProvedor({ empresaId, provedor: e.provedor, ok: e.ok, erro: e.erro }).catch(() => {}); },
        });
        return r.resposta;
    } catch {
        return dados;
    }
}

export async function redigirBriefing(dados, { empresaId = 0, agora = new Date(), ia = conversar, nome = "" } = {}) {
    return `${cabecalhoDoBriefing(nome, agora)}\n\n${await corpoDoBriefing(dados, { empresaId, ia })}`;
}

export async function garantirBot(empresaId) {
    const [achado] = await db.query("SELECT id FROM usuarios WHERE email = ? AND empresa_id = ? LIMIT 1", [BOT_EMAIL, empresaId]);
    if (achado[0]) return achado[0].id;
    // senha inválida de propósito: a conta não faz login
    const [r] = await db.query("INSERT INTO usuarios (nome, email, senha, empresa_id, perfil, status) VALUES (?, ?, '!', ?, 'usuario', 'online')", [BOT_NOME, BOT_EMAIL, empresaId]);
    return r.insertId;
}

/** Gestores que recebem: a lista escolhida na administração; sem lista, os administradores. */
export async function destinatarios(empresaId) {
    await garantirTabelasIa();
    const [escolhidos] = await db.query(`
        SELECT u.id, u.nome FROM briefing_destinatarios b JOIN usuarios u ON u.id = b.usuario_id
        WHERE b.empresa_id = ? AND b.ativo = 1 AND u.deletado_em IS NULL AND u.email <> ?`, [empresaId, BOT_EMAIL]);
    if (escolhidos.length) return escolhidos;
    const [admins] = await db.query("SELECT id, nome FROM usuarios WHERE empresa_id = ? AND perfil = 'admin' AND deletado_em IS NULL AND email <> ?", [empresaId, BOT_EMAIL]);
    return admins;
}

export async function entregar({ io, botId, para, texto, tipo = "texto", anexoNome = null, anexoMime = null }) {
    let [conversa] = await db.query(
        "SELECT id FROM conversas_diretas WHERE (usuario1_id = ? AND usuario2_id = ?) OR (usuario1_id = ? AND usuario2_id = ?) LIMIT 1",
        [botId, para, para, botId],
    );
    if (!conversa.length) {
        await db.query("INSERT INTO conversas_diretas (usuario1_id, usuario2_id) VALUES (?, ?)", [botId, para]);
        [conversa] = await db.query("SELECT id FROM conversas_diretas WHERE usuario1_id = ? AND usuario2_id = ? LIMIT 1", [botId, para]);
    }
    const conversaId = conversa[0].id;
    const [ins] = await db.query("INSERT INTO mensagens (remetente_id, conversa_direta_id, mensagem, tipo_mensagem, anexo_nome, anexo_mime) VALUES (?, ?, ?, ?, ?, ?)", [botId, conversaId, texto, tipo, anexoNome, anexoMime]);
    await db.query("UPDATE conversas_diretas SET atualizada_em = NOW() WHERE id = ?", [conversaId]);
    // se a pessoa tinha escondido a conversa, ela volta a aparecer
    await db.query("DELETE FROM conversas_ocultas_usuario WHERE conversa_direta_id = ? AND usuario_id = ?", [conversaId, para]).catch(() => {});
    const msg = {
        id: ins.insertId, remetente_id: botId, usuario_id: para, conversa_id: conversaId, remetente_nome: BOT_NOME, remetente_avatar: null,
        mensagem: texto, tipo_mensagem: tipo, anexo_nome: anexoNome, anexo_mime: anexoMime, lida: false, entregue_em: null, lida_em: null, reacoes: [], criada_em: new Date(),
    };
    io?.to(`conversa_${conversaId}`).emit("receive_direct_message", msg);
    io?.to(`user_${para}`).emit("new_direct_message_notification", msg);
}

/** Gera e entrega o briefing. `forcar` ignora o "já enviei hoje" (botão de teste envia só para quem pediu). */
export async function enviarBriefing({ io, empresaId, para = null, agora = new Date() }) {
    const dados = montarDados(await coletarDadosDoBriefing(empresaId));
    const corpo = await corpoDoBriefing(dados, { empresaId });
    let lista;
    if (para) {
        const [u] = await db.query("SELECT id, nome FROM usuarios WHERE id = ? AND empresa_id = ? LIMIT 1", [para, empresaId]);
        lista = u.length ? u : [{ id: para, nome: "" }];
    } else lista = await destinatarios(empresaId);
    const texto = `${cabecalhoDoBriefing(lista[0]?.nome, agora)}\n\n${corpo}`;
    if (!lista.length) return { enviados: 0, texto };
    const botId = await garantirBot(empresaId);
    let enviados = 0;
    for (const d of lista) {
        try { await entregar({ io, botId, para: d.id, texto: `${cabecalhoDoBriefing(d.nome, agora)}\n\n${corpo}` }); enviados += 1; } catch (e) { console.error("[briefing] entrega falhou:", e?.message); }
    }
    return { enviados, texto };
}

/** Confere a cada minuto; o INSERT em briefing_envios garante um único envio por dia, mesmo com reinício. */
export function iniciarBriefing(io, { empresaId = 1, intervaloMs = 60_000 } = {}) {
    const tick = async () => {
        try {
            await garantirTabelasIa();
            const config = configDoBriefing(await lerConfig(empresaId));
            const agora = new Date();
            if (!deveEnviarAgora(config, agora)) return;
            const [r] = await db.query("INSERT IGNORE INTO briefing_envios (empresa_id, dia, quantidade) VALUES (?, ?, 0)", [empresaId, hojeSaoPaulo(agora)]);
            if (!r.affectedRows) return;
            const { enviados } = await enviarBriefing({ io, empresaId, agora });
            await db.query("UPDATE briefing_envios SET quantidade = ? WHERE empresa_id = ? AND dia = ?", [enviados, empresaId, hojeSaoPaulo(agora)]);
        } catch (e) {
            console.error("[briefing] falhou:", e?.message);
        }
    };
    const timer = setInterval(tick, intervaloMs);
    timer.unref?.();
    return () => clearInterval(timer);
}

export { gravarConfig };
