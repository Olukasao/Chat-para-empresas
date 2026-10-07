import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  CircleHelp,
  Code2,
  GraduationCap,
  Headset,
  Network,
  PlayCircle,
  ShieldCheck,
  ShoppingBag,
  Search,
  Sparkles,
  Star,
  Target,
  Clock,
  Plus,
  Pencil,
  Save,
  TrendingUp,
  Users,
  X,
  Zap,
  ArrowLeft,
} from 'lucide-react';
import api from '../services/api';
import WikiCoursePage from '../components/WikiCourse/WikiCoursePage';
import { findWikiCourseBySlug, normalizeWikiCourseSlug } from '../data/wikiCourses';
import { useInternalBack } from '../utils/internalNavigation';
import { PERFIL_ADMIN } from '../utils/perfis';
import styles from '../styles/Wiki.module.css';

const ACESSO_EXTERNO_DISPOSITIVOS_CONTEUDO = `Acesso Externo a Dispositivos

O que verificar primeiro

Antes de informar se é possível realizar o acesso externo, precisamos entender como está montada a rede do cliente.

Perguntas que devem ser feitas:
1. O cliente possui roteador/gateway próprio no local?
2. Qual é a marca e modelo desse equipamento?
3. O dispositivo que deseja acessar está ligado nesse roteador/gateway?
4. O equipamento aceita configuração PPPoE?
5. Qual dispositivo será acessado externamente: câmera, DVR/NVR, servidor, sistema interno, automação ou outro equipamento?
6. O cliente sabe qual porta ou sistema será usado para acesso?

IPv4 serve?

Sim, IPv4 serve, desde que seja um IPv4 público. O IP não precisa obrigatoriamente ser fixo. Se for um IPv4 público dinâmico, o cliente pode usar DDNS, como No-IP, DuckDNS ou serviço semelhante. Porém, se o cliente estiver em CGNAT, o redirecionamento de portas não funcionará para acesso externo direto.

O que é necessário para funcionar

Para acesso externo tradicional, normalmente é necessário roteador/gateway no local, IPv4 público, redirecionamento de portas, firewall liberado, dispositivo configurado corretamente e DDNS caso o IP seja dinâmico.

Exemplo: Internet → Roteador/Gateway do cliente → Dispositivo interno.

E se o cliente não tiver gateway?

Se o cliente não tiver um roteador/gateway próprio, não terá onde configurar NAT, redirecionamento de portas ou controle adequado da rede. Nesse caso, é necessário avaliar instalação ou configuração de um gateway, equipamento que aceite PPPoE, solução semi-dedicada, link dedicado, VPN ou solução em nuvem, dependendo do dispositivo.

Solução comercial

Caso o cliente precise de acesso externo com IP público, podemos avaliar uma solução semi-dedicada ou dedicada. Para link dedicado, o mínimo comercial é 100 Megas.

Resposta pronta para o cliente

Para verificarmos a possibilidade de acesso externo ao seu dispositivo, precisamos confirmar algumas informações sobre a sua rede.

Você possui um roteador ou gateway próprio no local? Se sim, poderia nos informar a marca e o modelo do equipamento?

Também precisamos verificar se esse equipamento aceita configuração PPPoE, pois o acesso externo depende da forma como a conexão chega até sua rede e de como o roteador trata as portas e o NAT.

Caso seja necessário IP público, podemos avaliar uma solução semi-dedicada ou dedicada. Para link dedicado, o plano mínimo é de 100 Megas.

Observação interna

Não prometer acesso externo antes de confirmar se existe gateway, marca/modelo do equipamento, se aceita PPPoE, se o cliente possui IPv4 público ou está em CGNAT, qual dispositivo será acessado e se será necessário semi-dedicado ou dedicado.`;

