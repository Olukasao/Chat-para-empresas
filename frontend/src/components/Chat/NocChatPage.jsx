import { useEffect, useMemo, useRef, useState } from 'react';
import styles from '../../styles/NocChat.module.css';

const initialConversations = [
  {
    id: 'noc',
    name: 'NOC',
    type: 'Canal operacional',
    status: 'online',
    typing: true,
    lastMessage: 'Latencia estabilizada no backbone SP-01.',
    lastTime: '14:32',
    unread: 3,
  },
  {
    id: 'atendimento',
    name: 'Atendimento',
    type: 'Setor',
    status: 'online',
    typing: false,
    lastMessage: 'Chamado #4821 direcionado para monitoramento.',
    lastTime: '14:18',
    unread: 0,
  },
  {
    id: 'suporte',
    name: 'Suporte Tecnico',
    type: 'Setor',
    status: 'offline',
    typing: false,
    lastMessage: 'Cliente aguardando validacao de sinal.',
    lastTime: '13:57',
    unread: 1,
  },
  {
    id: 'maria',
    name: 'Maria Oliveira',
    type: 'Engenharia de rede',
    status: 'online',
    typing: false,
    lastMessage: 'Vou acompanhar o alarme ate fechar.',
    lastTime: '13:41',
    unread: 0,
  },
  {
    id: 'campo',
    name: 'Equipe de Campo',
    type: 'Canal tecnico',
    status: 'online',
    typing: false,
    lastMessage: 'Tecnico a 12 min do POP Central.',
    lastTime: '12:58',
    unread: 5,
  },
];

const initialMessages = {
  noc: [
    {
      id: 1,
      sender: 'Lucas NOC',
      text: 'Monitoramento detectou perda curta no enlace SP-01 as 14:06. Grafico ja voltou para o baseline.',
      time: '14:08',
      direction: 'received',
    },
    {
      id: 2,
      sender: 'Voce',
      text: 'Confirma se foi somente oscilacao de borda ou impacto no transporte tambem.',
      time: '14:09',
      direction: 'sent',
      status: 'read',
    },
    {
      id: 3,
      sender: 'Maria Oliveira',
      text: 'Sem impacto no transporte. O evento ficou restrito ao BGP da borda. Sessao normalizou em 42 segundos.',
      time: '14:12',
      direction: 'received',
    },
    {
      id: 4,
      sender: 'NOC Alerta',
      text: 'Prioridade: acompanhar por 15 minutos antes de encerrar o incidente.',
      time: '14:14',
      direction: 'received',
      priority: 'warning',
    },
    {
      id: 5,
      sender: 'Voce',
      text: 'Perfeito. Mantem o canal aberto ate 14:30 e registra no historico operacional.',
      time: '14:17',
      direction: 'sent',
      status: 'read',
    },
    {
      id: 6,
      sender: 'Lucas NOC',
      text: 'Latencia estabilizada no backbone SP-01.',
      time: '14:32',
      direction: 'received',
    },
  ],
  atendimento: [
    {
      id: 1,
      sender: 'Atendimento',
      text: 'Chamado #4821 direcionado para monitoramento. Cliente relata intermitencia desde 13:40.',
      time: '14:18',
      direction: 'received',
    },
    {
      id: 2,
      sender: 'Voce',
      text: 'Recebido. Vou cruzar com eventos da regiao e retorno no chamado.',
      time: '14:19',
      direction: 'sent',
      status: 'read',
    },
  ],
  suporte: [
    {
      id: 1,
      sender: 'Suporte Tecnico',
      text: 'Cliente aguardando validacao de sinal antes da troca de equipamento.',
      time: '13:57',
      direction: 'received',
      priority: 'alert',
    },
  ],
  maria: [
    {
      id: 1,
      sender: 'Maria Oliveira',
      text: 'Vou acompanhar o alarme ate fechar.',
      time: '13:41',
      direction: 'received',
    },
  ],
  campo: [
    {
      id: 1,
      sender: 'Equipe de Campo',
      text: 'Tecnico a 12 min do POP Central.',
      time: '12:58',
      direction: 'received',
    },
  ],
};

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.headerIcon}>
      <path d="M5 5.75C5 4.78 5.78 4 6.75 4h10.5C18.22 4 19 4.78 19 5.75v7.5c0 .97-.78 1.75-1.75 1.75H11l-4.4 3.3A1 1 0 0 1 5 17.5V5.75Z" />
      <path d="M8 8h8M8 11h5" />
    </svg>
  );
}

function ToolIcon({ type }) {
  const paths = {
    search: 'M10.5 18a7.5 7.5 0 1 1 5.3-12.8A7.5 7.5 0 0 1 10.5 18Zm5.3-2.2L21 21',
    attach: 'M8.5 12.5 14 7a3 3 0 1 1 4.2 4.2l-7.4 7.4a4.5 4.5 0 0 1-6.4-6.4L12 4.6',
    options: 'M12 6h.01M12 12h.01M12 18h.01',
    emoji: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9 10h.01M15 10h.01M8.5 14.2c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8',
    send: 'M4 12 20 4l-4 16-3-7-9-1Zm9 1 7-9',
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.toolSvg}>
      <path d={paths[type]} />
    </svg>
  );
}

const formatClock = (date) => (
  date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
);

const formatMessageTime = (date) => (
  date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
);

