// Limites de corpo JSON/urlencoded.
//
// Padrão: 1 MB para qualquer rota. Só as rotas da lista "grandes" aceitam mais (JSON_LARGE_LIMIT, padrão 25mb),
// e mesmo nelas o corpo só é lido DEPOIS de conferir a assinatura do JWT (sem tocar no banco), para que
// um cliente anônimo não consiga fazer o servidor bufferizar dezenas de MB.
import express from "express";

export const LIMITE_JSON_PADRAO = "1mb";
export const LIMITE_JSON_GRANDE_PADRAO = "25mb";

// [método, regex do caminho completo]. Mensagens com anexo legado em data URL, foto de perfil e ditado por voz (base64).
export const ROTAS_JSON_GRANDE_PADRAO = [
    ["POST", /^\/api\/chat\/enviar-direto\/?$/],
    ["POST", /^\/api\/chat\/enviar-grupo\/?$/],
    ["PUT", /^\/api\/profile\/?$/],
    ["POST", /^\/api\/ia\/assistente\/ditado\/?$/],
];

// JSON_LARGE_ROUTES="POST /api/foo,PUT /api/bar/\d+" adiciona rotas (regex após o método).
export const lerRotasExtras = (valor = process.env.JSON_LARGE_ROUTES) => String(valor || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
        const [metodo, ...resto] = item.split(/\s+/);
        try {
            return [metodo.toUpperCase(), new RegExp(`^${resto.join(" ")}/?$`)];
        } catch {
            return null;
        }
    })
    .filter(Boolean);

export const rotaPermiteJsonGrande = (req, rotas) => {
    const caminho = String(req.originalUrl || req.url || "").split("?")[0];
    return rotas.some(([metodo, regex]) => metodo === req.method && regex.test(caminho));
};

export const criarParsersDeCorpo = ({
    limitePadrao = process.env.JSON_BODY_LIMIT || LIMITE_JSON_PADRAO,
    limiteGrande = process.env.JSON_LARGE_LIMIT || LIMITE_JSON_GRANDE_PADRAO,
    rotasGrandes = [...ROTAS_JSON_GRANDE_PADRAO, ...lerRotasExtras()],
    verificarAssinatura = () => true,
} = {}) => {
    const jsonPadrao = express.json({ limit: limitePadrao });
    const jsonGrande = express.json({ limit: limiteGrande });
    const urlPadrao = express.urlencoded({ extended: true, limit: limitePadrao });

    const json = (req, res, next) => {
        if (!rotaPermiteJsonGrande(req, rotasGrandes)) return jsonPadrao(req, res, next);

        const cabecalho = String(req.headers.authorization || "");
        const token = cabecalho.split(" ")[1];
        // Sem token plausível não há motivo para ler corpo grande: cai no limite padrão (rota devolverá 401/413).
        if (!token || !verificarAssinatura(token)) return jsonPadrao(req, res, next);
        return jsonGrande(req, res, next);
    };

    return { json, urlencoded: urlPadrao };
};
