import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { socket } from '../services/socket';
import '../styles/ContratacoesPendentes.css';

// Contratações pendentes do site (acessanet.com.br), via backend do chat:
//   contratacoes:resumo -> { conectado, pendentes, itens }  (contador e lista)
//   contratacoes:novo   -> { itens }                        (aviso de pedido novo)
// Bolha fixa com o número (brilha enquanto houver pendência), painel com a lista e
// aviso na tela / do navegador a cada pedido novo.

const ADMIN_CONTRATACOES_URL = 'https://acessanet.com.br/admin/contratacoes';
const TOAST_MS = 12000;
const ROTAS_SEM_AVISO = ['/login', '/atendimento-sso'];

const formatarHora = (iso) => {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '';
  return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const descreverPedido = (item) => [item.plano, item.cidade].filter(Boolean).join(' · ');

export default function ContratacoesPendentes() {
  const { pathname } = useLocation();
  const [resumo, setResumo] = useState({ conectado: false, pendentes: 0, itens: [] });
  const [aberto, setAberto] = useState(false);
  const [avisos, setAvisos] = useState([]);
  const [chamando, setChamando] = useState(false);
  const timers = useRef([]);

  const logado = Boolean(localStorage.getItem('token')) && !ROTAS_SEM_AVISO.includes(pathname);

  useEffect(() => {
    if (!logado) return undefined;

    const aoResumo = (dados) => {
      if (dados && typeof dados === 'object') setResumo(dados);
    };

    const aoNovo = ({ itens = [] } = {}) => {
      if (!itens.length) return;
      const novos = itens.map((item) => ({ ...item, aviso: `${item.id}-${Date.now()}` }));
      setAvisos((atuais) => [...novos, ...atuais].slice(0, 4));
      setChamando(true);
      const id = setTimeout(() => {
        setAvisos((atuais) => atuais.filter((a) => !novos.some((n) => n.aviso === a.aviso)));
        setChamando(false);
      }, TOAST_MS);
      timers.current.push(id);

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const principal = itens[0];
        try {
          const notificacao = new Notification(
            itens.length > 1 ? `${itens.length} novas contratações no site` : 'Nova contratação no site',
            { body: `${principal.cliente} — ${descreverPedido(principal)}`, tag: 'contratacao-nova' },
          );
          notificacao.onclick = () => {
            window.focus();
            setAberto(true);
            notificacao.close();
          };
        } catch {
          // Notificação do navegador é só um extra.
        }
      }
    };

    socket.on('contratacoes:resumo', aoResumo);
    socket.on('contratacoes:novo', aoNovo);
    return () => {
      socket.off('contratacoes:resumo', aoResumo);
      socket.off('contratacoes:novo', aoNovo);
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [logado]);

  if (!logado) return null;

  const { pendentes, itens, conectado } = resumo;
  const temPendencia = pendentes > 0;

  return (
    <div className="contratacoes-widget">
      {avisos.length > 0 && (
        <div className="contratacoes-toasts" role="status" aria-live="polite">
          {avisos.map((aviso) => (
            <button
              type="button"
              key={aviso.aviso}
              className="contratacoes-toast"
              onClick={() => {
                setAberto(true);
                setAvisos((atuais) => atuais.filter((a) => a.aviso !== aviso.aviso));
              }}
            >
              <strong>Nova contratação no site</strong>
              <span>{aviso.cliente}</span>
              <small>{descreverPedido(aviso)}</small>
            </button>
          ))}
        </div>
      )}

      {aberto && (
        <section className="contratacoes-panel" aria-label="Contratações pendentes">
          <header>
            <strong>Contratações pendentes</strong>
            <button type="button" onClick={() => setAberto(false)} aria-label="Fechar">×</button>
          </header>
          {!conectado && <p className="contratacoes-aviso-offline">Sem conexão com o site agora. Mostrando a última lista.</p>}
          {itens.length === 0 ? (
            <p className="contratacoes-vazio">Nenhum pedido novo aguardando atendimento.</p>
          ) : (
            <ul>
              {itens.map((item) => (
                <li key={item.id}>
                  <strong>{item.cliente}</strong>
                  <span>{descreverPedido(item)}</span>
                  <small>{item.protocolo} · {formatarHora(item.criadoEm)}</small>
                </li>
              ))}
            </ul>
          )}
          {pendentes > itens.length && (
            <p className="contratacoes-mais">+ {pendentes - itens.length} pedidos mais antigos no painel.</p>
          )}
          <a href={ADMIN_CONTRATACOES_URL} target="_blank" rel="noopener noreferrer">Abrir contratações no painel</a>
        </section>
      )}

      <button
        type="button"
        className={`contratacoes-bubble${temPendencia ? ' is-pending' : ''}${chamando ? ' is-ringing' : ''}${conectado ? '' : ' is-offline'}`}
        onClick={() => setAberto((atual) => !atual)}
        aria-label={temPendencia ? `${pendentes} contratações pendentes no site` : 'Nenhuma contratação pendente'}
        title="Contratações pendentes do site"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="m9 14 2 2 4-4" />
        </svg>
        <span className="contratacoes-count">{pendentes > 99 ? '99+' : pendentes}</span>
      </button>
    </div>
  );
}
