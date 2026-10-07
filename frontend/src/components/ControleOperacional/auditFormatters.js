export const formatarDataHora = (valor) => {
  if (!valor) return "-";

  return new Date(valor).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatarHora = (valor) => {
  if (!valor) return "--:--";

  return new Date(valor).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const rotuloNivel = (nivel) => ({
  normal: "Normal",
  important: "Importante",
  critical: "Crítico",
}[nivel] || "Normal");

export const rotuloTipo = (tipo) => ({
  manutencao: "Manutenção",
  instalacao: "Instalação",
  agenda: "Agenda",
  ausencias: "Ausências",
  chat: "Chat",
  usuarios: "Usuários",
  sistema: "Sistema",
}[tipo] || "Sistema");

export const rotuloAcao = (acao = "") => String(acao || "")
  .toLowerCase()
  .replaceAll("_", " ")
  .replace(/(^|\s)\S/g, (char) => char.toUpperCase());

export const valorCurto = (valor) => {
  if (valor === null || valor === undefined || valor === "") return "-";
  if (typeof valor === "object") return JSON.stringify(valor);
  return String(valor);
};

export const extrairMudancas = (evento = {}) => {
  const anterior = evento.valor_anterior;
  const novo = evento.valor_novo;

  if (!anterior || !novo || typeof anterior !== "object" || typeof novo !== "object") {
    return [];
  }

  const chaves = [...new Set([...Object.keys(anterior), ...Object.keys(novo)])]
    .filter((chave) => JSON.stringify(anterior[chave]) !== JSON.stringify(novo[chave]));

  return chaves.slice(0, 6).map((chave) => ({
    campo: chave,
    anterior: anterior[chave],
    novo: novo[chave],
  }));
};

export const descreverEvento = (evento = {}) => {
  const usuario = evento.usuario_nome || evento.origem || "Sistema";
  const entidade = evento.entidade_id ? `#${evento.entidade_id}` : evento.entidade || "";
  const acao = String(evento.acao || "");
  const novo = evento.valor_novo || {};
  const anterior = evento.valor_anterior || {};

  if (acao === "TRANSFERIR_CHAMADO" || acao === "ALTERAR_TECNICO") {
    const de = anterior.tecnico_nome || anterior.tecnico || anterior.tecnico_id || "-";
    const para = novo.tecnico_nome || novo.tecnico || novo.tecnico_id || "-";
    return `${usuario} transferiu ${entidade} de ${de} para ${para}.`;
  }

  if (acao === "REAGENDAR_CHAMADO" || acao === "ALTERAR_HORARIO") {
    const de = anterior.horario || anterior.hora || anterior.data_hora || "-";
    const para = novo.horario || novo.hora || novo.data_hora || "-";
    return `${usuario} alterou o horário de ${entidade}: ${de} para ${para}.`;
  }

  if (acao === "ENVIAR_MENSAGEM") {
    return `${usuario} enviou uma mensagem no chat.`;
  }

  if (acao === "REMOVER_MENSAGEM") {
    return `${usuario} removeu uma mensagem.`;
  }

  return `${usuario} executou ${rotuloAcao(acao)} ${entidade}`.trim();
};
