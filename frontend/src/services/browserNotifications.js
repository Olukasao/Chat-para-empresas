import appLogo from '../assets/logo.png';
import { removerFormatacaoMensagem } from '../utils/formatacaoMensagem';

const SETUP_STORAGE_KEY = 'chatBrowserNotificationsConfigured';
const AUTO_CLOSE_MS = 10000;
const TEST_AUTO_CLOSE_MS = 7000;
const MAX_TITLE_LENGTH = 90;
const MAX_BODY_LENGTH = 150;
const MAX_PROCESSED_MESSAGES = 500;

const processedMessages = new Set();
let activeConversation = null;

const normalizeId = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? String(numeric) : null;
};

const normalizeConversation = (conversation = null) => {
  const type = conversation?.type === 'group' ? 'group' : 'direct';
  const id = normalizeId(conversation?.id);

  if (!id) return null;

  return { type, id };
};

const cleanText = (value = '') => (
  removerFormatacaoMensagem(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
);

const limitText = (value = '', maxLength = MAX_BODY_LENGTH) => {
  const text = cleanText(value);

  if (text.length <= maxLength) return text;

  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
};

const addProcessedMessage = (key) => {
  if (!key) return false;

  if (processedMessages.has(key)) {
    return false;
  }

  processedMessages.add(key);

  if (processedMessages.size > MAX_PROCESSED_MESSAGES) {
    const [oldestKey] = processedMessages;
    processedMessages.delete(oldestKey);
  }

  return true;
};

const getMessageKey = (message = {}, kind = 'direct') => {
  if (message.id) return `${kind}:id:${message.id}`;

  return [
    kind,
    message.remetente_id || '',
    message.conversa_id || message.grupo_id || '',
    message.criada_em || '',
    message.preview || message.mensagem || '',
  ].join(':');
};

const getMessagePreview = (message = {}) => {
  const type = String(message.tipo_mensagem || 'texto').toLowerCase();

  if (type === 'imagem') return 'Enviou uma imagem';
  if (type === 'arquivo') return 'Enviou um arquivo';
  if (type === 'audio') return 'Enviou um áudio';
  if (type === 'sticker') return 'Enviou uma figurinha';

  return limitText(message.preview || message.mensagem || 'Nova mensagem');
};

const getNotificationTarget = (message = {}, kind = 'direct', currentUserId = null) => {
  if (kind === 'group' || message.grupo_id) {
    const groupId = normalizeId(message.grupo_id);
    return groupId ? { type: 'group', id: groupId } : null;
  }

  const currentId = normalizeId(currentUserId);
  const senderId = normalizeId(message.remetente_id);
  const recipientId = normalizeId(message.usuario_id);
  const targetId = senderId === currentId ? recipientId : senderId;

  return targetId ? { type: 'direct', id: targetId } : null;
};

const isSameConversation = (first = null, second = null) => (
  Boolean(first && second && first.type === second.type && first.id === second.id)
);

const isWindowActivelyViewingConversation = (conversation) => {
  if (typeof document === 'undefined') return false;

  return (
    document.visibilityState === 'visible' &&
    document.hasFocus() === true &&
    isSameConversation(activeConversation, conversation)
  );
};

const createNotification = (title, options = {}) => {
  try {
    return new Notification(title, options);
  } catch (err) {
    console.warn('Nao foi possivel criar notificacao do navegador:', err);
    return null;
  }
};

export const isBrowserNotificationSupported = () => (
  typeof window !== 'undefined' &&
  typeof Notification !== 'undefined' &&
  'Notification' in window
);

export const getBrowserNotificationPermission = () => {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  return Notification.permission;
};

export const hasConfiguredBrowserNotifications = () => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SETUP_STORAGE_KEY) === 'true';
};

export const setActiveBrowserNotificationConversation = (conversation = null) => {
  activeConversation = normalizeConversation(conversation);
};

export const getActiveBrowserNotificationConversation = () => activeConversation;

export const requestBrowserNotificationPermission = async () => {
  if (!isBrowserNotificationSupported()) return 'unsupported';

  localStorage.setItem(SETUP_STORAGE_KEY, 'true');

  const permission = Notification.permission === 'default'
    ? await Notification.requestPermission()
    : Notification.permission;

  if (permission === 'granted') {
    const notification = createNotification('Notificações ativadas', {
      body: 'Você receberá avisos quando chegarem novas mensagens.',
      icon: appLogo,
      badge: appLogo,
      tag: 'chat-browser-notifications-enabled',
      renotify: false,
      silent: false,
    });

    if (notification) {
      window.setTimeout(() => notification.close(), TEST_AUTO_CLOSE_MS);
    }
  }

  return permission;
};

export const showBrowserMessageNotification = (message = {}, options = {}) => {
  if (!isBrowserNotificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;

  const {
    kind = message.grupo_id ? 'group' : 'direct',
    currentUserId = null,
    openConversation,
  } = options;

  if (normalizeId(message.remetente_id) === normalizeId(currentUserId)) {
    return false;
  }

  if (
    message.silenciado ||
    message.muted ||
    message.conversa_silenciada ||
    message.grupo_silenciado
  ) {
    return false;
  }

  const target = getNotificationTarget(message, kind, currentUserId);
  if (!target) return false;

  if (isWindowActivelyViewingConversation(target)) {
    return false;
  }

  if (!addProcessedMessage(getMessageKey(message, target.type))) {
    return false;
  }

  const senderName = limitText(message.remetente_nome || 'Nova mensagem', MAX_TITLE_LENGTH);
  const groupName = limitText(message.grupo_nome || message.nome_grupo || '', MAX_TITLE_LENGTH);
  const title = target.type === 'group' && groupName
    ? `${groupName} - ${senderName}`
    : senderName;
  const body = getMessagePreview(message);
  const notification = createNotification(title, {
    body,
    icon: message.remetente_avatar || appLogo,
    badge: appLogo,
    tag: `${target.type}-${target.id}`,
    renotify: true,
    silent: false,
    data: target,
  });

  if (!notification) return false;

  notification.onclick = () => {
    window.focus();
    openConversation?.(target);
    notification.close();
  };

  window.setTimeout(() => notification.close(), AUTO_CLOSE_MS);

  return true;
};
