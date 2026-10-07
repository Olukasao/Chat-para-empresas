import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  BookOpen,
  FileText,
  Loader2,
  MessageSquareText,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import api from '../services/api';
import { wikiCourses } from '../data/wikiCourses';
import { getWikiLessonContent } from '../data/wikiLessonContent';
import { useInternalBack, useInternalNavigation } from '../utils/internalNavigation';
import styles from '../styles/GlobalSearch.module.css';

const SECTION_META = {
  messages: {
    icon: MessageSquareText,
    description: 'Conversas diretas e grupos que você pode acessar',
  },
  wiki: {
    icon: BookOpen,
    description: 'Cursos, categorias e aulas da Wiki interna',
  },
  attendance_texts: {
    icon: FileText,
    description: 'Modelos prontos e procedimentos de atendimento',
  },
  internal_announcements: {
    icon: Bell,
    description: 'Comunicados, metas e conteúdos publicados',
  },
  best_practices: {
    icon: ShieldCheck,
    description: 'Orientações de atendimento e dúvidas respondidas',
  },
};

const EMPTY_SECTIONS = [
  { id: 'messages', label: 'Mensagens', total: 0, results: [] },
  { id: 'wiki', label: 'Wiki', total: 0, results: [] },
  { id: 'attendance_texts', label: 'Textos para Atendimento', total: 0, results: [] },
  { id: 'internal_announcements', label: 'Avisos Internos', total: 0, results: [] },
  { id: 'best_practices', label: 'Boas Práticas', total: 0, results: [] },
];

const normalizarBusca = (valor = '') => (
  String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
);

