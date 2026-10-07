import { createElement, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Flame,
  FolderOpen,
  Headphones,
  HelpCircle,
  Image as ImageIcon,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  MessageCircle,
  NotebookPen,
  Pencil,
  PlayCircle,
  Plus,
  Presentation,
  Save,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Upload,
  User,
  Video,
  Wrench,
  X,
} from 'lucide-react';
import {
  createWikiCourseFromCatalogItem,
  findWikiCourseBySlug,
  normalizeWikiCourseSlug,
} from '../../data/wikiCourses';
import { getWikiLessonContent } from '../../data/wikiLessonContent';
import api from '../../services/api';
import styles from '../../styles/WikiCourse.module.css';

const navItems = ['Dashboard', 'Wiki', 'Cursos', 'Materiais', 'Dúvidas', 'Certificados'];

const sidebarItems = [
  { label: 'Visão geral', section: 'visao-geral', Icone: LayoutDashboard },
  { label: 'Aulas', section: 'aulas', Icone: BookOpen },
  { label: 'Exercícios', section: 'exercicios', Icone: ClipboardCheck },
  { label: 'Projetos', section: 'projetos', Icone: Wrench },
  { label: 'Materiais', section: 'materiais', Icone: FileText },
  { label: 'Fórum', section: 'forum', Icone: MessageCircle },
  { label: 'Anotações', section: 'anotacoes', Icone: NotebookPen },
  { label: 'Configurações', section: 'configuracoes', Icone: Settings },
];

const quickLinks = [
  { label: 'Abrir material de apoio', Icone: FileText },
  { label: 'Enviar dúvida', Icone: HelpCircle },
  { label: 'Ver procedimentos', Icone: ClipboardCheck },
  { label: 'Falar com suporte', Icone: Headphones },
];

const filterOptions = [
  { value: 'all', label: 'Todas' },
  { value: 'completed', label: 'Concluídas' },
  { value: 'in-progress', label: 'Em andamento' },
  { value: 'available', label: 'Disponíveis' },
  { value: 'materials', label: 'Materiais' },
  { value: 'exercises', label: 'Exercícios' },
];

const moduleIcons = {
  overview: BookOpen,
  diagnostic: ShieldCheck,
  support: Headphones,
  speech: MessageCircle,
  materials: FileText,
  evaluation: ClipboardCheck,
};

const typeLabels = {
  video: 'Vídeo',
  text: 'Texto',
  'video-text': 'Vídeo e texto',
  pdf: 'PDF',
  doc: 'DOC',
  exercise: 'Exercício',
  material: 'Material',
};

const statusLabels = {
  completed: 'Concluída',
  'in-progress': 'Em andamento',
  available: 'Disponível',
};

const lessonTypeIcons = {
  video: Video,
  text: FileText,
  'video-text': PlayCircle,
  pdf: FileText,
  doc: FileText,
  exercise: ClipboardCheck,
  material: Download,
};

const lessonDocumentLabels = {
  pdf: 'PDF',
  powerpoint: 'PowerPoint',
  excel: 'Excel',
};

const lessonTypeOptions = Object.entries(typeLabels).map(([value, label]) => ({
  value,
  label,
}));

const moduleIconOptions = [
  { value: 'overview', label: 'Livro / visão geral' },
  { value: 'diagnostic', label: 'Escudo / diagnóstico' },
  { value: 'support', label: 'Headset / atendimento' },
  { value: 'speech', label: 'Conversa / comunicação' },
  { value: 'materials', label: 'Documento / materiais' },
  { value: 'evaluation', label: 'Checklist / avaliação' },
];

const getUserName = () => {
  try {
    const raw = localStorage.getItem('user');
    const user = raw ? JSON.parse(raw) : null;
    const name = user?.nome || user?.name || '';

    return name ? name.split(' ')[0] : 'Lucas';
  } catch {
    return 'Lucas';
  }
};

const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

const isAdminUser = (user = {}) => (
  user?.perfil === 'admin' ||
  user?.role === 'admin' ||
  user?.tipo === 'admin'
);

const getPageEditStorageKey = (courseSlug) => `wiki-course-page-edits:${courseSlug}`;

const loadPageEdits = (courseSlug) => {
  try {
    return JSON.parse(localStorage.getItem(getPageEditStorageKey(courseSlug)) || '{}');
  } catch {
    return {};
  }
};

const sectionContent = {
  'visao-geral': {
    title: 'Visão geral do curso',
    description: 'Acompanhe a estrutura da trilha, o progresso dos módulos e os próximos passos recomendados.',
  },
  aulas: {
    title: 'Aulas do curso',
    description: 'Conteúdo organizado por módulos, com status de conclusão, duração e tipo de aula.',
  },
  exercicios: {
    title: 'Exercícios e avaliações',
    description: 'Atividades práticas para fixar o conteúdo e validar o aprendizado da equipe.',
  },
  projetos: {
    title: 'Projetos práticos',
    description: 'Simulações e entregas guiadas para aplicar o curso em situações reais da operação.',
  },
  materiais: {
    title: 'Materiais de apoio',
    description: 'Arquivos, modelos, checklists e procedimentos complementares deste curso.',
  },
  forum: {
    title: 'Fórum e dúvidas',
    description: 'Espaço para perguntas, alinhamentos e discussões relacionadas ao conteúdo da trilha.',
  },
  anotacoes: {
    title: 'Anotações pessoais',
    description: 'Registre observações importantes, respostas padrão e aprendizados do curso.',
  },
  configuracoes: {
    title: 'Configurações do curso',
    description: 'Área administrativa para revisar publicação, visibilidade e manutenção da trilha.',
  },
};

const getSectionContent = (section, edits = {}) => ({
  ...sectionContent[section],
  ...(edits[section] || {}),
});

const lessonMatchesFilter = (lesson, filter) => {
  if (filter === 'all') return true;
  if (filter === 'materials') return ['material', 'pdf', 'doc'].includes(lesson.type);
  if (filter === 'exercises') return lesson.type === 'exercise';

  return lesson.status === filter;
};

const normalizeText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const getCompletedCount = (lessons = []) => (
  lessons.filter((lesson) => lesson.status === 'completed').length
);

const findLesson = (course, lessonSlug) => {
  if (!lessonSlug) return null;

  for (const module of course.modules) {
    const lesson = module.lessons.find((item) => (
      item.slug === lessonSlug || item.previousSlugs?.includes(lessonSlug)
    ));

    if (lesson) {
      return { lesson, module };
    }
  }

  return null;
};

const createLessonSlug = (value = '') => (
  String(value || 'aula')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180)
    || 'aula'
);

const applyCourseConfig = (baseCourse, config) => {
  if (!baseCourse || !Array.isArray(config?.modules) || config.modules.length === 0) {
    return baseCourse;
  }

  const modules = baseCourse.modules.map((baseModule) => {
    const configuredModule = config.modules.find((module) => module.id === baseModule.id);

    if (!configuredModule) return baseModule;

    const lessons = baseModule.lessons.map((baseLesson) => {
      const contentKey = baseLesson.contentKey || baseLesson.slug;
      const configuredLesson = configuredModule.lessons?.find((lesson) => (
        lesson.contentKey === contentKey ||
        lesson.slug === baseLesson.slug ||
        lesson.previousSlugs?.includes(baseLesson.slug)
      ));

      if (!configuredLesson) {
        return {
          ...baseLesson,
          contentKey,
          previousSlugs: [],
        };
      }

      return {
        ...baseLesson,
        contentKey,
        slug: configuredLesson.slug || baseLesson.slug,
        previousSlugs: configuredLesson.previousSlugs || [],
        number: configuredLesson.number || baseLesson.number,
        title: configuredLesson.title || baseLesson.title,
        type: configuredLesson.type || baseLesson.type,
        duration: configuredLesson.duration || baseLesson.duration,
      };
    });

    return {
      ...baseModule,
      title: configuredModule.title || baseModule.title,
      description: configuredModule.description || baseModule.description,
      icon: configuredModule.icon || baseModule.icon,
      lessons,
    };
  });

  const lessonSequence = modules.flatMap((module) => (
    module.lessons.map((lesson) => ({ lesson, module }))
  ));
  const currentLessonEntry = lessonSequence.find(({ lesson }) => (
    lesson.contentKey === baseCourse.currentLesson.slug ||
    lesson.slug === baseCourse.currentLesson.slug
  ));

  return {
    ...baseCourse,
    modules,
    totalLessons: lessonSequence.length,
    currentLesson: currentLessonEntry
      ? {
        ...baseCourse.currentLesson,
        title: currentLessonEntry.lesson.title,
        module: currentLessonEntry.lesson.number,
        duration: currentLessonEntry.lesson.duration,
        slug: currentLessonEntry.lesson.slug,
      }
    : baseCourse.currentLesson,
  };
};

const getLessonProgressKey = (lesson = {}) => lesson.contentKey || lesson.slug;

const getCourseLessonEntries = (course) => (
  course?.modules?.flatMap((module) => (
    module.lessons.map((lesson) => ({ lesson, module }))
  )) || []
);

const applyCourseProgress = (baseCourse, progressData) => {
  if (!baseCourse) return baseCourse;

  const lessonEntries = getCourseLessonEntries(baseCourse);
  const totalLessons = lessonEntries.length || baseCourse.totalLessons || 0;
  const progressRows = Array.isArray(progressData?.aulas) ? progressData.aulas : [];
  const progressByKey = new Map(progressRows.map((row) => [row.aula_chave, row]));
  const completedKeys = new Set(
    progressRows
      .filter((row) => row.concluida)
      .map((row) => row.aula_chave)
  );
  const lastLessonKey = progressData?.ultima_aula_chave || null;
  const firstAvailableEntry =
    lessonEntries.find(({ lesson }) => !completedKeys.has(getLessonProgressKey(lesson))) ||
    lessonEntries[lessonEntries.length - 1] ||
    null;
  const currentEntry =
    lessonEntries.find(({ lesson }) => getLessonProgressKey(lesson) === lastLessonKey) ||
    firstAvailableEntry;
  const completedLessons = lessonEntries.filter(({ lesson }) => (
    completedKeys.has(getLessonProgressKey(lesson))
  )).length;
  const courseProgress = totalLessons
    ? Math.round((completedLessons / totalLessons) * 100)
    : 0;
  const modules = baseCourse.modules.map((module) => {
    const lessons = module.lessons.map((lesson) => {
      const lessonKey = getLessonProgressKey(lesson);
      const completed = completedKeys.has(lessonKey);
      const isCurrent = currentEntry?.lesson && getLessonProgressKey(currentEntry.lesson) === lessonKey;
      const status = completed
        ? 'completed'
        : isCurrent && (lastLessonKey || completedLessons > 0)
          ? 'in-progress'
          : 'available';

      return {
        ...lesson,
        status,
        progress: progressByKey.get(lessonKey) || null,
      };
    });
    const moduleCompletedLessons = lessons.filter((lesson) => lesson.status === 'completed').length;

    return {
      ...module,
      progress: lessons.length ? Math.round((moduleCompletedLessons / lessons.length) * 100) : 0,
      lessons,
    };
  });
  const currentLesson = currentEntry?.lesson
    ? {
      ...baseCourse.currentLesson,
      title: currentEntry.lesson.title,
      module: currentEntry.lesson.number,
      duration: currentEntry.lesson.duration,
      remaining: completedKeys.has(getLessonProgressKey(currentEntry.lesson))
        ? 'Concluída'
        : `${currentEntry.lesson.duration} restantes`,
      slug: currentEntry.lesson.slug,
      description: baseCourse.currentLesson?.description || currentEntry.module.description,
    }
    : baseCourse.currentLesson;

  return {
    ...baseCourse,
    modules,
    progress: courseProgress,
    totalLessons,
    currentLesson,
    progressSummary: {
      ...(baseCourse.progressSummary || {}),
      completedLessons,
      totalLessons,
      currentStreak: completedLessons
        ? `${completedLessons} aula${completedLessons === 1 ? '' : 's'} concluída${completedLessons === 1 ? '' : 's'}`
        : 'Ainda não iniciado',
      lastLesson: currentEntry?.lesson?.title || baseCourse.currentLesson?.title,
    },
  };
};

