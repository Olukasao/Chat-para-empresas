import { Children, useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Lock, LockOpen } from 'lucide-react';
import NovidadesCard from './NovidadesCard';
import '../styles/HomeHighlightsCarousel.css';

// Tempo que Destaques (banner, CCNA, massivos) e Agenda técnicos ficam na
// tela antes de passar para a próxima aba no modo automático. Novidades
// troca quando o vídeo termina.
const DWELL_MS = 14000;

// Trava escolhida por quem está vendo (só neste navegador).
const TRAVA_STORAGE_KEY = 'homeCarrosselTrava';

const MotionDiv = motion.div;
const MotionSpan = motion.span;

const EASE_OUT = [0.16, 1, 0.3, 1];
const EASE_EXIT = [0.7, 0, 0.84, 0];

// Entrada com espera embutida nos keyframes (em vez de `delay`): o valor
// inicial é aplicado no mesmo frame da troca, então a camada que entra já
// nasce escondida do lado certo e nunca aparece como "fantasma" na espera.
function entrada(atraso, duracao, valores) {
  const total = atraso + duracao;
  const espera = atraso / total;
  const keyframes = Object.fromEntries(
    Object.entries(valores).map(([prop, [de, para]]) => [prop, [de, de, para]]),
  );
  return {
    ...keyframes,
    transition: { duration: total, times: [0, espera, 1], ease: ['linear', EASE_OUT] },
  };
}

// Esteira com sentido: avançando (dir 1) tudo sai pela esquerda e o próximo
// entra pela direita; voltando (dir -1), o contrário.
const saida = (dir, delay = 0) => ({
  x: `${-34 * dir}%`,
  opacity: 0,
  scale: 0.96,
  filter: ['blur(0px)', 'blur(10px)'],
  transition: { duration: 0.55, ease: EASE_EXIT, delay },
});

const camadaDestaque = {
  center: ({ i, dir }) => entrada(0.24 + i * 0.08, 0.9, {
    x: [`${18 * dir}%`, '0%'],
    opacity: [0, 1],
    scale: [0.97, 1],
    filter: ['blur(10px)', 'blur(0px)'],
  }),
  out: ({ i, dir }) => saida(dir, i * 0.07),
};

// cortina abrindo a partir do lado de onde o card chega
const camadaCard = {
  center: ({ dir }) => entrada(0.26, 1, {
    x: [`${10 * dir}%`, '0%'],
    opacity: [0, 1],
    scale: [1, 1],
    filter: ['blur(0px)', 'blur(0px)'],
    clipPath: [
      dir > 0 ? 'inset(0% 0% 0% 100% round 24px)' : 'inset(0% 100% 0% 0% round 24px)',
      'inset(0% 0% 0% 0% round 24px)',
    ],
  }),
  out: ({ dir }) => saida(dir),
};

const camadaReduzida = {
  center: { opacity: 1, x: 0, transition: { duration: 0.25 } },
  out: { opacity: 0, x: 0, transition: { duration: 0.2 } },
};

// Ordem da esteira: Novidades abre a home, depois Destaques e Agenda técnicos.
const ABAS_BASE = [
  { id: 'novidades', label: 'Novidades' },
  { id: 'destaques', label: 'Destaques' },
  { id: 'agenda', label: 'Agenda técnicos', labelCurto: 'Agenda' },
];

function lerTrava() {
  try {
    const salvo = JSON.parse(localStorage.getItem(TRAVA_STORAGE_KEY) || 'null');
    return salvo?.aba ? salvo : null;
  } catch {
    return null;
  }
}

function salvarTrava(aba) {
  try {
    if (aba) localStorage.setItem(TRAVA_STORAGE_KEY, JSON.stringify({ aba }));
    else localStorage.removeItem(TRAVA_STORAGE_KEY);
  } catch {
    // sem storage (aba anônima etc.): a trava vale só nesta visita
  }
}

