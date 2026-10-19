import { io as conectarSocket } from "socket.io-client";

// Situação atual da Agenda de Técnicos (app separado, porta 8500) para o card
// da home. O backend do chat assina o socket da agenda como mais um cliente,
// resume as OS do dia e repassa para o chat. Os navegadores não precisam
// confiar no certificado da agenda e nada de cliente (nome, endereço) sai daqui.

const AGENDA_TECNICOS_URL = (process.env.AGENDA_TECNICOS_URL || "https://127.0.0.1:8500").replace(/\/+$/, "");
const AGENDA_TECNICOS_POLL_MS = Math.max(15_000, Number(process.env.AGENDA_TECNICOS_POLL_MS || 60_000));
const EVENTO_RESUMO = "agenda-tecnicos:resumo";

export function dataHojeSaoPaulo(agora = new Date()) {
    return agora.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

export function classificarStatus(ordem = {}) {
    const status = String(ordem.status || "").toLowerCase();
    if (ordem.data_finalizado || /encerr|finaliz|conclu/.test(status)) return "encerrada";
    if (/execu|andamento|deslocamento/.test(status)) return "execucao";
    return "aberta";
}

const horaCurta = hora => String(hora || "").slice(0, 5);
const texto = (valor, limite = 60) => String(valor || "").trim().slice(0, limite);

function resumirOrdem(ordem) {
    return {
        hora: horaCurta(ordem.hora),
        motivo: texto(ordem.motivo),
        bairro: texto(ordem.bairro),
    };
}

export function resumirAgenda(ordens = [], { data = dataHojeSaoPaulo(), atualizadoEm = new Date() } = {}) {
    const totais = { total: 0, abertas: 0, execucao: 0, encerradas: 0 };
    const porTecnico = new Map();

    for (const ordem of Array.isArray(ordens) ? ordens : []) {
        const nome = texto(ordem.tecnico, 40);
        if (!nome) continue;

        const status = classificarStatus(ordem);
        totais.total += 1;
        totais[status === "aberta" ? "abertas" : status === "execucao" ? "execucao" : "encerradas"] += 1;

        if (!porTecnico.has(nome)) {
            porTecnico.set(nome, { nome, turno: texto(ordem.turnoHorario, 30), ordens: [] });
        }
        porTecnico.get(nome).ordens.push({ ...resumirOrdem(ordem), status });
    }

    const tecnicos = [...porTecnico.values()].map((tecnico) => {
        const ordensDoDia = tecnico.ordens.sort((a, b) => a.hora.localeCompare(b.hora));
        const emExecucao = ordensDoDia.filter(ordem => ordem.status === "execucao");
        const abertas = ordensDoDia.filter(ordem => ordem.status === "aberta");
        const encerradas = ordensDoDia.length - emExecucao.length - abertas.length;
        const atual = emExecucao.at(-1) || null;

        return {
            nome: tecnico.nome,
            turno: tecnico.turno,
            situacao: atual ? "atendimento" : abertas.length ? "aguardando" : "concluido",
            atual: atual && { hora: atual.hora, motivo: atual.motivo, bairro: atual.bairro },
            proxima: abertas[0] ? { hora: abertas[0].hora, motivo: abertas[0].motivo, bairro: abertas[0].bairro } : null,
            total: ordensDoDia.length,
            encerradas,
            // o dia do técnico, na ordem do horário
            ordens: ordensDoDia,
        };
    });

    // Em atendimento primeiro, depois quem tem mais OS pendentes.
    const peso = { atendimento: 0, aguardando: 1, concluido: 2 };
    tecnicos.sort((a, b) => peso[a.situacao] - peso[b.situacao]
        || (b.total - b.encerradas) - (a.total - a.encerradas)
        || a.nome.localeCompare(b.nome, "pt-BR"));

    return { data, atualizadoEm: atualizadoEm.toISOString(), totais, tecnicos };
}

let estado = {
    conectado: false,
    erro: null,
    resumo: null,
    verificadoEm: null,
};

export function obterResumoAgendaTecnicos() {
    return {
        conectado: estado.conectado,
        erro: estado.erro,
        verificadoEm: estado.verificadoEm,
        ...(estado.resumo || { data: dataHojeSaoPaulo(), atualizadoEm: null, totais: null, tecnicos: [] }),
    };
}

export function iniciarAgendaTecnicosResumo(io) {
    const socket = conectarSocket(AGENDA_TECNICOS_URL, {
        transports: ["websocket"],
        // a agenda usa certificado próprio; a conexão é servidor a servidor
        rejectUnauthorized: false,
        reconnectionDelayMax: 30_000,
    });

    let assinatura = "";
    const publicar = () => {
        const resumo = obterResumoAgendaTecnicos();
        const { verificadoEm: _ignorado, ...semRelogio } = resumo;
        const novaAssinatura = JSON.stringify(semRelogio);
        if (novaAssinatura === assinatura) return;
        assinatura = novaAssinatura;
        io.emit(EVENTO_RESUMO, resumo);
    };

    const pedirAgenda = () => {
        if (socket.connected) socket.emit("filtrarData", dataHojeSaoPaulo());
    };

    const aoReceberAgenda = (ordens) => {
        estado = {
            ...estado,
            erro: null,
            resumo: resumirAgenda(ordens),
            verificadoEm: new Date().toISOString(),
        };
        publicar();
    };

    socket.on("connect", () => {
        estado = { ...estado, conectado: true, erro: null };
        pedirAgenda();
        publicar();
    });
    socket.on("disconnect", () => {
        estado = { ...estado, conectado: false };
        publicar();
    });
    socket.on("connect_error", (err) => {
        estado = { ...estado, conectado: false, erro: "Agenda de técnicos indisponível." };
        console.error("Agenda técnicos: falha ao conectar:", err.message);
        publicar();
    });
    socket.on("agenda", aoReceberAgenda);
    socket.on("agendaAtualizada", aoReceberAgenda);
    socket.on("agendaSemAlteracao", () => {
        estado = { ...estado, verificadoEm: new Date().toISOString() };
    });
    socket.on("agendaErro", (payload = {}) => {
        estado = { ...estado, erro: texto(payload.erro, 120) || "Não foi possível atualizar a agenda." };
        publicar();
    });

    const intervalo = setInterval(pedirAgenda, AGENDA_TECNICOS_POLL_MS);
    intervalo.unref?.();

    return () => {
        clearInterval(intervalo);
        socket.close();
    };
}
