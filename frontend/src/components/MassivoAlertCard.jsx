import { ArrowRight } from 'lucide-react';
import AlertFireIcon from './AlertFireIcon';
import '../styles/MassivoAlertCard.css';

export default function MassivoAlertCard({
  className = '',
  conectado = true,
  massivos = [],
  massivosCount = 0,
  onOpen,
}) {
  const total = Number(massivosCount) || 0;
  const hasMassivo = total > 0;
  const modeClass = hasMassivo ? 'red-mode' : 'yellow-mode';
  const massivosAtivos = massivos.filter((massivo) => Number(massivo.total) > 0);

  return (
    <button
      type="button"
      className={`massivoAlertCard alert-card ${modeClass} ${className}`.trim()}
      onClick={onOpen}
      title={hasMassivo ? `${total} massivo(s) ativo(s)` : 'Abrir alertas'}
    >
      <span className="massivoAlertBeacon" aria-hidden="true">
        <i />
        <i />
      </span>

      <span className="massivoAlertIcon" aria-hidden="true">
        <AlertFireIcon severity={hasMassivo ? 'red' : 'yellow'} />
      </span>

      <span className="massivoAlertContent">
        <span className="massivoAlertTitleRow">
          <strong>Alertas</strong>
          <em>{total} massivo(s)</em>
        </span>

        <b>
          {hasMassivo
            ? 'Massivo ativo no dashboard'
            : 'Sem massivo ativo'}
        </b>

        {hasMassivo && massivosAtivos.length > 0 && (
          <span className="massivoAlertChips">
            {massivosAtivos.map((massivo) => (
              <i key={massivo.id}>
                {massivo.label}
                <strong>{massivo.total}</strong>
              </i>
            ))}
          </span>
        )}

        {!conectado && (
          <span className="massivoAlertConnection">
            Dashboard desconectado
          </span>
        )}
      </span>

      <span className="massivoAlertArrow" aria-hidden="true">
        <ArrowRight size={20} />
      </span>
    </button>
  );
}
