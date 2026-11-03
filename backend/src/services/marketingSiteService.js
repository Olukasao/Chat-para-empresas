// Resumo do site (acessanet.com.br) para a aba Marketing do Workspace.
// O chat consulta o site com um token próprio (sistema a sistema) e repassa só números agregados.
// O token nunca sai daqui: o Workspace fala apenas com o chat, usando o login do usuário.

const PERIODOS = new Set(["today", "7d", "30d", "90d", "custom"]);
const CACHE_MS = 30_000;
const TIMEOUT_MS = 12_000;

export function lerConfigMarketing(env = process.env) {
    const token = String(env.MARKETING_FEED_TOKEN || "").trim();
    let url = String(env.MARKETING_FEED_URL || "").trim();
    if (!url) {
        // Mesmo servidor do feed de contratações: só muda o caminho.
        try {
            url = `${new URL(String(env.CONTRATACOES_FEED_URL || "")).origin}/api/integracoes/marketing/resumo`;
        } catch {
            url = "";
        }
    }
    return { url, token };
}

export class ErroMarketing extends Error {
    constructor(status, mensagem) {
        super(mensagem);
        this.status = status;
    }
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;

export function validarConsulta(query = {}) {
    const periodo = String(query.periodo || query.period || "30d");
    if (!PERIODOS.has(periodo)) throw new ErroMarketing(400, "Período inválido.");
    const consulta = { period: periodo };
    if (periodo === "custom") {
        const de = String(query.de || query.from || "");
        const ate = String(query.ate || query.to || "");
        if (!DATA.test(de) || !DATA.test(ate)) throw new ErroMarketing(400, "Informe as datas no formato AAAA-MM-DD.");
        consulta.from = `${de}T00:00:00-03:00`;
        // O fim é exclusivo no site: soma um dia para incluir a data final escolhida.
        consulta.to = new Date(new Date(`${ate}T00:00:00-03:00`).getTime() + 86_400_000).toISOString();
    }
    return consulta;
}

export function criarServicoMarketing({ env = process.env, fetchImpl = globalThis.fetch, agora = () => Date.now() } = {}) {
    const cache = new Map();

    return {
        configurado: () => {
            const { url, token } = lerConfigMarketing(env);
            return Boolean(url && token);
        },
        async resumo(query) {
            const { url, token } = lerConfigMarketing(env);
            if (!url || !token) throw new ErroMarketing(503, "A integração com os dados do site ainda não foi configurada.");
            const consulta = validarConsulta(query);
            const chave = JSON.stringify(consulta);
            const guardado = cache.get(chave);
            if (guardado && agora() - guardado.em < CACHE_MS) return { ...guardado.dados, emCache: true };

            const alvo = new URL(url);
            for (const [k, v] of Object.entries(consulta)) alvo.searchParams.set(k, v);
            let resposta;
            try {
                resposta = await fetchImpl(alvo, {
                    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
                    signal: AbortSignal.timeout(TIMEOUT_MS),
                    redirect: "error"
                });
            } catch {
                throw new ErroMarketing(502, "O site não respondeu. Tente novamente em instantes.");
            }
            if (resposta.status === 401) throw new ErroMarketing(502, "O site recusou o acesso: confira o token da integração.");
            if (!resposta.ok) throw new ErroMarketing(502, "O site não conseguiu gerar o resumo agora.");
            const dados = await resposta.json();
            cache.set(chave, { em: agora(), dados });
            if (cache.size > 40) cache.clear();
            return { ...dados, emCache: false };
        }
    };
}