const CATEGORIAS_WIKI = [
  {
    id: 'noc',
    titulo: 'NOC',
    subtitulo: 'Monitoramento, quedas, massivos e rotinas operacionais.',
    icone: Network,
    cor: 'blue',
    cursos: [
      {
        id: 'redes-fibra-optica',
        titulo: 'Redes e Fibra Óptica',
        descricao: 'Fundamentos de rede, sinal óptico, diagnóstico inicial e boas práticas de campo.',
        atualizado: 'Hoje',
        destaque: true,
      },
      {
        id: 'seguranca-informacao',
        titulo: 'Segurança da Informação',
        descricao: 'Cuidados essenciais com acessos, dados sensíveis, senhas e rotinas internas.',
        atualizado: 'Hoje',
      },
      {
        id: 'rotina-monitoramento',
        titulo: 'Rotina de monitoramento',
        descricao: 'Checklist inicial para início de turno no NOC.',
        atualizado: 'Ontem',
      },
    ],
  },
  {
    id: 'vendas',
    titulo: 'Vendas',
    subtitulo: 'Planos, abordagem comercial, promoções e dúvidas frequentes.',
    icone: ShoppingBag,
    cor: 'green',
    cursos: [
      {
        id: 'tecnicas-vendas',
        titulo: 'Técnicas de Vendas',
        descricao: 'Abordagens comerciais, perguntas certas e estratégias para melhorar conversão.',
        atualizado: 'Hoje',
        destaque: true,
      },
      {
        id: 'atendimento-cliente',
        titulo: 'Atendimento ao Cliente',
        descricao: 'Postura, escuta ativa e condução de atendimentos com clareza e empatia.',
        atualizado: 'Esta semana',
      },
      {
        id: 'promocoes',
        titulo: 'Promoções ativas',
        descricao: 'Lista de campanhas atuais e regras comerciais.',
        atualizado: 'Hoje',
      },
    ],
  },
  {
    id: 'desenvolvimento',
    titulo: 'Desenvolvimento',
    subtitulo: 'Documentação técnica, deploy, APIs, frontend e backend.',
    icone: Code2,
    cor: 'purple',
    cursos: [
      {
        id: 'comunicacao-interna',
        titulo: 'Comunicação Interna',
        descricao: 'Padrões de alinhamento, passagem de contexto e comunicação entre equipes.',
        atualizado: 'Hoje',
        destaque: true,
      },
      {
        id: 'apis',
        titulo: 'APIs do sistema',
        descricao: 'Onde ficam as URLs, tokens, variáveis .env e integrações.',
        atualizado: 'Ontem',
      },
      {
        id: 'estrutura-projeto',
        titulo: 'Estrutura do projeto',
        descricao: 'Organização de pastas, componentes, páginas e estilos.',
        atualizado: 'Esta semana',
      },
    ],
  },
  {
    id: 'suporte',
    titulo: 'Suporte Técnico',
    subtitulo: 'Atendimento, diagnóstico, chamados e procedimentos técnicos.',
    icone: Headset,
    cor: 'orange',
    cursos: [
      {
        id: 'suporte-tecnico',
        titulo: 'Suporte Técnico',
        descricao: 'Fluxo completo para triagem, diagnóstico e encaminhamento de chamados.',
        atualizado: 'Hoje',
        destaque: true,
      },
      {
        id: 'lentidao',
        titulo: 'Lentidão na conexão',
        descricao: 'Como validar sinal, equipamento, consumo e testes básicos.',
        atualizado: 'Ontem',
      },
      {
        id: 'abertura-chamado',
        titulo: 'Abertura de chamado',
        descricao: 'Padrão para registrar informações corretamente no sistema.',
        atualizado: 'Esta semana',
      },
    ],
  },
  {
    id: 'duvidas-respondidas',
    titulo: 'Dúvidas Respondidas',
    subtitulo: 'Central de dúvidas respondidas para consulta rápida da equipe. Perguntas frequentes e orientações já respondidas para facilitar o atendimento e padronizar as respostas da equipe.',
    icone: CircleHelp,
    cor: 'purple',
    cursos: [
      {
        id: 'acesso-externo-dispositivos',
        titulo: 'Acesso Externo a Dispositivos',
        descricao: 'Orientação sobre como tratar solicitações de clientes que desejam acessar dispositivos de fora da rede, como câmeras, DVR/NVR, servidores, automação ou sistemas internos.',
        atualizado: 'Hoje',
        destaque: true,
        cabecalho: 'Dúvidas Respondidas',
        conteudo: ACESSO_EXTERNO_DISPOSITIVOS_CONTEUDO,
        nivel: 'Consulta rápida',
        duracao: '15min',
        progresso: 0,
        novo: true,
      },
    ],
  },
];

const FILTROS_CURSOS = [
  { id: 'todos', label: 'Todos' },
  { id: 'em-andamento', label: 'Em andamento' },
  { id: 'concluidos', label: 'Concluídos' },
  { id: 'novos', label: 'Novos' },
  { id: 'mais-acessados', label: 'Mais acessados' },
];

const BENEFICIOS_APRENDIZADO = [
  {
    titulo: 'Conteúdo direto ao ponto',
    descricao: 'Aulas objetivas para resolver dúvidas reais da rotina, sem excesso de teoria.',
    Icone: Target,
  },
  {
    titulo: 'Aprendizado no seu ritmo',
    descricao: 'Acesse quando precisar, retome o conteúdo e avance conforme sua agenda.',
    Icone: PlayCircle,
  },
  {
    titulo: 'Evolução profissional',
    descricao: 'Fortaleça habilidades técnicas e comportamentais para crescer na operação.',
    Icone: TrendingUp,
  },
];

const METADADOS_ROTATIVOS = [
  {
    nivel: 'Iniciante',
    duracao: '1h 40min',
    progresso: 72,
    filtro: 'em-andamento',
    novo: false,
    maisAcessado: true,
    Icone: Headset,
  },
  {
    nivel: 'Intermediário',
    duracao: '2h 10min',
    progresso: 38,
    filtro: 'em-andamento',
    novo: true,
    maisAcessado: false,
    Icone: ShoppingBag,
  },
  {
    nivel: 'Avançado',
    duracao: '3h 20min',
    progresso: 100,
    filtro: 'concluidos',
    novo: false,
    maisAcessado: true,
    Icone: ShieldCheck,
  },
  {
    nivel: 'Intermediário',
    duracao: '2h 35min',
    progresso: 12,
    filtro: 'novos',
    novo: true,
    maisAcessado: false,
    Icone: Network,
  },
  {
    nivel: 'Iniciante',
    duracao: '1h 15min',
    progresso: 58,
    filtro: 'em-andamento',
    novo: false,
    maisAcessado: false,
    Icone: Users,
  },
  {
    nivel: 'Avançado',
    duracao: '4h',
    progresso: 84,
    filtro: 'mais-acessados',
    novo: false,
    maisAcessado: true,
    Icone: Code2,
  },
];

const METADADOS_POR_CURSO = {
  'atendimento-cliente': {
    nivel: 'Iniciante',
    duracao: '1h 45min',
    progresso: 72,
    filtro: 'em-andamento',
    novo: false,
    maisAcessado: true,
    Icone: Headset,
  },
  'tecnicas-vendas': {
    nivel: 'Intermediário',
    duracao: '2h 20min',
    progresso: 46,
    filtro: 'em-andamento',
    novo: true,
    maisAcessado: true,
    Icone: ShoppingBag,
  },
  'suporte-tecnico': {
    nivel: 'Intermediário',
    duracao: '2h 40min',
    progresso: 64,
    filtro: 'em-andamento',
    novo: false,
    maisAcessado: true,
    Icone: Headset,
  },
  'redes-fibra-optica': {
    nivel: 'Avançado',
    duracao: '3h 30min',
    progresso: 32,
    filtro: 'novos',
    novo: true,
    maisAcessado: false,
    Icone: Network,
  },
  'comunicacao-interna': {
    nivel: 'Iniciante',
    duracao: '1h 20min',
    progresso: 100,
    filtro: 'concluidos',
    novo: false,
    maisAcessado: false,
    Icone: Users,
  },
  'seguranca-informacao': {
    nivel: 'Avançado',
    duracao: '2h 50min',
    progresso: 18,
    filtro: 'novos',
    novo: true,
    maisAcessado: false,
    Icone: ShieldCheck,
  },
  'acesso-externo-dispositivos': {
    nivel: 'Consulta rápida',
    duracao: '15min',
    progresso: 0,
    filtro: 'novos',
    novo: true,
    maisAcessado: false,
    Icone: CircleHelp,
  },
};

