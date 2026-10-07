const massivosModules = [
  {
    id: 'introducao-aos-massivos',
    order: 1,
    title: 'Introdução aos Massivos',
    description: 'Entenda o que é um massivo, quando ele acontece e como ele impacta os clientes.',
    progress: 100,
    icon: 'overview',
    lessons: [
      {
        number: '1.1',
        title: 'O que é um massivo?',
        slug: 'o-que-e-um-massivo',
        type: 'video',
        duration: '05:40',
        status: 'completed',
      },
      {
        number: '1.2',
        title: 'Diferença entre massivo, chamado individual e instabilidade local',
        slug: 'diferenca-entre-massivo-chamado-individual-e-instabilidade-local',
        type: 'text',
        duration: '08:20',
        status: 'completed',
      },
      {
        number: '1.3',
        title: 'Como identificar sinais de um massivo',
        slug: 'como-identificar-sinais-de-um-massivo',
        type: 'video',
        duration: '12:15',
        status: 'completed',
      },
    ],
  },
  {
    id: 'diagnostico-e-comunicacao-interna',
    order: 2,
    title: 'Diagnóstico e Comunicação Interna',
    description: 'Aprenda a validar informações antes de comunicar o cliente.',
    progress: 100,
    icon: 'diagnostic',
    lessons: [
      {
        number: '2.1',
        title: 'Conferindo alertas internos',
        slug: 'conferindo-alertas-internos',
        type: 'text',
        duration: '07:30',
        status: 'completed',
      },
      {
        number: '2.2',
        title: 'Verificando região, CTO e clientes afetados',
        slug: 'verificando-regiao-cto-e-clientes-afetados',
        type: 'text',
        duration: '10:45',
        status: 'completed',
      },
      {
        number: '2.3',
        title: 'Como acionar o NOC corretamente',
        slug: 'como-acionar-o-noc-corretamente',
        type: 'video',
        duration: '09:20',
        status: 'completed',
      },
      {
        number: '2.4',
        title: 'Registro correto no atendimento',
        slug: 'registro-correto-no-atendimento',
        type: 'exercise',
        duration: 'Exercício',
        status: 'completed',
      },
    ],
  },
  {
    id: 'atendimento-ao-cliente-em-caso-de-massivo',
    order: 3,
    title: 'Atendimento ao Cliente em Caso de Massivo',
    description: 'Saiba como explicar o problema ao cliente com clareza, segurança e empatia.',
    progress: 75,
    icon: 'support',
    lessons: [
      {
        number: '3.1',
        title: 'Como iniciar o atendimento',
        slug: 'como-iniciar-o-atendimento',
        type: 'text',
        duration: '06:30',
        status: 'completed',
      },
      {
        number: '3.2',
        title: 'Frases recomendadas para informar instabilidade',
        slug: 'frases-recomendadas-para-informar-instabilidade',
        type: 'text',
        duration: '11:10',
        status: 'completed',
      },
      {
        number: '3.3',
        title: 'Como comunicar previsão sem prometer prazo exato',
        slug: 'como-comunicar-previsao',
        type: 'video-text',
        duration: '14:25',
        status: 'in-progress',
      },
      {
        number: '3.4',
        title: 'Como encerrar o atendimento',
        slug: 'como-encerrar-o-atendimento',
        type: 'text',
        duration: '08:00',
        status: 'available',
      },
    ],
  },
  {
    id: 'argumentos-e-boas-praticas',
    order: 4,
    title: 'Argumentos e Boas Práticas',
    description: 'Modelos de fala, respostas rápidas e cuidados ao lidar com clientes insatisfeitos.',
    progress: 0,
    icon: 'speech',
    collapsed: true,
    lessons: [
      {
        number: '4.1',
        title: 'Como manter o controle da conversa',
        slug: 'como-manter-o-controle-da-conversa',
        type: 'text',
        duration: '09:30',
        status: 'available',
      },
      {
        number: '4.2',
        title: 'Palavras que devem ser evitadas',
        slug: 'palavras-que-devem-ser-evitadas',
        type: 'text',
        duration: '07:20',
        status: 'available',
      },
      {
        number: '4.3',
        title: 'Modelos de resposta rápida',
        slug: 'modelos-de-resposta-rapida',
        type: 'material',
        duration: 'Material',
        status: 'available',
      },
      {
        number: '4.4',
        title: 'Atendimento humanizado em instabilidade',
        slug: 'atendimento-humanizado-em-instabilidade',
        type: 'text',
        duration: '10:15',
        status: 'available',
      },
    ],
  },
  {
    id: 'materiais-de-apoio',
    order: 5,
    title: 'Materiais de Apoio',
    description: 'Arquivos, modelos de mensagem e procedimentos complementares.',
    progress: 0,
    icon: 'materials',
    collapsed: true,
    lessons: [
      {
        number: '5.1',
        title: 'Modelo de mensagem para massivo',
        slug: 'modelo-de-mensagem-para-massivo',
        type: 'pdf',
        duration: 'PDF',
        status: 'available',
      },
      {
        number: '5.2',
        title: 'Checklist de validação',
        slug: 'checklist-de-validacao',
        type: 'pdf',
        duration: 'PDF',
        status: 'available',
      },
      {
        number: '5.3',
        title: 'Frases recomendadas',
        slug: 'frases-recomendadas',
        type: 'doc',
        duration: 'DOC',
        status: 'available',
      },
      {
        number: '5.4',
        title: 'Procedimento NOC',
        slug: 'procedimento-noc',
        type: 'pdf',
        duration: 'PDF',
        status: 'available',
      },
    ],
  },
  {
    id: 'avaliacao-final',
    order: 6,
    title: 'Avaliação Final',
    description: 'Teste seus conhecimentos e conclua o treinamento.',
    progress: 0,
    icon: 'evaluation',
    collapsed: true,
    lessons: [
      {
        number: '6.1',
        title: 'Questionário final',
        slug: 'questionario-final',
        type: 'exercise',
        duration: 'Exercício',
        status: 'available',
      },
    ],
  },
];

