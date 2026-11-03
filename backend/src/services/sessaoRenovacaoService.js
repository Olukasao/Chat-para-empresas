// Renovação silenciosa do login: o app troca um token ainda válido por um novo, antes de vencer, e a pessoa não é
// deslogada no meio do trabalho. Para uma chave roubada não valer para sempre, a sessão tem um limite absoluto
// (padrão 30 dias desde o login de verdade): depois disso é preciso entrar de novo.
export const SESSAO_MAX_DIAS_PADRAO = 30;

export const maximoDeDias = (env = process.env) => {
    const n = Number(env.SESSAO_MAX_DIAS);
    return Number.isFinite(n) && n >= 1 ? Math.min(365, Math.floor(n)) : SESSAO_MAX_DIAS_PADRAO;
};

/** Início da sessão contínua, em segundos: o do login original, que se mantém a cada renovação. */
export const inicioDaSessao = (payload = {}) => {
    const n = Number(payload.sessao_inicio ?? payload.iat);
    return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Pode renovar enquanto a sessão contínua não passou do limite. */
export const podeRenovar = (payload = {}, agoraSeg = Math.floor(Date.now() / 1000), maxDias = SESSAO_MAX_DIAS_PADRAO) => {
    const inicio = inicioDaSessao(payload);
    return inicio > 0 && agoraSeg - inicio < maxDias * 86400;
};

/** Dados do novo token: vêm do cadastro atual (cargo e setor podem ter mudado) e levam junto o início da sessão. */
export const montarPayloadRenovado = (usuario = {}, payloadAtual = {}) => ({
    id: usuario.id,
    nome: usuario.nome,
    empresa_id: usuario.empresa_id,
    setor_id: usuario.setor_id,
    perfil: usuario.perfil,
    sessao_inicio: inicioDaSessao(payloadAtual),
});
