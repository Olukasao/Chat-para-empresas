export const CHAT_APPEARANCE_DEFAULTS = {
  theme: 'default',
  accentColor: null,
  backgroundColor: null,
  panelColor: null,
  ownMessageColor: null,
  receivedMessageColor: null,
  textColor: null,
  secondaryTextColor: null,
  linkColor: null,
  wallpaperType: 'none',
  wallpaperUrl: null,
  wallpaperColor: null,
  wallpaperColor2: null,
  wallpaperAngle: 135,
  wallpaperMode: 'cover',
  wallpaperIntensity: 100,
  wallpaperBlur: 0,
  messageRadius: 18,
  messageDensity: 'comfortable',
  fontSize: 'normal',
  bubbleOpacity: 100,
  showTimestamp: true,
  showAvatar: true,
  showDateSeparator: true,
  showWallpaper: true,
  animationsEnabled: true,
};

export const CHAT_APPEARANCE_THEME_PRESETS = [
  {
    id: 'default',
    label: 'Padrão AcessaNet',
    colors: null,
  },
  {
    id: 'dark',
    label: 'Dark',
    colors: {
      backgroundColor: '#0b1220', panelColor: '#111a2c', accentColor: '#38bdf8',
      ownMessageColor: '#0f4c81', receivedMessageColor: '#1b2740',
      textColor: '#e5e7eb', secondaryTextColor: '#94a3b8', linkColor: '#38bdf8',
    },
  },
  {
    id: 'amoled',
    label: 'AMOLED',
    colors: {
      backgroundColor: '#000000', panelColor: '#080808', accentColor: '#22d3ee',
      ownMessageColor: '#0a3d62', receivedMessageColor: '#151515',
      textColor: '#f5f5f5', secondaryTextColor: '#8a8a8a', linkColor: '#22d3ee',
    },
  },
  {
    id: 'claro',
    label: 'Claro',
    colors: {
      backgroundColor: '#f3f7fb', panelColor: '#ffffff', accentColor: '#0077ff',
      ownMessageColor: '#dbeafe', receivedMessageColor: '#ffffff',
      textColor: '#102033', secondaryTextColor: '#5b6b81', linkColor: '#0077ff',
    },
  },
  {
    id: 'oceano',
    label: 'Oceano',
    colors: {
      backgroundColor: '#062b3d', panelColor: '#0a3a52', accentColor: '#2dd4bf',
      ownMessageColor: '#0f6674', receivedMessageColor: '#0a3a52',
      textColor: '#e6fbff', secondaryTextColor: '#8fc4d1', linkColor: '#2dd4bf',
    },
  },
  {
    id: 'roxo',
    label: 'Roxo',
    colors: {
      backgroundColor: '#1a1330', panelColor: '#241a44', accentColor: '#a78bfa',
      ownMessageColor: '#5b21b6', receivedMessageColor: '#241a44',
      textColor: '#f1eaff', secondaryTextColor: '#b6a8d6', linkColor: '#a78bfa',
    },
  },
  {
    id: 'cyber',
    label: 'Cyber',
    colors: {
      backgroundColor: '#0a0014', panelColor: '#140027', accentColor: '#ff2fd0',
      ownMessageColor: '#3d0066', receivedMessageColor: '#140027',
      textColor: '#f5e6ff', secondaryTextColor: '#c084fc', linkColor: '#00e5ff',
    },
  },
];

