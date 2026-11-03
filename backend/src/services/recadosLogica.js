// Recados da agenda que são só chamados de clientes (LOS, LOBI, offline, rompimento, agendamento de cliente...) não vão para o
// Resumo de hoje: isso já está nas filas. Entram apenas os avisos sobre a equipe e a operação (técnico sem veículo, em dupla, folga...).
const CHAMADO = /\b(los|lobi)\b|offline|rompimento|rompeu|agendamento\s+de\s+cliente|cliente\s+(com|sem|em)\b|sem\s+(sinal|acesso|conex[aã]o|internet)|queda\s+de\s+(sinal|fibra|energia)|fibra\s+(rompida|cortada)|massivo|atendimento\s+de\s+cliente/i;

export const ehRecadoDeChamado = (descricao) => CHAMADO.test(String(descricao ?? ""));
export const recadosImportantes = (recados = []) => recados.filter((r) => r?.descricao && !ehRecadoDeChamado(r.descricao));
