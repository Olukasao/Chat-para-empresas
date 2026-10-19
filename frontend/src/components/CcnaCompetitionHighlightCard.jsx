import { ArrowRight, CalendarClock, Layers, Network, Trophy } from 'lucide-react';
import '../styles/CcnaCompetitionCard.css';

// Topologia decorativa: o assunto da competição é rede (CCNA).
const NOS = [
  [212, 40], [268, 22], [300, 74], [246, 98], [190, 120], [286, 140], [226, 158],
];
const LIGACOES = [
  [0, 1], [1, 2], [0, 3], [2, 3], [3, 4], [3, 5], [4, 6], [5, 6], [2, 5],
];

export default function CcnaCompetitionHighlightCard({
  className = '',
  onOpen,
  title = 'Competição CCNA V7',
}) {
  return (
    <button
      type="button"
      className={`anCcnaCard ${className}`.trim()}
      onClick={onOpen}
      title={title}
    >
      <svg className="anCcnaTopology" viewBox="0 0 320 180" aria-hidden="true" focusable="false">
        {LIGACOES.map(([a, b]) => (
          <line key={`${a}-${b}`} x1={NOS[a][0]} y1={NOS[a][1]} x2={NOS[b][0]} y2={NOS[b][1]} />
        ))}
        {NOS.map(([x, y], index) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={index === 3 ? 5 : 3} className={index === 3 ? 'is-core' : ''} />
        ))}
      </svg>

      <span className="anCcnaBody">
        <span className="anCcnaTag">
          <Network size={14} strokeWidth={2} aria-hidden="true" />
          Competição interna
        </span>

        <strong className="anCcnaTitle">CCNA v7</strong>

        <span className="anCcnaText">
          Conclua os 3 módulos do CCNA v7 até o fim do ano. A primeira pessoa a
          entregar os 3 cursos ganha o prêmio.
        </span>

        <span className="anCcnaMeta">
          <span><Trophy size={14} strokeWidth={2} aria-hidden="true" /> Apenas 1 ganhador</span>
          <span><Layers size={14} strokeWidth={2} aria-hidden="true" /> 3 módulos</span>
          <span><CalendarClock size={14} strokeWidth={2} aria-hidden="true" /> Até o fim do ano</span>
        </span>
      </span>

      <span className="anCcnaPrize">
        <small>Prêmio</small>
        <b>
          <span className="anCcnaCurrency">R$</span>1.000
        </b>
        <span className="anCcnaCta">
          Participar agora
          <ArrowRight size={16} strokeWidth={2.2} aria-hidden="true" />
        </span>
      </span>
    </button>
  );
}