const serializeCourseModules = (modules) => ({
  modules: modules.map((module) => ({
    id: module.id,
    title: module.title,
    description: module.description,
    icon: module.icon,
    lessons: module.lessons.map((lesson) => ({
      contentKey: lesson.contentKey || lesson.slug,
      slug: lesson.slug,
      previousSlugs: lesson.previousSlugs || [],
      number: lesson.number,
      title: lesson.title,
      type: lesson.type,
      duration: lesson.duration,
    })),
  })),
});

const joinEditorLines = (items = []) => items.join('\n');
const splitEditorLines = (value = '') => (
  String(value || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
);

const contentToLessonEditorValues = (content) => ({
  displayMode: content.displayMode === 'document' && content.document
    ? 'document'
    : 'content',
  document: content.document ? { ...content.document } : null,
  summary: content.summary || '',
  objectives: joinEditorLines(content.objectives),
  sections: (content.sections || []).map((section) => ({
    eyebrow: section.eyebrow || '',
    title: section.title || '',
    paragraphs: joinEditorLines(section.paragraphs),
    bullets: joinEditorLines(section.bullets),
    tone: section.tone || '',
    media: (section.media || []).map((item) => ({ ...item })),
    mediaPosition: section.mediaPosition === 'before' ? 'before' : 'after',
  })),
  comparisonHeaders: joinEditorLines(content.comparison?.headers),
  comparisonRows: (content.comparison?.rows || [])
    .map((row) => row.join(' | '))
    .join('\n'),
  steps: (content.steps || []).map((step) => ({
    title: step.title || '',
    description: step.description || '',
  })),
  exampleTitle: content.example?.title || '',
  exampleScenario: content.example?.scenario || '',
  exampleResponse: content.example?.response || '',
  checklist: joinEditorLines(content.checklist),
  takeaways: joinEditorLines(content.takeaways),
  knowledgeQuestion: content.knowledgeCheck?.question || '',
  knowledgeAnswer: content.knowledgeCheck?.answer || '',
  media: (content.media || []).map((item) => ({ ...item })),
});

const lessonEditorValuesToContent = (values) => {
  const comparisonHeaders = splitEditorLines(values.comparisonHeaders);
  const comparisonRows = splitEditorLines(values.comparisonRows)
    .map((row) => row.split('|').map((cell) => cell.trim()).filter(Boolean))
    .filter((row) => row.length > 0);
  const example = values.exampleTitle.trim() ||
    values.exampleScenario.trim() ||
    values.exampleResponse.trim()
    ? {
      title: values.exampleTitle.trim(),
      scenario: values.exampleScenario.trim(),
      response: values.exampleResponse.trim(),
    }
    : null;
  const knowledgeCheck = values.knowledgeQuestion.trim() || values.knowledgeAnswer.trim()
    ? {
      question: values.knowledgeQuestion.trim(),
      answer: values.knowledgeAnswer.trim(),
    }
    : null;

  return {
    displayMode: values.displayMode === 'document' && values.document
      ? 'document'
      : 'content',
    document: values.document ? { ...values.document } : null,
    summary: values.summary.trim(),
    objectives: splitEditorLines(values.objectives),
    sections: values.sections
      .map((section) => ({
        eyebrow: section.eyebrow.trim(),
        title: section.title.trim(),
        paragraphs: splitEditorLines(section.paragraphs),
        bullets: splitEditorLines(section.bullets),
        tone: section.tone,
        media: section.media.map((item) => ({ ...item })),
        mediaPosition: section.mediaPosition === 'before' ? 'before' : 'after',
      }))
      .filter((section) => (
        section.title ||
        section.paragraphs.length ||
        section.bullets.length ||
        section.media.length
      )),
    comparison: comparisonHeaders.length || comparisonRows.length
      ? {
        headers: comparisonHeaders,
        rows: comparisonRows,
      }
      : null,
    steps: values.steps
      .map((step) => ({
        title: step.title.trim(),
        description: step.description.trim(),
      }))
      .filter((step) => step.title || step.description),
    example,
    checklist: splitEditorLines(values.checklist),
    takeaways: splitEditorLines(values.takeaways),
    knowledgeCheck,
    media: values.media.map((item) => ({ ...item })),
  };
};

function CourseTopNav({ userName, onDashboardClick }) {
  return (
    <header className={styles.topNav}>
      <div className={styles.brand}>
        <div className={styles.brandMark}>AW</div>
        <div>
          <strong>Wiki Acessanet</strong>
          <span>Treinamentos internos</span>
        </div>
      </div>

      <nav className={styles.mainNav} aria-label="Navegação principal">
        {navItems.map((item) => (
          <button
            key={item}
            type="button"
            onClick={item === 'Dashboard' ? onDashboardClick : undefined}
            className={item === 'Cursos' ? styles.navActive : ''}
            aria-label={item === 'Dashboard' ? 'Voltar para a página de Wiki' : undefined}
          >
            {item}
          </button>
        ))}
      </nav>

      <div className={styles.userArea}>
        <button type="button" aria-label="Notificações">
          <Bell size={18} />
        </button>
        <div className={styles.avatar}>
          <User size={16} />
        </div>
        <span>Olá, {userName}</span>
      </div>
    </header>
  );
}

function CourseSidebar({ course, activeSection, baseCoursePath, onSupportClick, onNavigateSection }) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarCourseCard}>
        <span>Curso atual</span>
        <strong>{course.title}</strong>
        <small>{course.category}</small>
        <div className={styles.sidebarProgressHeader}>
          <span>Progresso</span>
          <b>{course.progress}%</b>
        </div>
        <div className={styles.progressTrack}>
          <div style={{ width: `${course.progress}%` }} />
        </div>
      </div>

      <nav className={styles.sideNav} aria-label="Menu do curso">
        {sidebarItems.map(({ label, section, Icone }) => (
          <button
            key={label}
            type="button"
            className={activeSection === section ? styles.sideNavActive : ''}
            onClick={() => onNavigateSection(section)}
          >
            {createElement(Icone, { size: 17 })}
            {label}
          </button>
        ))}
      </nav>

      <div className={styles.helpCard}>
        <strong>Precisa de ajuda?</strong>
        <p>Acesse o suporte ou fale com a equipe.</p>
        <small>{baseCoursePath}</small>
        <button type="button" onClick={onSupportClick}>
          Abrir suporte
        </button>
      </div>
    </aside>
  );
}

function CircularProgress({ value }) {
  return (
    <div
      className={styles.circularProgress}
      style={{ '--progress': `${value}%` }}
      aria-label={`${value}% concluído`}
    >
      <strong>{value}%</strong>
      <span>concluído</span>
    </div>
  );
}

