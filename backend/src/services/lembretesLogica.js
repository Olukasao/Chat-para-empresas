// Regras dos Lembretes: normalização, próxima ocorrência e descrição em português. Funções puras (sem banco nem relógio).
// Datas e horas são sempre de Brasília, em texto "AAAA-MM-DD HH:mm:ss".

export const TIPOS = ["unico", "diario", "semanal", "mensal"];
export const MAX_HORARIOS = 8;
const NOMES_DIA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const NOMES_DIA_PLURAL = ["domingos", "segundas", "terças", "quartas", "quintas", "sextas", "sábados"];

const dois = (n) => String(n).padStart(2, "0");
const erro = (mensagem) => Object.assign(new Error(mensagem), { status: 400 });

/** "9h", "9:5", "09:00", "21h30" -> "HH:mm" (ou null). */
export function normalizarHorario(valor) {
    const m = /^\s*(\d{1,2})\s*(?:[:h]\s*(\d{1,2})?)?\s*$/i.exec(String(valor ?? ""));
    if (!m) return null;
    const h = Number(m[1]), min = m[2] === undefined ? 0 : Number(m[2]);
    if (h > 23 || min > 59) return null;
    return `${dois(h)}:${dois(min)}`;
}

const listaNumeros = (valor, min, max) => [...new Set((Array.isArray(valor) ? valor : String(valor ?? "").split(","))
    .map((x) => (String(x).trim() === "" ? NaN : Number(x))).filter((n) => Number.isInteger(n) && n >= min && n <= max))].sort((a, b) => a - b);

const dataValida = (texto) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(texto ?? ""));
    if (!m) return null;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? texto : null;
};

/** Valida e limpa uma regra vinda da IA ou da tela. Lança erro com mensagem clara para a pessoa. */
export function normalizarRegra(entrada) {
    const texto = String(entrada?.texto ?? "").trim().replace(/\s+/g, " ").slice(0, 300);
    if (!texto) throw erro("Escreva a mensagem do lembrete.");
    const tipo = TIPOS.includes(entrada?.tipo) ? entrada.tipo : null;
    if (!tipo) throw erro("Escolha com que frequência o lembrete deve tocar.");
    const horarios = [...new Set((Array.isArray(entrada?.horarios) ? entrada.horarios : String(entrada?.horarios ?? "").split(","))
        .map(normalizarHorario).filter(Boolean))].sort();
    if (!horarios.length) throw erro("Informe pelo menos um horário.");
    if (horarios.length > MAX_HORARIOS) throw erro(`Use no máximo ${MAX_HORARIOS} horários por lembrete.`);
    const regra = { texto, tipo, horarios, dias_semana: [], dia_mes: null, data: null, avisar_chat: entrada?.avisar_chat === false || entrada?.avisar_chat === 0 ? 0 : 1 };
    if (tipo === "semanal") {
        regra.dias_semana = listaNumeros(entrada?.dias_semana, 0, 6);
        if (!regra.dias_semana.length) throw erro("Escolha pelo menos um dia da semana.");
    } else if (tipo === "mensal") {
        const dia = Number(entrada?.dia_mes);
        if (!Number.isInteger(dia) || dia < 1 || dia > 31) throw erro("Informe o dia do mês (de 1 a 31).");
        regra.dia_mes = dia;
    } else if (tipo === "unico") {
        regra.data = dataValida(entrada?.data);
        if (!regra.data) throw erro("Informe a data do lembrete.");
    }
    return regra;
}

const diasNoMes = (ano, mes) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();

function casaNoDia(regra, ano, mes, dia) {
    if (regra.tipo === "diario") return true;
    if (regra.tipo === "semanal") return regra.dias_semana.includes(new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay());
    if (regra.tipo === "mensal") return dia === Math.min(regra.dia_mes, diasNoMes(ano, mes));
    return regra.data === `${ano}-${dois(mes)}-${dois(dia)}`;
}

/** Horários (HH:mm) em que a regra toca na data "AAAA-MM-DD". */
export function horariosNoDia(regra, data) {
    const [a, m, d] = data.split("-").map(Number);
    return casaNoDia(regra, a, m, d) ? regra.horarios : [];
}

/** Próxima vez, estritamente depois de `apos`, em que a regra toca; null quando não toca mais (lembrete único já passado). */
export function proximaOcorrencia(regra, apos) {
    const [dataApos] = apos.split(" ");
    const [a, m, d] = dataApos.split("-").map(Number);
    for (let i = 0; i <= (regra.tipo === "mensal" ? 400 : 8); i += 1) {
        const dia = new Date(Date.UTC(a, m - 1, d + i));
        const ano = dia.getUTCFullYear(), mes = dia.getUTCMonth() + 1, dd = dia.getUTCDate();
        if (!casaNoDia(regra, ano, mes, dd)) continue;
        const data = `${ano}-${dois(mes)}-${dois(dd)}`;
        for (const h of regra.horarios) {
            const candidato = `${data} ${h}:00`;
            if (candidato > apos) return candidato;
        }
        if (regra.tipo === "unico") return null;
    }
    return null;
}

const juntar = (lista) => (lista.length <= 1 ? lista.join("") : `${lista.slice(0, -1).join(", ")} e ${lista[lista.length - 1]}`);

export function descreverRegra(regra) {
    const horas = juntar(regra.horarios);
    if (regra.tipo === "diario") return `Todos os dias às ${horas}`;
    if (regra.tipo === "mensal") return `Todo dia ${regra.dia_mes} do mês às ${horas}`;
    if (regra.tipo === "unico") {
        const [a, m, d] = regra.data.split("-");
        return `Uma vez, em ${d}/${m}/${a}, às ${horas}`;
    }
    const dias = regra.dias_semana;
    if (dias.length === 7) return `Todos os dias às ${horas}`;
    if (dias.join() === "1,2,3,4,5") return `De segunda a sexta às ${horas}`;
    if (dias.join() === "0,6") return `Aos fins de semana às ${horas}`;
    if (dias.length === 1) return `Toda ${NOMES_DIA[dias[0]]}${[0, 6].includes(dias[0]) ? "" : "-feira"} às ${horas}`.replace("Toda domingo", "Todo domingo").replace("Toda sábado", "Todo sábado");
    return `${juntar(dias.map((x) => NOMES_DIA_PLURAL[x]))} às ${horas}`.replace(/^./, (c) => c.toUpperCase());
}