export const CHAT_APPEARANCE_WALLPAPER_PRESETS = [
  { id: 'aurora', label: 'Aurora', css: 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)' },
  { id: 'sunset', label: 'Pôr do sol', css: 'linear-gradient(135deg, #ff512f, #dd2476)' },
  { id: 'forest', label: 'Floresta', css: 'linear-gradient(135deg, #134e5e, #71b280)' },
  { id: 'night', label: 'Noite', css: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' },
  { id: 'ocean', label: 'Oceano', css: 'linear-gradient(135deg, #2193b0, #6dd5ed)' },
];

export const FONT_SIZE_PX = { small: '13px', normal: '14px', large: '16px' };

export const MESSAGE_RADIUS_PRESETS = [
  { id: 'arredondado', label: 'Arredondado', value: 18 },
  { id: 'moderno', label: 'Moderno', value: 12 },
  { id: 'quadrado', label: 'Quadrado', value: 5 },
];

export const DENSITY_TOKENS = {
  compact: { bubblePaddingY: '5px', bubblePaddingX: '9px', messageGap: '2px', lineHeight: '1.3' },
  comfortable: { bubblePaddingY: '8px', bubblePaddingX: '12px', messageGap: '6px', lineHeight: '1.45' },
  spacious: { bubblePaddingY: '12px', bubblePaddingX: '16px', messageGap: '12px', lineHeight: '1.6' },
};

export function hexToRgba(hex, opacityPercent = 100) {
  if (!hex || typeof hex !== 'string') return null;
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const int = parseInt(match[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  const alpha = Math.min(1, Math.max(0, Number(opacityPercent) / 100));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function relativeLuminance(hex) {
  const match = /^#([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!match) return null;
  const int = parseInt(match[1], 16);
  const channels = [(int >> 16) & 255, (int >> 8) & 255, int & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function pickReadableTextColor(bgHex, fallback = null) {
  const lum = relativeLuminance(bgHex);
  if (lum === null) return fallback;
  return lum > 0.5 ? '#111111' : '#f5f5f5';
}

export function contrastRatio(hexA, hexB) {
  const lumA = relativeLuminance(hexA);
  const lumB = relativeLuminance(hexB);
  if (lumA === null || lumB === null) return null;
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

export function resolveWallpaperImage(prefs) {
  if (!prefs || prefs.wallpaperType === 'none' || !prefs.showWallpaper) return null;

  if (prefs.wallpaperType === 'preset') {
    const preset = CHAT_APPEARANCE_WALLPAPER_PRESETS.find((item) => item.id === prefs.wallpaperUrl);
    return preset ? preset.css : null;
  }

  if (prefs.wallpaperType === 'upload' && prefs.wallpaperUrl) {
    return `url("${prefs.wallpaperUrl}")`;
  }

  if (prefs.wallpaperType === 'gradient' && prefs.wallpaperColor && prefs.wallpaperColor2) {
    return `linear-gradient(${Number(prefs.wallpaperAngle) || 0}deg, ${prefs.wallpaperColor}, ${prefs.wallpaperColor2})`;
  }

  return null;
}

export function buildChatAppearanceCssVars(prefs = CHAT_APPEARANCE_DEFAULTS) {
  const density = DENSITY_TOKENS[prefs.messageDensity] || DENSITY_TOKENS.comfortable;
  const wallpaperImage = resolveWallpaperImage(prefs);
  const solidWallpaperColor = prefs.wallpaperType === 'color' ? prefs.wallpaperColor : null;

  const generalTextFallbackBg = prefs.backgroundColor || prefs.panelColor;

  const vars = {
    '--user-accent-color': prefs.accentColor || undefined,
    '--user-bg-color': prefs.backgroundColor || undefined,
    '--user-panel-color': prefs.panelColor || undefined,
    '--user-text-color': prefs.textColor
      || (generalTextFallbackBg ? pickReadableTextColor(generalTextFallbackBg) : undefined),
    '--user-secondary-text-color': prefs.secondaryTextColor || undefined,
    '--user-link-color': prefs.linkColor || undefined,
    '--user-message-sent': prefs.ownMessageColor
      ? (hexToRgba(prefs.ownMessageColor, prefs.bubbleOpacity) || prefs.ownMessageColor)
      : undefined,
    '--user-message-received': prefs.receivedMessageColor
      ? (hexToRgba(prefs.receivedMessageColor, prefs.bubbleOpacity) || prefs.receivedMessageColor)
      : undefined,
    '--user-message-sent-text': prefs.textColor
      || (prefs.ownMessageColor ? pickReadableTextColor(prefs.ownMessageColor) : undefined),
    '--user-message-received-text': prefs.textColor
      || (prefs.receivedMessageColor ? pickReadableTextColor(prefs.receivedMessageColor) : undefined),
    '--user-message-radius': prefs.messageRadius != null ? `${prefs.messageRadius}px` : undefined,
    '--user-font-size': FONT_SIZE_PX[prefs.fontSize] || undefined,
    '--user-bubble-padding-y': density.bubblePaddingY,
    '--user-bubble-padding-x': density.bubblePaddingX,
    '--user-message-gap': density.messageGap,
    '--user-line-height': density.lineHeight,
    '--user-animation-duration': prefs.animationsEnabled === false ? '0s' : undefined,
    '--user-wallpaper-image': wallpaperImage || undefined,
    '--user-wallpaper-color': solidWallpaperColor || undefined,
    '--user-wallpaper-size': prefs.wallpaperMode === 'contain'
      ? 'contain'
      : prefs.wallpaperMode === 'repeat' ? 'auto' : 'cover',
    '--user-wallpaper-repeat': prefs.wallpaperMode === 'repeat' ? 'repeat' : 'no-repeat',
    '--user-wallpaper-blur': `${prefs.wallpaperBlur || 0}px`,
    '--user-wallpaper-opacity': String(Math.min(100, Math.max(0, prefs.wallpaperIntensity ?? 100)) / 100),
  };

  return Object.fromEntries(Object.entries(vars).filter(([, value]) => value !== undefined));
}

export function mergeAppearance(base, overrides) {
  if (!overrides) return base;
  const merged = { ...base };
  Object.entries(overrides).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      merged[key] = value;
    }
  });
  return merged;
}
