// Limite de tentativas de login em memória: por IP e por e-mail, com bloqueio progressivo (backoff).
// Zera ao reiniciar o processo (aceitável: protege contra força bruta online, não é trilha de auditoria).

const MINUTO = 60 * 1000;

export const criarLimitadorLogin = ({
    maxPorIp = Number(process.env.LOGIN_MAX_POR_IP) || 30,
    maxPorEmail = Number(process.env.LOGIN_MAX_POR_EMAIL) || 10,
    janelaMs = (Number(process.env.LOGIN_JANELA_MIN) || 15) * MINUTO,
    bloqueioBaseMs = (Number(process.env.LOGIN_BLOQUEIO_MIN) || 1) * MINUTO,
    bloqueioMaxMs = 60 * MINUTO,
    maxEntradas = 20000,
    agora = () => Date.now(),
} = {}) => {
    const mapas = { ip: new Map(), email: new Map() };
    const limites = { ip: maxPorIp, email: maxPorEmail };

    const estado = (tipo, chave) => {
        const mapa = mapas[tipo];
        const t = agora();
        let e = mapa.get(chave);
        if (e && t - e.inicio > janelaMs && t >= e.bloqueadoAte) {
            // Janela expirou. Mantém a contagem de bloqueios por mais uma janela para o backoff valer em reincidentes.
            if (t - e.inicio > janelaMs * 2) e = null;
            else e = { ...e, tentativas: 0, inicio: t };
            if (e) mapa.set(chave, e); else mapa.delete(chave);
        }
        if (!e) {
            if (mapa.size >= maxEntradas) mapa.delete(mapa.keys().next().value);
            e = { tentativas: 0, inicio: t, bloqueadoAte: 0, bloqueios: 0 };
            mapa.set(chave, e);
        }
        return e;
    };

    const normalizarEmail = (email) => String(email || "").trim().toLowerCase().slice(0, 254);

    // Antes de consultar senha. Devolve { permitido, tentarEmSeg }.
    const verificar = ({ ip, email }) => {
        const t = agora();
        const chaves = [["ip", String(ip || "desconhecido")], ["email", normalizarEmail(email)]];
        let espera = 0;
        for (const [tipo, chave] of chaves) {
            if (!chave) continue;
            const e = estado(tipo, chave);
            if (e.bloqueadoAte > t) espera = Math.max(espera, e.bloqueadoAte - t);
        }
        return { permitido: espera <= 0, tentarEmSeg: Math.ceil(espera / 1000) };
    };

    // Chamar a cada tentativa que falhou.
    const registrarFalha = ({ ip, email }) => {
        const t = agora();
        for (const [tipo, chave] of [["ip", String(ip || "desconhecido")], ["email", normalizarEmail(email)]]) {
            if (!chave) continue;
            const e = estado(tipo, chave);
            e.tentativas += 1;
            if (e.tentativas >= limites[tipo]) {
                e.bloqueios += 1;
                // 1 min, 2, 4, 8... até 60 min.
                e.bloqueadoAte = t + Math.min(bloqueioBaseMs * 2 ** (e.bloqueios - 1), bloqueioMaxMs);
                e.tentativas = 0;
                e.inicio = t;
            }
        }
    };

    // Login bem-sucedido limpa só o contador do e-mail (o do IP continua, para não virar bypass com conta própria).
    const registrarSucesso = ({ email }) => {
        mapas.email.delete(normalizarEmail(email));
    };

    return { verificar, registrarFalha, registrarSucesso, _mapas: mapas };
};
