import { io } from "socket.io-client";

export const getSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }

  const host = window.location.hostname || 'localhost';
  return `http://${host}:8600`;
};

export const socket = io(getSocketUrl(), {
  transports: ['websocket', 'polling'],
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
  timeout: 10000,
});

export const configureSocketAuth = (token) => {
  socket.auth = token ? { token } : {};
  return socket;
};

export const connectSocket = (token) => {
  configureSocketAuth(token);

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
};

export const syncSocketUser = (user = {}) => {
  if (!user?.id || !user?.empresa_id) return;

  socket.emit('user_connect', {
    usuario_id: user.id,
    empresa_id: user.empresa_id,
  });

  socket.emit('join_user_groups', {
    usuario_id: user.id,
    empresa_id: user.empresa_id,
  });
};

export const disconnectSocket = () => {
  socket.auth = {};

  if (socket.connected) {
    socket.disconnect();
  }
};
