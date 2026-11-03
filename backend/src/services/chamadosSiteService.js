// Chamados abertos pelo site (Central do Cliente) para a aba Chamados do Workspace.
// Mesmo token e mesma URL base do resumo de marketing (marketingSiteService.js):
// o chat fala com o site sistema a sistema; o token nunca chega ao Workspace.
import { lerConfigMarketing, ErroMarketing } from "./marketingSiteService.js";

const CACHE_MS = 15_000;
const TIMEOUT_MS = 12_000;

export function criarServicoChamados({ env = process.env, fetchImpl = globalThis.fetch, agora = () => Date.now() } = {}) {
    const cache = new Map();

    const base = () => {
        const { url, token } = lerConfigMarketing(env);
        if (!url || !token) throw new ErroMarketing(503, "A integração com os dados do site ainda não foi configurada.");
        // .../marketing/resumo -> .../marketing/chamados (mesmo servidor e token).
        return { alvo: new URL(url).href.replace(/\/resumo$/, "/chamados"), token };
    };

    async function buscar(caminho, query = {}) {
        const { alvo, token } = base();
        const url = new URL(caminho ? `${alvo}/${caminho}` : alvo);
        for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
        const chave = url.href;
        const guardado = cache.get(chave);
        if (guardado && agora() - guardado.em < CACHE_MS) return guardado.dados;
        let resposta;
        try {
            resposta = await fetchImpl(url, {
                headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
                signal: AbortSignal.timeout(TIMEOUT_MS),
                redirect: "error",
            });
        } catch {
            throw new ErroMarketing(502, "O site não respondeu. Tente novamente em instantes.");
        }
        if (resposta.status === 401) throw new ErroMarketing(502, "O site recusou o acesso: confira o token da integração.");
        if (resposta.status === 404) throw new ErroMarketing(404, "Chamado não encontrado.");
        if (!resposta.ok) throw new ErroMarketing(502, "O site não conseguiu responder agora.");
        const dados = await resposta.json();
        cache.set(chave, { em: agora(), dados });
        if (cache.size > 60) cache.clear();
        return dados;
    }

    return {
        listar: (query) => buscar("", {
            period: query.period || "30d", page: query.page, limit: query.limit, status: query.status,
        }),
        detalhe: (protocolo) => buscar(encodeURIComponent(protocolo)),
    };
}
