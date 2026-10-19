import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Maximize2, Volume2, VolumeX } from 'lucide-react';
import '../styles/NovidadesCard.css';

const MotionDiv = motion.div;

const EASE_OUT = [0.16, 1, 0.3, 1];

export default function NovidadesCard({
  motions,
  index,
  active,
  onVideoEnded,
  onProgress,
}) {
  const reduzirMovimento = useReducedMotion();
  const videoRef = useRef(null);
  const [mudo, setMudo] = useState(true);
  // progresso guardado junto do índice: ao trocar de motion ele volta a 0 sozinho
  const [progressoMotion, setProgressoMotion] = useState({ index, valor: 0 });
  const progresso = progressoMotion.index === index ? progressoMotion.valor : 0;
  const atual = motions[index];

  // Toca só enquanto o card está visível; ao sair, pausa e volta ao início.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    if (active && !reduzirMovimento) {
      video.play().catch(() => {});
      return undefined;
    }

    video.pause();
    const timeout = window.setTimeout(() => {
      if (!active && videoRef.current) {
        videoRef.current.currentTime = 0;
        setProgressoMotion({ index, valor: 0 });
      }
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [active, index, reduzirMovimento]);

  useEffect(() => {
    onProgress?.(progresso);
  }, [progresso, onProgress]);

  const atualizarProgresso = (event) => {
    const { currentTime, duration } = event.currentTarget;
    if (duration > 0) setProgressoMotion({ index, valor: currentTime / duration });
  };

  const telaCheia = () => {
    const video = videoRef.current;
    if (!video) return;
    video.requestFullscreen?.() ?? video.webkitEnterFullscreen?.();
  };

  return (
    <section className="anNovidades" aria-label="Novidades">
      <MotionDiv
        className="anNovidadesStage"
        initial={false}
        animate={active || reduzirMovimento ? { scale: 1, opacity: 1 } : { scale: 1.04, opacity: 0.4 }}
        transition={{ duration: 1.1, ease: EASE_OUT, delay: active ? 0.2 : 0 }}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <MotionDiv
            key={atual.id}
            className="anNovidadesFrame"
            initial={{ opacity: 0, scale: 1.03, filter: 'blur(12px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.98, filter: 'blur(12px)' }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
          >
            <img className="anNovidadesBackdrop" src={atual.poster} alt="" aria-hidden="true" />
            <video
              // o vídeo que sai (AnimatePresence) desmonta depois do novo montar;
              // ignorar o null evita perder a referência do vídeo atual
              ref={(node) => {
                if (node) videoRef.current = node;
              }}
              className="anNovidadesVideo"
              src={atual.video}
              poster={atual.poster}
              muted={mudo}
              playsInline
              preload={active ? 'auto' : 'metadata'}
              controls={reduzirMovimento}
              onTimeUpdate={atualizarProgresso}
              onEnded={onVideoEnded}
              aria-label={atual.titulo}
            />
          </MotionDiv>
        </AnimatePresence>

        <div className="anNovidadesTrack" aria-hidden="true">
          <div className="anNovidadesTrackFill" style={{ transform: `scaleX(${progresso})` }} />
        </div>
      </MotionDiv>

      <div className="anNovidadesActions">
        <button
          type="button"
          className="anNovidadesIconBtn"
          onClick={() => setMudo((valor) => !valor)}
          aria-pressed={!mudo}
          aria-label={mudo ? 'Ativar som' : 'Desativar som'}
          title={mudo ? 'Ativar som' : 'Desativar som'}
          disabled={atual?.vertical}
        >
          {mudo || atual?.vertical ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <button
          type="button"
          className="anNovidadesIconBtn"
          onClick={telaCheia}
          aria-label="Ver em tela cheia"
          title="Ver em tela cheia"
        >
          <Maximize2 size={18} />
        </button>
      </div>
    </section>
  );
}
