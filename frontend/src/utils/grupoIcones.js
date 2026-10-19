import { createElement } from 'react';
import {
  Briefcase,
  Compass,
  FolderKanban,
  Handshake,
  Hammer,
  Headphones,
  Laptop,
  Lock,
  Megaphone,
  Palette,
  Phone,
  Satellite,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';

const normalizarTexto = (valor = '') => (
  String(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
);

const regrasIconesGrupo = [
  { icone: '🎨', Icone: Palette, termos: ['marketing', 'redes sociais', 'social', 'design'] },
  { icone: '🛰️', Icone: Satellite, termos: ['noc', 'monitoramento', 'rede', 'redes'] },
  { icone: '🎧', Icone: Headphones, termos: ['atendimento', 'sac', 'cliente'] },
  { icone: '🛠️', Icone: Wrench, termos: ['suporte', 'tecnico', 'tecnica', 'manutencao'] },
  { icone: '💼', Icone: Briefcase, termos: ['comercial', 'venda', 'vendas'] },
  { icone: '💰', Icone: Wallet, termos: ['financeiro', 'cobranca', 'faturamento'] },
  { icone: '🤝', Icone: Handshake, termos: ['rh', 'recursos humanos', 'pessoas'] },
  { icone: '🗂️', Icone: FolderKanban, termos: ['administrativo', 'adm', 'administracao'] },
  { icone: '🧭', Icone: Compass, termos: ['gerencia', 'gestao', 'diretoria', 'lideranca'] },
  { icone: '📢', Icone: Megaphone, termos: ['informacoes', 'informacao', 'avisos', 'comunicados'] },
  { icone: '☎️', Icone: Phone, termos: ['ligacoes', 'ligacao', 'telefone', 'telefonia', 'call'] },
  { icone: '💻', Icone: Laptop, termos: ['ti', 'tecnologia', 'sistemas'] },
  { icone: '🧰', Icone: Hammer, termos: ['instalacao', 'instalacoes', 'instalador'] },
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

// Mesmo mapeamento, em ícones Lucide (o emoji acima continua disponível).
const obterComponenteIconeGrupo = (grupo = {}, { bloqueado = false } = {}) => {
  if (bloqueado) return Lock;

  const texto = normalizarTexto([
    grupo.nome,
    grupo.setor_nome,
    grupo.descricao,
  ].filter(Boolean).join(' '));

  const regra = regrasIconesGrupo.find(({ termos }) => (
    termos.some((termo) => texto.includes(termo))
  ));

  return regra?.Icone || Users;
};

export const renderIconeGrupo = (grupo = {}, { bloqueado = false, size = 20 } = {}) => (
  createElement(obterComponenteIconeGrupo(grupo, { bloqueado }), { size, strokeWidth: 1.8, 'aria-hidden': true })
);