const massivosMaterials = [
  { title: 'Modelo de mensagem para massivo', type: 'PDF', size: '1.2 MB' },
  { title: 'Checklist de validação', type: 'PDF', size: '850 KB' },
  { title: 'Frases recomendadas', type: 'DOC', size: '620 KB' },
  { title: 'Procedimento NOC', type: 'PDF', size: '1.5 MB' },
];

const createSimpleCourse = ({
  slug,
  title,
  description,
  category = 'Treinamento interno',
  level = 'Capacitação interna',
  progress = 35,
}) => ({
  slug,
  title,
  description,
  category,
  level,
  updatedAt: '2026-06-08',
  progress,
  totalLessons: 6,
  totalMaterials: 2,
  estimatedTime: '1h40min',
  badges: ['Treinamento interno', category, 'Atualizado recentemente'],
  currentLesson: {
    title: 'Conceitos essenciais e aplicação prática',
    module: '1.2',
    duration: '11:00',
    slug: 'conceitos-essenciais-e-aplicacao-pratica',
    description: 'Revise os principais pontos e avance para a próxima etapa do treinamento.',
  },
  modules: [
    {
      id: `${slug}-fundamentos`,
      order: 1,
      title: 'Fundamentos da trilha',
      description: 'Entenda os conceitos principais e como eles aparecem na rotina da equipe.',
      progress: progress >= 50 ? 100 : 50,
      icon: 'overview',
      lessons: [
        {
          number: '1.1',
          title: 'Visão geral do conteúdo',
          slug: 'visao-geral-do-conteudo',
          type: 'video',
          duration: '08:30',
          status: 'completed',
        },
        {
          number: '1.2',
          title: 'Conceitos essenciais e aplicação prática',
          slug: 'conceitos-essenciais-e-aplicacao-pratica',
          type: 'text',
          duration: '11:00',
          status: progress > 0 && progress < 100 ? 'in-progress' : 'completed',
        },
      ],
    },
    {
      id: `${slug}-pratica`,
      order: 2,
      title: 'Aplicação no atendimento',
      description: 'Use modelos, exemplos e exercícios para aplicar o conteúdo em situações reais.',
      progress: 0,
      icon: 'support',
      collapsed: true,
      lessons: [
        {
          number: '2.1',
          title: 'Exemplos práticos guiados',
          slug: 'exemplos-praticos-guiados',
          type: 'video',
          duration: '14:20',
          status: 'available',
        },
        {
          number: '2.2',
          title: 'Exercício de fixação',
          slug: 'exercicio-de-fixacao',
          type: 'exercise',
          duration: 'Exercício',
          status: 'available',
        },
      ],
    },
    {
      id: `${slug}-materiais`,
      order: 3,
      title: 'Materiais complementares',
      description: 'Arquivos, exemplos e referências para consulta rápida.',
      progress: 0,
      icon: 'materials',
      collapsed: true,
      lessons: [
        {
          number: '3.1',
          title: 'Resumo da trilha',
          slug: 'resumo-da-trilha',
          type: 'pdf',
          duration: 'PDF',
          status: 'available',
        },
        {
          number: '3.2',
          title: 'Checklist de aplicação',
          slug: 'checklist-de-aplicacao',
          type: 'material',
          duration: 'Material',
          status: 'available',
        },
      ],
    },
  ],
  materials: [
    { title: 'Resumo da trilha', type: 'PDF', size: '780 KB' },
    { title: 'Checklist de aplicação', type: 'PDF', size: '540 KB' },
  ],
});

