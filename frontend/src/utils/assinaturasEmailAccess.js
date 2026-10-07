export const ASSINATURAS_EMAIL_CARGOS_PERMITIDOS = ['marketing'];
export const ASSINATURAS_EMAIL_SETORES_PERMITIDOS = ['marketing'];

const normalizarPermissao = (valor = '') => (
  String(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
);

export const podeAcessarAssinaturasEmail = (usuario = {}) => {
  if (!usuario) return false;

  if (normalizarPermissao(usuario.perfil) === 'admin') {
    return true;
  }

  const cargosUsuario = [
    usuario.cargo,
    usuario.cargo_nome,
    usuario.funcao,
    usuario.perfil,
  ].map(normalizarPermissao).filter(Boolean);

  const setoresUsuario = [
    usuario.setor,
    usuario.setor_nome,
    usuario.departamento,
  ].map(normalizarPermissao).filter(Boolean);

  return (
    cargosUsuario.some((cargo) => ASSINATURAS_EMAIL_CARGOS_PERMITIDOS.includes(cargo)) ||
    setoresUsuario.some((setor) => ASSINATURAS_EMAIL_SETORES_PERMITIDOS.includes(setor))
  );
};
