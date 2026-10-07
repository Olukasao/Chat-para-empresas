import { useCallback, useEffect, useMemo, useState } from 'react';
import ThemeContext from '../utils/ThemeContext';
import {
  applyThemeToDocument,
  applyWorldCupThemeToDocument,
  normalizeTheme,
  readStoredTheme,
  THEME_DARK,
  THEME_LIGHT,
  THEME_STORAGE_KEY,
  WORLD_CUP_THEME_STORAGE_KEY,
} from '../utils/theme';

export default function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStoredTheme);
  const [worldCupTheme, setWorldCupTheme] = useState(false);

  useEffect(() => {
    const normalizedTheme = normalizeTheme(theme);

    window.localStorage.setItem(THEME_STORAGE_KEY, normalizedTheme);
    applyThemeToDocument(normalizedTheme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.removeItem(WORLD_CUP_THEME_STORAGE_KEY);
    applyWorldCupThemeToDocument(false);
  }, []);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === THEME_STORAGE_KEY) {
        setThemeState(normalizeTheme(event.newValue));
      }
      if (event.key === WORLD_CUP_THEME_STORAGE_KEY) {
        setWorldCupTheme(false);
      }
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const setTheme = useCallback((nextTheme) => {
    setThemeState(normalizeTheme(nextTheme));
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((currentTheme) => (
      currentTheme === THEME_LIGHT ? THEME_DARK : THEME_LIGHT
    ));
  }, []);

  const toggleWorldCup = useCallback(() => {
    setWorldCupTheme((current) => !current);
  }, []);

  const value = useMemo(() => ({
    theme,
    isLightTheme: theme === THEME_LIGHT,
    isWorldCupTheme: worldCupTheme,
    setTheme,
    toggleTheme,
    toggleWorldCup,
  }), [setTheme, theme, toggleTheme, toggleWorldCup, worldCupTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
