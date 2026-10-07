import '../styles/AlertFireIcon.css';

const normalizarSeverity = (valor) => (
  valor === 'red' ? 'red' : 'yellow'
);

export default function AlertFireIcon({
  severity,
  status,
  className = '',
}) {
  const estado = normalizarSeverity(severity || status);

  return (
    <span
      className={`alertFireIcon alertFireIcon-${estado} ${className}`.trim()}
      aria-hidden="true"
    >
      <svg
        className="alertFireIconSvg"
        viewBox="0 0 64 72"
        focusable="false"
      >
        <g className="alertFireSmoke" fill="none" strokeLinecap="round">
          <path className="alertFireSmokeLine alertFireSmokeLineOne" d="M25 36 C18 27 31 25 25 16 C21 10 28 7 31 3" />
          <path className="alertFireSmokeLine alertFireSmokeLineTwo" d="M34 37 C42 28 29 24 36 15 C41 9 33 7 31 2" />
          <path className="alertFireSmokeLine alertFireSmokeLineThree" d="M30 38 C28 29 39 28 38 20 C37 14 43 11 46 7" />
        </g>

        <g className="alertFireSparks">
          <circle className="alertFireSpark alertFireSparkOne" cx="22" cy="31" r="1.6" />
          <circle className="alertFireSpark alertFireSparkTwo" cx="43" cy="27" r="1.35" />
          <circle className="alertFireSpark alertFireSparkThree" cx="31" cy="19" r="1.15" />
          <circle className="alertFireSpark alertFireSparkFour" cx="47" cy="37" r="1" />
        </g>

        <g className="alertFireGlowShape">
          <ellipse cx="32" cy="53" rx="21" ry="10" />
        </g>

        <g className="alertFireFlames">
          <path
            className="alertFireFlame alertFireFlameOuter"
            d="M31.7 52.8 C21.8 50.8 17.5 43.2 20.4 35 C22.5 29 27.2 25 28 18 C32.8 23.6 37.6 25.6 36.7 15.8 C45.2 23.3 50.6 32.2 48.2 41.2 C46.1 49 39.7 54.1 31.7 52.8 Z"
          />
          <path
            className="alertFireFlame alertFireFlameMiddle"
            d="M32.3 52 C25.1 50.2 22.7 44.4 25.1 38.1 C26.8 33.8 30.8 31.4 30.6 25.3 C35.1 29.8 39 31.8 39.1 24.3 C44.5 31.1 45.8 39.4 42.3 45.8 C40.2 49.7 36.7 52.9 32.3 52 Z"
          />
          <path
            className="alertFireFlame alertFireFlameInner"
            d="M32.1 51.2 C28.1 49.9 26.8 46.1 28.5 42 C29.6 39.4 32.3 37.8 32.2 33.8 C35.6 37.3 37.6 39.9 37.3 43.6 C36.9 48.1 34.9 51.8 32.1 51.2 Z"
          />
        </g>

        <g className="alertFireCoals">
          <path d="M20 54 C22.8 49.7 27.6 49.5 30.2 53.4 C27.2 56.2 23.2 56.5 20 54 Z" />
          <path d="M32.1 53.8 C34.3 49.9 39.3 50.2 42.6 53.6 C39.5 56.6 35.6 56.9 32.1 53.8 Z" />
          <path d="M27.6 57.1 C30.6 54.4 34.2 54.7 37.2 57.5 C34.2 59.8 30.5 59.7 27.6 57.1 Z" />
        </g>

        <g className="alertFireLogs">
          <path className="alertFireLog alertFireLogBack" d="M16.8 55.8 L44 43.6 C46.9 42.3 50 44.1 50.9 46.9 C51.5 49 50.4 51.3 48.4 52.2 L21.2 64.4 C18.5 65.6 15.3 64.1 14.4 61.2 C13.7 59 14.8 56.7 16.8 55.8 Z" />
          <path className="alertFireLog alertFireLogFront" d="M47.2 55.8 L20 43.6 C17.1 42.3 14 44.1 13.1 46.9 C12.5 49 13.6 51.3 15.6 52.2 L42.8 64.4 C45.5 65.6 48.7 64.1 49.6 61.2 C50.3 59 49.2 56.7 47.2 55.8 Z" />
          <circle className="alertFireLogCut alertFireLogCutLeft" cx="19.2" cy="60.2" r="4.2" />
          <circle className="alertFireLogCut alertFireLogCutRight" cx="44.8" cy="60.2" r="4.2" />
          <path className="alertFireLogLine" d="M21.5 57.9 L42.5 48.4" />
          <path className="alertFireLogLine" d="M42.6 57.9 L21.5 48.4" />
        </g>
      </svg>
    </span>
  );
}
