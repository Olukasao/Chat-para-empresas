import { createContext, useContext } from 'react';

export const BrowserNotificationContext = createContext({
  permission: 'unsupported',
  hasConfigured: false,
  isSupported: false,
  requestPermission: async () => 'unsupported',
  refreshPermission: () => {},
});

export const useBrowserNotifications = () => useContext(BrowserNotificationContext);
