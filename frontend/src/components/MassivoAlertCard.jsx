import { ArrowUpRight, CircleCheck, Siren, WifiOff } from 'lucide-react';
import '../styles/MassivoAlertCard.css';

const textoTotalMassivos = (total) => (
  total === 1 ? '1 massivo ativo' : `${total} massivos ativos`
);

export default function MassivoAlertCard({
  className = '',
  conectado = true,
  massivos = [],
  massivosCount = 0,
  onOpen,
}) {
  const total = Number(massivosCount) || 0;
  const hasMassivo = total > 0;
  const massivosAtivos = massivos.filter((massivo) => Number(massivo.total) > 0);
  const estado = hasMassivo ? 'is-critical' : (conectado ? 'is-clear' : 'is-offline');

  let Icone = CircleCheck;
  let titulo = 'Sem massivo ativo';
  let descricao = 'Nenhum massivo no dashboard do NOC.';

  if (hasMassivo) {
    Icone = Siren;
    titulo = textoTotalMassivos(total);
    descricao = 'Backbones com massivo no dashboard do NOC:';
  } else if (!conectado) {
    Icone = WifiOff;
    titulo = 'Status indisponível';
    descricao = 'Sem conexão com o dashboard do NOC.';
  }

  return (
    <button
      type="button"
      className={`anAlertCard ${estado} ${className}`.trim()}
      onClick={onOpen}
      title={hasMassivo ? `${total} massivo(s) ativo(s)` : 'Abrir alertas'}
    >
      {hasMassivo && <span key={`flash-${total}`} className="anAlertFlash" aria-hidden="true" />}

      <span className="anAlertHead">
        <span className="anAlertIcon" aria-hidden="true">
          {hasMassivo && <i className="anAlertRing" />}
          <Icone size={22} strokeWidth={2} />
        </span>

        <span className="anAlertLabel">
          Alertas de rede
          <span className={`anAlertLive ${conectado ? '' : 'is-off'}`.trim()}>
            {conectado ? 'Ao vivo' : 'Desconectado'}
          </span>
        </span>
      </span>

      <span className="anAlertBody" aria-live="polite">
        <strong className="anAlertTitle">{titulo}</strong>
        <span className="anAlertText">{descricao}</span>
      </span>

      {hasMassivo && massivosAtivos.length > 0 && (
        <span className="anAlertChips">
          {massivosAtivos.map((massivo) => (
            <i key={massivo.id}>
              {massivo.label}
              <strong>{massivo.total}</strong>
            </i>
          ))}
        </span>
      )}

      {hasMassivo && !conectado && (
        <span className="anAlertWarning">
          <WifiOff size={13} strokeWidth={2.2} aria-hidden="true" />
          Dashboard desconectado: os números podem estar desatualizados.
        </span>
      )}

      <span className="anAlertCta">
        Abrir dashboard
        <ArrowUpRight size={16} strokeWidth={2.2} aria-hidden="true" />
      </span>
    </button>
  );
}
