import { ArrowRight, BadgeDollarSign, Network, Trophy } from 'lucide-react';
import '../styles/WikiCopaCard.css';

export default function CcnaCompetitionHighlightCard({
  className = '',
  onOpen,
  title = 'Competição CCNA V7',
}) {
  return (
    <button
      type="button"
      className={`wikiCopaCard ccnaCompetitionHighlightCard ${className}`.trim()}
      onClick={onOpen}
      title={title}
    >
      <span className="wikiCopaGlow" aria-hidden="true" />

      <span className="wikiCopaIcon ccnaCompetitionHighlightIcon">
        <Network size={27} />
        <i />
      </span>

      <span className="wikiCopaContent">
        <span className="wikiCopaTitleRow">
          <strong>COMPETIÇÃO CCNA V7</strong>
          <em className="competitionPrizeBadge">R$1000</em>
        </span>

        <span className="competitionWinnerBadge">
          <Trophy size={12} />
          Apenas 1 ganhador
        </span>

        <small>
          Conclua os 3 módulos do CCNA V7 até o final do ano. A primeira pessoa
          a entregar os 3 cursos ganha R$1000.
        </small>

        <span className="wikiCopaCta competitionCta">
          Participar agora
          <ArrowRight size={15} />
        </span>
      </span>

      <span className="ccnaCompetitionHighlightPrize" aria-hidden="true">
        <Trophy size={30} />
        <b>R$1000</b>
        <small>3 módulos</small>
        <BadgeDollarSign size={22} />
      </span>
    </button>
  );
}
