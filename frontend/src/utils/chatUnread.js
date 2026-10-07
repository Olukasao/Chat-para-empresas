export const normalizarTotalNaoLidas = (valor = 0) => {
  const total = Number(valor || 0);

  if (!Number.isFinite(total) || total <= 0) {
    return 0;
  }

  return Math.floor(total);
};

export const formatarBadgeNaoLidas = (valor = 0) => {
  const total = normalizarTotalNaoLidas(valor);

  return total > 99 ? '99+' : String(total);
};

export const normalizarGrupoComNaoLidas = (grupo = {}) => {
  const unreadCount = normalizarTotalNaoLidas(
    grupo.unreadCount ?? grupo.nao_lidas ?? 0
  );

  return {
    ...grupo,
    nao_lidas: unreadCount,
    unreadCount,
  };
};

export const extrairGruposChat = (data) => {
  const grupos = Array.isArray(data)
    ? data
    : Array.isArray(data?.grupos)
      ? data.grupos
      : [];

  return grupos.map(normalizarGrupoComNaoLidas);
};
