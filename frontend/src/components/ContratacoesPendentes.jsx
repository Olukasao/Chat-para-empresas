import { useCallback, useEffect, useRef, useState } from 'react';
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

// Bolha arrastável: a posição (canto superior esquerdo da bolha) fica salva no
// navegador. O padrão fica acima da área de envio do chat.
const POSICAO_KEY = 'contratacoes:posicao';
const BOLHA = 52;
const MARGEM = 12;
const LIMIAR_ARRASTE = 5;

const limitar = ({ x, y }) => ({
  x: Math.min(Math.max(MARGEM, x), window.innerWidth - BOLHA - MARGEM),
  y: Math.min(Math.max(MARGEM, y), window.innerHeight - BOLHA - MARGEM),
});

const posicaoPadrao = () => limitar({ x: window.innerWidth - BOLHA - 20, y: window.innerHeight - BOLHA - 110 });

const lerPosicao = () => {
  try {
    const salva = JSON.parse(localStorage.getItem(POSICAO_KEY));
    if (Number.isFinite(salva?.x) && Number.isFinite(salva?.y)) return limitar(salva);
  } catch {
    // Posição salva inválida: usa a padrão.
  }
  return posicaoPadrao();
};

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
  const [posicao, setPosicao] = useState(lerPosicao);
  const [arrastando, setArrastando] = useState(false);
  const arraste = useRef(null);
  const ignorarClique = useRef(false);

  const salvarPosicao = useCallback((nova) => {
    const ajustada = limitar(nova);
    setPosicao(ajustada);
    try {
      localStorage.setItem(POSICAO_KEY, JSON.stringify(ajustada));
    } catch {
      // Sem armazenamento: a posição vale só nesta sessão.
    }
  }, []);

  useEffect(() => {
    const aoRedimensionar = () => setPosicao((atual) => limitar(atual));
    window.addEventListener('resize', aoRedimensionar);
    return () => window.removeEventListener('resize', aoRedimensionar);
  }, []);

  const iniciarArraste = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    arraste.current = {
      id: event.pointerId,
      inicioX: event.clientX,
      inicioY: event.clientY,
      origem: posicao,
      moveu: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const moverArraste = (event) => {
    const atual = arraste.current;
    if (!atual || atual.id !== event.pointerId) return;
    const dx = event.clientX - atual.inicioX;
    const dy = event.clientY - atual.inicioY;
    if (!atual.moveu && Math.hypot(dx, dy) < LIMIAR_ARRASTE) return;
    if (!atual.moveu) {
      atual.moveu = true;
      setArrastando(true);
    }
    setPosicao(limitar({ x: atual.origem.x + dx, y: atual.origem.y + dy }));
  };

  const terminarArraste = (event) => {
    const atual = arraste.current;
    if (!atual || atual.id !== event.pointerId) return;
    arraste.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (atual.moveu) {
      ignorarClique.current = true;
      setArrastando(false);
      salvarPosicao({ x: atual.origem.x + event.clientX - atual.inicioX, y: atual.origem.y + event.clientY - atual.inicioY });
    }
  };

  // Shift + setas move a bolha pelo teclado; Shift + Home volta à posição padrão.
  const moverPeloTeclado = (event) => {
    if (!event.shiftKey) return;
    const passo = 24;
    const deslocamentos = { ArrowUp: [0, -passo], ArrowDown: [0, passo], ArrowLeft: [-passo, 0], ArrowRight: [passo, 0] };
    if (event.key === 'Home') {
      event.preventDefault();
      salvarPosicao(posicaoPadrao());
      return;
    }
    const delta = deslocamentos[event.key];
    if (!delta) return;
    event.preventDefault();
    salvarPosicao({ x: posicao.x + delta[0], y: posicao.y + delta[1] });
  };

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

  // O painel e os avisos abrem para o lado com mais espaço livre.
  const metadeSuperior = posicao.y + BOLHA / 2 < window.innerHeight / 2;
  const ladoEsquerdo = posicao.x + BOLHA / 2 < window.innerWidth / 2;
  const estiloWidget = {
    ...(metadeSuperior
      ? { top: posicao.y }
      : { bottom: window.innerHeight - posicao.y - BOLHA }),
    ...(ladoEsquerdo
      ? { left: posicao.x }
      : { right: window.innerWidth - posicao.x - BOLHA }),
  };
  const classesWidget = [
    'contratacoes-widget',
    metadeSuperior ? 'abre-abaixo' : '',
    ladoEsquerdo ? 'alinha-esquerda' : '',
    arrastando ? 'is-dragging' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={classesWidget} style={estiloWidget}>
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
        onClick={() => {
          if (ignorarClique.current) {
            ignorarClique.current = false;
            return;
          }
          setAberto((atual) => !atual);
        }}
        onPointerDown={iniciarArraste}
        onPointerMove={moverArraste}
        onPointerUp={terminarArraste}
        onPointerCancel={terminarArraste}
        onKeyDown={moverPeloTeclado}
        aria-label={temPendencia ? `${pendentes} contratações pendentes no site` : 'Nenhuma contratação pendente'}
        aria-describedby="contratacoes-dica-arraste"
        title="Contratações pendentes do site — arraste para mover"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="m9 14 2 2 4-4" />
        </svg>
        <span className="contratacoes-count">{pendentes > 99 ? '99+' : pendentes}</span>
      </button>
      <span id="contratacoes-dica-arraste" className="contratacoes-sr-only">
        Arraste para mover. Pelo teclado, use Shift e as setas; Shift e Home voltam à posição inicial.
      </span>
    </div>
  );
}
