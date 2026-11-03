// Ditado por voz: o app grava o áudio, o servidor converte para WAV e um modelo que entende áudio devolve o texto.
// O áudio não é guardado em lugar nenhum: vive só na memória durante o pedido.
import { spawn } from "node:child_process";
import { configuracao } from "./assistenteIa.js";

export const MAX_AUDIO_BYTES = 3 * 1024 * 1024;
export const MAX_SEGUNDOS = 90;
const TEMPO_LIMITE_MS = 45_000;
const CANDIDATOS_FFMPEG = [process.env.FFMPEG_PATH, "ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg", "/home/noc/.npm-global/bin/ffmpeg"].filter(Boolean);

function rodarFfmpeg(caminho, entrada) {
    return new Promise((resolve, reject) => {
        const proc = spawn(caminho, ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-t", String(MAX_SEGUNDOS), "-ar", "16000", "-ac", "1", "-f", "wav", "pipe:1"], { stdio: ["pipe", "pipe", "pipe"] });
        const saida = [];
        let erro = "";
        const timer = setTimeout(() => { proc.kill("SIGKILL"); reject(new Error("A conversão do áudio demorou demais.")); }, 20_000);
        proc.stdout.on("data", (d) => saida.push(d));
        proc.stderr.on("data", (d) => { erro += d; });
        proc.on("error", (e) => { clearTimeout(timer); reject(e); });
        proc.on("close", (codigo) => {
            clearTimeout(timer);
            if (codigo === 0 && saida.length) resolve(Buffer.concat(saida));
            else reject(Object.assign(new Error("Não consegui ler esse áudio."), { detalhe: erro.slice(0, 300), status: 400 }));
        });
        proc.stdin.on("error", () => { /* ffmpeg fechou antes de ler tudo: o "close" traz o resultado */ });
        proc.stdin.end(entrada);
    });
}

/** Converte qualquer áudio do navegador (webm/opus, ogg, mp4...) em WAV 16 kHz mono. */
export async function converterParaWav(buffer, { rodar = rodarFfmpeg, candidatos = CANDIDATOS_FFMPEG } = {}) {
    let ultimo = null;
    for (const caminho of candidatos) {
        try { return await rodar(caminho, buffer); } catch (e) {
            if (e?.code !== "ENOENT") throw e;
            ultimo = e;
        }
    }
    throw Object.assign(new Error("O ditado por voz não está disponível no servidor."), { status: 503, detalhe: ultimo?.message });
}

const SISTEMA = [
    "Você transcreve áudios em português do Brasil, fielmente, para quem está ditando um texto.",
    "Responda SOMENTE com o que foi falado, com pontuação e letras maiúsculas normais. Não resuma, não explique, não responda ao que foi dito e não acrescente comentários.",
    "Escreva números e horários como a pessoa falou (por exemplo, 9h, 15 horas, 20 reais). Se não houver fala, responda exatamente: [sem fala]",
].join(" ");

/** Pede a transcrição a um modelo que entende áudio (os modelos marcados como "visao" são os Gemini). */
export async function transcreverWav(wav, { env = process.env, fetchImpl = fetch, observar } = {}) {
    const cfg = configuracao(env);
    if (!cfg.configurada) throw Object.assign(new Error("Assistente na internet não configurado."), { status: 503 });
    const modelos = cfg.modelosVisao.length ? cfg.modelosVisao : cfg.modelos;
    const dados = wav.toString("base64");
    let ultimo = "";
    for (const modelo of modelos) {
        try {
            const r = await fetchImpl(`${cfg.base}/chat/completions`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.chave}` },
                body: JSON.stringify({
                    model: modelo, stream: false, temperature: 0, max_tokens: 1200,
                    messages: [
                        { role: "system", content: SISTEMA },
                        { role: "user", content: [{ type: "text", text: "Transcreva este áudio." }, { type: "input_audio", input_audio: { data: dados, format: "wav" } }] },
                    ],
                }),
                signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
            });
            if (!r.ok) { ultimo = `${modelo}: HTTP ${r.status}`; observar?.({ tipo: "modelo", provedor: modelo, ok: false, erro: `HTTP ${r.status}` }); continue; }
            const texto = (await r.json())?.choices?.[0]?.message?.content;
            if (typeof texto === "string") {
                observar?.({ tipo: "modelo", provedor: modelo, ok: true });
                return limparTranscricao(texto);
            }
            ultimo = `${modelo}: resposta vazia`;
        } catch (e) {
            ultimo = `${modelo}: ${e?.name === "TimeoutError" ? "demorou demais" : e?.message}`;
            observar?.({ tipo: "modelo", provedor: modelo, ok: false, erro: String(e?.message || "erro").slice(0, 120) });
        }
    }
    throw Object.assign(new Error("Não consegui transcrever agora. Tente de novo."), { status: 502, detalhe: ultimo });
}

export function limparTranscricao(texto) {
    const t = String(texto ?? "").trim().replace(/^["“”']+|["“”']+$/g, "").trim();
    return /^\[?\s*sem fala\s*\]?\.?$/i.test(t) ? "" : t.slice(0, 4000);
}