export default function NocChatPage() {
  const [conversations, setConversations] = useState(initialConversations);
  const [messagesByConversation, setMessagesByConversation] = useState(initialMessages);
  const [activeId, setActiveId] = useState('noc');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [now, setNow] = useState(new Date());
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activeConversation = conversations.find((item) => item.id === activeId) || conversations[0];
  const activeMessages = messagesByConversation[activeConversation.id] || [];
  const totalUnread = conversations.reduce((total, item) => total + item.unread, 0);

  const filteredConversations = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return conversations;

    return conversations.filter((item) => (
      `${item.name} ${item.type} ${item.lastMessage} ${item.status}`
        .toLowerCase()
        .includes(term)
    ));
  }, [conversations, search]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeId, activeMessages.length]);

  const selectConversation = (id) => {
    setActiveId(id);
    setConversations((current) =>
      current.map((item) => (
        item.id === id ? { ...item, unread: 0 } : item
      ))
    );
  };

  const sendMessage = () => {
    const text = draft.trim();

    if (!text) return;

    const createdAt = new Date();
    const message = {
      id: Date.now(),
      sender: 'Voce',
      text,
      time: formatMessageTime(createdAt),
      direction: 'sent',
      status: 'sent',
    };

    setMessagesByConversation((current) => ({
      ...current,
      [activeConversation.id]: [
        ...(current[activeConversation.id] || []),
        message,
      ],
    }));
    setConversations((current) =>
      current.map((item) => (
        item.id === activeConversation.id
          ? {
              ...item,
              lastMessage: text,
              lastTime: message.time,
              typing: false,
              unread: 0,
            }
          : item
      ))
    );
    setDraft('');
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <main className={styles.pageShell}>
      <header className={styles.topHeader}>
        <div className={styles.titleCluster}>
          <div className={styles.iconFrame}>
            <ChatIcon />
          </div>
          <div>
            <h1>Chat Interno NOC</h1>
            <p>
              <span className={styles.liveDot} />
              Servidor conectado | Chat operacional | Última atualização: {formatClock(now)}
            </p>
          </div>
        </div>
        <div className={styles.headerMeta}>
          <span>{totalUnread} não lidas</span>
          <strong>NOC LIVE</strong>
        </div>
      </header>

      <section className={styles.chatLayout} aria-label="Chat interno NOC">
        <aside className={styles.sidebar}>
          <div className={styles.searchBox}>
            <ToolIcon type="search" />
            <input
              type="search"
              placeholder="Buscar funcionário ou canal"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className={styles.conversationList}>
            {filteredConversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                className={`${styles.conversationCard} ${
                  conversation.id === activeConversation.id ? styles.activeConversation : ''
                } ${conversation.unread ? styles.unreadConversation : ''}`}
                onClick={() => selectConversation(conversation.id)}
              >
                <span
                  className={`${styles.presenceDot} ${
                    conversation.status === 'online' ? styles.online : styles.offline
                  }`}
                />
                <span className={styles.conversationBody}>
                  <span className={styles.conversationNameRow}>
                    <strong>{conversation.name}</strong>
                    <time>{conversation.lastTime}</time>
                  </span>
                  <span className={styles.conversationType}>{conversation.type}</span>
                  <span className={styles.lastMessage}>{conversation.lastMessage}</span>
                </span>
                {conversation.unread > 0 && (
                  <span className={styles.unreadBadge}>{conversation.unread}</span>
                )}
              </button>
            ))}
          </div>
        </aside>

        <section className={styles.messagePanel}>
          <div className={styles.conversationHeader}>
            <div>
              <h2>{activeConversation.name}</h2>
              <p>
                <span
                  className={`${styles.statusPip} ${
                    activeConversation.status === 'online' ? styles.online : styles.offline
                  }`}
                />
                {activeConversation.typing
                  ? 'Digitando...'
                  : activeConversation.status === 'online'
                  ? 'Online'
                  : 'Offline'}
              </p>
            </div>
            <div className={styles.headerActions}>
              <button type="button" aria-label="Pesquisar na conversa">
                <ToolIcon type="search" />
              </button>
              <button type="button" aria-label="Anexar arquivo">
                <ToolIcon type="attach" />
              </button>
              <button type="button" aria-label="Opções da conversa">
                <ToolIcon type="options" />
              </button>
            </div>
          </div>

          <div className={styles.messagesViewport}>
            <div className={styles.dateSeparator}><span>Hoje</span></div>

            {activeMessages.map((message) => (
              <article
                key={message.id}
                className={`${styles.messageRow} ${
                  message.direction === 'sent' ? styles.sentRow : styles.receivedRow
                }`}
              >
                <div
                  className={`${styles.messageBubble} ${
                    message.direction === 'sent' ? styles.sentBubble : styles.receivedBubble
                  } ${
                    message.priority === 'alert'
                      ? styles.alertBubble
                      : message.priority === 'warning'
                      ? styles.warningBubble
                      : ''
                  }`}
                >
                  {message.direction === 'received' && (
                    <strong className={styles.senderName}>{message.sender}</strong>
                  )}
                  <p>{message.text}</p>
                  <footer>
                    <time>{message.time}</time>
                    {message.direction === 'sent' && (
                      <span className={message.status === 'read' ? styles.readMark : styles.sentMark}>
                        ✓✓
                      </span>
                    )}
                  </footer>
                </div>
              </article>
            ))}

            {activeConversation.typing && (
              <div className={`${styles.messageRow} ${styles.receivedRow}`}>
                <div className={`${styles.messageBubble} ${styles.typingBubble}`}>
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className={styles.inputBar}>
            <button type="button" aria-label="Emoji">
              <ToolIcon type="emoji" />
            </button>
            <button type="button" aria-label="Anexar">
              <ToolIcon type="attach" />
            </button>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite uma mensagem..."
              rows="1"
            />
            <button
              type="button"
              className={styles.sendButton}
              onClick={sendMessage}
              aria-label="Enviar mensagem"
            >
              <ToolIcon type="send" />
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}
