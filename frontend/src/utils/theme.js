export const THEME_STORAGE_KEY = 'chatTema';
export const WORLD_CUP_THEME_STORAGE_KEY = 'chatTemaCopa2026';
export const WORLD_CUP_THEME_CLASS = 'copa-theme';
export const WORLD_CUP_THEME_ALIAS = 'themeWorldCup2026';
export const THEME_LIGHT = 'claro';
export const THEME_DARK = 'escuro';

export const normalizeTheme = (theme) => (
  theme === THEME_LIGHT ? THEME_LIGHT : THEME_DARK
);

export const readStoredTheme = () => {
  if (typeof window === 'undefined') {
    return THEME_DARK;
  }

  return normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
};

export const readStoredWorldCupTheme = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(WORLD_CUP_THEME_STORAGE_KEY) === 'true';
};

const updateWorldCupClasses = (enabled) => {
  if (typeof document === 'undefined') {
    return;
  }

  document.body?.classList.toggle(WORLD_CUP_THEME_CLASS, enabled);
  document.body?.classList.toggle(WORLD_CUP_THEME_ALIAS, enabled);
  document.documentElement?.classList.toggle(WORLD_CUP_THEME_CLASS, enabled);
  document.documentElement?.classList.toggle(WORLD_CUP_THEME_ALIAS, enabled);
};

export const applyThemeToDocument = (theme) => {
  if (typeof document === 'undefined') {
    return;
  }

  const nextTheme = normalizeTheme(theme);

  document.documentElement.setAttribute('data-theme', nextTheme);
  // Tokens do AcessaNet Design System (public/design-system/acessanet-ds.css).
  document.documentElement.setAttribute('data-an-theme', nextTheme === THEME_LIGHT ? 'light' : 'dark');
  document.documentElement.style.colorScheme = nextTheme === THEME_LIGHT ? 'light' : 'dark';
  document.body?.setAttribute('data-theme', nextTheme);
};

export const applyWorldCupThemeToDocument = (enabled) => {
  if (typeof window === 'undefined') {
    return;
  }

  updateWorldCupClasses(enabled);
};
