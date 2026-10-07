export const chamadosLinks = {
  'Super Técnico 97': 'https://acessanet.sgp.net.br/admin/atendimento/relatorios/ocorrencia/?status=0&tipo=10000',
  'Suporte Técnico': 'https://acessanet.sgp.net.br/admin/atendimento/relatorios/ocorrencia/?status=0&tipo=10000',
  N1: 'https://acessanet.sgp.net.br/admin/atendimento/relatorios/ocorrencia/?status=0&tipo=2322',
  N2: 'https://acessanet.sgp.net.br/admin/atendimento/relatorios/ocorrencia/?status=0&tipo=2314',
  N3: 'https://acessanet.sgp.net.br/admin/atendimento/relatorios/ocorrencia/?status=0&tipo=2315',
  Regular: 'https://acessanet.sgp.net.br/admin/atendimento/relatorios/ocorrencia/?status=0&tipo=2323',
  ALTA: 'https://acessanet.sgp.net.br/admin/atendimento/relatorios/ocorrencia/?status=0&tipo=2324',
  Alta: 'https://acessanet.sgp.net.br/admin/atendimento/relatorios/ocorrencia/?status=0&tipo=2324',
  Roteador: 'https://acessanet.sgp.net.br/admin/atendimento/relatorios/ocorrencia/?status=0&tipo=1923',
  Atenuação: 'https://acessanet.sgp.net.br/admin/atendimento/relatorios/ocorrencia/?status=0&tipo=1922',
  Atenuacao: 'https://acessanet.sgp.net.br/admin/atendimento/relatorios/ocorrencia/?status=0&tipo=1922',
  Instalação: 'https://acessanet.sgp.net.br/admin/atendimento/relatorios/ocorrencia/?status=0&tipo=14',
  Instalacao: 'https://acessanet.sgp.net.br/admin/atendimento/relatorios/ocorrencia/?status=0&tipo=14',
  'RETIRADA DE EQUIPAMENTO': 'https://acessanet.sgp.net.br/admin/atendimento/relatorios/ocorrencia/?status=0&tipo=2034',
  'Retirada de Equipamento': 'https://acessanet.sgp.net.br/admin/atendimento/relatorios/ocorrencia/?status=0&tipo=2034',
  'RETIRADA DE EQUIPAMENTO - SUSPENSOS': 'https://acessanet.sgp.net.br/admin/atendimento/relatorios/ocorrencia/?status=0&tipo=2130',
  'Retirada de Equipamento - Suspensos': 'https://acessanet.sgp.net.br/admin/atendimento/relatorios/ocorrencia/?status=0&tipo=2130',
  'Retirada de Equipamento Suspensos': 'https://acessanet.sgp.net.br/admin/atendimento/relatorios/ocorrencia/?status=0&tipo=2130',
  'Mudança de Endereço': 'https://acessanet.sgp.net.br/admin/atendimento/relatorios/ocorrencia/?status=0&tipo=1928',
  'Mudanca de Endereco': 'https://acessanet.sgp.net.br/admin/atendimento/relatorios/ocorrencia/?status=0&tipo=1928',
  'Mudança de Ponto interno': 'https://acessanet.sgp.net.br/admin/atendimento/relatorios/ocorrencia/?status=0&tipo=1925',
  'Mudanca de Ponto interno': 'https://acessanet.sgp.net.br/admin/atendimento/relatorios/ocorrencia/?status=0&tipo=1925',
};

const normalizarDescricaoChamado = (valor = '') => (
  String(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
);

const chamadosLinksNormalizados = Object.entries(chamadosLinks).reduce((links, [label, url]) => {
  links[normalizarDescricaoChamado(label)] = url;
  return links;
}, {});

export const obterChamadoLink = (label) => chamadosLinksNormalizados[normalizarDescricaoChamado(label)] || '';