export default function HomeHighlightsCarousel({ motions, renderAgenda, children }) {
  const reduzirMovimento = useReducedMotion();
  const temNovidades = motions.length > 0;
  const abas = ABAS_BASE.filter((aba) => (
    aba.id === 'novidades' ? temNovidades : aba.id === 'agenda' ? Boolean(renderAgenda) : true
  ));

  const [trava] = useState(lerTrava);
  const [slide, setSlide] = useState(() => {
    if (trava && abas.some((aba) => aba.id === trava.aba)) return trava.aba;
    return temNovidades ? 'novidades' : 'destaques';
  });
  const [travado, setTravado] = useState(() => Boolean(trava && abas.some((aba) => aba.id === trava.aba)));
  const [direcao, setDirecao] = useState(1);
  const [indice, setIndice] = useState(0);
  const [ciclo, setCiclo] = useState(0);
  const [hover, setHover] = useState(false);
  const [focoDentro, setFocoDentro] = useState(false);
  const [abaOculta, setAbaOculta] = useState(() => document.hidden);
  const [progressoVideo, setProgressoVideo] = useState(0);
  const toqueRef = useRef(null);

  const pausado = hover || focoDentro || abaOculta;
  const automatico = abas.length > 1 && !travado && !reduzirMovimento;
  const posicaoAtual = Math.max(0, abas.findIndex((aba) => aba.id === slide));

  useEffect(() => {
    const aoMudar = () => setAbaOculta(document.hidden);
    document.addEventListener('visibilitychange', aoMudar);
    return () => document.removeEventListener('visibilitychange', aoMudar);
  }, []);

  const irPara = useCallback((destino, dir) => {
    setDirecao(dir);
    setSlide(destino);
    setCiclo((valor) => valor + 1);
    // travado, a trava acompanha a aba escolhida
    if (travado) salvarTrava(destino);
  }, [travado]);

  // passo +1 / -1 com volta: depois da última vem a primeira
  const andar = (passo) => {
    const destino = abas[(posicaoAtual + passo + abas.length) % abas.length].id;
    irPara(destino, passo);
  };

  const selecionarAba = (id) => {
    const destino = abas.findIndex((aba) => aba.id === id);
    if (destino === posicaoAtual) return;
    irPara(id, destino > posicaoAtual ? 1 : -1);
  };

  const alternarTrava = () => {
    const novo = !travado;
    setTravado(novo);
    salvarTrava(novo ? slide : null);
    setCiclo((valor) => valor + 1);
  };

  // Fim do vídeo: no automático passa para a próxima aba (o próximo motion
  // fica pronto para a próxima volta); travado ou com o mouse em cima, segue
  // a playlist sem sair da tela.
  const aoTerminarVideo = () => {
    setIndice((valor) => (valor + 1) % motions.length);
    if (automatico && !pausado) andar(1);
  };

  const aoTeclarAbas = (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const passo = event.key === 'ArrowRight' ? 1 : -1;
    const destino = abas[(posicaoAtual + passo + abas.length) % abas.length].id;
    andar(passo);
    event.currentTarget.querySelector(`[data-aba="${destino}"]`)?.focus();
  };

  // Deslizar no celular troca de card; mouse fica de fora para não brigar
  // com cliques e seleção de texto.
  const aoTocar = (event) => {
    if (event.pointerType !== 'touch') return;
    toqueRef.current = { x: event.clientX, y: event.clientY };
  };

  const aoSoltar = (event) => {
    const inicio = toqueRef.current;
    toqueRef.current = null;
    if (!inicio || event.pointerType !== 'touch') return;
    const dx = event.clientX - inicio.x;
    const dy = event.clientY - inicio.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    andar(dx < 0 ? 1 : -1);
  };

  const aoSairFoco = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setFocoDentro(false);
  };

  const camadas = Children.toArray(children);
  const varianteDestaque = reduzirMovimento ? camadaReduzida : camadaDestaque;
  const varianteCard = reduzirMovimento ? camadaReduzida : camadaCard;

  if (abas.length < 2) return <>{children}</>;

  const painel = (id) => ({
    role: 'tabpanel',
    id: `anHlPanel-${id}`,
    'aria-labelledby': `anHlTab-${id}`,
    inert: slide !== id,
    'aria-hidden': slide !== id,
  });

  const rotuloTrava = travado ? 'Destravar e voltar a girar' : 'Travar neste card';

  return (
    <div
      className="anHl"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      // só o foco de teclado pausa; um clique nas abas não deve travar o timer
      onFocus={(event) => setFocoDentro(event.target.matches(':focus-visible'))}
      onBlur={aoSairFoco}
    >
      <div className="anHlControls">
        <button
          type="button"
          className="anHlNav"
          onClick={() => andar(-1)}
          aria-label="Card anterior"
          title="Card anterior"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>

        <div className="anHlTabs" role="tablist" aria-label="Conteúdo da home" onKeyDown={aoTeclarAbas}>
          {abas.map((aba) => {
            const ativa = slide === aba.id;
            return (
              <button
                key={aba.id}
                type="button"
                role="tab"
                id={`anHlTab-${aba.id}`}
                data-aba={aba.id}
                aria-label={aba.label}
                aria-selected={ativa}
                aria-controls={`anHlPanel-${aba.id}`}
                tabIndex={ativa ? 0 : -1}
                className={`anHlTab ${ativa ? 'is-active' : ''}`.trim()}
                onClick={() => selecionarAba(aba.id)}
              >
                {ativa && (
                  <MotionSpan
                    layoutId="anHlTabPill"
                    className="anHlTabPill"
                    transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                  />
                )}
                <span className="anHlTabLabel">
                  {aba.id === 'novidades' && !ativa && <span className="anHlTabDot" aria-hidden="true" />}
                  {ativa && travado && <Lock className="anHlTabLock" size={12} aria-hidden="true" />}
                  {aba.labelCurto ? (
                    <>
                      <span className="anHlTabLabelLongo">{aba.label}</span>
                      <span className="anHlTabLabelCurto" aria-hidden="true">{aba.labelCurto}</span>
                    </>
                  ) : aba.label}
                </span>

                {ativa && aba.id !== 'novidades' && automatico && (
                  <span
                    key={`dwell-${ciclo}`}
                    className={`anHlTabTimer ${pausado ? 'is-paused' : ''}`.trim()}
                    style={{ '--anHl-dwell': `${DWELL_MS}ms` }}
                    onAnimationEnd={() => andar(1)}
                    aria-hidden="true"
                  />
                )}
                {ativa && aba.id === 'novidades' && (
                  <span
                    className="anHlTabTimer is-manual"
                    style={{ transform: `scaleX(${progressoVideo})` }}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="anHlNav"
          onClick={() => andar(1)}
          aria-label="Próximo card"
          title="Próximo card"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>

        <button
          type="button"
          className={`anHlNav anHlLockBtn ${travado ? 'is-locked' : ''}`.trim()}
          onClick={alternarTrava}
          aria-pressed={travado}
          aria-label={rotuloTrava}
          title={rotuloTrava}
        >
          {travado ? <Lock size={16} aria-hidden="true" /> : <LockOpen size={16} aria-hidden="true" />}
        </button>
      </div>

      <div className="anHlStage" onPointerDown={aoTocar} onPointerUp={aoSoltar}>
        <div className="anHlLayerGroup" {...painel('destaques')}>
          {camadas.map((camada, i) => (
            <MotionDiv
              key={camada.key ?? i}
              className="anHlLayer"
              custom={{ i, dir: direcao }}
              variants={varianteDestaque}
              initial={false}
              animate={slide === 'destaques' ? 'center' : 'out'}
            >
              {camada}
            </MotionDiv>
          ))}
        </div>

        {temNovidades && (
          <MotionDiv
            className="anHlLayerGroup anHlNews"
            {...painel('novidades')}
            custom={{ dir: direcao }}
            variants={varianteCard}
            initial={{ opacity: 0 }}
            animate={slide === 'novidades' ? 'center' : 'out'}
          >
            <NovidadesCard
              motions={motions}
              index={indice}
              active={slide === 'novidades'}
              onVideoEnded={aoTerminarVideo}
              onProgress={setProgressoVideo}
            />
          </MotionDiv>
        )}

        {renderAgenda && (
          <MotionDiv
            className="anHlLayerGroup anHlNews"
            {...painel('agenda')}
            custom={{ dir: direcao }}
            variants={varianteCard}
            initial={{ opacity: 0 }}
            animate={slide === 'agenda' ? 'center' : 'out'}
          >
            {renderAgenda(slide === 'agenda')}
          </MotionDiv>
        )}
      </div>
    </div>
  );
}
