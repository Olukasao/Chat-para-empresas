import {
  ArrowRight,
  CalendarDays,
  Smartphone,
  Target,
  Tv,
  Users,
  Zap,
} from 'lucide-react';
import '../styles/HeroCopaBanner.css';
import {
  DEFAULT_HERO_COPA_PREVIEW_CONTENT,
  normalizeHeroCopaContent,
} from '../utils/heroCopa';

function HeroStat({ icon, label, value, detail }) {
  return (
    <div className="heroCopaStat">
      <span className="heroCopaStatIcon">{icon}</span>
      <span className="heroCopaStatCopy">
        <small>{label}</small>
        <span>
          <strong>{value}</strong>
          <em>{detail}</em>
        </span>
      </span>
    </div>
  );
}

function OfferBenefit({ icon, title, detail }) {
  return (
    <span className="heroCopaBenefit">
      {icon}
      <strong>{title}</strong>
      {detail && <small>{detail}</small>}
    </span>
  );
}

function HeroOfferCard({ content }) {
  const abrirOferta = () => {
    if (!content.botao_url) return;
    window.open(content.botao_url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="heroCopaOffer">
      <div className="heroCopaGoalNet" aria-hidden="true">
        <span className="heroCopaBall" />
      </div>

      <span className="heroCopaOfferConfetti heroCopaOfferConfetti--one" />
      <span className="heroCopaOfferConfetti heroCopaOfferConfetti--two" />
      <span className="heroCopaOfferConfetti heroCopaOfferConfetti--three" />

      <h3>
        {content.oferta_titulo}
        <span>{content.oferta_subtitulo}</span>
      </h3>

      <div className="heroCopaBenefits">
        <OfferBenefit
          icon={<Zap size={18} />}
          title={content.beneficio_1_titulo}
          detail={content.beneficio_1_detalhe}
        />
        <OfferBenefit
          icon={<Tv size={18} />}
          title={content.beneficio_2_titulo}
          detail={content.beneficio_2_detalhe}
        />
        <OfferBenefit
          icon={<Smartphone size={18} />}
          title={content.beneficio_3_titulo}
          detail={content.beneficio_3_detalhe}
        />
      </div>

      <button
        type="button"
        onClick={abrirOferta}
        disabled={!content.botao_url}
      >
        {content.botao_texto}
        <ArrowRight size={17} />
      </button>

      <span className="heroCopaOfferCurve heroCopaOfferCurve--green" aria-hidden="true" />
      <span className="heroCopaOfferCurve heroCopaOfferCurve--yellow" aria-hidden="true" />
    </div>
  );
}

export default function HeroCopaBanner({
  className = '',
  content,
  style,
}) {
  const data = normalizeHeroCopaContent(
    content,
    DEFAULT_HERO_COPA_PREVIEW_CONTENT
  );

  return (
    <section
      className={`heroCopaBanner ${className}`.trim()}
      style={style}
      aria-label="Campanha da semana"
    >
      <div className="heroCopaStadium" aria-hidden="true">
        <span className="heroCopaFloodlights heroCopaFloodlights--left">
          <i /><i /><i /><i /><i /><i />
        </span>
        <span className="heroCopaFloodlights heroCopaFloodlights--right">
          <i /><i /><i /><i /><i />
        </span>
        <span className="heroCopaLightBeam heroCopaLightBeam--one" />
        <span className="heroCopaLightBeam heroCopaLightBeam--two" />
        <span className="heroCopaLightBeam heroCopaLightBeam--three" />
        <span className="heroCopaPitch">
          <i className="heroCopaPitchCenter" />
          <i className="heroCopaPitchBox" />
          <i className="heroCopaPitchArc" />
        </span>
      </div>

      <span className="heroCopaConfetti heroCopaConfetti--one" />
      <span className="heroCopaConfetti heroCopaConfetti--two" />
      <span className="heroCopaConfetti heroCopaConfetti--three" />
      <span className="heroCopaConfetti heroCopaConfetti--four" />
      <span className="heroCopaConfetti heroCopaConfetti--five" />
      <span className="heroCopaConfetti heroCopaConfetti--six" />

      <div className="heroCopaContent">
        <div className="heroCopaBadge">
          <span>🔥</span>
          {data.selo}
        </div>

        <h2>
          {data.titulo_linha_1}
          <span>
            {data.titulo_linha_2} <mark>{data.titulo_destaque}</mark>
          </span>
        </h2>

        <p>
          {data.descricao_linha_1}
          <br />
          {data.descricao_linha_2}
        </p>

        <div className="heroCopaStats">
          <HeroStat
            icon={<Users size={23} />}
            label={data.time_label}
            value={data.time_valor}
            detail={data.time_detalhe}
          />
          <HeroStat
            icon={<Target size={23} />}
            label={data.meta_label}
            value={data.meta_valor}
            detail={data.meta_detalhe}
          />
          <HeroStat
            icon={<CalendarDays size={22} />}
            label={data.rodada_label}
            value={data.rodada_valor}
            detail={data.rodada_detalhe}
          />
        </div>
      </div>

      <HeroOfferCard content={data} />
    </section>
  );
}