const textoPlano = (valor = '') => (
  String(valor || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
);

const extrairTextos = (valor, textos = []) => {
  if (valor === null || valor === undefined) return textos;

  if (['string', 'number', 'boolean'].includes(typeof valor)) {
    const texto = textoPlano(valor);
    if (texto) textos.push(texto);
    return textos;
  }

  if (Array.isArray(valor)) {
    valor.forEach((item) => extrairTextos(item, textos));
    return textos;
  }

  if (typeof valor === 'object') {
    Object.values(valor).forEach((item) => extrairTextos(item, textos));
  }

  return textos;
};

const criarSnippet = (valor, termo, tamanho = 220) => {
  const texto = textoPlano(valor);
  if (!texto) return '';

  const textoNormalizado = normalizarBusca(texto);
  const termoNormalizado = normalizarBusca(termo);
  const indice = termoNormalizado ? textoNormalizado.indexOf(termoNormalizado) : -1;
  const inicio = indice > 48 ? indice - 48 : 0;
  const fim = Math.min(texto.length, inicio + tamanho);

  return `${inicio > 0 ? '...' : ''}${texto.slice(inicio, fim).trim()}${fim < texto.length ? '...' : ''}`;
};

const formatarData = (valor) => {
  if (!valor) return '';

  return new Date(valor).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const criarResultadosWikiLocais = (termo, limite = 10) => {
  const termoNormalizado = normalizarBusca(termo);
  if (termoNormalizado.length < 2) return [];

  const resultados = [];
  const adicionar = (resultado, textos) => {
    if (resultados.length >= limite) return;
    if (!normalizarBusca(textos.join(' ')).includes(termoNormalizado)) return;

    resultados.push({
      id: resultado.id,
      source: 'wiki',
      source_label: 'Wiki',
      title: resultado.title,
      subtitle: resultado.subtitle,
      snippet: criarSnippet(textos.join(' '), termo),
      url: resultado.url,
      date: resultado.date || null,
      local: true,
    });
  };

  wikiCourses.forEach((course) => {
    const courseTexts = extrairTextos({
      title: course.title,
      description: course.description,
      category: course.category,
      level: course.level,
      badges: course.badges,
      currentLesson: course.currentLesson,
    });

    adicionar({
      id: `wiki-local-course-${course.slug}`,
      title: course.title,
      subtitle: course.category || 'Curso da Wiki',
      url: `/wiki/curso/${course.slug}`,
      date: course.updatedAt,
    }, courseTexts);

    (course.modules || []).forEach((module) => {
      const moduleTexts = extrairTextos({
        title: module.title,
        description: module.description,
      });

      adicionar({
        id: `wiki-local-module-${course.slug}-${module.id}`,
        title: module.title,
        subtitle: course.title,
        url: `/wiki/curso/${course.slug}`,
        date: course.updatedAt,
      }, moduleTexts);

      (module.lessons || []).forEach((lesson) => {
        const lessonTexts = extrairTextos(lesson);

        if (['massivos', 'acesso-externo-dispositivos'].includes(course.slug)) {
          try {
            lessonTexts.push(...extrairTextos(getWikiLessonContent({ course, module, lesson })));
          } catch {
            // Conteúdos customizados da Wiki não devem bloquear a busca global.
          }
        }

        adicionar({
          id: `wiki-local-lesson-${course.slug}-${lesson.slug}`,
          title: lesson.title,
          subtitle: `${course.title} • ${module.title}`,
          url: `/wiki/curso/${course.slug}/aula/${lesson.slug}`,
          date: course.updatedAt,
        }, lessonTexts);
      });
    });
  });

  return resultados;
};

export default function GlobalSearch() {
  const navigate = useNavigate();
  const voltarPaginaInterna = useInternalBack('/chat');
  const navegarInterno = useInternalNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const termoInicial = searchParams.get('q') || searchParams.get('busca') || '';
  const [busca, setBusca] = useState(termoInicial);
  const [consulta, setConsulta] = useState(termoInicial.trim());
  const [resultado, setResultado] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const id = window.setTimeout(() => {
      const proximaConsulta = busca.trim();
      setConsulta(proximaConsulta);
      setSearchParams(proximaConsulta ? { q: proximaConsulta } : {}, { replace: true });
    }, 320);

    return () => window.clearTimeout(id);
  }, [busca, setSearchParams]);

  useEffect(() => {
    const carregarResultados = async () => {
      if (consulta.length < 2) {
        setResultado(null);
        setErro('');
        setCarregando(false);
        return;
      }

      const token = localStorage.getItem('token');

      if (!token) {
        navigate('/login', { replace: true });
        return;
      }

      try {
        setCarregando(true);
        setErro('');

        const { data } = await api.get('/search/global', {
          params: { q: consulta, limit: 12 },
          headers: { Authorization: `Bearer ${token}` },
        });

        setResultado(data);
      } catch (err) {
        console.error('Erro ao executar busca global:', err);

        if (err.response?.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          navigate('/login', { replace: true });
          return;
        }

        setErro(err.response?.data?.error || 'Não foi possível executar a busca.');
      } finally {
        setCarregando(false);
      }
    };

    carregarResultados();
  }, [consulta, navigate]);

  const secoes = useMemo(() => {
    const base = Array.isArray(resultado?.sections) ? resultado.sections : EMPTY_SECTIONS;
    const wikiLocal = criarResultadosWikiLocais(consulta, 10);

    return base.map((secao) => {
      if (secao.id !== 'wiki') return secao;

      const vistos = new Set((secao.results || []).map((item) => `${item.url}-${item.title}`));
      const complementares = wikiLocal.filter((item) => {
        const chave = `${item.url}-${item.title}`;
        if (vistos.has(chave)) return false;
        vistos.add(chave);
        return true;
      });
      const results = [...(secao.results || []), ...complementares].slice(0, 18);

      return {
        ...secao,
        total: results.length,
        results,
      };
    });
  }, [resultado, consulta]);

  const totalResultados = secoes.reduce((total, secao) => total + secao.total, 0);
  const consultaCurta = consulta.length > 0 && consulta.length < 2;
  const temBusca = consulta.length >= 2;

  const abrirResultado = (url) => {
    if (!url) return;
    navegarInterno(url);
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <button type="button" className={styles.backButton} onClick={voltarPaginaInterna}>
          <ArrowLeft size={18} />
          Voltar
        </button>

        <section className={styles.hero}>
          <span>
            <Search size={16} />
            Pesquisa interna
          </span>
          <h1>Busca Global</h1>
          <p>Pesquise em mensagens, Wiki, textos para atendimento, avisos internos e boas práticas.</p>
        </section>

        <section className={styles.searchPanel}>
          <label className={styles.searchBox}>
            <Search size={22} />
            <input
              type="search"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              autoFocus
              placeholder="Digite pelo menos 2 caracteres"
            />
            {busca && (
              <button type="button" onClick={() => setBusca('')} title="Limpar busca">
                <X size={18} />
              </button>
            )}
          </label>
          <div className={styles.searchStatus}>
            {carregando ? (
              <span>
                <Loader2 size={16} />
                Buscando...
              </span>
            ) : temBusca ? (
              <span>{totalResultados} resultados encontrados</span>
            ) : (
              <span>Mensagens respeitam suas permissões de conversa e grupo.</span>
            )}
          </div>
        </section>

        {erro && <div className={styles.errorBox}>{erro}</div>}

        {consultaCurta && (
          <div className={styles.emptyState}>
            Digite mais um caractere para iniciar a busca.
          </div>
        )}

        {!temBusca && !consultaCurta && (
          <div className={styles.emptyState}>
            Comece procurando por nome, procedimento, aviso, assunto de Wiki ou trecho de mensagem.
          </div>
        )}

        {temBusca && !carregando && totalResultados === 0 && !erro && (
          <div className={styles.emptyState}>
            Nenhum resultado encontrado para “{consulta}”.
          </div>
        )}

        {temBusca && totalResultados > 0 && (
          <div className={styles.resultsLayout}>
            {secoes.map((secao) => {
              const Icone = SECTION_META[secao.id]?.icon || Search;
              const descricao = SECTION_META[secao.id]?.description || '';

              return (
                <section key={secao.id} className={styles.section}>
                  <header className={styles.sectionHeader}>
                    <span className={styles.sectionIcon}>
                      <Icone size={20} />
                    </span>
                    <div>
                      <h2>{secao.label}</h2>
                      <p>{descricao}</p>
                    </div>
                    <strong>{secao.total}</strong>
                  </header>

                  {secao.results.length === 0 ? (
                    <div className={styles.sectionEmpty}>Nada encontrado nesta origem.</div>
                  ) : (
                    <div className={styles.resultList}>
                      {secao.results.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={styles.resultCard}
                          onClick={() => abrirResultado(item.url)}
                        >
                          <span className={styles.resultSource}>{item.source_label || secao.label}</span>
                          <strong>{item.title}</strong>
                          {item.subtitle && <em>{item.subtitle}</em>}
                          {item.snippet && <p>{item.snippet}</p>}
                          {item.date && <small>{formatarData(item.date)}</small>}
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
