import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  connectSocket,
  disconnectSocket,
  syncSocketUser,
} from '../services/socket';
import {
  getBrowserNotificationPermission,
  hasConfiguredBrowserNotifications,
  isBrowserNotificationSupported,
  requestBrowserNotificationPermission,
  showBrowserMessageNotification,
} from '../services/browserNotifications';
import { BrowserNotificationContext } from './browserNotificationContext';

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

const buildConversationPath = (conversation) => {
  if (conversation?.type === 'group') {
    return `/chat?grupo=${conversation.id}`;
  }

  return `/chat?conversa=${conversation?.id}`;
};

export function BrowserNotificationProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const tokenRef = useRef(localStorage.getItem('token'));
  const [currentUser, setCurrentUser] = useState(() => readStoredUser());
  const [permission, setPermission] = useState(() => getBrowserNotificationPermission());
  const [hasConfigured, setHasConfigured] = useState(() => hasConfiguredBrowserNotifications());

  const updateCurrentUser = useCallback((nextUser = {}) => {
    Promise.resolve().then(() => {
      setCurrentUser(nextUser || {});
    });
  }, []);

  const refreshPermission = useCallback(() => {
    setPermission(getBrowserNotificationPermission());
    setHasConfigured(hasConfiguredBrowserNotifications());
  }, []);

  const requestPermission = useCallback(async () => {
    const nextPermission = await requestBrowserNotificationPermission();
    refreshPermission();
    return nextPermission;
  }, [refreshPermission]);

  useEffect(() => {
    window.addEventListener('focus', refreshPermission);
    document.addEventListener('visibilitychange', refreshPermission);

    return () => {
      window.removeEventListener('focus', refreshPermission);
      document.removeEventListener('visibilitychange', refreshPermission);
    };
  }, [refreshPermission]);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('token');
    tokenRef.current = token;

    if (!token) {
      updateCurrentUser({});
      disconnectSocket();
      return undefined;
    }

    const storedUser = readStoredUser();
    updateCurrentUser(storedUser);
    connectSocket(token);
    syncSocketUser(storedUser);

    const loadCurrentUser = async () => {
      try {
        const { data } = await api.get('/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (cancelled) return;

        localStorage.setItem('user', JSON.stringify(data));
        updateCurrentUser(data || {});
        syncSocketUser(data || {});
      } catch (err) {
        if (cancelled) return;

        console.error('Erro ao sincronizar usuário para notificações:', err);

        if (err.response?.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          updateCurrentUser({});
          disconnectSocket();
          navigate('/login', { replace: true });
        }
      }
    };

    if (!storedUser?.id || !storedUser?.empresa_id) {
      loadCurrentUser();
    }

    return () => {
      cancelled = true;
    };
  }, [location.pathname, navigate, updateCurrentUser]);

  useEffect(() => {
    const token = tokenRef.current;

    if (!token || !currentUser?.id) return undefined;

    const socketInstance = connectSocket(token);

    const openConversation = (conversation) => {
      if (!conversation?.id) return;
      navigate(buildConversationPath(conversation));
    };

    const handleConnect = () => {
      syncSocketUser(currentUser);
    };

    const handleDirectMessage = (message) => {
      showBrowserMessageNotification(message, {
        kind: 'direct',
        currentUserId: currentUser.id,
        openConversation,
      });
    };

    const handleGroupMessage = (message) => {
      showBrowserMessageNotification(message, {
        kind: 'group',
        currentUserId: currentUser.id,
        openConversation,
      });
    };

    socketInstance.on('connect', handleConnect);
    socketInstance.on('receive_direct_message', handleDirectMessage);
    socketInstance.on('new_direct_message_notification', handleDirectMessage);
    socketInstance.on('receive_group_message', handleGroupMessage);

    if (socketInstance.connected) {
      syncSocketUser(currentUser);
    }

    return () => {
      socketInstance.off('connect', handleConnect);
      socketInstance.off('receive_direct_message', handleDirectMessage);
      socketInstance.off('new_direct_message_notification', handleDirectMessage);
      socketInstance.off('receive_group_message', handleGroupMessage);
    };
  }, [currentUser, navigate]);

  const value = useMemo(() => ({
    permission,
    hasConfigured,
    isSupported: isBrowserNotificationSupported(),
    requestPermission,
    refreshPermission,
  }), [hasConfigured, permission, refreshPermission, requestPermission]);

  return (
    <BrowserNotificationContext.Provider value={value}>
      {children}
    </BrowserNotificationContext.Provider>
  );
}
