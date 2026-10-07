import { ArrowRight, ClipboardList } from 'lucide-react';
import '../styles/WikiCopaCard.css';

function WikiTacticalBoard() {
  return (
    <span className="wikiCopaBoard" aria-hidden="true">
      <i className="wikiCopaBoardCenter" />
      <i className="wikiCopaBoardBox wikiCopaBoardBox--top" />
      <i className="wikiCopaBoardBox wikiCopaBoardBox--bottom" />

      <b className="wikiCopaMarker wikiCopaMarker--x1">×</b>
      <b className="wikiCopaMarker wikiCopaMarker--x2">×</b>
      <b className="wikiCopaMarker wikiCopaMarker--x3">×</b>

      <i className="wikiCopaMarker wikiCopaMarker--o1" />
      <i className="wikiCopaMarker wikiCopaMarker--o2" />
      <i className="wikiCopaMarker wikiCopaMarker--o3" />

      <span className="wikiCopaRoute wikiCopaRoute--one" />
      <span className="wikiCopaRoute wikiCopaRoute--two" />
      <span className="wikiCopaRoute wikiCopaRoute--three" />
    </span>
  );
}

export default function WikiCopaCard({
  className = '',
  onOpen,
  title = 'Abrir wiki interna',
}) {
  return (
    <button
      type="button"
      className={`wikiCopaCard ${className}`.trim()}
      onClick={onOpen}
      title={title}
    >
      <span className="wikiCopaGlow" aria-hidden="true" />

      <span className="wikiCopaIcon">
        <ClipboardList size={27} />
        <i />
      </span>

      <span className="wikiCopaContent">
        <span className="wikiCopaTitleRow">
          <strong>Wiki interna</strong>
          <em>Playbook</em>
        </span>

        <small>
          Tutoriais, dicas de sistema, vendas e
          informações para novos funcionários.
        </small>

        <span className="wikiCopaCta">
          Acessar agora
          <ArrowRight size={15} />
        </span>
      </span>

      <WikiTacticalBoard />
    </button>
  );
}
