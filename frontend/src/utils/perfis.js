export const PERFIL_ADMIN = "admin";
export const PERFIL_ADMIN_COMERCIAL = "admin_comercial";
export const PERFIL_USUARIO = "usuario";

export const PERFIS_USUARIO = [
  PERFIL_ADMIN,
  PERFIL_ADMIN_COMERCIAL,
  PERFIL_USUARIO,
];

export const PERFIL_LABELS = {
  [PERFIL_ADMIN]: "Administrador",
  [PERFIL_ADMIN_COMERCIAL]: "Admin Comercial",
  [PERFIL_USUARIO]: "Usuário",
};

export const getPerfilLabel = (perfil) => PERFIL_LABELS[perfil] || perfil || PERFIL_LABELS[PERFIL_USUARIO];

export const podeEditarAvisosInternos = (usuario = {}) => (
  usuario?.perfil === PERFIL_ADMIN || usuario?.perfil === PERFIL_ADMIN_COMERCIAL
);
