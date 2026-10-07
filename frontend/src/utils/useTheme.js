import { useContext } from 'react';
import ThemeContext from './ThemeContext';
import { readStoredTheme, readStoredWorldCupTheme, THEME_LIGHT } from './theme';

export default function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    const theme = readStoredTheme();

    return {
      theme,
      isLightTheme: theme === THEME_LIGHT,
      isWorldCupTheme: readStoredWorldCupTheme(),
      setTheme: () => {},
      toggleTheme: () => {},
      toggleWorldCup: () => {},
    };
  }

  return context;
}
