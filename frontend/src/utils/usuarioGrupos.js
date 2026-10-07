const parseGruposSerializados = (valor) => {
  if (typeof valor !== 'string') return valor;

  const texto = valor.trim();
  if (!texto) return [];

  try {
    const parsed = JSON.parse(texto);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return texto.split(',').map((nome) => ({ nome: nome.trim() }));
  }
};

export const normalizarGruposUsuario = (usuario = {}) => {
  const usuarioValido = usuario && typeof usuario === 'object' ? usuario : {};
  const origem = parseGruposSerializados(usuarioValido.grupos || usuarioValido.grupos_usuario || []);
  const grupos = Array.isArray(origem) ? origem : [];
  const vistos = new Set();

  return grupos
    .map((grupo) => (
      typeof grupo === 'string'
        ? { nome: grupo }
        : {
            id: grupo?.id,
            nome: grupo?.nome,
            setor_nome: grupo?.setor_nome,
          }
    ))
    .map((grupo) => ({
      ...grupo,
      nome: String(grupo.nome || '').trim(),
    }))
    .filter((grupo) => {
      if (!grupo.nome) return false;

      const chave = grupo.nome
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    });
};

export const nomesGruposUsuario = (usuario = {}) => (
  normalizarGruposUsuario(usuario).map((grupo) => grupo.nome)
);
