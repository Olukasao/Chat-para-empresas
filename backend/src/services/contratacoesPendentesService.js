// Contratações pendentes do site (acessanet.com.br). O site fica na internet e o chat na
// rede local, então o chat é quem consulta: a cada POLL_MS pede o feed ao site com um token
// próprio e repassa por socket para quem está logado (sala "contratacoes").
//
// - contratacoes:resumo -> { conectado, pendentes, itens } sempre que algo muda
// - contratacoes:novo   -> { itens } só quando chega pedido novo (id maior que o já visto)
//
// Pedidos que já estavam pendentes quando o chat subiu entram só no contador, sem aviso.

// Lidos ao iniciar (não no import): o server.js carrega o .env depois que os imports rodam.
const lerConfig = () => ({
    FEED_URL: (process.env.CONTRATACOES_FEED_URL
        || "https://acessanet.com.br/api/integracoes/contratacoes/pendentes").trim(),
    FEED_TOKEN: (process.env.CONTRATACOES_FEED_TOKEN || "").trim(),
    POLL_MS: Math.max(15_000, Number(process.env.CONTRATACOES_POLL_MS || 30_000)),
});
const TIMEOUT_MS = 10_000;

export const SALA_CONTRATACOES = "contratacoes";
const EVENTO_RESUMO = "contratacoes:resumo";
const EVENTO_NOVO = "contratacoes:novo";

const texto = (valor, limite = 80) => String(valor || "").trim().slice(0, limite);

export function normalizarFeed(payload = {}) {
    const itens = (Array.isArray(payload.items) ? payload.items : [])
        .map((item) => ({
            id: Number(item?.id),
            protocolo: texto(item?.protocol, 40),
            cliente: texto(item?.customerName),
            plano: texto(item?.planName),
            cidade: texto(item?.city, 60),
            criadoEm: texto(item?.createdAt, 40),
        }))
        .filter((item) => Number.isInteger(item.id) && item.id > 0)
        .sort((a, b) => b.id - a.id);
    const pendentes = Number.isInteger(Number(payload.pendingCount)) ? Number(payload.pendingCount) : itens.length;
    return { pendentes: Math.max(0, pendentes), itens };
}

/** Pedidos mais novos que o último id visto; `ultimoVisto` null = primeira leitura (nada é "novo"). */
export function selecionarNovos(itens, ultimoVisto) {
    if (ultimoVisto === null) return [];
    return itens.filter((item) => item.id > ultimoVisto);
}

let estado = { conectado: false, pendentes: 0, itens: [], atualizadoEm: null };

export function obterResumoContratacoes() {
    return { ...estado };
}

export function iniciarContratacoesPendentes(io, { buscar = fetch } = {}) {
    const { FEED_URL, FEED_TOKEN, POLL_MS } = lerConfig();
    if (!FEED_TOKEN) {
        console.warn("Contratações: CONTRATACOES_FEED_TOKEN não configurado; aviso de contratações desligado.");
        return () => {};
    }

    let ultimoVisto = null;
    let assinatura = "";
    let parado = false;
    let timer;

    const publicar = () => {
        const { atualizadoEm: _ignorado, ...semRelogio } = estado;
        const nova = JSON.stringify(semRelogio);
        if (nova === assinatura) return;
        assinatura = nova;
        io.to(SALA_CONTRATACOES).emit(EVENTO_RESUMO, obterResumoContratacoes());
    };

    const consultar = async () => {
        try {
            const resposta = await buscar(FEED_URL, {
                headers: { Authorization: `Bearer ${FEED_TOKEN}`, Accept: "application/json" },
                signal: AbortSignal.timeout(TIMEOUT_MS),
            });
            if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
            const { pendentes, itens } = normalizarFeed(await resposta.json());

            const novos = selecionarNovos(itens, ultimoVisto);
            const maiorId = itens.reduce((max, item) => Math.max(max, item.id), 0);
            ultimoVisto = Math.max(ultimoVisto ?? 0, maiorId);

            estado = { conectado: true, pendentes, itens, atualizadoEm: new Date().toISOString() };
            publicar();
            if (novos.length) io.to(SALA_CONTRATACOES).emit(EVENTO_NOVO, { itens: novos });
        } catch (err) {
            if (estado.conectado) console.error("Contratações: site indisponível:", err.message);
            estado = { ...estado, conectado: false };
            publicar();
        }
    };

    const ciclo = async () => {
        await consultar();
        if (!parado) timer = setTimeout(ciclo, POLL_MS);
    };
    ciclo();

    return () => {
        parado = true;
        clearTimeout(timer);
    };
}
