import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import db from "../db/db.js";
import { entregar, garantirBot } from "./briefingService.js";
import { conversar, mascararSensivel } from "./assistenteIa.js";
import { registrarProvedor, registrarUso } from "./iaAdminService.js";

// Disparo de mensagens pela conta "Assistente Acessa": a administração escolhe quem recebe, o texto e uma imagem pronta
// (ou um arquivo já enviado pelo chat). Cada pessoa recebe na conversa direta com o assistente.

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.resolve(AQUI, "../assets/disparo");
const UPLOADS_CHAT = path.resolve(AQUI, "../../../uploads/chat");

export const IMAGENS_PRONTAS = {
    harry404: { arquivo: "harry-404.webp", nome: "Harry 404.webp" },
    ednesio: { arquivo: "ednesio.webp", nome: "Ed o Tecladista.webp" },
};
export const MAX_DESTINATARIOS = 300;
const URL_ANEXO = /^\/uploads\/chat\/\d+\/[\w.\-]+$/;

/** Coloca a imagem pronta na pasta de arquivos do chat (uma vez) e devolve o endereço que as mensagens usam. */
export function publicarImagemPronta(chave, empresaId) {
    const img = IMAGENS_PRONTAS[chave];
    if (!img) throw new Error("Imagem desconhecida.");
    const dir = path.join(UPLOADS_CHAT, String(empresaId));
    const nome = `assistente-${img.arquivo}`;
    fs.mkdirSync(dir, { recursive: true });
    const destino = path.join(dir, nome);
    if (!fs.existsSync(destino)) fs.copyFileSync(path.join(ASSETS, img.arquivo), destino);
    return { url: `/uploads/chat/${empresaId}/${nome}`, nome: img.nome, mime: "image/webp" };
}

/** Valida o pedido e monta o que será enviado, sem tocar no banco. */
export function montarDisparo({ texto, imagem, anexo, empresaId }) {
    const msg = String(texto || "").trim().slice(0, 4000);
    let arquivo = null;
    if (imagem) arquivo = { ...publicarImagemPronta(String(imagem), empresaId), tipo: "imagem" };
    else if (anexo?.url) {
        if (!URL_ANEXO.test(String(anexo.url))) throw new Error("Arquivo inválido.");
        const mime = String(anexo.mime || "application/octet-stream").slice(0, 120);
        arquivo = { url: String(anexo.url), nome: String(anexo.nome || "arquivo").slice(0, 200), mime, tipo: mime.startsWith("image/") ? "imagem" : mime.startsWith("audio/") ? "audio" : "arquivo" };
    }
    if (!msg && !arquivo) throw new Error("Escreva uma mensagem ou escolha uma imagem.");
    return { msg, arquivo };
}

export async function dispararComoAssistente({ io, empresaId, usuarios, texto, imagem, anexo }) {
    const ids = [...new Set((Array.isArray(usuarios) ? usuarios : []).map(Number).filter(Number.isInteger))];
    if (!ids.length) throw new Error("Escolha para quem enviar.");
    if (ids.length > MAX_DESTINATARIOS) throw new Error(`Escolha no máximo ${MAX_DESTINATARIOS} pessoas por disparo.`);
    const { msg, arquivo } = montarDisparo({ texto, imagem, anexo, empresaId });
    const botId = await garantirBot(empresaId);
    const [validos] = await db.query("SELECT id FROM usuarios WHERE empresa_id = ? AND deletado_em IS NULL AND id <> ? AND id IN (?)", [empresaId, botId, ids]);
    const aceitos = new Set(validos.map((u) => u.id));
    const falhas = ids.filter((id) => !aceitos.has(id)).map((id) => ({ id, erro: "Usuário não encontrado." }));
    let enviados = 0;
    for (const id of aceitos) {
        try {
            if (msg) await entregar({ io, botId, para: id, texto: msg });
            if (arquivo) await entregar({ io, botId, para: id, texto: arquivo.url, tipo: arquivo.tipo, anexoNome: arquivo.nome, anexoMime: arquivo.mime });
            enviados += 1;
        } catch (e) {
            falhas.push({ id, erro: "Falha ao entregar." });
            console.error("[disparo] entrega falhou:", e?.message);
        }
    }
    return { enviados, falhas };
}

export const SISTEMA_REDACAO = [
    "Você escreve mensagens curtas para o chat interno de uma empresa de internet (AcessaNet), enviadas pela conta Assistente Acessa a colegas de trabalho.",
    "Responda SOMENTE com o texto da mensagem, pronto para enviar: sem título, sem aspas, sem explicações e sem markdown (nada de asteriscos ou listas com #).",
    "Português do Brasil, tom cordial e direto, no máximo 6 linhas. Pode usar no máximo 2 emojis, se combinar com o assunto.",
    "Se receber um rascunho, melhore-o mantendo o sentido e os fatos. Nunca invente datas, horários, nomes ou números que não foram informados.",
].join("\n");

/** Tira o que a IA às vezes acrescenta (cerca de código, aspas, negrito) para o texto ir limpo ao chat. */
export function limparRascunho(texto) {
    return String(texto || "")
        .replace(/^```\w*\n?|```$/g, "")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/^["“”']+|["“”']+$/g, "")
        .trim()
        .slice(0, 4000);
}

export async function redigirMensagem({ empresaId, usuarioId, pedido, rascunho = "", ia = conversar }) {
    const ideia = String(pedido || "").trim().slice(0, 600);
    const base = String(rascunho || "").trim().slice(0, 2000);
    if (ideia.length < 3 && !base) throw new Error("Conte o que a mensagem precisa dizer.");
    const conteudo = [
        ideia ? `O que a mensagem precisa dizer: ${mascararSensivel(ideia)}` : "",
        base ? `Rascunho atual para melhorar:\n${mascararSensivel(base)}` : "",
    ].filter(Boolean).join("\n\n");
    const observar = (e) => { void registrarProvedor({ empresaId, provedor: e.provedor, ok: e.ok, erro: e.erro }).catch(() => {}); };
    try {
        const r = await ia([{ role: "user", content: conteudo }], { sistema: SISTEMA_REDACAO, observar });
        void registrarUso({ empresaId, usuarioId, campo: "perguntas" }).catch(() => {});
        const texto = limparRascunho(r.resposta);
        if (!texto) throw new Error("vazio");
        return texto;
    } catch (e) {
        void registrarUso({ empresaId, usuarioId, campo: "falhas" }).catch(() => {});
        throw new Error("A IA não conseguiu escrever agora. Tente de novo em instantes.");
    }
}