const createCourseSlug = (value = 'curso') => (
  String(value || 'curso')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'curso'
);

const normalizeProgress = (value = 0) => {
  const number = Number(value);

  if (!Number.isFinite(number)) return 0;

  return Math.min(100, Math.max(0, Math.round(number)));
};

const getLessonStatusFromProgress = (progress) => {
  if (progress >= 100) return 'completed';
  if (progress > 0) return 'in-progress';

  return 'available';
};

const getParagraphsFromCatalogContent = (content = '', fallback = '') => {
  const text = String(content || fallback || '').trim();

  if (!text) {
    return ['Conteúdo disponível para consulta interna da equipe.'];
  }

  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .slice(0, 30);
};

const createCatalogLessonContent = ({
  title,
  description,
  content,
  category,
}) => ({
  summary: description || `Conteúdo interno sobre ${title}.`,
  objectives: [
    `Consultar as orientações principais de ${title}.`,
    `Aplicar o conteúdo na rotina de ${category || 'atendimento interno'}.`,
    'Manter a equipe alinhada com a orientação registrada na Wiki.',
  ],
  sections: [
    {
      eyebrow: 'CONTEÚDO DA WIKI',
      title,
      paragraphs: getParagraphsFromCatalogContent(content, description),
      tone: 'info',
    },
  ],
  checklist: [
    'Ler a orientação completa antes de responder ou executar o procedimento.',
    'Validar se o cenário atual corresponde ao conteúdo da Wiki.',
    'Registrar informações importantes no atendimento quando necessário.',
  ],
  takeaways: [
    description || 'Conteúdo disponível para consulta interna.',
    'Em caso de dúvida, valide com a liderança ou área responsável.',
  ],
});

export const normalizeWikiCourseSlug = createCourseSlug;

export const createWikiCourseFromCatalogItem = ({ course = {}, category = {} } = {}) => {
  const slug = createCourseSlug(course.id || course.titulo);
  const title = course.cabecalho || course.titulo || 'Curso da Wiki';
  const description = course.descricao || course.conteudo || 'Conteúdo interno disponível na Wiki.';
  const categoryTitle = category.titulo || category.title || 'Wiki interna';
  const level = course.nivel || 'Consulta interna';
  const duration = course.duracao || 'Conteúdo';
  const progress = normalizeProgress(course.progresso);
  const lessonStatus = getLessonStatusFromProgress(progress);
  const lesson = {
    number: '1.1',
    title,
    slug,
    contentKey: slug,
    type: 'text',
    duration,
    status: lessonStatus,
  };

  return {
    slug,
    title,
    description,
    category: categoryTitle,
    level,
    updatedAt: course.atualizado || 'Hoje',
    progress,
    totalLessons: 1,
    totalMaterials: 0,
    estimatedTime: duration,
    badges: [...new Set(['Wiki interna', categoryTitle, level].filter(Boolean))],
    currentLesson: {
      title,
      module: lesson.number,
      duration,
      slug,
      description,
    },
    modules: [
      {
        id: `${slug}-conteudo`,
        order: 1,
        title: categoryTitle,
        description,
        progress,
        icon: 'overview',
        lessons: [lesson],
      },
    ],
    materials: [],
    defaultLessonContent: createCatalogLessonContent({
      title,
      description,
      content: course.conteudo,
      category: categoryTitle,
    }),
    progressSummary: {
      completedLessons: lessonStatus === 'completed' ? 1 : 0,
      totalLessons: 1,
      currentStreak: progress > 0 ? 'Em andamento' : 'Ainda não iniciado',
      lastLesson: title,
    },
  };
};

