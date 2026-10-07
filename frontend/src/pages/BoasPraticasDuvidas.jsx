import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  BookOpen,
  Calculator,
  Check,
  CheckCircle2,
  CircleHelp,
  Copy,
  Globe2,
  Network,
  Router,
  MessageSquareText,
  Search,
  Send,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  X,
} from 'lucide-react';
import api from '../services/api';
import { useInternalBack, useInternalNavigation } from '../utils/internalNavigation';
import styles from '../styles/BoasPraticasDuvidas.module.css';

const obterUsuarioLocal = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

const formatarData = (valor) => {
  if (!valor) return '';

  return new Date(valor).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const respostaProntaAcessoExterno = `Para verificarmos a possibilidade de acesso externo ao seu dispositivo, precisamos confirmar algumas informações sobre a sua rede.

Você possui um roteador ou gateway próprio no local? Se sim, poderia nos informar a marca e o modelo do equipamento?

Também precisamos verificar se esse equipamento aceita configuração PPPoE, pois o acesso externo depende da forma como a conexão chega até sua rede e de como o roteador trata as portas e o NAT.

Caso seja necessário IP público, podemos avaliar uma solução semi-dedicada ou dedicada. Para link dedicado, o plano mínimo é de 100 Megas.`;

const copiarTexto = async (texto) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(texto);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = texto;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
};