function CourseHero({ course, baseCoursePath, onContinue }) {
  const stats = [
    { value: course.totalLessons, label: 'Aulas' },
    { value: course.estimatedTime, label: 'Conteúdo total' },
    { value: course.totalMaterials, label: 'Materiais' },
    { value: 'Incluso', label: 'Certificado' },
  ];

  return (
    <section className={styles.courseHero}>
      <div className={styles.breadcrumb}>
        <span>Início</span>
        <span>/</span>
        <span>Wiki</span>
        <span>/</span>
        <span>Cursos</span>
        <span>/</span>
        <strong>{course.title}</strong>
      </div>

      <span className={styles.routeHint}>{baseCoursePath}</span>

      <div className={styles.heroBody}>
        <div className={styles.heroCopy}>
          <span className={styles.kicker}>CURSO</span>
          <h1>{course.title}</h1>
          <p>{course.description}</p>

          <div className={styles.badgeRow}>
            {course.badges.map((badge) => (
              <span key={badge}>{badge}</span>
            ))}
          </div>

          <div className={styles.heroStats}>
            {stats.map((stat) => (
              <div key={stat.label}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        <CircularProgress value={course.progress} />
      </div>

      <div className={styles.heroActionRow}>
        <button type="button" className={styles.primaryButton} onClick={onContinue}>
          <PlayCircle size={18} />
          Continuar de onde parei
        </button>

        <div className={styles.currentLesson}>
          <span>Aula atual</span>
          <strong>
            Aula {course.currentLesson.module} - {course.currentLesson.title}
          </strong>
          <small>{course.currentLesson.remaining || `${course.currentLesson.duration} restantes`}</small>
        </div>
      </div>
    </section>
  );
}

function CourseSearchFilters({ search, setSearch, filter, setFilter }) {
  return (
    <section className={styles.searchFilters}>
      <label className={styles.courseSearch}>
        <Search size={19} />
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar aulas, assuntos ou materiais deste curso..."
        />
      </label>

      <label className={styles.courseFilter}>
        <Filter size={18} />
        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
          {filterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}

function CourseSectionHeader({ title, description, activeSection, isAdmin, onEditPage }) {
  return (
    <section className={styles.sectionHeader}>
      <div>
        <span>{activeSection}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      {isAdmin && (
        <button type="button" className={styles.adminEditButton} onClick={onEditPage}>
          <Pencil size={17} />
          Editar página
        </button>
      )}
    </section>
  );
}

function CourseLessonItem({ lesson, moduleOrder, active, onOpenLesson }) {
  const TypeIcon = lessonTypeIcons[lesson.type] || FileText;
  const completed = lesson.status === 'completed';
  const inProgress = lesson.status === 'in-progress';

  return (
    <button
      type="button"
      className={`${styles.lessonItem} ${active ? styles.lessonActive : ''} ${
        inProgress ? styles.lessonInProgress : ''
      }`}
      onClick={() => onOpenLesson(lesson)}
    >
      <span className={styles.lessonStatusIcon}>
        {completed && <CheckCircle2 size={19} />}
        {inProgress && <Circle size={18} />}
        {!completed && !inProgress && <BookOpen size={18} />}
      </span>

      <span className={styles.lessonNumber}>{lesson.number || `${moduleOrder}.`}</span>

      <span className={styles.lessonMain}>
        <strong>{lesson.title}</strong>
        <small>
          <TypeIcon size={14} />
          {typeLabels[lesson.type] || 'Aula'}
        </small>
      </span>

      <span className={styles.lessonDuration}>{lesson.duration}</span>
      <span className={styles.lessonStatus}>{statusLabels[lesson.status] || 'Aula'}</span>
    </button>
  );
}

function CourseModuleAccordion({
  module,
  expanded,
  toggleModule,
  activeLessonSlug,
  onOpenLesson,
  isAdmin,
  onEditModule,
}) {
  const ModuleIcon = moduleIcons[module.icon] || BookOpen;
  const completedCount = getCompletedCount(module.lessons);

  return (
    <article className={styles.moduleCard}>
      <div className={styles.moduleHeaderShell}>
        <button type="button" className={styles.moduleHeader} onClick={() => toggleModule(module.id)}>
          <span className={styles.moduleIcon}>
            <ModuleIcon size={22} />
          </span>

          <span className={styles.moduleTitleGroup}>
            <small>Módulo {module.order}</small>
            <strong>{module.title}</strong>
            <em>{module.description}</em>
          </span>

          <span className={styles.moduleProgress}>
            <b>{module.progress}%</b>
            <small>
              {completedCount}/{module.lessons.length} aulas
            </small>
            <span className={styles.progressTrack}>
              <span style={{ width: `${module.progress}%` }} />
            </span>
          </span>

          <span className={styles.expandIcon}>
            {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </span>
        </button>

        {isAdmin && (
          <button
            type="button"
            className={styles.moduleEditButton}
            onClick={() => onEditModule(module)}
          >
            <Pencil size={16} />
            Editar módulo
          </button>
        )}
      </div>

      {expanded && (
        <div className={styles.lessonList}>
          {module.lessons.map((lesson) => (
            <CourseLessonItem
              key={lesson.slug}
              lesson={lesson}
              moduleOrder={module.order}
              active={lesson.slug === activeLessonSlug}
              onOpenLesson={onOpenLesson}
            />
          ))}
        </div>
      )}
    </article>
  );
}

function CourseOverviewSection({ course, onNavigateSection }) {
  const completedModules = course.modules.filter((module) => module.progress >= 100).length;

  return (
    <div className={styles.overviewGrid}>
      <article className={styles.overviewCard}>
        <BookOpen size={22} />
        <strong>{course.modules.length} módulos</strong>
        <p>{completedModules} módulos já concluídos ou liberados para revisão.</p>
      </article>

      <article className={styles.overviewCard}>
        <CalendarDays size={22} />
        <strong>{course.estimatedTime}</strong>
        <p>Tempo estimado para completar toda a trilha.</p>
      </article>

      <article className={styles.overviewCard}>
        <ClipboardCheck size={22} />
        <strong>{course.totalLessons} aulas</strong>
        <p>Conteúdo organizado para consulta e prática no dia a dia.</p>
      </article>

      <article className={styles.overviewWideCard}>
        <div>
          <span>Próxima etapa recomendada</span>
          <h3>{course.currentLesson.title}</h3>
          <p>{course.currentLesson.description}</p>
        </div>
        <button type="button" className={styles.primaryButton} onClick={() => onNavigateSection('aulas')}>
          Ir para aulas
        </button>
      </article>
    </div>
  );
}

function CourseExercisesSection({ course, onOpenLesson }) {
  const exercises = course.modules.flatMap((module) =>
    module.lessons
      .filter((lesson) => lesson.type === 'exercise')
      .map((lesson) => ({ ...lesson, moduleTitle: module.title }))
  );

  return (
    <div className={styles.activityGrid}>
      {exercises.map((exercise) => (
        <article key={exercise.slug} className={styles.activityCard}>
          <div className={styles.activityIcon}>
            <ClipboardCheck size={22} />
          </div>
          <span>{exercise.moduleTitle}</span>
          <h3>{exercise.title}</h3>
          <p>Status: {statusLabels[exercise.status] || 'Pendente'}</p>
          <button
            type="button"
            className={exercise.status === 'locked' ? styles.secondaryButton : styles.primaryButton}
            onClick={() => onOpenLesson(exercise)}
          >
            {exercise.status === 'locked' ? 'Bloqueado' : 'Abrir exercício'}
          </button>
        </article>
      ))}
    </div>
  );
}

function CourseProjectsSection({ course }) {
  const projects = [
    {
      title: `Simulação guiada - ${course.title}`,
      description: 'Aplique os conceitos em um cenário prático, com roteiro e critérios de avaliação.',
      status: 'Em preparação',
    },
    {
      title: 'Plano de melhoria da rotina',
      description: 'Monte uma proposta simples para melhorar o atendimento ou operação após concluir o curso.',
      status: 'Bloqueado',
    },
  ];

  return (
    <div className={styles.activityGrid}>
      {projects.map((project) => (
        <article key={project.title} className={styles.activityCard}>
          <div className={styles.activityIcon}>
            <FolderOpen size={22} />
          </div>
          <span>{project.status}</span>
          <h3>{project.title}</h3>
          <p>{project.description}</p>
          <button type="button" className={styles.secondaryButton}>
            Ver projeto
          </button>
        </article>
      ))}
    </div>
  );
}

function CourseMaterialsSection({ course }) {
  return (
    <div className={styles.materialsPageList}>
      {course.materials.map((material) => (
        <article key={material.title} className={styles.materialPageCard}>
          <FileText size={22} />
          <div>
            <h3>{material.title}</h3>
            <p>{material.type} - {material.size}</p>
          </div>
          <button type="button" className={styles.secondaryButton}>
            <Download size={16} />
            Baixar
          </button>
        </article>
      ))}
    </div>
  );
}

function CourseForumSection({ course }) {
  const questions = [
    {
      title: `Como aplicar este curso em um atendimento real de ${course.category}?`,
      meta: 'Respondido pela equipe - hoje',
    },
    {
      title: 'Posso sugerir uma nova aula para esta trilha?',
      meta: 'Aberto para discussão',
    },
  ];

  return (
    <div className={styles.forumStack}>
      <div className={styles.forumComposer}>
        <MessageCircle size={22} />
        <input type="text" placeholder="Escreva uma dúvida sobre este curso..." />
        <button type="button" className={styles.primaryButton}>
          <Send size={16} />
          Enviar
        </button>
      </div>

      {questions.map((question) => (
        <article key={question.title} className={styles.forumQuestion}>
          <HelpCircle size={21} />
          <div>
            <h3>{question.title}</h3>
            <p>{question.meta}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

function CourseNotesSection({ course }) {
  const notes = [
    {
      title: 'Pontos importantes',
      text: `Registrar exemplos práticos do curso ${course.title} para consultar durante os atendimentos.`,
    },
    {
      title: 'Resposta rápida',
      text: 'Anotar frases aprovadas pela equipe para manter o padrão de comunicação.',
    },
  ];

  return (
    <div className={styles.notesLayout}>
      <div className={styles.noteComposer}>
        <NotebookPen size={22} />
        <textarea placeholder="Criar nova anotação deste curso..." rows={5} />
        <button type="button" className={styles.primaryButton}>
          Salvar anotação
        </button>
      </div>

      <div className={styles.notesGrid}>
        {notes.map((note) => (
          <article key={note.title} className={styles.noteCard}>
            <strong>{note.title}</strong>
            <p>{note.text}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function CourseSettingsSection({ course, isAdmin, onEditPage }) {
  return (
    <div className={styles.settingsPanel}>
      <article>
        <SlidersHorizontal size={22} />
        <div>
          <h3>Publicação da trilha</h3>
          <p>Curso ativo na Wiki, visível para usuários autenticados.</p>
        </div>
        <span>Ativo</span>
      </article>

      <article>
        <ShieldCheck size={22} />
        <div>
          <h3>Permissões</h3>
          <p>Administradores podem editar páginas e preparar conteúdo para integração futura com API.</p>
        </div>
        <span>{isAdmin ? 'Admin' : 'Leitura'}</span>
      </article>

      {isAdmin && (
        <button type="button" className={styles.primaryButton} onClick={onEditPage}>
          <Pencil size={17} />
          Editar página de configurações
        </button>
      )}

      <small>Curso: {course.slug}</small>
    </div>
  );
}

function NextLessonCard({ course, onWatchLesson }) {
  return (
    <section className={styles.panelCard}>
      <div className={styles.panelTitle}>
        <span>Próxima aula</span>
      </div>

      <div className={styles.videoThumb}>
        <span>COMUNICAÇÃO DE MASSIVO</span>
        <button type="button" onClick={onWatchLesson} aria-label="Assistir aula">
          <PlayCircle size={28} />
        </button>
      </div>

      <strong>{course.currentLesson.title}</strong>
      <p>{course.currentLesson.description}</p>

      <div className={styles.panelMeta}>
        <span>{course.currentLesson.duration}</span>
        <span>Aula {course.currentLesson.module}</span>
      </div>

      <button type="button" className={styles.primaryButton} onClick={onWatchLesson}>
        Assistir aula
      </button>
    </section>
  );
}

function MaterialsCard({ materials }) {
  return (
    <section className={styles.panelCard}>
      <div className={styles.panelTitle}>
        <span>Materiais deste curso</span>
      </div>

      <div className={styles.materialList}>
        {materials.map((material) => (
          <button key={material.title} type="button" className={styles.materialItem}>
            <FileText size={17} />
            <span>
              <strong>{material.title}</strong>
              <small>
                {material.type} - {material.size}
              </small>
            </span>
            <Download size={16} />
          </button>
        ))}
      </div>

      <button type="button" className={styles.secondaryButton}>
        Ver todos os materiais
      </button>
    </section>
  );
}

function CertificateCard() {
  return (
    <section className={styles.panelCard}>
      <div className={styles.certificatePreview}>
        <Award size={22} />
        <span>Certificado Wiki Acessanet</span>
      </div>
      <strong>Seu certificado</strong>
      <p>Disponível ao concluir todas as aulas e avaliação final.</p>
      <button type="button" className={styles.secondaryButton}>
        Ver certificado
      </button>
    </section>
  );
}

function ProgressCard({ course }) {
  const summary = course.progressSummary || {
    completedLessons: Math.round((course.progress / 100) * course.totalLessons),
    totalLessons: course.totalLessons,
    currentStreak: '3 dias',
    lastLesson: course.currentLesson.title,
  };
  const activeHeatmapCells = summary.totalLessons
    ? Math.round((summary.completedLessons / summary.totalLessons) * 21)
    : 0;

  return (
    <section className={styles.panelCard}>
      <div className={styles.panelTitle}>
        <span>Seu progresso</span>
      </div>
      <div className={styles.largeProgress}>{course.progress}% concluído</div>
      <p>Aulas concluídas: {summary.completedLessons}/{summary.totalLessons}</p>
      <p>Última aula: {summary.lastLesson}</p>
      <div className={styles.studyStreak}>
        <Flame size={17} />
        Sequência atual: {summary.currentStreak}
      </div>
      <div className={styles.heatmap} aria-label="Calendário de estudos">
        {Array.from({ length: 21 }, (_, index) => (
          <span key={index} className={index < activeHeatmapCells ? styles.heatmapActive : ''} />
        ))}
      </div>
      <button type="button" className={styles.textButton}>
        Ver estatísticas
      </button>
    </section>
  );
}

function QuickLinksCard({ onSupportClick }) {
  return (
    <section className={styles.panelCard}>
      <div className={styles.panelTitle}>
        <span>Atalhos rápidos</span>
      </div>

      <div className={styles.quickLinks}>
        {quickLinks.map(({ label, Icone }) => (
          <button
            key={label}
            type="button"
            onClick={label === 'Falar com suporte' ? onSupportClick : undefined}
          >
            {createElement(Icone, { size: 17 })}
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}

function CourseRightPanel({ course, onWatchLesson, onSupportClick }) {
  return (
    <aside className={styles.rightPanel}>
      <NextLessonCard course={course} onWatchLesson={onWatchLesson} />
      <MaterialsCard materials={course.materials} />
      <CertificateCard />
      <ProgressCard course={course} />
      <QuickLinksCard onSupportClick={onSupportClick} />
    </aside>
  );
}

function AdminEditModal({
  open,
  section,
  values,
  setValues,
  onClose,
  onSave,
}) {
  if (!open) return null;

  return (
    <div className={styles.editModalOverlay}>
      <form className={styles.editModal} onSubmit={onSave}>
        <div className={styles.editModalHeader}>
          <div>
            <span>Edição administrativa</span>
            <h2>Editar página: {section}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <label>
          Título da página
          <input
            type="text"
            value={values.title}
            onChange={(event) => setValues((current) => ({
              ...current,
              title: event.target.value,
            }))}
          />
        </label>

        <label>
          Descrição
          <textarea
            rows={4}
            value={values.description}
            onChange={(event) => setValues((current) => ({
              ...current,
              description: event.target.value,
            }))}
          />
        </label>

        <label>
          Observação interna
          <textarea
            rows={5}
            value={values.adminNote}
            onChange={(event) => setValues((current) => ({
              ...current,
              adminNote: event.target.value,
            }))}
            placeholder="Use este campo para orientar futuras edições ou integração com API."
          />
        </label>

        <div className={styles.editModalActions}>
          <button type="button" className={styles.secondaryButton} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className={styles.primaryButton}>
            Salvar edição
          </button>
        </div>
      </form>
    </div>
  );
}

function ModuleEditModal({
  open,
  values,
  setValues,
  saving,
  error,
  onClose,
  onSave,
}) {
  if (!open || !values) return null;

  const updateLesson = (lessonIndex, field, value) => {
    setValues((current) => ({
      ...current,
      lessons: current.lessons.map((lesson, index) => (
        index === lessonIndex ? { ...lesson, [field]: value } : lesson
      )),
    }));
  };

  return (
    <div className={styles.editModalOverlay}>
      <form className={styles.moduleEditModal} onSubmit={onSave}>
        <div className={styles.editModalHeader}>
          <div>
            <span>Edição administrativa</span>
            <h2>Editar módulo {values.order}</h2>
            <p>As páginas internas permanecem intactas ao renomear uma aula.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className={styles.moduleEditGrid}>
          <label>
            Título do módulo
            <input
              type="text"
              value={values.title}
              onChange={(event) => setValues((current) => ({
                ...current,
                title: event.target.value,
              }))}
              maxLength={180}
              required
            />
          </label>

          <label>
            Ícone do módulo
            <select
              value={values.icon}
              onChange={(event) => setValues((current) => ({
                ...current,
                icon: event.target.value,
              }))}
            >
              {moduleIconOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Descrição do módulo
          <textarea
            rows={3}
            value={values.description}
            onChange={(event) => setValues((current) => ({
              ...current,
              description: event.target.value,
            }))}
            maxLength={700}
          />
        </label>

        <section className={styles.moduleLessonsEditor}>
          <div className={styles.moduleLessonsEditorHeader}>
            <div>
              <span>Aulas do módulo</span>
              <h3>Edite título, número, tipo e duração</h3>
            </div>
            <small>O link acompanha o novo título automaticamente.</small>
          </div>

          <div className={styles.moduleLessonsEditorList}>
            {values.lessons.map((lesson, lessonIndex) => (
              <article key={lesson.contentKey}>
                <div className={styles.moduleLessonEditorTitle}>
                  <span>{lesson.number}</span>
                  <strong>{lesson.title || `Aula ${lessonIndex + 1}`}</strong>
                </div>

                <div className={styles.moduleLessonFields}>
                  <label>
                    Número
                    <input
                      type="text"
                      value={lesson.number}
                      onChange={(event) => updateLesson(lessonIndex, 'number', event.target.value)}
                      maxLength={20}
                      required
                    />
                  </label>

                  <label className={styles.moduleLessonTitleField}>
                    Título da aula
                    <input
                      type="text"
                      value={lesson.title}
                      onChange={(event) => updateLesson(lessonIndex, 'title', event.target.value)}
                      maxLength={220}
                      required
                    />
                  </label>

                  <label>
                    Tipo / ícone
                    <select
                      value={lesson.type}
                      onChange={(event) => updateLesson(lessonIndex, 'type', event.target.value)}
                    >
                      {lessonTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Duração
                    <input
                      type="text"
                      value={lesson.duration}
                      onChange={(event) => updateLesson(lessonIndex, 'duration', event.target.value)}
                      maxLength={40}
                      required
                    />
                  </label>
                </div>

                <div className={styles.moduleLessonLinkPreview}>
                  <span>Link atualizado:</span>
                  <code>/aula/{createLessonSlug(lesson.title)}</code>
                </div>
              </article>
            ))}
          </div>
        </section>

        {error && <div className={styles.moduleEditError}>{error}</div>}

        <div className={styles.editModalActions}>
          <button type="button" className={styles.secondaryButton} onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className={styles.primaryButton} disabled={saving}>
            <Save size={17} />
            {saving ? 'Salvando...' : 'Salvar módulo'}
          </button>
        </div>
      </form>
    </div>
  );
}

function LessonEditModal({
  open,
  lesson,
  values,
  setValues,
  saving,
  uploading,
  error,
  onClose,
  onSave,
  onUploadMedia,
  onUploadDocument,
}) {
  if (!open || !lesson || !values) return null;

  const updateSection = (sectionIndex, field, value) => {
    setValues((current) => ({
      ...current,
      sections: current.sections.map((section, index) => (
        index === sectionIndex ? { ...section, [field]: value } : section
      )),
    }));
  };

  const updateStep = (stepIndex, field, value) => {
    setValues((current) => ({
      ...current,
      steps: current.steps.map((step, index) => (
        index === stepIndex ? { ...step, [field]: value } : step
      )),
    }));
  };

  const updateSectionMedia = (sectionIndex, mediaIndex, field, value) => {
    setValues((current) => ({
      ...current,
      sections: current.sections.map((section, index) => (
        index === sectionIndex
          ? {
            ...section,
            media: section.media.map((item, itemIndex) => (
              itemIndex === mediaIndex ? { ...item, [field]: value } : item
            )),
          }
          : section
      )),
    }));
  };

  const removeSectionMedia = (sectionIndex, mediaIndex) => {
    setValues((current) => ({
      ...current,
      sections: current.sections.map((section, index) => (
        index === sectionIndex
          ? {
            ...section,
            media: section.media.filter((_, itemIndex) => itemIndex !== mediaIndex),
          }
          : section
      )),
    }));
  };

  const updateMedia = (mediaIndex, field, value) => {
    setValues((current) => ({
      ...current,
      media: current.media.map((item, index) => (
        index === mediaIndex ? { ...item, [field]: value } : item
      )),
    }));
  };

  const removeMedia = (mediaIndex) => {
    setValues((current) => ({
      ...current,
      media: current.media.filter((_, index) => index !== mediaIndex),
    }));
  };

  return (
    <div className={styles.editModalOverlay}>
      <form className={styles.lessonEditModal} onSubmit={onSave}>
        <div className={styles.editModalHeader}>
          <div>
            <span>Edição administrativa</span>
            <h2>Editar conteúdo da aula {lesson.number}</h2>
            <p>{lesson.title}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar editor da aula">
            <X size={18} />
          </button>
        </div>

        <section className={styles.lessonEditorSection}>
          <div className={styles.lessonEditorSectionTitle}>
            <div>
              <span>FORMATO DA AULA</span>
              <h3>Escolha o que será exibido nesta página</h3>
            </div>
          </div>

          <div className={styles.lessonDisplayModeOptions}>
            <label
              className={values.displayMode === 'content'
                ? styles.lessonDisplayModeActive
                : ''}
            >
              <input
                type="radio"
                name="lesson-display-mode"
                value="content"
                checked={values.displayMode === 'content'}
                onChange={() => setValues((current) => ({
                  ...current,
                  displayMode: 'content',
                }))}
              />
              <BookOpen size={22} />
              <span>
                <strong>Conteúdo da própria aula</strong>
                <small>Mostra objetivos, blocos, imagens, vídeos e exercícios configurados.</small>
              </span>
            </label>

            <label
              className={`${
                values.displayMode === 'document' ? styles.lessonDisplayModeActive : ''
              } ${
                !values.document ? styles.lessonDisplayModeDisabled : ''
              }`.trim()}
            >
              <input
                type="radio"
                name="lesson-display-mode"
                value="document"
                checked={values.displayMode === 'document'}
                disabled={!values.document}
                onChange={() => setValues((current) => ({
                  ...current,
                  displayMode: 'document',
                }))}
              />
              <FileText size={22} />
              <span>
                <strong>Documento incorporado</strong>
                <small>Exibe o PDF, PowerPoint ou Excel já montado dentro da aula.</small>
              </span>
            </label>
          </div>

          <div className={styles.lessonDocumentEditor}>
            <div>
              <strong>Documento principal</strong>
              <small>
                PowerPoint e Excel recebem uma prévia automática em PDF. Limite de 500 MB.
              </small>
            </div>

            <label className={styles.lessonMediaUploadButton}>
              <Upload size={17} />
              {uploading ? 'Preparando arquivo...' : 'Enviar PDF, PowerPoint ou Excel'}
              <input
                type="file"
                accept=".pdf,.ppt,.pptx,.xls,.xlsx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                disabled={uploading}
                onChange={(event) => {
                  onUploadDocument(event.target.files);
                  event.target.value = '';
                }}
              />
            </label>
          </div>

          {values.document && (
            <article className={styles.lessonDocumentEditorCard}>
              <span className={styles.lessonDocumentIcon}>
                {values.document.type === 'excel' ? (
                  <FileSpreadsheet size={25} />
                ) : values.document.type === 'powerpoint' ? (
                  <Presentation size={25} />
                ) : (
                  <FileText size={25} />
                )}
              </span>
              <div>
                <strong>{values.document.name}</strong>
                <small>
                  {values.document.type === 'powerpoint'
                    ? 'PowerPoint com prévia em PDF'
                    : values.document.type === 'excel'
                      ? 'Excel com prévia em PDF'
                      : 'PDF pronto para visualização'}
                </small>
              </div>
              <a href={values.document.url} target="_blank" rel="noreferrer">
                <Download size={16} />
                Baixar original
              </a>
              <button
                type="button"
                onClick={() => setValues((current) => ({
                  ...current,
                  displayMode: 'content',
                  document: null,
                }))}
              >
                <Trash2 size={16} />
                Remover
              </button>
            </article>
          )}
        </section>

        <section className={styles.lessonEditorSection}>
          <div className={styles.lessonEditorSectionTitle}>
            <div>
              <span>APRESENTAÇÃO</span>
              <h3>Resumo e objetivos</h3>
            </div>
          </div>

          <label>
            Resumo da aula
            <textarea
              rows={4}
              value={values.summary}
              onChange={(event) => setValues((current) => ({
                ...current,
                summary: event.target.value,
              }))}
              required
            />
          </label>

          <label>
            Objetivos
            <textarea
              rows={4}
              value={values.objectives}
              onChange={(event) => setValues((current) => ({
                ...current,
                objectives: event.target.value,
              }))}
              placeholder="Um objetivo por linha"
            />
            <small>Use uma linha para cada objetivo.</small>
          </label>
        </section>

        <section className={styles.lessonEditorSection}>
          <div className={styles.lessonEditorSectionTitle}>
            <div>
              <span>CONTEÚDO</span>
              <h3>Blocos principais da aula</h3>
            </div>
            <button
              type="button"
              onClick={() => setValues((current) => ({
                ...current,
                sections: [
                  ...current.sections,
                  {
                    eyebrow: 'NOVO BLOCO',
                    title: '',
                    paragraphs: '',
                    bullets: '',
                    tone: '',
                    media: [],
                    mediaPosition: 'after',
                  },
                ],
              }))}
            >
              <Plus size={16} />
              Adicionar bloco
            </button>
          </div>

          <div className={styles.lessonEditorCards}>
            {values.sections.map((section, sectionIndex) => (
              <article key={`${sectionIndex}-${section.eyebrow}`}>
                <div className={styles.lessonEditorCardHeader}>
                  <strong>Bloco {sectionIndex + 1}</strong>
                  <button
                    type="button"
                    onClick={() => setValues((current) => ({
                      ...current,
                      sections: current.sections.filter((_, index) => index !== sectionIndex),
                    }))}
                    aria-label={`Remover bloco ${sectionIndex + 1}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className={styles.lessonEditorGrid}>
                  <label>
                    Chamada
                    <input
                      type="text"
                      value={section.eyebrow}
                      onChange={(event) => updateSection(
                        sectionIndex,
                        'eyebrow',
                        event.target.value
                      )}
                    />
                  </label>

                  <label>
                    Destaque visual
                    <select
                      value={section.tone}
                      onChange={(event) => updateSection(
                        sectionIndex,
                        'tone',
                        event.target.value
                      )}
                    >
                      <option value="">Padrão</option>
                      <option value="info">Informativo azul</option>
                      <option value="warning">Atenção amarelo</option>
                    </select>
                  </label>
                </div>

                <label>
                  Título do bloco
                  <input
                    type="text"
                    value={section.title}
                    onChange={(event) => updateSection(
                      sectionIndex,
                      'title',
                      event.target.value
                    )}
                  />
                </label>

                <div className={styles.lessonEditorGrid}>
                  <label>
                    Parágrafos
                    <textarea
                      rows={5}
                      value={section.paragraphs}
                      onChange={(event) => updateSection(
                        sectionIndex,
                        'paragraphs',
                        event.target.value
                      )}
                      placeholder="Um parágrafo por linha"
                    />
                  </label>

                  <label>
                    Lista de pontos
                    <textarea
                      rows={5}
                      value={section.bullets}
                      onChange={(event) => updateSection(
                        sectionIndex,
                        'bullets',
                        event.target.value
                      )}
                      placeholder="Um item por linha"
                    />
                  </label>
                </div>

                <div className={styles.lessonBlockMediaEditor}>
                  <div className={styles.lessonBlockMediaHeader}>
                    <div>
                      <strong>Imagens e vídeos deste bloco</strong>
                      <small>A mídia aparecerá somente dentro do Bloco {sectionIndex + 1}.</small>
                    </div>

                    <div className={styles.lessonBlockMediaActions}>
                      <label>
                        Posição
                        <select
                          value={section.mediaPosition}
                          onChange={(event) => updateSection(
                            sectionIndex,
                            'mediaPosition',
                            event.target.value
                          )}
                        >
                          <option value="before">Antes do texto</option>
                          <option value="after">Depois do texto</option>
                        </select>
                      </label>

                      <label className={styles.lessonMediaUploadButton}>
                        <Upload size={16} />
                        {uploading ? 'Enviando...' : 'Adicionar mídia'}
                        <input
                          type="file"
                          accept="image/*,video/*"
                          multiple
                          disabled={uploading}
                          onChange={(event) => {
                            onUploadMedia(event.target.files, { sectionIndex });
                            event.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  {section.media.length > 0 ? (
                    <div className={styles.lessonMediaEditorGrid}>
                      {section.media.map((item, mediaIndex) => (
                        <article key={item.id || item.url}>
                          <div className={styles.lessonMediaEditorPreview}>
                            {item.type === 'video' ? (
                              <video src={item.url} controls preload="metadata" />
                            ) : (
                              <img src={item.url} alt={item.caption || item.name} />
                            )}
                          </div>
                          <div className={styles.lessonMediaEditorBody}>
                            <span>
                              {item.type === 'video'
                                ? <Video size={16} />
                                : <ImageIcon size={16} />}
                              {item.name}
                            </span>
                            <label>
                              Legenda
                              <input
                                type="text"
                                value={item.caption || ''}
                                onChange={(event) => updateSectionMedia(
                                  sectionIndex,
                                  mediaIndex,
                                  'caption',
                                  event.target.value
                                )}
                                placeholder="Descreva esta mídia"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => removeSectionMedia(sectionIndex, mediaIndex)}
                            >
                              <Trash2 size={16} />
                              Remover do bloco
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.lessonBlockMediaEmpty}>
                      <ImageIcon size={20} />
                      <span>Este bloco ainda não possui mídia.</span>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.lessonEditorSection}>
          <div className={styles.lessonEditorSectionTitle}>
            <div>
              <span>MÍDIA</span>
              <h3>Imagens e vídeos da aula</h3>
            </div>
            <label className={styles.lessonMediaUploadButton}>
              <Upload size={17} />
              {uploading ? 'Enviando...' : 'Enviar imagens ou vídeos'}
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                disabled={uploading}
                onChange={(event) => {
                  onUploadMedia(event.target.files, { sectionIndex: null });
                  event.target.value = '';
                }}
              />
            </label>
          </div>

          <p className={styles.lessonMediaHelp}>
            Arquivos de até 500 MB. As mídias serão exibidas na própria página da aula.
          </p>

          {values.media.length > 0 ? (
            <div className={styles.lessonMediaEditorGrid}>
              {values.media.map((item, mediaIndex) => (
                <article key={item.id || item.url}>
                  <div className={styles.lessonMediaEditorPreview}>
                    {item.type === 'video' ? (
                      <video src={item.url} controls preload="metadata" />
                    ) : (
                      <img src={item.url} alt={item.caption || item.name} />
                    )}
                  </div>
                  <div className={styles.lessonMediaEditorBody}>
                    <span>
                      {item.type === 'video' ? <Video size={16} /> : <ImageIcon size={16} />}
                      {item.name}
                    </span>
                    <label>
                      Legenda
                      <input
                        type="text"
                        value={item.caption || ''}
                        onChange={(event) => updateMedia(
                          mediaIndex,
                          'caption',
                          event.target.value
                        )}
                        placeholder="Descreva esta mídia"
                      />
                    </label>
                    <button type="button" onClick={() => removeMedia(mediaIndex)}>
                      <Trash2 size={16} />
                      Remover da aula
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.lessonMediaEmpty}>
              <ImageIcon size={26} />
              <span>Nenhuma imagem ou vídeo nesta aula.</span>
            </div>
          )}
        </section>

        <section className={styles.lessonEditorSection}>
          <div className={styles.lessonEditorSectionTitle}>
            <div>
              <span>APOIO</span>
              <h3>Comparativo e passo a passo</h3>
            </div>
            <button
              type="button"
              onClick={() => setValues((current) => ({
                ...current,
                steps: [...current.steps, { title: '', description: '' }],
              }))}
            >
              <Plus size={16} />
              Adicionar etapa
            </button>
          </div>

          <div className={styles.lessonEditorGrid}>
            <label>
              Cabeçalhos do comparativo
              <textarea
                rows={4}
                value={values.comparisonHeaders}
                onChange={(event) => setValues((current) => ({
                  ...current,
                  comparisonHeaders: event.target.value,
                }))}
                placeholder="Um cabeçalho por linha"
              />
            </label>

            <label>
              Linhas do comparativo
              <textarea
                rows={4}
                value={values.comparisonRows}
                onChange={(event) => setValues((current) => ({
                  ...current,
                  comparisonRows: event.target.value,
                }))}
                placeholder="Separe as colunas com | e use uma linha por registro"
              />
            </label>
          </div>

          <div className={styles.lessonStepsEditor}>
            {values.steps.map((step, stepIndex) => (
              <article key={stepIndex}>
                <span>{String(stepIndex + 1).padStart(2, '0')}</span>
                <label>
                  Título
                  <input
                    type="text"
                    value={step.title}
                    onChange={(event) => updateStep(stepIndex, 'title', event.target.value)}
                  />
                </label>
                <label>
                  Descrição
                  <input
                    type="text"
                    value={step.description}
                    onChange={(event) => updateStep(
                      stepIndex,
                      'description',
                      event.target.value
                    )}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setValues((current) => ({
                    ...current,
                    steps: current.steps.filter((_, index) => index !== stepIndex),
                  }))}
                  aria-label={`Remover etapa ${stepIndex + 1}`}
                >
                  <Trash2 size={16} />
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.lessonEditorSection}>
          <div className={styles.lessonEditorSectionTitle}>
            <div>
              <span>EXEMPLO</span>
              <h3>Cenário e conduta recomendada</h3>
            </div>
          </div>

          <label>
            Título do exemplo
            <input
              type="text"
              value={values.exampleTitle}
              onChange={(event) => setValues((current) => ({
                ...current,
                exampleTitle: event.target.value,
              }))}
            />
          </label>

          <div className={styles.lessonEditorGrid}>
            <label>
              Cenário
              <textarea
                rows={5}
                value={values.exampleScenario}
                onChange={(event) => setValues((current) => ({
                  ...current,
                  exampleScenario: event.target.value,
                }))}
              />
            </label>
            <label>
              Conduta recomendada
              <textarea
                rows={5}
                value={values.exampleResponse}
                onChange={(event) => setValues((current) => ({
                  ...current,
                  exampleResponse: event.target.value,
                }))}
              />
            </label>
          </div>
        </section>

        <section className={styles.lessonEditorSection}>
          <div className={styles.lessonEditorSectionTitle}>
            <div>
              <span>REVISÃO</span>
              <h3>Checklist, aprendizados e fixação</h3>
            </div>
          </div>

          <div className={styles.lessonEditorGrid}>
            <label>
              Checklist de aplicação
              <textarea
                rows={5}
                value={values.checklist}
                onChange={(event) => setValues((current) => ({
                  ...current,
                  checklist: event.target.value,
                }))}
                placeholder="Um item por linha"
              />
            </label>
            <label>
              Pontos que ficam
              <textarea
                rows={5}
                value={values.takeaways}
                onChange={(event) => setValues((current) => ({
                  ...current,
                  takeaways: event.target.value,
                }))}
                placeholder="Um item por linha"
              />
            </label>
          </div>

          <label>
            Pergunta de fixação
            <input
              type="text"
              value={values.knowledgeQuestion}
              onChange={(event) => setValues((current) => ({
                ...current,
                knowledgeQuestion: event.target.value,
              }))}
            />
          </label>

          <label>
            Resposta
            <textarea
              rows={4}
              value={values.knowledgeAnswer}
              onChange={(event) => setValues((current) => ({
                ...current,
                knowledgeAnswer: event.target.value,
              }))}
            />
          </label>
        </section>

        {error && <div className={styles.moduleEditError}>{error}</div>}

        <div className={styles.editModalActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onClose}
            disabled={saving || uploading}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className={styles.primaryButton}
            disabled={saving || uploading}
          >
            <Save size={17} />
            {saving ? 'Salvando...' : 'Salvar conteúdo da aula'}
          </button>
        </div>
      </form>
    </div>
  );
}

function CourseMainContent({
  section,
  course,
  filteredModules,
  expandedModules,
  toggleModule,
  activeLesson,
  openLesson,
  navigateSection,
  isAdmin,
  onEditPage,
  onEditModule,
}) {
  if (section === 'visao-geral') {
    return <CourseOverviewSection course={course} onNavigateSection={navigateSection} />;
  }

  if (section === 'exercicios') {
    return <CourseExercisesSection course={course} onOpenLesson={openLesson} />;
  }

  if (section === 'projetos') {
    return <CourseProjectsSection course={course} />;
  }

  if (section === 'materiais') {
    return <CourseMaterialsSection course={course} />;
  }

  if (section === 'forum') {
    return <CourseForumSection course={course} />;
  }

  if (section === 'anotacoes') {
    return <CourseNotesSection course={course} />;
  }

  if (section === 'configuracoes') {
    return <CourseSettingsSection course={course} isAdmin={isAdmin} onEditPage={onEditPage} />;
  }

  return (
    <div className={styles.modulesStack}>
      {filteredModules.length > 0 ? (
        filteredModules.map((module) => (
          <CourseModuleAccordion
            key={module.id}
            module={module}
            expanded={Boolean(expandedModules[module.id])}
            toggleModule={toggleModule}
            activeLessonSlug={activeLesson?.lesson?.slug}
            onOpenLesson={openLesson}
            isAdmin={isAdmin}
            onEditModule={onEditModule}
          />
        ))
      ) : (
        <div className={styles.emptyModules}>
          <Search size={34} />
          <h2>Nenhuma aula encontrada</h2>
          <p>Altere a busca ou escolha outro filtro para visualizar o conteúdo deste curso.</p>
        </div>
      )}
    </div>
  );
}

function LessonMediaItems({ media = [], compact = false }) {
  if (!media.length) return null;

  return (
    <div
      className={`${styles.lessonMediaGrid} ${compact ? styles.lessonSectionMedia : ''}`.trim()}
    >
      {media.map((item) => (
        <figure key={item.id || item.url}>
          {item.type === 'video' ? (
            <video src={item.url} controls preload="metadata">
              Seu navegador não conseguiu reproduzir este vídeo.
            </video>
          ) : (
            <img src={item.url} alt={item.caption || item.name || 'Imagem da aula'} />
          )}
          {(item.caption || item.name) && (
            <figcaption>
              {item.type === 'video' ? <Video size={16} /> : <ImageIcon size={16} />}
              <span>{item.caption || item.name}</span>
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}

function LessonContentSection({ section }) {
  const toneClass = section.tone
    ? styles[`lessonSection${section.tone.charAt(0).toUpperCase()}${section.tone.slice(1)}`]
    : '';
  const mediaBeforeText = section.mediaPosition === 'before';

  return (
    <section className={`${styles.lessonContentSection} ${toneClass}`.trim()}>
      {section.eyebrow && <span>{section.eyebrow}</span>}
      <h2>{section.title}</h2>

      {mediaBeforeText && <LessonMediaItems media={section.media} compact />}

      {section.paragraphs?.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}

      {section.bullets?.length > 0 && (
        <ul>
          {section.bullets.map((bullet) => (
            <li key={bullet}>
              <Check size={16} />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      )}

      {!mediaBeforeText && <LessonMediaItems media={section.media} compact />}
    </section>
  );
}

function LessonComparison({ comparison }) {
  if (!comparison) return null;

  return (
    <section className={styles.lessonComparisonCard}>
      <div className={styles.lessonBlockHeading}>
        <span>COMPARATIVO</span>
        <h2>Veja as diferenças lado a lado</h2>
      </div>

      <div className={styles.lessonTableScroll}>
        <table>
          <thead>
            <tr>
              {comparison.headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparison.rows.map((row) => (
              <tr key={row.join('-')}>
                {row.map((cell) => (
                  <td key={cell}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LessonSteps({ steps }) {
  if (!steps?.length) return null;

  return (
    <section className={styles.lessonStepsCard}>
      <div className={styles.lessonBlockHeading}>
        <span>PASSO A PASSO</span>
        <h2>Fluxo recomendado</h2>
      </div>

      <div className={styles.lessonSteps}>
        {steps.map((step, index) => (
          <article key={step.title}>
            <b>{String(index + 1).padStart(2, '0')}</b>
            <div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function LessonChecklist({ title, items, Icone = ListChecks, variant = '' }) {
  if (!items?.length) return null;

  return (
    <section className={`${styles.lessonChecklistCard} ${variant}`.trim()}>
      <div className={styles.lessonChecklistTitle}>
        <span>
          {createElement(Icone, { size: 20 })}
        </span>
        <div>
          <small>REVISÃO DA AULA</small>
          <h2>{title}</h2>
        </div>
      </div>

      <ul>
        {items.map((item) => (
          <li key={item}>
            <CheckCircle2 size={18} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LessonNavigation({
  previousLesson,
  nextLesson,
  onNavigateLesson,
  onBackToLessons,
}) {
  return (
    <nav className={styles.lessonNavigation} aria-label="Navegação entre aulas">
      {previousLesson ? (
        <button type="button" onClick={() => onNavigateLesson(previousLesson.lesson)}>
          <ArrowLeft size={18} />
          <span>
            <small>Aula anterior</small>
            <strong>{previousLesson.lesson.title}</strong>
          </span>
        </button>
      ) : (
        <button type="button" onClick={onBackToLessons}>
          <ArrowLeft size={18} />
          <span>
            <small>Voltar</small>
            <strong>Ver todas as aulas</strong>
          </span>
        </button>
      )}

      {nextLesson ? (
        <button
          type="button"
          className={styles.lessonNavigationNext}
          onClick={() => onNavigateLesson(nextLesson.lesson)}
        >
          <span>
            <small>Próxima aula</small>
            <strong>{nextLesson.lesson.title}</strong>
          </span>
          <ArrowRight size={18} />
        </button>
      ) : (
        <button
          type="button"
          className={styles.lessonNavigationNext}
          onClick={onBackToLessons}
        >
          <span>
            <small>Trilha concluída</small>
            <strong>Voltar para o curso</strong>
          </span>
          <CheckCircle2 size={18} />
        </button>
      )}
    </nav>
  );
}

function LessonMediaGallery({ media = [] }) {
  if (!media.length) return null;

  return (
    <section className={styles.lessonMediaGallery}>
      <div className={styles.lessonBlockHeading}>
        <span>CONTEÚDO VISUAL</span>
        <h2>Imagens e vídeos desta aula</h2>
      </div>

      <LessonMediaItems media={media} />
    </section>
  );
}

function LessonDocumentViewer({ document }) {
  const DocumentIcon = document.type === 'excel'
    ? FileSpreadsheet
    : document.type === 'powerpoint'
      ? Presentation
      : FileText;

  return (
    <section className={styles.lessonDocumentViewer}>
      <header>
        <span className={styles.lessonDocumentIcon}>
          <DocumentIcon size={25} />
        </span>
        <div>
          <small>DOCUMENTO DA AULA · {lessonDocumentLabels[document.type]}</small>
          <h2>{document.name}</h2>
          <p>
            {document.type === 'pdf'
              ? 'Documento exibido diretamente nesta aula.'
              : 'Prévia convertida automaticamente para PDF. O original continua disponível.'}
          </p>
        </div>
        <a href={document.url} download={document.name}>
          <Download size={17} />
          Baixar original
        </a>
      </header>

      <div className={styles.lessonDocumentFrame}>
        <iframe
          src={`${document.previewUrl}#toolbar=1&navpanes=0&view=FitH`}
          title={`Visualização de ${document.name}`}
        />
      </div>
    </section>
  );
}

function CourseLessonPage({
  course,
  activeLesson,
  content,
  baseCoursePath,
  previousLesson,
  nextLesson,
  onNavigateLesson,
  onBackToLessons,
  isAdmin,
  onEditLesson,
  onToggleLessonComplete,
  completionSaving,
}) {
  const { lesson, module } = activeLesson;
  const TypeIcon = lessonTypeIcons[lesson.type] || FileText;
  const showDocument = content.displayMode === 'document' && content.document;
  const lessonCompleted = lesson.status === 'completed';

  return (
    <article className={styles.lessonPage}>
      <header className={styles.lessonHero}>
        <div className={styles.lessonBreadcrumb}>
          <button type="button" onClick={onBackToLessons}>
            <ArrowLeft size={16} />
            Curso {course.title}
          </button>
          <span>/</span>
          <span>Módulo {module.order}</span>
          <span>/</span>
          <strong>Aula {lesson.number}</strong>
        </div>

        <span className={styles.lessonKicker}>MÓDULO {module.order} · {module.title}</span>
        <h1>{lesson.title}</h1>
        <p>{content.summary}</p>

        <div className={styles.lessonMeta}>
          <span>
            <TypeIcon size={16} />
            {typeLabels[lesson.type] || 'Aula'}
          </span>
          <span>
            <CalendarDays size={16} />
            {lesson.duration}
          </span>
          <span>
            <BookOpen size={16} />
            Aula {lesson.number}
          </span>
          <span>
            <CheckCircle2 size={16} />
            Conteúdo disponível
          </span>
        </div>

        <div className={styles.lessonHeroFooter}>
          <span>{baseCoursePath}/aula/{lesson.slug}</span>
          <div className={styles.lessonHeroActions}>
            <button
              type="button"
              className={`${styles.lessonCompleteButton} ${
                lessonCompleted ? styles.lessonCompleteButtonDone : ''
              }`}
              onClick={() => onToggleLessonComplete(!lessonCompleted)}
              disabled={completionSaving}
            >
              <CheckCircle2 size={16} />
              {completionSaving
                ? 'Salvando...'
                : lessonCompleted
                  ? 'Aula concluída'
                  : 'Marcar como concluída'}
            </button>
            {isAdmin && (
              <button
                type="button"
                className={styles.lessonAdminEditButton}
                onClick={onEditLesson}
              >
                <Pencil size={16} />
                Editar aula
              </button>
            )}
            <button type="button" onClick={onBackToLessons}>
              Ver trilha completa
            </button>
          </div>
        </div>
      </header>

      {showDocument ? (
        <LessonDocumentViewer document={content.document} />
      ) : (
        <>
          <section className={styles.lessonObjectives}>
            <div>
              <span className={styles.lessonObjectiveIcon}>
                <Lightbulb size={22} />
              </span>
              <div>
                <small>OBJETIVOS</small>
                <h2>O que você vai aprender</h2>
              </div>
            </div>
            <ul>
              {content.objectives.map((objective) => (
                <li key={objective}>
                  <Check size={16} />
                  {objective}
                </li>
              ))}
            </ul>
          </section>

          <LessonMediaGallery media={content.media} />
          <LessonComparison comparison={content.comparison} />
          <LessonSteps steps={content.steps} />

          <div className={styles.lessonContentStack}>
            {content.sections.map((section) => (
              <LessonContentSection
                key={`${section.eyebrow}-${section.title}`}
                section={section}
              />
            ))}
          </div>

          {content.example && (
            <section className={styles.lessonExampleCard}>
              <div className={styles.lessonExampleHeading}>
                <span>
                  <MessageCircle size={21} />
                </span>
                <div>
                  <small>EXEMPLO PRÁTICO</small>
                  <h2>{content.example.title}</h2>
                </div>
              </div>
              <div className={styles.lessonExampleConversation}>
                <div>
                  <small>Cenário</small>
                  <p>{content.example.scenario}</p>
                </div>
                <div>
                  <small>Conduta recomendada</small>
                  <p>{content.example.response}</p>
                </div>
              </div>
            </section>
          )}

          <div className={styles.lessonReviewGrid}>
            <LessonChecklist title="Checklist de aplicação" items={content.checklist} />
            <LessonChecklist
              title="Pontos que ficam"
              items={content.takeaways}
              Icone={Lightbulb}
              variant={styles.lessonTakeaways}
            />
          </div>

          {content.knowledgeCheck && (
            <section className={styles.lessonKnowledgeCard}>
              <div>
                <span>FIXAÇÃO</span>
                <h2>{content.knowledgeCheck.question}</h2>
              </div>
              <p>{content.knowledgeCheck.answer}</p>
            </section>
          )}
        </>
      )}

      <LessonNavigation
        previousLesson={previousLesson}
        nextLesson={nextLesson}
        onNavigateLesson={onNavigateLesson}
        onBackToLessons={onBackToLessons}
      />
    </article>
  );
}

function LessonRightPanel({ course, activeLesson, onNavigateLesson, onSupportClick }) {
  const { lesson: currentLesson, module: currentModule } = activeLesson;

  return (
    <aside className={`${styles.rightPanel} ${styles.lessonRightPanel}`}>
      <section className={styles.panelCard}>
        <div className={styles.panelTitle}>
          <span>Nesta aula</span>
        </div>
        <strong>{currentLesson.title}</strong>
        <p>{currentModule.title}</p>
        <div className={styles.largeProgress}>
          Aula {currentLesson.number}
        </div>
        <div className={styles.panelMeta}>
          <span>{currentLesson.duration}</span>
          <span>{typeLabels[currentLesson.type] || 'Aula'}</span>
        </div>
      </section>

      <section className={styles.panelCard}>
        <div className={styles.panelTitle}>
          <span>Aulas do módulo</span>
        </div>
        <div className={styles.lessonOutline}>
          {currentModule.lessons.map((lesson) => (
            <button
              key={lesson.slug}
              type="button"
              className={lesson.slug === currentLesson.slug ? styles.lessonOutlineActive : ''}
              onClick={() => onNavigateLesson(lesson)}
            >
              <span>{lesson.number}</span>
              <strong>{lesson.title}</strong>
              <ArrowRight size={15} />
            </button>
          ))}
        </div>
      </section>

      <section className={styles.panelCard}>
        <div className={styles.panelTitle}>
          <span>Progresso do curso</span>
        </div>
        <div className={styles.largeProgress}>{course.progress}% concluído</div>
        <div className={styles.progressTrack}>
          <span style={{ width: `${course.progress}%` }} />
        </div>
        <button type="button" className={styles.secondaryButton} onClick={onSupportClick}>
          <HelpCircle size={16} />
          Tirar uma dúvida
        </button>
      </section>
    </aside>
  );
}

function CourseNotFound({ slug, message }) {
  const navigate = useNavigate();

  return (
    <main className={`${styles.courseShell} ${styles.notFoundShell}`}>
      <section className={styles.notFoundCard}>
        <BookOpen size={42} />
        <span>/wiki/curso/{slug}</span>
        <h1>Curso não encontrado</h1>
        <p>{message || 'Esse curso ainda não existe na Wiki ou o endereço foi digitado incorretamente.'}</p>
        <button type="button" className={styles.primaryButton} onClick={() => navigate('/wiki')}>
          Voltar para a Wiki
        </button>
      </section>
    </main>
  );
}

function CourseLoading({ slug }) {
  return (
    <main className={`${styles.courseShell} ${styles.notFoundShell}`}>
      <section className={styles.notFoundCard}>
        <BookOpen size={42} />
        <span>/wiki/curso/{slug}</span>
        <h1>Carregando curso</h1>
        <p>Buscando o conteúdo atualizado da Wiki interna.</p>
      </section>
    </main>
  );
}

export default function WikiCoursePage({ slug, lessonSlug, courseSection }) {
  const navigate = useNavigate();
  const location = useLocation();
  const baseCourse = findWikiCourseBySlug(slug);
  const userName = useMemo(() => getUserName(), []);
  const currentUser = useMemo(() => getCurrentUser(), []);
  const isAdmin = isAdminUser(currentUser);
  const token = useMemo(() => localStorage.getItem('token'), []);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [courseConfig, setCourseConfig] = useState(null);
  const [courseConfigError, setCourseConfigError] = useState('');
  const [moduleFeedback, setModuleFeedback] = useState('');
  const [moduleEditOpen, setModuleEditOpen] = useState(false);
  const [moduleEditValues, setModuleEditValues] = useState(null);
  const [moduleSaving, setModuleSaving] = useState(false);
  const [moduleEditError, setModuleEditError] = useState('');
  const [lessonContentOverride, setLessonContentOverride] = useState(null);
  const [lessonContentError, setLessonContentError] = useState('');
  const [lessonFeedback, setLessonFeedback] = useState('');
  const [lessonEditOpen, setLessonEditOpen] = useState(false);
  const [lessonEditValues, setLessonEditValues] = useState(null);
  const [lessonSaving, setLessonSaving] = useState(false);
  const [lessonUploading, setLessonUploading] = useState(false);
  const [lessonEditError, setLessonEditError] = useState('');
  const [catalogCourse, setCatalogCourse] = useState(null);
  const [catalogCourseLoading, setCatalogCourseLoading] = useState(!baseCourse);
  const [catalogCourseError, setCatalogCourseError] = useState('');
  const [courseProgress, setCourseProgress] = useState(null);
  const [courseProgressError, setCourseProgressError] = useState('');
  const [progressFeedback, setProgressFeedback] = useState('');
  const [progressSavingKey, setProgressSavingKey] = useState('');
  const [pageEdits, setPageEdits] = useState(() => loadPageEdits(slug));
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editValues, setEditValues] = useState({
    title: '',
    description: '',
    adminNote: '',
  });
  const courseSource = baseCourse || catalogCourse;
  const configuredCourse = useMemo(
    () => applyCourseConfig(courseSource, courseConfig),
    [courseSource, courseConfig]
  );
  const course = useMemo(
    () => applyCourseProgress(configuredCourse, courseProgress),
    [configuredCourse, courseProgress]
  );

  const baseCoursePath = location.pathname.startsWith('/cursos')
    ? `/cursos/curso/${slug}`
    : `/wiki/curso/${slug}`;
  const requestedSection = lessonSlug ? 'aulas' : courseSection || 'aulas';
  const activeSection = sectionContent[requestedSection] ? requestedSection : 'aulas';
  const activeSectionContent = getSectionContent(activeSection, pageEdits);

  const activeLesson = useMemo(() => (
    course ? findLesson(course, lessonSlug || course.currentLesson.slug) : null
  ), [course, lessonSlug]);
  const lessonSequence = useMemo(() => (
    course
      ? course.modules.flatMap((module) => (
        module.lessons.map((lesson) => ({ lesson, module }))
      ))
      : []
  ), [course]);
  const activeLessonIndex = activeLesson
    ? lessonSequence.findIndex((item) => item.lesson.slug === activeLesson.lesson.slug)
    : -1;
  const previousLesson = activeLessonIndex > 0 ? lessonSequence[activeLessonIndex - 1] : null;
  const nextLesson = activeLessonIndex >= 0 && activeLessonIndex < lessonSequence.length - 1
    ? lessonSequence[activeLessonIndex + 1]
    : null;
  const defaultLessonContent = useMemo(() => (
    course && activeLesson
      ? getWikiLessonContent({
        course,
        module: activeLesson.module,
        lesson: activeLesson.lesson,
      })
      : null
  ), [course, activeLesson]);
  const activeLessonContentKey = activeLesson?.lesson?.contentKey || activeLesson?.lesson?.slug || '';
  const lessonContent = (
    lessonContentOverride?.key === activeLessonContentKey &&
    lessonContentOverride.content
  )
    ? lessonContentOverride.content
    : defaultLessonContent;

  const [expandedModules, setExpandedModules] = useState(() => {
    if (!course) return {};

    return Object.fromEntries(course.modules.map((module) => [
      module.id,
      !module.collapsed || module.lessons.some((lesson) => lesson.slug === activeLesson?.lesson?.slug),
    ]));
  });

  useEffect(() => {
    let active = true;

    const loadCatalogCourse = async () => {
      if (baseCourse) {
        setCatalogCourse(null);
        setCatalogCourseLoading(false);
        setCatalogCourseError('');
        return;
      }

      if (!token) {
        setCatalogCourseLoading(false);
        return;
      }

      try {
        setCatalogCourseLoading(true);
        setCatalogCourseError('');

        const response = await api.get('/wiki', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const requestedSlug = normalizeWikiCourseSlug(slug);
        const categories = Array.isArray(response.data?.categorias)
          ? response.data.categorias
          : [];
        let foundCourse = null;
        let foundCategory = null;

        for (const category of categories) {
          const courses = Array.isArray(category?.cursos)
            ? category.cursos
            : Array.isArray(category?.artigos)
              ? category.artigos
              : [];
          const match = courses.find((courseItem) => (
            normalizeWikiCourseSlug(courseItem?.id || courseItem?.titulo) === requestedSlug
          ));

          if (match) {
            foundCourse = match;
            foundCategory = category;
            break;
          }
        }

        if (active) {
          setCatalogCourse(
            foundCourse
              ? createWikiCourseFromCatalogItem({
                course: foundCourse,
                category: foundCategory,
              })
              : null
          );
        }
      } catch (error) {
        if (active) {
          setCatalogCourseError(
            error.response?.data?.error || 'Não foi possível carregar este curso da Wiki.'
          );
          setCatalogCourse(null);
        }
      } finally {
        if (active) {
          setCatalogCourseLoading(false);
        }
      }
    };

    loadCatalogCourse();

    return () => {
      active = false;
    };
  }, [baseCourse, slug, token]);

  useEffect(() => {
    let active = true;

    const loadCourseProgress = async () => {
      if (!courseSource || !token) {
        setCourseProgress(null);
        return;
      }

      try {
        setCourseProgressError('');
        const response = await api.get(`/wiki/curso/${slug}/progresso`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (active) {
          setCourseProgress(response.data || null);
        }
      } catch (error) {
        if (active) {
          setCourseProgress(null);
          setCourseProgressError(
            error.response?.data?.error || 'Não foi possível carregar seu progresso neste curso.'
          );
        }
      }
    };

    loadCourseProgress();

    return () => {
      active = false;
    };
  }, [courseSource, slug, token]);

  useEffect(() => {
    let active = true;

    const loadCourseConfig = async () => {
      if (!courseSource || !token) return;

      try {
        setCourseConfigError('');
        const response = await api.get(`/wiki/curso/${slug}/config`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (active) {
          setCourseConfig(response.data?.config || { modules: [] });
        }
      } catch (error) {
        if (active) {
          setCourseConfigError(
            error.response?.data?.error || 'Não foi possível carregar as edições deste curso.'
          );
        }
      }
    };

    loadCourseConfig();

    return () => {
      active = false;
    };
  }, [courseSource, slug, token]);

  useEffect(() => {
    let active = true;

    const loadLessonContent = async () => {
      if (!token || !activeLessonContentKey) {
        setLessonContentOverride(null);
        return;
      }

      try {
        setLessonContentError('');
        setLessonFeedback('');
        setLessonContentOverride(null);

        const response = await api.get(
          `/wiki/curso/${slug}/aula/${activeLessonContentKey}/config`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (active) {
          setLessonContentOverride({
            key: activeLessonContentKey,
            content: response.data?.content || null,
          });
        }
      } catch (error) {
        if (active) {
          setLessonContentError(
            error.response?.data?.error || 'Não foi possível carregar o conteúdo editado da aula.'
          );
        }
      }
    };

    loadLessonContent();

    return () => {
      active = false;
    };
  }, [activeLessonContentKey, slug, token]);

  useEffect(() => {
    let active = true;

    const markLessonAccessed = async () => {
      if (!token || !lessonSlug || !activeLessonContentKey) return;

      try {
        setCourseProgressError('');
        const response = await api.put(
          `/wiki/curso/${slug}/aula/${activeLessonContentKey}/progresso`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (active) {
          setCourseProgress(response.data || null);
        }
      } catch (error) {
        if (active) {
          setCourseProgressError(
            error.response?.data?.error || 'Não foi possível atualizar sua última aula acessada.'
          );
        }
      }
    };

    markLessonAccessed();

    return () => {
      active = false;
    };
  }, [activeLessonContentKey, lessonSlug, slug, token]);

  useEffect(() => {
    if (!activeLesson?.module?.id) return;

    setExpandedModules((current) => ({
      ...current,
      [activeLesson.module.id]: true,
    }));
  }, [activeLesson?.module?.id]);

  useEffect(() => {
    if (!lessonSlug || !activeLesson || activeLesson.lesson.slug === lessonSlug) return;

    navigate(`${baseCoursePath}/aula/${activeLesson.lesson.slug}`, { replace: true });
  }, [activeLesson, baseCoursePath, lessonSlug, navigate]);

  if (!course && catalogCourseLoading) {
    return <CourseLoading slug={slug} />;
  }

  if (!course) {
    return <CourseNotFound slug={slug} message={catalogCourseError} />;
  }

  const filteredModules = course.modules.map((module) => {
    const term = normalizeText(search);
    const lessons = module.lessons.filter((lesson) => {
      const matchesSearch =
        !term ||
        normalizeText(lesson.title).includes(term) ||
        normalizeText(typeLabels[lesson.type]).includes(term) ||
        normalizeText(module.title).includes(term) ||
        normalizeText(module.description).includes(term);

      return matchesSearch && lessonMatchesFilter(lesson, filter);
    });

    return { ...module, lessons };
  }).filter((module) => module.lessons.length > 0);

  const toggleModule = (moduleId) => {
    setExpandedModules((current) => ({
      ...current,
      [moduleId]: !current[moduleId],
    }));
  };

  const openModuleEdit = (module) => {
    setModuleFeedback('');
    setModuleEditError('');
    setModuleEditValues({
      id: module.id,
      order: module.order,
      title: module.title,
      description: module.description,
      icon: module.icon,
      lessons: module.lessons.map((lesson) => ({
        contentKey: lesson.contentKey || lesson.slug,
        slug: lesson.slug,
        previousSlugs: lesson.previousSlugs || [],
        number: lesson.number,
        title: lesson.title,
        type: lesson.type,
        duration: lesson.duration,
      })),
    });
    setModuleEditOpen(true);
  };

  const closeModuleEdit = () => {
    if (moduleSaving) return;

    setModuleEditOpen(false);
    setModuleEditValues(null);
    setModuleEditError('');
  };

  const saveModuleEdit = async (event) => {
    event.preventDefault();

    if (!isAdmin || !moduleEditValues) return;

    const title = moduleEditValues.title.trim();

    if (!title) {
      setModuleEditError('Informe o título do módulo.');
      return;
    }

    const usedSlugs = new Set(
      course.modules
        .filter((module) => module.id !== moduleEditValues.id)
        .flatMap((module) => module.lessons.map((lesson) => lesson.slug))
    );
    const lessons = moduleEditValues.lessons.map((lesson, lessonIndex) => {
      const lessonTitle = lesson.title.trim() || `Aula ${moduleEditValues.order}.${lessonIndex + 1}`;
      const baseSlug = createLessonSlug(lessonTitle);
      let nextSlug = baseSlug;
      let suffix = 2;

      while (usedSlugs.has(nextSlug)) {
        nextSlug = `${baseSlug}-${suffix}`;
        suffix += 1;
      }

      usedSlugs.add(nextSlug);

      const previousSlugs = new Set(lesson.previousSlugs || []);
      if (lesson.slug && lesson.slug !== nextSlug) {
        previousSlugs.add(lesson.slug);
      }
      previousSlugs.delete(nextSlug);

      return {
        ...lesson,
        contentKey: lesson.contentKey || lesson.slug,
        slug: nextSlug,
        previousSlugs: [...previousSlugs],
        number: lesson.number.trim() || `${moduleEditValues.order}.${lessonIndex + 1}`,
        title: lessonTitle,
        duration: lesson.duration.trim() || 'Conteúdo',
      };
    });
    const editedModule = {
      ...course.modules.find((module) => module.id === moduleEditValues.id),
      title,
      description: moduleEditValues.description.trim(),
      icon: moduleEditValues.icon,
      lessons,
    };
    const nextModules = course.modules.map((module) => (
      module.id === editedModule.id ? editedModule : module
    ));

    try {
      setModuleSaving(true);
      setModuleEditError('');

      const response = await api.put(
        `/wiki/curso/${slug}/config`,
        serializeCourseModules(nextModules),
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setCourseConfig(response.data?.config || serializeCourseModules(nextModules));
      setModuleFeedback(`Módulo ${editedModule.order} atualizado com sucesso.`);
      setExpandedModules((current) => ({
        ...current,
        [editedModule.id]: true,
      }));
      setModuleEditOpen(false);
      setModuleEditValues(null);
    } catch (error) {
      setModuleEditError(
        error.response?.data?.error || 'Não foi possível salvar as alterações do módulo.'
      );
    } finally {
      setModuleSaving(false);
    }
  };

  const openLessonEdit = () => {
    if (!isAdmin || !activeLesson || !lessonContent) return;

    setLessonFeedback('');
    setLessonEditError('');
    setLessonEditValues(contentToLessonEditorValues(lessonContent));
    setLessonEditOpen(true);
  };

  const closeLessonEdit = () => {
    if (lessonSaving || lessonUploading) return;

    setLessonEditOpen(false);
    setLessonEditValues(null);
    setLessonEditError('');
  };

  const uploadLessonMedia = async (fileList, { sectionIndex = null } = {}) => {
    const files = Array.from(fileList || []);

    if (!files.length || !activeLessonContentKey) return;

    try {
      setLessonUploading(true);
      setLessonEditError('');

      for (const file of files) {
        if (!/^(image|video)\//i.test(file.type || '')) {
          throw new Error(`O arquivo "${file.name}" não é uma imagem ou vídeo.`);
        }

        const formData = new FormData();
        formData.append('arquivo', file);

        const response = await api.post(
          `/wiki/curso/${slug}/aula/${activeLessonContentKey}/upload`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setLessonEditValues((current) => {
          if (Number.isInteger(sectionIndex)) {
            return {
              ...current,
              sections: current.sections.map((section, index) => (
                index === sectionIndex
                  ? { ...section, media: [...section.media, response.data] }
                  : section
              )),
            };
          }

          return {
            ...current,
            media: [...current.media, response.data],
          };
        });
      }
    } catch (error) {
      setLessonEditError(
        error.response?.data?.error || error.message || 'Não foi possível enviar a mídia.'
      );
    } finally {
      setLessonUploading(false);
    }
  };

  const uploadLessonDocument = async (fileList) => {
    const file = Array.from(fileList || [])[0];

    if (!file || !activeLessonContentKey) return;

    if (!/\.(pdf|ppt|pptx|xls|xlsx)$/i.test(file.name || '')) {
      setLessonEditError('Envie um arquivo PDF, PowerPoint ou Excel.');
      return;
    }

    try {
      setLessonUploading(true);
      setLessonEditError('');

      const formData = new FormData();
      formData.append('arquivo', file);

      const response = await api.post(
        `/wiki/curso/${slug}/aula/${activeLessonContentKey}/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!['pdf', 'powerpoint', 'excel'].includes(response.data?.type)) {
        throw new Error('O arquivo enviado não foi reconhecido como documento.');
      }

      setLessonEditValues((current) => ({
        ...current,
        displayMode: 'document',
        document: response.data,
      }));
    } catch (error) {
      setLessonEditError(
        error.response?.data?.error || error.message || 'Não foi possível enviar o documento.'
      );
    } finally {
      setLessonUploading(false);
    }
  };

  const saveLessonEdit = async (event) => {
    event.preventDefault();

    if (!isAdmin || !lessonEditValues || !activeLessonContentKey) return;

    const content = lessonEditorValuesToContent(lessonEditValues);

    if (!content.summary) {
      setLessonEditError('Informe o resumo da aula.');
      return;
    }

    if (lessonEditValues.displayMode === 'document' && !lessonEditValues.document) {
      setLessonEditError('Envie um documento antes de escolher a exibição incorporada.');
      return;
    }

    try {
      setLessonSaving(true);
      setLessonEditError('');

      const response = await api.put(
        `/wiki/curso/${slug}/aula/${activeLessonContentKey}/config`,
        content,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const savedContent = response.data?.content || content;

      setLessonContentOverride({
        key: activeLessonContentKey,
        content: savedContent,
      });
      setLessonFeedback(`Conteúdo da aula ${activeLesson.lesson.number} atualizado com sucesso.`);
      setLessonEditOpen(false);
      setLessonEditValues(null);
    } catch (error) {
      setLessonEditError(
        error.response?.data?.error || 'Não foi possível salvar o conteúdo da aula.'
      );
    } finally {
      setLessonSaving(false);
    }
  };

  const updateLessonCompletion = async (completed) => {
    if (!activeLessonContentKey || progressSavingKey) return;

    try {
      setProgressSavingKey(activeLessonContentKey);
      setCourseProgressError('');
      setProgressFeedback('');

      const response = await api.put(
        `/wiki/curso/${slug}/aula/${activeLessonContentKey}/progresso`,
        { concluida: completed },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setCourseProgress(response.data || null);
      setProgressFeedback(
        completed
          ? `Aula ${activeLesson.lesson.number} marcada como concluída.`
          : `Conclusão da aula ${activeLesson.lesson.number} removida.`
      );
    } catch (error) {
      setCourseProgressError(
        error.response?.data?.error || 'Não foi possível atualizar a conclusão da aula.'
      );
    } finally {
      setProgressSavingKey('');
    }
  };

  const navigateSection = (section) => {
    if (section === 'aulas') {
      navigate(baseCoursePath);
      return;
    }

    navigate(`${baseCoursePath}/${section}`);
  };

  const openEditModal = () => {
    const content = getSectionContent(activeSection, pageEdits);

    setEditValues({
      title: content.title,
      description: content.description,
      adminNote: content.adminNote || '',
    });
    setEditModalOpen(true);
  };

  const savePageEdit = (event) => {
    event.preventDefault();

    const nextEdits = {
      ...pageEdits,
      [activeSection]: {
        title: editValues.title.trim() || sectionContent[activeSection].title,
        description: editValues.description.trim() || sectionContent[activeSection].description,
        adminNote: editValues.adminNote.trim(),
        updatedAt: new Date().toISOString(),
      },
    };

    localStorage.setItem(getPageEditStorageKey(slug), JSON.stringify(nextEdits));
    setPageEdits(nextEdits);
    setEditModalOpen(false);
  };

  const openLesson = (lesson) => {
    navigate(`${baseCoursePath}/aula/${lesson.slug}`);
  };

  const continueLesson = () => {
    navigate(`${baseCoursePath}/aula/${course.currentLesson.slug}`);
  };

  const handleSupportClick = () => {
    navigate('/chat');
  };

  const handleDashboardClick = () => {
    navigate('/wiki');
  };
  const showLessonPage = Boolean(lessonSlug && activeLesson && lessonContent);

  return (
    <main className={styles.courseShell}>
      <CourseTopNav userName={userName} onDashboardClick={handleDashboardClick} />

      <div className={styles.courseLayout}>
        <CourseSidebar
          course={course}
          activeSection={activeSection}
          baseCoursePath={baseCoursePath}
          onSupportClick={handleSupportClick}
          onNavigateSection={navigateSection}
        />

        <section className={styles.centerColumn}>
          {showLessonPage ? (
            <>
              {lessonContentError && (
                <div className={styles.courseConfigError}>
                  {lessonContentError}
                </div>
              )}
              {lessonFeedback && (
                <div className={styles.courseConfigSuccess}>
                  <CheckCircle2 size={17} />
                  {lessonFeedback}
                </div>
              )}
              {courseProgressError && (
                <div className={styles.courseConfigError}>
                  {courseProgressError}
                </div>
              )}
              {progressFeedback && (
                <div className={styles.courseConfigSuccess}>
                  <CheckCircle2 size={17} />
                  {progressFeedback}
                </div>
              )}
              <CourseLessonPage
                course={course}
                activeLesson={activeLesson}
                content={lessonContent}
                baseCoursePath={baseCoursePath}
                previousLesson={previousLesson}
                nextLesson={nextLesson}
                onNavigateLesson={openLesson}
                onBackToLessons={() => navigate(baseCoursePath)}
                isAdmin={isAdmin}
                onEditLesson={openLessonEdit}
                onToggleLessonComplete={updateLessonCompletion}
                completionSaving={progressSavingKey === activeLessonContentKey}
              />
            </>
          ) : (
            <>
              <CourseHero course={course} baseCoursePath={baseCoursePath} onContinue={continueLesson} />
              <CourseSectionHeader
                title={activeSectionContent.title}
                description={activeSectionContent.description}
                activeSection={activeSection}
                isAdmin={isAdmin}
                onEditPage={openEditModal}
              />

              {isAdmin && activeSectionContent.adminNote && (
                <div className={styles.adminNoteBox}>
                  <strong>Observação administrativa</strong>
                  <p>{activeSectionContent.adminNote}</p>
                </div>
              )}

              {activeSection === 'aulas' && (
                <CourseSearchFilters
                  search={search}
                  setSearch={setSearch}
                  filter={filter}
                  setFilter={setFilter}
                />
              )}

              {courseConfigError && (
                <div className={styles.courseConfigError}>
                  {courseConfigError}
                </div>
              )}

              {courseProgressError && (
                <div className={styles.courseConfigError}>
                  {courseProgressError}
                </div>
              )}

              {moduleFeedback && (
                <div className={styles.courseConfigSuccess}>
                  <CheckCircle2 size={17} />
                  {moduleFeedback}
                </div>
              )}

              <CourseMainContent
                section={activeSection}
                course={course}
                filteredModules={filteredModules}
                expandedModules={expandedModules}
                toggleModule={toggleModule}
                activeLesson={activeLesson}
                openLesson={openLesson}
                navigateSection={navigateSection}
                isAdmin={isAdmin}
                onEditPage={openEditModal}
                onEditModule={openModuleEdit}
              />
            </>
          )}
        </section>

        {showLessonPage ? (
          <LessonRightPanel
            course={course}
            activeLesson={activeLesson}
            onNavigateLesson={openLesson}
            onSupportClick={handleSupportClick}
          />
        ) : (
          <CourseRightPanel
            course={course}
            onWatchLesson={continueLesson}
            onSupportClick={handleSupportClick}
          />
        )}
      </div>

      <AdminEditModal
        open={editModalOpen}
        section={activeSection}
        values={editValues}
        setValues={setEditValues}
        onClose={() => setEditModalOpen(false)}
        onSave={savePageEdit}
      />

      <ModuleEditModal
        open={moduleEditOpen}
        values={moduleEditValues}
        setValues={setModuleEditValues}
        saving={moduleSaving}
        error={moduleEditError}
        onClose={closeModuleEdit}
        onSave={saveModuleEdit}
      />

      <LessonEditModal
        open={lessonEditOpen}
        lesson={activeLesson?.lesson}
        values={lessonEditValues}
        setValues={setLessonEditValues}
        saving={lessonSaving}
        uploading={lessonUploading}
        error={lessonEditError}
        onClose={closeLessonEdit}
        onSave={saveLessonEdit}
        onUploadMedia={uploadLessonMedia}
        onUploadDocument={uploadLessonDocument}
      />
    </main>
  );
}
