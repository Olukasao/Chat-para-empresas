// Volume dos efeitos sonoros remotos, em PORCENTAGEM (0 a 200). Até 100% é o volume normal do aparelho;
// acima de 100% o app de quem recebe amplifica o som (com limitador, para não estourar o alto-falante).
export const VOLUME_PADRAO_PERCENT = 60;
export const VOLUME_PADRAO_USUARIO_PERCENT = 70; // teto de quem não recebeu um limite maior
export const VOLUME_ABSOLUTO_PERCENT = 200; // ninguém passa disso, qualquer que seja a permissão

/** Número inteiro de 0 ao teto absoluto; valor inválido vira o padrão do usuário. */
export const limitarVolumePercent = (valor, padrao = VOLUME_PADRAO_USUARIO_PERCENT) => {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return padrao;
    return Math.max(0, Math.min(VOLUME_ABSOLUTO_PERCENT, Math.round(numero)));
};

/**
 * Volume pedido pelo disparo, já limitado pelo teto de quem dispara.
 * `volume_percent` (0–200) é o campo novo; `volume` é o antigo (fração de 0 a 1, ou porcentagem se maior que 1).
 */
export const resolverVolumePercent = (dados = {}, maximoPercent = VOLUME_PADRAO_USUARIO_PERCENT) => {
    const teto = limitarVolumePercent(maximoPercent);
    const novo = Number(dados.volume_percent);
    let pedido;
    if (dados.volume_percent !== undefined && dados.volume_percent !== null && dados.volume_percent !== "" && Number.isFinite(novo)) {
        pedido = novo;
    } else {
        const antigo = Number(dados.volume);
        pedido = Number.isFinite(antigo) && dados.volume !== null && dados.volume !== "" ? (antigo > 1 ? antigo : antigo * 100) : VOLUME_PADRAO_PERCENT;
    }
    return Math.max(0, Math.min(teto, Math.round(pedido)));
};
