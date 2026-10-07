const normalizarTexto = (valor = '') => (
  String(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
);

const regrasIconesGrupo = [
  { icone: '🎨', termos: ['marketing', 'redes sociais', 'social', 'design'] },
  { icone: '🛰️', termos: ['noc', 'monitoramento', 'rede', 'redes'] },
  { icone: '🎧', termos: ['atendimento', 'sac', 'cliente'] },
  { icone: '🛠️', termos: ['suporte', 'tecnico', 'tecnica', 'manutencao'] },
  { icone: '💼', termos: ['comercial', 'venda', 'vendas'] },
  { icone: '💰', termos: ['financeiro', 'cobranca', 'faturamento'] },
  { icone: '🤝', termos: ['rh', 'recursos humanos', 'pessoas'] },
  { icone: '🗂️', termos: ['administrativo', 'adm', 'administracao'] },
  { icone: '🧭', termos: ['gerencia', 'gestao', 'diretoria', 'lideranca'] },
  { icone: '📢', termos: ['informacoes', 'informacao', 'avisos', 'comunicados'] },
  { icone: '☎️', termos: ['ligacoes', 'ligacao', 'telefone', 'telefonia', 'call'] },
  { icone: '💻', termos: ['ti', 'tecnologia', 'sistemas'] },
  { icone: '🧰', termos: ['instalacao', 'instalacoes', 'instalador'] },
];

export const obterIconeGrupo = (grupo = {}) => {
  const texto = normalizarTexto([
    grupo.nome,
    grupo.setor_nome,
    grupo.descricao,
  ].filter(Boolean).join(' '));

  const regra = regrasIconesGrupo.find(({ termos }) => (
    termos.some((termo) => texto.includes(termo))
  ));

  return regra?.icone || '👥';
};
