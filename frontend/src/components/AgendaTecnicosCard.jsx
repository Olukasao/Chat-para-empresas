import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import '../styles/AgendaTecnicosCard.css';

const MotionLi = motion.li;
const EASE_OUT = [0.16, 1, 0.3, 1];

export const AGENDA_TECNICOS_URL = 'https://192.168.1.133:8500';

const SITUACAO = {
  atendimento: 'Em atendimento',
  aguardando: 'Aguardando',
  concluido: 'Dia concluído',
};

const STATUS_OS = {
  encerrada: 'encerrada',
  execucao: 'em execução',
  aberta: 'aberta',
};

// O SGP manda tudo em caixa alta; na home fica mais leve em formato de frase.
function emFrase(valor = '') {
  const minusculo = String(valor).toLocaleLowerCase('pt-BR');
  return minusculo.replace(/(^|[\s(/-])(\p{L})/gu, (_, antes, letra) => (
    antes + letra.toLocaleUpperCase('pt-BR')
  )).replace(/\b(De|Da|Do|Dos|Das|E)\b/g, (palavra) => palavra.toLowerCase());
}

function formatarDia(data) {
  if (!data) return '';
  const [ano, mes, dia] = data.split('-').map(Number);
  const texto = new Date(ano, mes - 1, dia).toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function formatarHora(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function DiaBarra({ totais }) {
  const total = totais?.total || 0;
  const partes = [
    { id: 'encerradas', rotulo: 'Encerradas', valor: totais?.encerradas || 0 },
    { id: 'execucao', rotulo: 'Em execução', valor: totais?.execucao || 0 },
    { id: 'abertas', rotulo: 'Abertas', valor: totais?.abertas || 0 },
  ];

  return (
    <div className="anAgDia">
      <p className="anAgDiaTotal">
        <strong>{total}</strong> OS hoje
      </p>
      <div
        className="anAgDiaBar"
        role="img"
        aria-label={partes.map((p) => `${p.valor} ${p.rotulo.toLowerCase()}`).join(', ')}
      >
        {partes.map((parte) => parte.valor > 0 && (
          <span
            key={parte.id}
            className={`anAgDiaSeg is-${parte.id}`}
            style={{ flexGrow: parte.valor }}
          />
        ))}
      </div>
      <ul className="anAgDiaLegenda">
        {partes.map((parte) => (
          <li key={parte.id} className={`is-${parte.id}`}>
            <span className="anAgDiaSwatch" aria-hidden="true" />
            {parte.rotulo} <strong>{parte.valor}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Tecnico({ tecnico }) {
  return (
    <article className={`anAgTec is-${tecnico.situacao}`}>
      <header className="anAgTecHead">
        <strong className="anAgTecNome">{tecnico.nome}</strong>
        <span className="anAgTecSituacao">
          <span className="anAgTecLed" aria-hidden="true" />
          {SITUACAO[tecnico.situacao]}
        </span>
      </header>

      {/* o dia do técnico: uma linha por OS, na ordem do horário */}
      <ol className="anAgTecDia">
        {tecnico.ordens.map((ordem, i) => (
          <li key={`${ordem.hora}-${i}`} className={`anAgOs is-${ordem.status}`}>
            <span className="anAgOsHora">{ordem.hora}</span>
            <span className="anAgPip" aria-hidden="true" />
            <span className="anAgOsTexto">
              {emFrase(ordem.motivo) || 'OS'}
              {ordem.bairro && <span className="anAgOsBairro"> · {emFrase(ordem.bairro)}</span>}
            </span>
            <span className="anAgSrOnly">, {STATUS_OS[ordem.status]}</span>
          </li>
        ))}
      </ol>

      <footer className="anAgTecFoot">
        {tecnico.turno && <span>Turno {tecnico.turno}</span>}
        <span className="anAgTecConta">
          {tecnico.encerradas} de {tecnico.total} encerradas
        </span>
      </footer>
    </article>
  );
}

export default function AgendaTecnicosCard({ resumo, active }) {
  const reduzirMovimento = useReducedMotion();
  const tecnicos = resumo?.tecnicos || [];
  const carregando = !resumo;
  const semConexao = resumo && !resumo.conectado && !resumo.atualizadoEm;
  const visivel = active || reduzirMovimento;

  let estado = null;
  if (carregando) estado = 'Carregando a agenda…';
  else if (semConexao) estado = resumo.erro || 'Agenda de técnicos indisponível no momento.';
  else if (!tecnicos.length) estado = 'Nenhuma OS agendada para hoje.';

  return (
    <section className="anAgenda" aria-labelledby="anAgendaTitulo">
      <header className="anAgendaHeader">
        <div>
          <h2 id="anAgendaTitulo" className="anAgendaTitle">Agenda técnicos</h2>
          <p className="anAgendaDia">{formatarDia(resumo?.data)}</p>
        </div>

        <div className="anAgendaMeta">
          {resumo?.atualizadoEm && (
            <span className={`anAgendaLive ${resumo.conectado ? '' : 'is-off'}`.trim()}>
              <span className="anAgendaLiveDot" aria-hidden="true" />
              {resumo.conectado ? 'Ao vivo' : 'Sem conexão'} · atualizado às {formatarHora(resumo.atualizadoEm)}
            </span>
          )}
          <a
            className="anAgendaAbrir"
            href={AGENDA_TECNICOS_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir agenda
            <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        </div>
      </header>

      {estado ? (
        <p className="anAgendaEstado">{estado}</p>
      ) : (
        <>
          <DiaBarra totais={resumo.totais} />

          <ul className="anAgendaGrid">
            {tecnicos.map((tecnico, i) => (
              <MotionLi
                key={tecnico.nome}
                initial={false}
                animate={visivel ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
                transition={{ duration: 0.6, ease: EASE_OUT, delay: active ? 0.45 + i * 0.045 : 0 }}
              >
                <Tecnico tecnico={tecnico} />
              </MotionLi>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