const criarFormCurso = (categoriaId = 'noc') => ({
  categoriaId,
  titulo: '',
  descricao: '',
  atualizado: 'Hoje',
  destaque: false,
  cabecalho: '',
  conteudo: '',
  nivel: 'Iniciante',
  duracao: '1h',
  progresso: 0,
  novo: false,
  maisAcessado: false,
});

const criarWikiId = (valor = 'curso') => {
  const base = String(valor || 'curso')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${base || 'curso'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
};

const normalizarChaveCurso = (valor = '') => String(valor || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const limitarProgresso = (valor) => {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) return 0;

  return Math.min(100, Math.max(0, Math.round(numero)));
};

const obterMetadadosCurso = (curso, categoria, index = 0) => {
  const chaveId = normalizarChaveCurso(curso.id);
  const chaveTitulo = normalizarChaveCurso(curso.titulo);
  const base =
    METADADOS_POR_CURSO[chaveId] ||
    METADADOS_POR_CURSO[chaveTitulo] ||
    METADADOS_ROTATIVOS[index % METADADOS_ROTATIVOS.length];
  const progresso = limitarProgresso(curso.progresso ?? base.progresso);
  const novo = Boolean(curso.novo ?? base.novo);
  const maisAcessado = Boolean(curso.maisAcessado ?? curso.mais_acessado ?? base.maisAcessado);

  return {
    nivel: curso.nivel || base.nivel,
    duracao: curso.duracao || base.duracao,
    progresso,
    novo,
    maisAcessado,
    Icone: base.Icone || categoria.icone || BookOpen,
    statusLabel: progresso >= 100 ? 'Concluído' : novo ? 'Novo' : 'Em andamento',
  };
};

const contarAulasCurso = (cursoId) => {
  const cursoBase = findWikiCourseBySlug(normalizeWikiCourseSlug(cursoId));
  const total = cursoBase?.modules?.reduce(
    (sum, module) => sum + (Array.isArray(module.lessons) ? module.lessons.length : 0),
    0
  );

  return total || 1;
};

const aplicarProgressoUsuarioAoCurso = (curso, progressoCurso) => {
  const totalAulas = contarAulasCurso(curso.id || curso.titulo);
  const aulas = Array.isArray(progressoCurso?.aulas) ? progressoCurso.aulas : [];
  const aulasConcluidas = aulas.filter((aula) => aula.concluida).length;
  const progresso = totalAulas
    ? Math.round((aulasConcluidas / totalAulas) * 100)
    : 0;
  const ultimaAulaSlug = progressoCurso?.ultima_aula_chave || null;

  return {
    ...curso,
    progresso,
    ultimaAulaSlug,
    statusLabel: progresso >= 100
      ? 'Concluído'
      : ultimaAulaSlug
        ? 'Em andamento'
        : curso.novo
          ? 'Novo'
          : 'Não iniciado',
  };
};

const cursoCorrespondeFiltro = (curso, filtroAtivo) => {
  if (filtroAtivo === 'todos') return true;
  if (filtroAtivo === 'concluidos') return curso.progresso >= 100;
  if (filtroAtivo === 'em-andamento') {
    return curso.progresso < 100 && (curso.progresso > 0 || Boolean(curso.ultimaAulaSlug));
  }
  if (filtroAtivo === 'novos') return curso.novo;
  if (filtroAtivo === 'mais-acessados') return curso.maisAcessado;

  return true;
};

const calcularMinutosDuracao = (duracao = '') => {
  const texto = String(duracao).toLowerCase();
  const horas = Number(texto.match(/(\d+)\s*h/)?.[1] || 0);
  const minutos = Number(texto.match(/(\d+)\s*min/)?.[1] || 0);

  return (horas * 60) + minutos;
};

const normalizarCurso = (curso = {}, index = 0, categoriaId = 'geral') => {
  const titulo = curso.titulo || '';
  const descricao = curso.descricao || '';

  return {
    id: curso.id || `${categoriaId}-curso-${index + 1}`,
    titulo,
    descricao,
    atualizado: curso.atualizado || 'Hoje',
    destaque: Boolean(curso.destaque),
    cabecalho: curso.cabecalho || titulo,
    conteudo: curso.conteudo || descricao,
    nivel: curso.nivel || '',
    duracao: curso.duracao || '',
    progresso: curso.progresso,
    novo: curso.novo,
    maisAcessado: curso.maisAcessado ?? curso.mais_acessado,
  };
};

const normalizarCategoriasWiki = (data = {}) => {
  const categoriasRecebidas = Array.isArray(data.categorias) ? data.categorias : [];

  return CATEGORIAS_WIKI.map((categoria) => {
    const recebida = categoriasRecebidas.find((item) => item?.id === categoria.id);
    const cursosOrigem = Array.isArray(recebida?.cursos)
      ? recebida.cursos
      : Array.isArray(recebida?.artigos)
        ? recebida.artigos
        : categoria.cursos;

    return {
      ...categoria,
      cursos: cursosOrigem
        .map((curso, index) => normalizarCurso(curso, index, categoria.id))
        .filter((curso) => curso.titulo && curso.descricao),
    };
  });
};

const prepararPayloadWiki = (categorias) => ({
  categorias: categorias.map((categoria, categoriaIndex) => ({
    id: categoria.id,
    cursos: categoria.cursos.map((curso, cursoIndex) => {
      const metadados = obterMetadadosCurso(curso, categoria, (categoriaIndex * 100) + cursoIndex);

      return {
        id: curso.id,
        titulo: curso.titulo,
        descricao: curso.descricao,
        atualizado: curso.atualizado,
        destaque: Boolean(curso.destaque),
        cabecalho: curso.cabecalho || curso.titulo,
        conteudo: curso.conteudo || curso.descricao,
        nivel: curso.nivel || metadados.nivel,
        duracao: curso.duracao || metadados.duracao,
        progresso: limitarProgresso(curso.progresso ?? metadados.progresso),
        novo: Boolean(curso.novo ?? metadados.novo),
        maisAcessado: Boolean(curso.maisAcessado ?? metadados.maisAcessado),
      };
    }),
  })),
});

const atualizarCategoriasComCurso = ({
  categorias,
  modo,
  curso,
  cursoId,
  categoriaOrigemId,
  categoriaDestinoId,
}) => categorias.map((categoria) => {
  if (modo === 'editar') {
    if (categoria.id === categoriaOrigemId && categoria.id === categoriaDestinoId) {
      return {
        ...categoria,
        cursos: categoria.cursos.map((item) => (item.id === cursoId ? curso : item)),
      };
    }

    if (categoria.id === categoriaOrigemId) {
      return {
        ...categoria,
        cursos: categoria.cursos.filter((item) => item.id !== cursoId),
      };
    }

    if (categoria.id === categoriaDestinoId) {
      return {
        ...categoria,
        cursos: [curso, ...categoria.cursos],
      };
    }

    return categoria;
  }

  if (categoria.id === categoriaDestinoId) {
    return {
      ...categoria,
      cursos: [curso, ...categoria.cursos],
    };
  }

  return categoria;
});

export default function Wiki() {
  const navigate = useNavigate();
  const { cursoId, lessonSlug, courseSection, categoriaId } = useParams();
  const [busca, setBusca] = useState('');
  const [categoriaAtiva, setCategoriaAtiva] = useState('todas');
  const [filtroAtivo, setFiltroAtivo] = useState('todos');
  const [categoriasWiki, setCategoriasWiki] = useState(() => normalizarCategoriasWiki());
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [feedback, setFeedback] = useState('');
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  });
  const [atualizadoEm, setAtualizadoEm] = useState(null);
  const [atualizadoPorNome, setAtualizadoPorNome] = useState('');
  const [progressoWiki, setProgressoWiki] = useState({});
  const [modalCurso, setModalCurso] = useState({
    aberto: false,
    modo: 'adicionar',
    cursoId: null,
    categoriaOrigemId: null,
    form: criarFormCurso(),
  });

  const location = useLocation();
  const voltarPaginaInterna = useInternalBack('/chat');
  const cursosBasePath = location.pathname.startsWith('/cursos') ? '/cursos' : '/wiki';
  const token = useMemo(() => localStorage.getItem('token'), []);
  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
  }), [token]);
  const isAdmin = user?.perfil === PERFIL_ADMIN;

  useEffect(() => {
    let ativo = true;

    const carregarWiki = async () => {
      if (!token) {
        navigate('/login', { replace: true });
        return;
      }

      if (cursoId) {
        setCarregando(false);
        return;
      }

      try {
        setCarregando(true);
        setErro('');

        const [wikiRes, meRes, progressoRes] = await Promise.all([
          api.get('/wiki', { headers }),
          api.get('/me', { headers }),
          api.get('/wiki/progresso', { headers }),
        ]);

        if (!ativo) return;

        setCategoriasWiki(normalizarCategoriasWiki(wikiRes.data));
        setAtualizadoEm(wikiRes.data.atualizado_em || null);
        setAtualizadoPorNome(wikiRes.data.atualizado_por_nome || '');
        setUser(meRes.data || {});
        localStorage.setItem('user', JSON.stringify(meRes.data || {}));
        setProgressoWiki(
          Object.fromEntries(
            (progressoRes.data?.cursos || []).map((curso) => [curso.curso_id, curso])
          )
        );
      } catch (err) {
        console.error('Erro ao carregar wiki interna:', err);

        if (err.response?.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          navigate('/login', { replace: true });
          return;
        }

        if (ativo) {
          setErro(err.response?.data?.error || 'Não foi possível carregar a wiki interna.');
        }
      } finally {
        if (ativo) {
          setCarregando(false);
        }
      }
    };

    carregarWiki();

    return () => {
      ativo = false;
    };
  }, [cursoId, headers, navigate, token]);

  useEffect(() => {
    if (cursoId) return;

    if (!categoriaId) {
      setCategoriaAtiva('todas');
      return;
    }

    if (categoriaId) {
      const categoriaExiste = categoriasWiki.some((categoria) => categoria.id === categoriaId);

      if (categoriaExiste) {
        setCategoriaAtiva(categoriaId);
        setFiltroAtivo('todos');
        setBusca('');
      }
    }
  }, [categoriaId, categoriasWiki, cursoId]);

  useEffect(() => {
    if (cursoId) return;

    const hash = (location.hash || '').replace(/^#/, '');
    if (!hash) return;

    const categoriaDoCurso = categoriasWiki.find((categoria) =>
      categoria.cursos.some((curso) => curso.id === hash)
    );

    if (categoriaDoCurso) {
      setCategoriaAtiva(categoriaDoCurso.id);
      setFiltroAtivo('todos');
    }

    const scrollTimeout = window.setTimeout(() => {
      const element = document.getElementById(hash);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 120);

    return () => {
      window.clearTimeout(scrollTimeout);
    };
  }, [location.hash, categoriasWiki, cursoId]);

  const cursosComMetadados = useMemo(() => {
    return categoriasWiki.flatMap((categoria, categoriaIndex) =>
      categoria.cursos.map((curso, cursoIndex) => {
        const metadados = obterMetadadosCurso(
          curso,
          categoria,
          (categoriaIndex * 100) + cursoIndex
        );

        const cursoComMetadados = {
          ...curso,
          ...metadados,
          categoria: categoria.titulo,
          categoriaId: categoria.id,
          categoriaSubtitulo: categoria.subtitulo,
          cor: categoria.cor,
        };

        return aplicarProgressoUsuarioAoCurso(
          cursoComMetadados,
          progressoWiki[normalizeWikiCourseSlug(curso.id || curso.titulo)]
        );
      })
    );
  }, [categoriasWiki, progressoWiki]);

  const categoriaSelecionada = useMemo(() => {
    if (categoriaAtiva === 'todas') return null;

    return categoriasWiki.find((categoria) => categoria.id === categoriaAtiva) || null;
  }, [categoriaAtiva, categoriasWiki]);

  const cursosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return cursosComMetadados.filter((curso) => {
      const correspondeBusca =
        !termo ||
        curso.titulo.toLowerCase().includes(termo) ||
        curso.descricao.toLowerCase().includes(termo) ||
        curso.cabecalho.toLowerCase().includes(termo) ||
        curso.conteudo.toLowerCase().includes(termo) ||
        curso.categoria.toLowerCase().includes(termo) ||
        curso.nivel.toLowerCase().includes(termo);

      const correspondeCategoria =
        categoriaAtiva === 'todas' || categoriaAtiva === curso.categoriaId;

      return correspondeBusca && correspondeCategoria && cursoCorrespondeFiltro(curso, filtroAtivo);
    });
  }, [busca, categoriaAtiva, cursosComMetadados, filtroAtivo]);

  const cursosDestaque = useMemo(() => {
    const destaqueBase = cursosComMetadados
      .filter((curso) => curso.destaque || curso.maisAcessado || curso.novo)
      .slice(0, 6);

    return destaqueBase.length ? destaqueBase : cursosComMetadados.slice(0, 6);
  }, [cursosComMetadados]);

  const metricasAprendizado = useMemo(() => {
    const totalCursos = cursosComMetadados.length;
    const totalMinutos = cursosComMetadados.reduce(
      (total, curso) => total + calcularMinutosDuracao(curso.duracao),
      0
    );
    const progressoGeral = totalCursos
      ? Math.round(cursosComMetadados.reduce((total, curso) => total + curso.progresso, 0) / totalCursos)
      : 0;

    return [
      {
        label: 'Cursos disponíveis',
        value: String(totalCursos).padStart(2, '0'),
        Icone: BookOpen,
      },
      {
        label: 'Horas de conteúdo',
        value: `${Math.max(1, Math.round(totalMinutos / 60))}h`,
        Icone: Clock,
      },
      {
        label: 'Progresso geral',
        value: `${progressoGeral}%`,
        Icone: BarChart3,
      },
    ];
  }, [cursosComMetadados]);

  const formCurso = modalCurso.form;

  const formatarDataAtualizacao = (data) => {
    if (!data) return 'Ainda não salvo';

    return new Date(data).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const IconeCategoriaSelecionada = categoriaSelecionada?.icone || BookOpen;

  const abrirAdicionarCurso = (categoriaId = categoriaAtiva) => {
    if (!isAdmin) {
      setErro('Seu usuário não tem permissão para editar a wiki interna.');
      return;
    }

    const categoriaSelecionada = categoriasWiki.some((categoria) => categoria.id === categoriaId)
      ? categoriaId
      : 'noc';

    setErro('');
    setFeedback('');
    setModalCurso({
      aberto: true,
      modo: 'adicionar',
      cursoId: null,
      categoriaOrigemId: null,
      form: criarFormCurso(categoriaSelecionada),
    });
  };

  const abrirEditarCurso = (categoriaId, curso) => {
    if (!isAdmin) {
      setErro('Seu usuário não tem permissão para editar a wiki interna.');
      return;
    }

    setErro('');
    setFeedback('');
    setModalCurso({
      aberto: true,
      modo: 'editar',
      cursoId: curso.id,
      categoriaOrigemId: categoriaId,
      form: {
        categoriaId,
        titulo: curso.titulo,
        descricao: curso.descricao,
        atualizado: curso.atualizado || 'Hoje',
        destaque: Boolean(curso.destaque),
        cabecalho: curso.cabecalho || curso.titulo,
        conteudo: curso.conteudo || curso.descricao,
        nivel: curso.nivel || 'Iniciante',
        duracao: curso.duracao || '1h',
        progresso: limitarProgresso(curso.progresso),
        novo: Boolean(curso.novo),
        maisAcessado: Boolean(curso.maisAcessado),
      },
    });
  };

  const fecharModal = () => {
    if (salvando) return;

    setModalCurso((atual) => ({
      ...atual,
      aberto: false,
      form: criarFormCurso(),
    }));
  };

  const alterarFormCurso = (campo, valor) => {
    setErro('');
    setFeedback('');
    setModalCurso((atual) => ({
      ...atual,
      form: {
        ...atual.form,
        [campo]: valor,
      },
    }));
  };

  const abrirDestinoCurso = (curso) => {
    navigate(`${cursosBasePath}/curso/${curso.id}`);
  };

  const selecionarCategoria = (categoriaIdSelecionada) => {
    setCategoriaAtiva(categoriaIdSelecionada);
    setFiltroAtivo('todos');

    if (categoriaIdSelecionada === 'todas') {
      navigate(cursosBasePath);
      return;
    }

    navigate(`${cursosBasePath}/${categoriaIdSelecionada}`);
  };

  const irParaCursosDisponiveis = () => {
    const section = document.getElementById('cursos-disponiveis');

    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const continuarAprendendo = () => {
    const cursoEmAndamento = cursosComMetadados.find((curso) => (
      curso.progresso < 100 && (curso.progresso > 0 || curso.ultimaAulaSlug)
    ));

    if (cursoEmAndamento) {
      if (cursoEmAndamento.ultimaAulaSlug) {
        navigate(`${cursosBasePath}/curso/${cursoEmAndamento.id}/aula/${cursoEmAndamento.ultimaAulaSlug}`);
        return;
      }

      abrirDestinoCurso(cursoEmAndamento);
      return;
    }

    irParaCursosDisponiveis();
  };

  const acionarCursoPorTeclado = (event, curso) => {
    if (event.target.closest?.('button,input,select,textarea,a')) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      abrirDestinoCurso(curso);
    }
  };

  const salvarCurso = async (event) => {
    event.preventDefault();

    if (!isAdmin) {
      setErro('Seu usuário não tem permissão para editar a wiki interna.');
      return;
    }

    const titulo = formCurso.titulo.trim();
    const descricao = formCurso.descricao.trim();
    const categoriaDestinoId = formCurso.categoriaId;
    const cabecalho = formCurso.cabecalho.trim() || titulo;
    const conteudo = formCurso.conteudo.trim();
    const progresso = limitarProgresso(formCurso.progresso);

    if (!titulo || !descricao) {
      setErro('Informe o título e a descrição do curso.');
      return;
    }

    if (!conteudo) {
      setErro('Informe o texto da página do curso.');
      return;
    }

    const curso = {
      id: modalCurso.modo === 'editar' ? modalCurso.cursoId : criarWikiId(titulo),
      titulo,
      descricao,
      atualizado: formCurso.atualizado.trim() || 'Hoje',
      destaque: Boolean(formCurso.destaque),
      cabecalho,
      conteudo,
      nivel: formCurso.nivel || 'Iniciante',
      duracao: formCurso.duracao.trim() || '1h',
      progresso,
      novo: Boolean(formCurso.novo),
      maisAcessado: Boolean(formCurso.maisAcessado),
    };

    const proximasCategorias = atualizarCategoriasComCurso({
      categorias: categoriasWiki,
      modo: modalCurso.modo,
      curso,
      cursoId: modalCurso.cursoId,
      categoriaOrigemId: modalCurso.categoriaOrigemId,
      categoriaDestinoId,
    });

    try {
      setSalvando(true);
      setErro('');
      setFeedback('');

      const { data } = await api.put('/wiki', prepararPayloadWiki(proximasCategorias), { headers });

      setCategoriasWiki(normalizarCategoriasWiki(data));
      setAtualizadoEm(data.atualizado_em || new Date().toISOString());
      setAtualizadoPorNome(data.atualizado_por_nome || '');
      setCategoriaAtiva(categoriaDestinoId);
      setFiltroAtivo('todos');
      setBusca('');
      setModalCurso((atual) => ({ ...atual, aberto: false }));
      setFeedback('Curso salvo com sucesso.');
    } catch (err) {
      console.error('Erro ao salvar curso da wiki:', err);

      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login', { replace: true });
        return;
      }

      setErro(err.response?.data?.error || 'Não foi possível salvar o curso.');
    } finally {
      setSalvando(false);
    }
  };

  const renderEditorModal = () => {
    if (!modalCurso.aberto) return null;

    return (
      <div className={styles.modalOverlay}>
        <form className={styles.courseModal} onSubmit={salvarCurso}>
          <div className={styles.modalHeader}>
            <div>
              <h2>{modalCurso.modo === 'editar' ? 'Editar curso' : 'Adicionar curso'}</h2>
              <p>{modalCurso.modo === 'editar' ? 'Atualize a página do curso.' : 'Crie uma nova página de curso para a wiki.'}</p>
            </div>

            <button
              type="button"
              className={styles.iconButton}
              onClick={fecharModal}
              disabled={salvando}
              title="Fechar"
            >
              <X size={18} />
            </button>
          </div>

          {erro && <div className={styles.errorMessage}>{erro}</div>}

          <div className={styles.formGrid}>
            <label className={styles.field}>
              Categoria
              <select
                value={formCurso.categoriaId}
                onChange={(event) => alterarFormCurso('categoriaId', event.target.value)}
                disabled={salvando}
              >
                {categoriasWiki.map((categoria) => (
                  <option key={categoria.id} value={categoria.id}>
                    {categoria.titulo}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              Atualização
              <input
                type="text"
                maxLength={80}
                value={formCurso.atualizado}
                onChange={(event) => alterarFormCurso('atualizado', event.target.value)}
                disabled={salvando}
                placeholder="Hoje"
              />
            </label>
          </div>

          <label className={styles.field}>
            Título do curso
            <input
              type="text"
              maxLength={160}
              value={formCurso.titulo}
              onChange={(event) => alterarFormCurso('titulo', event.target.value)}
              disabled={salvando}
              required
            />
          </label>

          <label className={styles.field}>
            Resumo na lista
            <textarea
              rows={3}
              maxLength={600}
              value={formCurso.descricao}
              onChange={(event) => alterarFormCurso('descricao', event.target.value)}
              disabled={salvando}
              required
            />
          </label>

          <label className={styles.field}>
            Cabeçalho da página
            <input
              type="text"
              maxLength={180}
              value={formCurso.cabecalho}
              onChange={(event) => alterarFormCurso('cabecalho', event.target.value)}
              disabled={salvando}
              placeholder="Título principal da página do curso"
            />
          </label>

          <div className={styles.formGrid}>
            <label className={styles.field}>
              Nível
              <select
                value={formCurso.nivel}
                onChange={(event) => alterarFormCurso('nivel', event.target.value)}
                disabled={salvando}
              >
                <option value="Iniciante">Iniciante</option>
                <option value="Intermediário">Intermediário</option>
                <option value="Avançado">Avançado</option>
              </select>
            </label>

            <label className={styles.field}>
              Duração
              <input
                type="text"
                maxLength={40}
                value={formCurso.duracao}
                onChange={(event) => alterarFormCurso('duracao', event.target.value)}
                disabled={salvando}
                placeholder="Ex.: 2h 30min"
              />
            </label>
          </div>

          <label className={styles.field}>
            Progresso do curso
            <div className={styles.progressEditor}>
              <input
                type="range"
                min="0"
                max="100"
                value={limitarProgresso(formCurso.progresso)}
                onChange={(event) => alterarFormCurso('progresso', Number(event.target.value))}
                disabled={salvando}
              />
              <input
                type="number"
                min="0"
                max="100"
                value={limitarProgresso(formCurso.progresso)}
                onChange={(event) => alterarFormCurso('progresso', Number(event.target.value))}
                disabled={salvando}
                aria-label="Progresso em porcentagem"
              />
              <span>%</span>
            </div>
          </label>

          <label className={styles.field}>
            Texto do curso
            <textarea
              rows={10}
              maxLength={6000}
              value={formCurso.conteudo}
              onChange={(event) => alterarFormCurso('conteudo', event.target.value)}
              disabled={salvando}
              required
            />
          </label>

          <label className={styles.checkboxField}>
            <input
              type="checkbox"
              checked={formCurso.destaque}
              onChange={(event) => alterarFormCurso('destaque', event.target.checked)}
              disabled={salvando}
            />
            <span>Destacar curso</span>
          </label>

          <div className={styles.checkboxRow}>
            <label className={styles.checkboxField}>
              <input
                type="checkbox"
                checked={formCurso.novo}
                onChange={(event) => alterarFormCurso('novo', event.target.checked)}
                disabled={salvando}
              />
              <span>Marcar como novo</span>
            </label>

            <label className={styles.checkboxField}>
              <input
                type="checkbox"
                checked={formCurso.maisAcessado}
                onChange={(event) => alterarFormCurso('maisAcessado', event.target.checked)}
                disabled={salvando}
              />
              <span>Mais acessado</span>
            </label>
          </div>

          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.secondaryAction}
              onClick={fecharModal}
              disabled={salvando}
            >
              Cancelar
            </button>

            <button type="submit" className={styles.primaryAction} disabled={salvando}>
              <Save size={17} />
              {salvando ? 'Salvando...' : 'Salvar curso'}
            </button>
          </div>
        </form>
      </div>
    );
  };

  if (cursoId) {
    return (
      <WikiCoursePage
        key={cursoId}
        slug={cursoId}
        lessonSlug={lessonSlug}
        courseSection={courseSection}
      />
    );
  }

  return (
    <main className={styles.wikiPage}>
      <div className={styles.topbar}>
        <button type="button" className={styles.backHomeButton} onClick={voltarPaginaInterna}>
          <ArrowLeft size={18} />
          Voltar
        </button>
      </div>

      <section className={styles.heroSection}>
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <GraduationCap size={16} />
            Academia interna
          </div>

          <h1>Aprenda, evolua e domine novas habilidades</h1>

          <p>
            Acesse cursos, treinamentos e conteúdos criados para acelerar seu
            desenvolvimento e fortalecer a rotina da equipe.
          </p>

          <div className={styles.heroActions}>
            <button type="button" className={styles.primaryAction} onClick={irParaCursosDisponiveis}>
              <BookOpen size={18} />
              Ver cursos disponíveis
            </button>

            <button type="button" className={styles.secondaryAction} onClick={continuarAprendendo}>
              <PlayCircle size={18} />
              Continuar aprendendo
            </button>
          </div>
        </div>

        <aside className={styles.heroLearningPanel} aria-label="Resumo dos cursos">
          <div className={styles.heroPanelHeader}>
            <span>
              <Sparkles size={15} />
              Plataforma de capacitação
            </span>
            <strong>Premium</strong>
          </div>

          <div className={styles.statsGrid}>
            {metricasAprendizado.map((metrica) => {
              const IconeMetrica = metrica.Icone;

              return (
                <div key={metrica.label} className={styles.statCard}>
                  <IconeMetrica size={18} />
                  <strong>{metrica.value}</strong>
                  <span>{metrica.label}</span>
                </div>
              );
            })}
          </div>

          <div className={styles.learningSnapshot}>
            <div>
              <span>Trilha em destaque</span>
              <strong>{cursosDestaque[0]?.titulo || 'Cursos internos'}</strong>
            </div>
            <div className={styles.snapshotProgress}>
              <span>{cursosDestaque[0]?.progresso || 0}%</span>
              <div className={styles.progressTrack}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${cursosDestaque[0]?.progresso || 0}%` }}
                />
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className={styles.courseControls} aria-label="Busca e filtros de cursos">
        <div className={styles.controlsHeader}>
          <div>
            <span className={styles.sectionEyebrow}>Catálogo</span>
            <h2>Encontre a próxima habilidade</h2>
          </div>

          {isAdmin && (
            <button
              type="button"
              className={styles.categoryAddButton}
              onClick={() => abrirAdicionarCurso()}
              disabled={salvando}
            >
              <Plus size={16} />
              Adicionar curso
            </button>
          )}
        </div>

        <div className={styles.searchBox}>
          <Search size={20} />
          <input
            type="text"
            placeholder="Buscar curso..."
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
          />
        </div>

        <div className={styles.filterGroup}>
          {FILTROS_CURSOS.map((filtro) => (
            <button
              type="button"
              key={filtro.id}
              className={`${styles.categoryFilter} ${
                filtroAtivo === filtro.id ? styles.active : ''
              }`}
              onClick={() => setFiltroAtivo(filtro.id)}
            >
              {filtro.label}
            </button>
          ))}
        </div>

        <div className={styles.areaFilterGroup}>
          <span>Áreas</span>

          <button
            type="button"
            className={`${styles.areaFilter} ${
              categoriaAtiva === 'todas' ? styles.active : ''
            }`}
            onClick={() => selecionarCategoria('todas')}
          >
            Todas
          </button>

          {categoriasWiki.map((categoria) => {
            const Icone = categoria.icone;

            return (
              <button
                type="button"
                key={categoria.id}
                className={`${styles.areaFilter} ${
                  categoriaAtiva === categoria.id ? styles.active : ''
                }`}
                onClick={() => selecionarCategoria(categoria.id)}
              >
                <Icone size={15} />
                {categoria.titulo}
              </button>
            );
          })}
        </div>
      </section>

      <div className={styles.statusRow}>
        {carregando && <span className={styles.loadingState}>Carregando cursos...</span>}
        {!carregando && (
          <span>
            Atualizado: {formatarDataAtualizacao(atualizadoEm)}
            {atualizadoPorNome ? ` por ${atualizadoPorNome}` : ''}
          </span>
        )}
      </div>

      {categoriaSelecionada && (
        <section className={styles.categoryBlock}>
          <div className={styles.categoryHeader}>
            <div className={styles.categoryTitleGroup}>
              <span className={`${styles.categoryIcon} ${styles[categoriaSelecionada.cor] || ''}`}>
                <IconeCategoriaSelecionada size={22} />
              </span>
              <div>
                <h2>{categoriaSelecionada.titulo}</h2>
                <p>{categoriaSelecionada.subtitulo}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {erro && !modalCurso.aberto && <div className={styles.errorMessage}>{erro}</div>}
      {feedback && !modalCurso.aberto && <div className={styles.successMessage}>{feedback}</div>}

      <section id="cursos-disponiveis" className={styles.featuredSection}>
        <div className={styles.sectionTitle}>
          <div>
            <span className={styles.sectionEyebrow}>Cursos em destaque</span>
            <h2>Conteúdos para acelerar sua evolução</h2>
          </div>
          <span>{cursosFiltrados.length} cursos encontrados</span>
        </div>

        {cursosFiltrados.length > 0 ? (
          <div className={styles.courseCardGrid}>
            {cursosFiltrados.map((curso) => {
              const IconeCurso = curso.Icone;

              return (
                <article
                  key={curso.id}
                  id={curso.id}
                  className={`${styles.courseCard} ${styles[curso.cor]}`}
                  role="button"
                  tabIndex={0}
                  title="Abrir página do curso"
                  onClick={() => abrirDestinoCurso(curso)}
                  onKeyDown={(event) => acionarCursoPorTeclado(event, curso)}
                >
                  <div className={styles.courseCardTop}>
                    <div className={styles.courseIllustration}>
                      <IconeCurso size={26} />
                    </div>

                    <div className={styles.courseBadgeGroup}>
                      {curso.novo && (
                        <span>
                          <Zap size={13} />
                          Novo
                        </span>
                      )}
                      {curso.maisAcessado && (
                        <span>
                          <Star size={13} />
                          Popular
                        </span>
                      )}
                    </div>
                  </div>

                  <span className={styles.courseCategory}>{curso.categoria}</span>
                  <h3>{curso.titulo}</h3>
                  <p>{curso.descricao}</p>

                  <div className={styles.courseInfoGrid}>
                    <span>
                      <Sparkles size={14} />
                      {curso.nivel}
                    </span>
                    <span>
                      <Clock size={14} />
                      {curso.duracao}
                    </span>
                  </div>

                  <div className={styles.progressBlock}>
                    <div className={styles.progressHeader}>
                      <span>{curso.statusLabel}</span>
                      <strong>{curso.progresso}%</strong>
                    </div>
                    <div className={styles.progressTrack}>
                      <div
                        className={styles.progressFill}
                        style={{ width: `${curso.progresso}%` }}
                      />
                    </div>
                  </div>

                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={styles.primaryAction}
                      onClick={(event) => {
                        event.stopPropagation();
                        abrirDestinoCurso(curso);
                      }}
                    >
                      <BookOpen size={16} />
                      Acessar curso
                    </button>

                    {isAdmin && (
                      <button
                        type="button"
                        className={styles.articleIconButton}
                        aria-label={`Editar ${curso.titulo}`}
                        title="Editar curso"
                        onClick={(event) => {
                          event.stopPropagation();
                          abrirEditarCurso(curso.categoriaId, curso);
                        }}
                      >
                        <Pencil size={17} />
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <BookOpen size={36} />
            <h2>Nenhum curso encontrado</h2>
            <p>Tente buscar por outro termo ou selecione outro filtro.</p>
          </div>
        )}
      </section>

      <section className={styles.benefitsSection}>
        <div className={styles.sectionTitle}>
          <div>
            <span className={styles.sectionEyebrow}>Por que aprender aqui?</span>
            <h2>Uma experiência pensada para rotina corporativa</h2>
          </div>
        </div>

        <div className={styles.benefitGrid}>
          {BENEFICIOS_APRENDIZADO.map((beneficio) => {
            const IconeBeneficio = beneficio.Icone;

            return (
              <article key={beneficio.titulo} className={styles.benefitCard}>
                <div className={styles.benefitIcon}>
                  <IconeBeneficio size={22} />
                </div>
                <h3>{beneficio.titulo}</h3>
                <p>{beneficio.descricao}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.finalCta}>
        <div>
          <span className={styles.sectionEyebrow}>Próximo passo</span>
          <h2>Comece hoje sua evolução profissional.</h2>
          <p>Escolha uma trilha, avance no seu ritmo e transforme conhecimento em resultado.</p>
        </div>

        <button type="button" className={styles.primaryAction} onClick={irParaCursosDisponiveis}>
          <Zap size={18} />
          Explorar cursos
        </button>
      </section>

      {renderEditorModal()}
    </main>
  );
}