export default function BoasPraticasDuvidas() {
  const navigate = useNavigate();
  const location = useLocation();
  const voltarPaginaInterna = useInternalBack('/chat');
  const navegarInterno = useInternalNavigation();
  const parametrosIniciais = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const usuarioLogado = useMemo(() => obterUsuarioLocal(), []);
  const [questionModalAberto, setQuestionModalAberto] = useState(false);
  const [questionForm, setQuestionForm] = useState({
    nome: usuarioLogado?.nome || '',
    setor: '',
    descricao: '',
  });
  const [questionErro, setQuestionErro] = useState('');
  const [questionSucesso, setQuestionSucesso] = useState('');
  const [questionEnviando, setQuestionEnviando] = useState(false);
  const [perguntasRespondidas, setPerguntasRespondidas] = useState([]);
  const [carregandoPerguntas, setCarregandoPerguntas] = useState(true);
  const [erroPerguntas, setErroPerguntas] = useState('');
  const [buscaPerguntas, setBuscaPerguntas] = useState(() => (
    parametrosIniciais.get('busca') || parametrosIniciais.get('q') || ''
  ));
  const [respostaAcessoCopiada, setRespostaAcessoCopiada] = useState(false);
  const [acessoExternoAberto, setAcessoExternoAberto] = useState(false);
  const acessoExternoRef = useRef(null);

  const perguntasFiltradas = useMemo(() => {
    const termo = buscaPerguntas.trim().toLowerCase();

    if (!termo) return perguntasRespondidas;

    return perguntasRespondidas.filter((pergunta) => (
      [
        pergunta.nome,
        pergunta.setor,
        pergunta.descricao,
        pergunta.resposta,
        pergunta.resolvido_por_nome,
      ]
        .filter(Boolean)
        .some((valor) => String(valor).toLowerCase().includes(termo))
    ));
  }, [buscaPerguntas, perguntasRespondidas]);

  const abrirQuestionModal = () => {
    setQuestionErro('');
    setQuestionSucesso('');
    setQuestionForm({ nome: usuarioLogado?.nome || '', setor: '', descricao: '' });
    setQuestionModalAberto(true);
  };

  const fecharQuestionModal = () => {
    if (questionEnviando) return;
    setQuestionModalAberto(false);
    setQuestionErro('');
  };

  const alterarQuestionForm = (campo, valor) => {
    setQuestionErro('');
    setQuestionSucesso('');
    setQuestionForm((atual) => ({
      ...atual,
      [campo]: valor,
    }));
  };

  const enviarQuestion = async (event) => {
    event.preventDefault();

    const nome = questionForm.nome.trim();
    const descricao = questionForm.descricao.trim();

    if (!nome || !descricao) {
      setQuestionErro('Preencha nome e descrição para enviar sua pergunta.');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setQuestionErro('Faça login novamente para enviar sua pergunta.');
      return;
    }

    try {
      setQuestionEnviando(true);
      setQuestionErro('');
      setQuestionSucesso('');

      await api.post(
        '/boas-praticas-duvidas/perguntas',
        {
          nome,
          setor: questionForm.setor.trim() || null,
          descricao,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setQuestionSucesso('Pergunta enviada com sucesso aos administradores.');
      setQuestionForm({ nome: usuarioLogado?.nome || '', setor: '', descricao: '' });

      window.setTimeout(() => {
        setQuestionModalAberto(false);
        setQuestionSucesso('');
      }, 900);
    } catch (err) {
      console.error('Erro ao enviar pergunta:', err);
      setQuestionErro('Não foi possível enviar sua pergunta. Tente novamente.');
    } finally {
      setQuestionEnviando(false);
    }
  };

  const copiarRespostaAcessoExterno = async () => {
    try {
      await copiarTexto(respostaProntaAcessoExterno);
      setRespostaAcessoCopiada(true);
      window.setTimeout(() => setRespostaAcessoCopiada(false), 1600);
    } catch (err) {
      console.error('Erro ao copiar resposta pronta:', err);
    }
  };

  const abrirAcessoExterno = () => {
    if (acessoExternoAberto) {
      acessoExternoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    setAcessoExternoAberto(true);
  };

  useEffect(() => {
    if (!acessoExternoAberto) return undefined;

    const animationFrameId = window.requestAnimationFrame(() => {
      acessoExternoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [acessoExternoAberto]);

  useEffect(() => {
    const carregarPerguntasRespondidas = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setCarregandoPerguntas(false);
        return;
      }

      try {
        setErroPerguntas('');
        setCarregandoPerguntas(true);

        const { data } = await api.get('/boas-praticas-duvidas/perguntas/respondidas', {
          headers: { Authorization: `Bearer ${token}` },
        });

        setPerguntasRespondidas(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Erro ao carregar perguntas respondidas:', error);
        setErroPerguntas('Não foi possível carregar as dúvidas respondidas no momento.');
      } finally {
        setCarregandoPerguntas(false);
      }
    };

    carregarPerguntasRespondidas();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const termo = params.get('busca') || params.get('q');

    if (termo !== null) {
      setBuscaPerguntas(termo);
    }
  }, [location.search]);

  useEffect(() => {
    if (!location.hash || carregandoPerguntas) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      document
        .getElementById(location.hash.slice(1))
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [location.hash, carregandoPerguntas, perguntasFiltradas.length]);

  return (
    <div className={styles.page}>
      <main className={styles.shell}>
        <button type="button" className={styles.backButton} onClick={voltarPaginaInterna}>
          <ArrowLeft size={18} />
          Voltar
        </button>

        <section className={styles.hero}>
          <span>
            <CircleHelp size={16} />
            Orientações internas
          </span>
          <h1>Dúvidas Respondidas</h1>
          <p>
            Utilize este espaço para consultar orientações, tirar dúvidas e acompanhar informações importantes sobre o uso da intranet e do chat interno.
          </p>
        </section>

        <section className={styles.notice}>
          <div className={styles.noticeIcon}>
            <ShieldCheck size={28} />
          </div>
          <p>
            Antes de abrir um chamado ou solicitar suporte, verifique se sua dúvida já foi respondida nos avisos, comunicados ou materiais disponíveis.
          </p>
        </section>

        <section className={styles.callout}>
          <div>
            <strong>Tem uma dúvida para os administradores?</strong>
            <p>Use este botão para enviar sua pergunta diretamente à equipe administrativa.</p>
          </div>
          <button type="button" className={styles.calloutButton} onClick={abrirQuestionModal}>
            <Send size={18} />
            Abrir dúvida para admins
          </button>
        </section>

        <div className={styles.actions}>
          <button type="button" className={styles.actionButton} onClick={() => navegarInterno('/avisos-internos')}>
            <Bell size={18} />
            Avisos internos
          </button>
          <button type="button" className={styles.actionButton} onClick={() => navegarInterno('/wiki')}>
            <BookOpen size={18} />
            Wiki interna
          </button>
        </div>

        <section className={styles.answersSection}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Dúvidas respondidas</h2>
              <p>As respostas publicadas pelos administradores ficam fixadas para toda a equipe.</p>
            </div>
            <span className={styles.answerTotal}>
              {perguntasRespondidas.length} {perguntasRespondidas.length === 1 ? 'dúvida fixada' : 'dúvidas fixadas'}
            </span>
          </div>

          <button
            type="button"
            className={styles.featuredQuestionButton}
            onClick={abrirAcessoExterno}
            aria-expanded={acessoExternoAberto}
            aria-controls="acesso-externo-dispositivos"
          >
            <span className={styles.featuredQuestionIcon}>
              <Globe2 size={20} />
            </span>
            <span className={styles.featuredQuestionText}>
              <strong>Acesso Externo a Dispositivos / IP fixo</strong>
              <span>Orientação para atendimento quando o cliente deseja acessar um dispositivo de fora da rede.</span>
            </span>
            <span className={styles.featuredQuestionAction}>
              {acessoExternoAberto ? 'Aberto' : 'Abrir'}
            </span>
          </button>

          {carregandoPerguntas ? (
            <div className={styles.emptyAnswers}>Carregando perguntas respondidas...</div>
          ) : erroPerguntas ? (
            <div className={styles.emptyAnswers}>{erroPerguntas}</div>
          ) : perguntasRespondidas.length === 0 ? (
            <div className={styles.emptyAnswers}>
              Ainda não há dúvidas respondidas. Envie a sua pergunta para que os administradores possam responder.
            </div>
          ) : (
            <>
              <label className={styles.searchBox}>
                <Search size={18} />
                <input
                  type="search"
                  value={buscaPerguntas}
                  onChange={(event) => setBuscaPerguntas(event.target.value)}
                  placeholder="Buscar por pergunta, resposta ou setor"
                />
              </label>

              {perguntasFiltradas.length === 0 ? (
                <div className={styles.emptyAnswers}>Nenhuma dúvida fixada corresponde à busca.</div>
              ) : (
                <div className={styles.answerList}>
                  {perguntasFiltradas.map((pergunta) => (
                    <article
                      id={`pergunta-${pergunta.id}`}
                      key={pergunta.id}
                      className={styles.answerCard}
                    >
                      <div className={styles.answerHeader}>
                        <div className={styles.answerAuthor}>
                          <span className={styles.answerAvatar}>
                            <UserRound size={18} />
                          </span>
                          <div>
                            <strong>{pergunta.nome}</strong>
                            <span>{pergunta.setor || 'Sem setor informado'}</span>
                          </div>
                        </div>

                        <span className={styles.fixedBadge}>
                          <CheckCircle2 size={14} />
                          Fixada
                        </span>
                      </div>

                      <div className={styles.answerQuestion}>
                        <strong>
                          <MessageSquareText size={16} />
                          Pergunta
                        </strong>
                        <p>{pergunta.descricao}</p>
                      </div>

                      <div className={styles.answerResponse}>
                        <strong>
                          <CheckCircle2 size={16} />
                          Resposta
                        </strong>
                        <p>{pergunta.resposta}</p>
                      </div>

                      <div className={styles.answerMeta}>
                        <span>{pergunta.resolvido_por_nome ? `Respondido por ${pergunta.resolvido_por_nome}` : 'Respondido pelos administradores'}</span>
                        <span>{formatarData(pergunta.resolvido_em || pergunta.updated_at)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {acessoExternoAberto && (
        <section
          id="acesso-externo-dispositivos"
          ref={acessoExternoRef}
          className={styles.externalAccessSection}
        >
          <div className={styles.sectionHeader}>
            <div>
              <h2>Acesso Externo a Dispositivos</h2>
              <p>Orientação para atendimento quando o cliente deseja acessar um dispositivo de fora da rede.</p>
            </div>
            <div className={styles.externalAccessHeaderActions}>
              <span className={styles.answerTotal}>
                <Globe2 size={14} />
                Rede externa
              </span>
              <button
                type="button"
                className={styles.calculatorLinkButton}
                onClick={() => navigate('/?calculadora=link-dedicado')}
              >
                <Calculator size={15} />
                Ir para a calculadora
              </button>
              <button
                type="button"
                className={styles.collapseButton}
                onClick={() => setAcessoExternoAberto(false)}
              >
                Ocultar
              </button>
            </div>
          </div>

          <div className={styles.externalAccessGrid}>
            <article className={`${styles.answerCard} ${styles.externalAccessCard}`}>
              <strong className={styles.externalAccessCardTitle}>
                <Network size={18} />
                O que verificar primeiro
              </strong>
              <p>
                Antes de informar se é possível realizar o acesso externo, precisamos entender como está montada a rede do cliente.
              </p>
              <ol className={styles.checkList}>
                <li>O cliente possui roteador/gateway próprio no local?</li>
                <li>Qual é a marca e modelo desse equipamento?</li>
                <li>O dispositivo que deseja acessar está ligado nesse roteador/gateway?</li>
                <li>O equipamento aceita configuração PPPoE?</li>
                <li>
                  Qual dispositivo será acessado externamente?
                  <ul>
                    <li>Câmera</li>
                    <li>DVR/NVR</li>
                    <li>Servidor</li>
                    <li>Sistema interno</li>
                    <li>Automação</li>
                    <li>Outro equipamento</li>
                  </ul>
                </li>
                <li>O cliente sabe qual porta ou sistema será usado para acesso?</li>
              </ol>
            </article>

            <article className={`${styles.answerCard} ${styles.externalAccessCard}`}>
              <strong className={styles.externalAccessCardTitle}>
                <Globe2 size={18} />
                IPv4 serve?
              </strong>
              <p>
                Sim, IPv4 serve, desde que seja um IPv4 público.
              </p>
              <p>
                O IP não precisa obrigatoriamente ser fixo. Se for um IPv4 público dinâmico, o cliente pode usar DDNS, como No-IP, DuckDNS ou serviço semelhante.
              </p>
              <p>
                Porém, se o cliente estiver em CGNAT, o redirecionamento de portas não funcionará para acesso externo direto.
              </p>
            </article>

            <article className={`${styles.answerCard} ${styles.externalAccessCard}`}>
              <strong className={styles.externalAccessCardTitle}>
                <Router size={18} />
                O que é necessário para funcionar
              </strong>
              <p>Para acesso externo tradicional, normalmente é necessário:</p>
              <ul className={styles.checkList}>
                <li>Roteador/gateway no local;</li>
                <li>IPv4 público;</li>
                <li>Redirecionamento de portas;</li>
                <li>Firewall liberado;</li>
                <li>Dispositivo configurado corretamente;</li>
                <li>DDNS, caso o IP seja dinâmico.</li>
              </ul>
              <div className={styles.networkFlow}>
                Internet <span>→</span> Roteador/Gateway do cliente <span>→</span> Dispositivo interno
              </div>
            </article>

            <article className={`${styles.answerCard} ${styles.externalAccessCard}`}>
              <strong className={styles.externalAccessCardTitle}>
                <CircleHelp size={18} />
                E se o cliente não tiver gateway?
              </strong>
              <p>
                Se o cliente não tiver um roteador/gateway próprio, não terá onde configurar NAT, redirecionamento de portas ou controle adequado da rede.
              </p>
              <p>Nesse caso, é necessário avaliar:</p>
              <ul className={styles.checkList}>
                <li>Instalação ou configuração de um gateway;</li>
                <li>Equipamento que aceite PPPoE;</li>
                <li>Solução semi-dedicada;</li>
                <li>Link dedicado;</li>
                <li>VPN ou solução em nuvem, dependendo do dispositivo.</li>
              </ul>
            </article>

            <article className={`${styles.answerCard} ${styles.externalAccessCard}`}>
              <strong className={styles.externalAccessCardTitle}>
                <ShieldCheck size={18} />
                Solução comercial
              </strong>
              <p>
                Caso o cliente precise de acesso externo com IP público, podemos avaliar uma solução semi-dedicada ou dedicada.
              </p>
              <div className={styles.commercialHighlight}>
                <span>Para link dedicado, o mínimo comercial é:</span>
                <strong>100 Megas</strong>
              </div>
            </article>
          </div>

          <article className={styles.readyAnswerCard}>
            <div className={styles.readyAnswerHeader}>
              <div>
                <strong>Resposta pronta para o cliente</strong>
                <p>Texto base para copiar e adaptar no atendimento.</p>
              </div>
              <button
                type="button"
                className={styles.copyButton}
                onClick={copiarRespostaAcessoExterno}
              >
                {respostaAcessoCopiada ? <Check size={16} /> : <Copy size={16} />}
                {respostaAcessoCopiada ? 'Copiado' : 'Copiar texto'}
              </button>
            </div>
            <div className={styles.readyAnswerText}>
              {respostaProntaAcessoExterno.split('\n\n').map((paragrafo) => (
                <p key={paragrafo}>{paragrafo}</p>
              ))}
            </div>
          </article>

          <article className={styles.internalAlertCard}>
            <strong>
              <TriangleAlert size={18} />
              Observação interna
            </strong>
            <p>Não prometer acesso externo antes de confirmar:</p>
            <ul className={styles.checkList}>
              <li>Se existe gateway;</li>
              <li>Marca/modelo do equipamento;</li>
              <li>Se aceita PPPoE;</li>
              <li>Se o cliente possui IPv4 público ou está em CGNAT;</li>
              <li>Qual dispositivo será acessado;</li>
              <li>Se será necessário semi-dedicado ou dedicado.</li>
            </ul>
          </article>
        </section>
        )}

        {questionModalAberto && (
          <div className={styles.modalOverlay}>
            <form className={styles.questionModal} onSubmit={enviarQuestion} noValidate>
              <div className={styles.questionHeader}>
                <div>
                  <h2>Pergunta para administradores</h2>
                  <p>Envie sua dúvida e aguarde a resposta da equipe administrativa.</p>
                </div>
                <button
                  type="button"
                  className={styles.closeButton}
                  title="Fechar"
                  onClick={fecharQuestionModal}
                  disabled={questionEnviando}
                >
                  <X size={20} />
                </button>
              </div>

              <div className={styles.questionBody}>
                {questionErro && <div className={styles.errorMessage}>{questionErro}</div>}
                {questionSucesso && <div className={styles.successMessage}>{questionSucesso}</div>}

                <label>
                  Seu nome
                  <input
                    type="text"
                    value={questionForm.nome}
                    onChange={(event) => alterarQuestionForm('nome', event.target.value)}
                    required
                  />
                </label>

                <label>
                  Setor ou área (opcional)
                  <input
                    type="text"
                    value={questionForm.setor}
                    onChange={(event) => alterarQuestionForm('setor', event.target.value)}
                  />
                </label>

                <label>
                  Pergunta
                  <textarea
                    value={questionForm.descricao}
                    onChange={(event) => alterarQuestionForm('descricao', event.target.value)}
                    rows={5}
                    required
                  />
                </label>
              </div>

              <div className={styles.questionActions}>
                <button type="button" className={styles.secondaryButton} onClick={fecharQuestionModal} disabled={questionEnviando}>
                  Cancelar
                </button>
                <button type="submit" className={styles.primaryButton} disabled={questionEnviando}>
                  <Send size={17} />
                  {questionEnviando ? 'Enviando...' : 'Enviar pergunta'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