export const wikiCourses = [
  {
    slug: 'massivos',
    title: 'Massivos',
    description: 'Aprenda como identificar, interpretar e comunicar massivos de forma clara, rápida e profissional.',
    category: 'Suporte técnico',
    level: 'Treinamento interno',
    updatedAt: '2026-06-08',
    progress: 75,
    totalLessons: 20,
    totalMaterials: 4,
    estimatedTime: '2h30min',
    badges: ['Treinamento interno', 'Suporte técnico', 'Atualizado recentemente', 'Certificado incluso'],
    currentLesson: {
      title: 'Como comunicar previsão sem prometer prazo exato',
      module: '3.3',
      duration: '14:25',
      remaining: '18 min restantes',
      slug: 'como-comunicar-previsao',
      description: 'Aprenda a orientar o cliente com clareza, sem gerar falsas expectativas.',
    },
    modules: massivosModules,
    materials: massivosMaterials,
    progressSummary: {
      completedLessons: 9,
      totalLessons: 20,
      currentStreak: '7 dias',
      lastLesson: 'Como comunicar previsão sem prometer prazo exato',
    },
  },
  createSimpleCourse({
    slug: 'argumentos-venda',
    title: 'Argumentos de Venda',
    description: 'Aprenda argumentos comerciais, quebra de objeções e boas práticas para converter atendimentos em vendas.',
    category: 'Vendas',
    level: 'Treinamento comercial',
    progress: 42,
  }),
  createSimpleCourse({
    slug: 'atendimento',
    title: 'Atendimento ao Cliente',
    description: 'Aprenda padrões de atendimento, postura profissional, organização da conversa e resolução eficiente.',
    category: 'Atendimento',
    level: 'Treinamento interno',
    progress: 58,
  }),
  createSimpleCourse({
    slug: 'retencao-clientes',
    title: 'Retenção de Clientes',
    description: 'Aprenda estratégias para entender objeções, reduzir cancelamentos e melhorar a experiência do cliente.',
    category: 'Relacionamento',
    level: 'Treinamento estratégico',
    progress: 18,
  }),
  createSimpleCourse({
    slug: 'dashboard-noc',
    title: 'Dashboard NOC',
    description: 'Aprenda a interpretar métricas de baixa, regular, alta e offline para acompanhar a operação com precisão.',
    category: 'NOC',
    level: 'Treinamento operacional',
    progress: 54,
  }),
  createSimpleCourse({
    slug: 'rotina-monitoramento',
    title: 'Rotina de Monitoramento',
    description: 'Checklist de início de turno, validações prioritárias e acompanhamento contínuo dos indicadores do NOC.',
    category: 'NOC',
    level: 'Treinamento operacional',
    progress: 36,
  }),
  createSimpleCourse({
    slug: 'planos',
    title: 'Tabela de Planos',
    description: 'Consulta guiada dos planos disponíveis, valores, benefícios e pontos de atenção na oferta comercial.',
    category: 'Vendas',
    level: 'Treinamento comercial',
    progress: 68,
  }),
  createSimpleCourse({
    slug: 'promocoes',
    title: 'Promoções Ativas',
    description: 'Entenda campanhas atuais, regras comerciais, elegibilidade e como comunicar as promoções corretamente.',
    category: 'Vendas',
    level: 'Treinamento comercial',
    progress: 25,
  }),
  createSimpleCourse({
    slug: 'deploy',
    title: 'Como Subir Alterações no Servidor',
    description: 'Passo a passo para build, atualização do frontend, restart PM2 e validação das rotas publicadas.',
    category: 'Desenvolvimento',
    level: 'Treinamento técnico',
    progress: 80,
  }),
  createSimpleCourse({
    slug: 'apis',
    title: 'APIs do Sistema',
    description: 'Onde ficam rotas, tokens, variáveis de ambiente e integrações principais do sistema interno.',
    category: 'Desenvolvimento',
    level: 'Treinamento técnico',
    progress: 44,
  }),
  createSimpleCourse({
    slug: 'estrutura-projeto',
    title: 'Estrutura do Projeto',
    description: 'Organização de pastas, páginas, componentes, estilos e serviços para manutenção do sistema.',
    category: 'Desenvolvimento',
    level: 'Treinamento técnico',
    progress: 22,
  }),
  createSimpleCourse({
    slug: 'sem-internet',
    title: 'Cliente Sem Internet',
    description: 'Checklist de atendimento para clientes sem conexão, triagem inicial e encaminhamento correto.',
    category: 'Suporte técnico',
    level: 'Treinamento operacional',
    progress: 76,
  }),
  createSimpleCourse({
    slug: 'lentidao',
    title: 'Lentidão na Conexão',
    description: 'Como validar sinal, equipamento, consumo, testes básicos e orientar o cliente durante o diagnóstico.',
    category: 'Suporte técnico',
    level: 'Treinamento operacional',
    progress: 48,
  }),
  createSimpleCourse({
    slug: 'abertura-chamado',
    title: 'Abertura de Chamado',
    description: 'Padrão para registrar informações, evidências e histórico de atendimento corretamente no sistema.',
    category: 'Suporte técnico',
    level: 'Treinamento operacional',
    progress: 30,
  }),
  createSimpleCourse({
    slug: 'tecnicas-vendas',
    title: 'Técnicas de Vendas',
    description: 'Abordagens comerciais, perguntas certas e estratégias para melhorar conversão.',
    category: 'Vendas',
    level: 'Treinamento comercial',
    progress: 46,
  }),
  createSimpleCourse({
    slug: 'atendimento-cliente',
    title: 'Atendimento ao Cliente',
    description: 'Postura, escuta ativa e condução de atendimentos com clareza e empatia.',
    category: 'Atendimento',
    level: 'Treinamento interno',
    progress: 72,
  }),
  createSimpleCourse({
    slug: 'suporte-tecnico',
    title: 'Suporte Técnico',
    description: 'Fluxo completo para triagem, diagnóstico e encaminhamento de chamados.',
    category: 'Suporte técnico',
    level: 'Treinamento operacional',
    progress: 64,
  }),
  createSimpleCourse({
    slug: 'redes-fibra-optica',
    title: 'Redes e Fibra Óptica',
    description: 'Fundamentos de rede, sinal óptico, diagnóstico inicial e boas práticas de campo.',
    category: 'NOC',
    level: 'Treinamento técnico',
    progress: 32,
  }),
  createSimpleCourse({
    slug: 'seguranca-informacao',
    title: 'Segurança da Informação',
    description: 'Cuidados essenciais com acessos, dados sensíveis, senhas e rotinas internas.',
    category: 'Segurança',
    level: 'Treinamento interno',
    progress: 18,
  }),
  {
    slug: 'acesso-externo-dispositivos',
    title: 'Acesso Externo a Dispositivos',
    description:
      'Orientação sobre como tratar solicitações de clientes que desejam acessar dispositivos de fora da rede, como câmeras, DVR/NVR, servidores, automação ou sistemas internos.',
    category: 'Dúvidas Respondidas',
    level: 'Consulta rápida',
    updatedAt: '2026-06-17',
    progress: 0,
    totalLessons: 1,
    totalMaterials: 0,
    estimatedTime: '15min',
    badges: ['Dúvidas Respondidas', 'Atendimento', 'Consulta rápida'],
    currentLesson: {
      title: 'Acesso Externo a Dispositivos',
      module: '1.1',
      duration: '15min',
      slug: 'acesso-externo-dispositivos',
      description: 'Perguntas, requisitos e resposta pronta para solicitações de acesso externo.',
    },
    modules: [
      {
        id: 'duvidas-respondidas-acesso-externo',
        order: 1,
        title: 'Acesso externo',
        description:
          'Oriente a equipe sobre dados necessários, IPv4 público, gateway, CGNAT e soluções comerciais.',
        progress: 0,
        icon: 'support',
        lessons: [
          {
            number: '1.1',
            title: 'Acesso Externo a Dispositivos',
            slug: 'acesso-externo-dispositivos',
            type: 'text',
            duration: '15min',
            status: 'available',
          },
        ],
      },
    ],
    materials: [],
  },
  createSimpleCourse({
    slug: 'comunicacao-interna',
    title: 'Comunicação Interna',
    description: 'Padrões de alinhamento, passagem de contexto e comunicação entre equipes.',
    category: 'Operação',
    level: 'Treinamento interno',
    progress: 100,
  }),
];

export const findWikiCourseBySlug = (slug) => (
  wikiCourses.find((course) => course.slug === slug)
);
