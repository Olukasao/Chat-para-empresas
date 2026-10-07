import {
  ArrowRight,
  Smartphone,
  Tv,
  Wifi,
  Zap,
} from 'lucide-react';
import '../styles/ArraiaCampaignBanner.css';

const FLAG_COLORS = [
  '#facc15',
  '#22c55e',
  '#38bdf8',
  '#f97316',
  '#e879f9',
  '#facc15',
  '#22c55e',
  '#38bdf8',
  '#f97316',
  '#e879f9',
];

const CONFETTI = [
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
];

function ArraiaFlagLine() {
  return (
    <div className="arraiaFlags" aria-hidden="true">
      {FLAG_COLORS.map((color, index) => (
        <span
          key={`${color}-${index}`}
          style={{ '--flag-color': color }}
        />
      ))}
    </div>
  );
}

function ArraiaLights() {
  return (
    <div className="arraiaLights" aria-hidden="true">
      {Array.from({ length: 7 }, (_, index) => (
        <span key={index} />
      ))}
    </div>
  );
}

function FiberLines() {
  return (
    <div className="arraiaFiberLines" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

function Bonfire() {
  return (
    <div className="arraiaBonfire" aria-hidden="true">
      <span className="arraiaBonfireGlow" />
      <span className="arraiaBonfireLog arraiaBonfireLogLeft" />
      <span className="arraiaBonfireLog arraiaBonfireLogRight" />
      <span className="arraiaFlame arraiaFlameBack" />
      <span className="arraiaFlame arraiaFlameMiddle" />
      <span className="arraiaFlame arraiaFlameFront" />
    </div>
  );
}

function StrawHat() {
  return (
    <span className="arraiaStrawHat" aria-hidden="true">
      <i />
      <b />
    </span>
  );
}

function Benefit({ icon, children }) {
  return (
    <span className="arraiaOfferBenefit">
      <span className="arraiaOfferBenefitIcon">{icon}</span>
      <strong>{children}</strong>
    </span>
  );
}

export default function ArraiaCampaignBanner({
  className = '',
  style,
  onCampaignClick,
}) {
  const handleCampaignClick = () => {
    if (typeof onCampaignClick === 'function') {
      onCampaignClick();
      return;
    }

    document.getElementById('campanha-arraia')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  return (
    <section
      className={`arraiaCampaignBanner ${className}`.trim()}
      style={style}
      aria-label="Campanha Arraiá Acessanet"
    >
      <ArraiaFlagLine />
      <ArraiaLights />
      <FiberLines />

      {CONFETTI.map((item) => (
        <span
          key={item}
          className={`arraiaConfetti arraiaConfetti-${item}`}
          aria-hidden="true"
        />
      ))}

      <div className="arraiaCampaignContent">
        <span className="arraiaCampaignBadge">ARRAIÁ ACESSANET</span>

        <h2 className="arraiaCampaignTitle">
          <span>Olha a</span>
          <span>internet lenta...</span>
          <mark>É mentiraaa!</mark>
        </h2>

        <p className="arraiaCampaignText">
          No arraiá da <strong>Acessanet</strong>, a conexão é{' '}
          <mark>rápida, estável e boa demais da conta.</mark>
        </p>

        <div className="arraiaCampaignFooter">
          <span className="arraiaCampaignPlate">
            <i />
            Acessanet
          </span>
          <Bonfire />
        </div>
      </div>

      <aside className="arraiaOfferCard" aria-label="Oferta da campanha">
        <StrawHat />
        <span className="arraiaOfferRibbon" aria-hidden="true" />
        <span className="arraiaOfferFlagCorner" aria-hidden="true" />

        <div className="arraiaOfferHeader">
          <small>Oferta especial</small>
          <h3>800 Mega</h3>
          <p>+ Premiere</p>
        </div>

        <div className="arraiaOfferBenefits">
          <Benefit icon={<Zap size={18} strokeWidth={2.4} />}>
            Internet ultrarrápida
          </Benefit>
          <Benefit icon={<Tv size={18} strokeWidth={2.4} />}>
            Mais de 80 canais
          </Benefit>
          <Benefit icon={<Smartphone size={18} strokeWidth={2.4} />}>
            App incluso
          </Benefit>
        </div>

        <button
          type="button"
          className="arraiaOfferButton"
          onClick={handleCampaignClick}
        >
          <span>Ver ofertas da campanha</span>
          <ArrowRight size={18} strokeWidth={2.6} />
        </button>

        <span className="arraiaOfferSignal" aria-hidden="true">
          <Wifi size={110} strokeWidth={1.2} />
        </span>
      </aside>
    </section>
  );
}
