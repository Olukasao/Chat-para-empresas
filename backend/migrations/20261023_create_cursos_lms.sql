-- Módulo Cursos (LMS) do Acessa Workspace. Somente tabelas novas, prefixo cursos_.

CREATE TABLE IF NOT EXISTS cursos_categorias (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  nome VARCHAR(120) NOT NULL,
  ordem INT NOT NULL DEFAULT 0,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cursos_categoria_nome (empresa_id, nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cursos (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  categoria_id INT NULL,
  titulo VARCHAR(200) NOT NULL,
  descricao TEXT NULL,
  objetivos TEXT NULL,
  prerequisitos TEXT NULL,
  instrutor VARCHAR(160) NULL,
  nivel ENUM('basico','intermediario','avancado') NOT NULL DEFAULT 'basico',
  capa_arquivo_id INT NULL,
  carga_horaria_min INT NOT NULL DEFAULT 0,
  status ENUM('rascunho','publicado','arquivado') NOT NULL DEFAULT 'rascunho',
  obrigatorio TINYINT(1) NOT NULL DEFAULT 0,
  prazo_dias INT NULL,
  emite_certificado TINYINT(1) NOT NULL DEFAULT 1,
  nota_final_minima INT NOT NULL DEFAULT 70,
  curso_requisito_id INT NULL,
  acessos INT NOT NULL DEFAULT 0,
  criado_por INT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (categoria_id) REFERENCES cursos_categorias(id) ON DELETE SET NULL,
  INDEX idx_cursos_empresa_status (empresa_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cursos_modulos (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  curso_id INT NOT NULL,
  titulo VARCHAR(200) NOT NULL,
  ordem INT NOT NULL DEFAULT 0,
  FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE,
  INDEX idx_cursos_modulos_curso (curso_id, ordem)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cursos_aulas (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  curso_id INT NOT NULL,
  modulo_id INT NOT NULL,
  titulo VARCHAR(200) NOT NULL,
  tipo ENUM('conteudo','prova') NOT NULL DEFAULT 'conteudo',
  ordem INT NOT NULL DEFAULT 0,
  duracao_min INT NOT NULL DEFAULT 0,
  blocos LONGTEXT NULL,
  prova LONGTEXT NULL,
  exige_anterior TINYINT(1) NOT NULL DEFAULT 0,
  versao INT NOT NULL DEFAULT 1,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE,
  FOREIGN KEY (modulo_id) REFERENCES cursos_modulos(id) ON DELETE CASCADE,
  INDEX idx_cursos_aulas_modulo (modulo_id, ordem)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cursos_aulas_versoes (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  aula_id INT NOT NULL,
  versao INT NOT NULL,
  titulo VARCHAR(200) NOT NULL,
  blocos LONGTEXT NULL,
  prova LONGTEXT NULL,
  autor_id INT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (aula_id) REFERENCES cursos_aulas(id) ON DELETE CASCADE,
  INDEX idx_cursos_versoes_aula (aula_id, versao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cursos_arquivos (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  curso_id INT NULL,
  nome_original VARCHAR(255) NOT NULL,
  mime VARCHAR(120) NOT NULL,
  caminho VARCHAR(255) NOT NULL,
  tamanho INT NOT NULL,
  publico TINYINT(1) NOT NULL DEFAULT 0,
  enviado_por INT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cursos_arquivos_curso (curso_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cursos_atribuicoes (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  curso_id INT NOT NULL,
  tipo ENUM('todos','setor','usuario') NOT NULL,
  alvo_id INT NOT NULL DEFAULT 0,
  obrigatorio TINYINT(1) NOT NULL DEFAULT 0,
  prazo_em DATE NULL,
  criado_por INT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE,
  UNIQUE KEY uq_cursos_atribuicao (curso_id, tipo, alvo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cursos_matriculas (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  curso_id INT NOT NULL,
  usuario_id INT NOT NULL,
  origem ENUM('livre','atribuido') NOT NULL DEFAULT 'livre',
  obrigatorio TINYINT(1) NOT NULL DEFAULT 0,
  prazo_em DATE NULL,
  ultima_aula_id INT NULL,
  ultima_posicao INT NOT NULL DEFAULT 0,
  concluido_em DATETIME NULL,
  ultimo_acesso DATETIME NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  UNIQUE KEY uq_cursos_matricula (curso_id, usuario_id),
  INDEX idx_cursos_matricula_usuario (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cursos_progresso (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  curso_id INT NOT NULL,
  aula_id INT NOT NULL,
  concluida_em DATETIME NULL,
  segundos INT NOT NULL DEFAULT 0,
  posicao INT NOT NULL DEFAULT 0,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (aula_id) REFERENCES cursos_aulas(id) ON DELETE CASCADE,
  UNIQUE KEY uq_cursos_progresso (usuario_id, aula_id),
  INDEX idx_cursos_progresso_curso (usuario_id, curso_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cursos_tentativas (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  curso_id INT NOT NULL,
  aula_id INT NOT NULL,
  numero INT NOT NULL,
  iniciada_em DATETIME NOT NULL,
  expira_em DATETIME NULL,
  finalizada_em DATETIME NULL,
  ordem LONGTEXT NULL,
  respostas LONGTEXT NULL,
  correcoes LONGTEXT NULL,
  nota DECIMAL(5,2) NULL,
  status ENUM('em_andamento','aguardando_correcao','finalizada') NOT NULL DEFAULT 'em_andamento',
  aprovado TINYINT(1) NULL,
  tempo_segundos INT NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (aula_id) REFERENCES cursos_aulas(id) ON DELETE CASCADE,
  UNIQUE KEY uq_cursos_tentativa (usuario_id, aula_id, numero),
  INDEX idx_cursos_tentativa_curso (curso_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cursos_certificados (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(24) NOT NULL,
  curso_id INT NOT NULL,
  usuario_id INT NOT NULL,
  nome_aluno VARCHAR(160) NOT NULL,
  curso_titulo VARCHAR(200) NOT NULL,
  carga_horaria_min INT NOT NULL DEFAULT 0,
  nota DECIMAL(5,2) NULL,
  emitido_em DATETIME NOT NULL,
  UNIQUE KEY uq_cursos_certificado_codigo (codigo),
  UNIQUE KEY uq_cursos_certificado_aluno (curso_id, usuario_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cursos_trilhas (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  titulo VARCHAR(200) NOT NULL,
  descricao TEXT NULL,
  publicada TINYINT(1) NOT NULL DEFAULT 0,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cursos_trilha_itens (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  trilha_id INT NOT NULL,
  curso_id INT NOT NULL,
  ordem INT NOT NULL DEFAULT 0,
  FOREIGN KEY (trilha_id) REFERENCES cursos_trilhas(id) ON DELETE CASCADE,
  FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE,
  UNIQUE KEY uq_cursos_trilha_item (trilha_id, curso_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cursos_favoritos (
  usuario_id INT NOT NULL,
  curso_id INT NOT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id, curso_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cursos_anotacoes (
  usuario_id INT NOT NULL,
  aula_id INT NOT NULL,
  texto TEXT NOT NULL,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id, aula_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (aula_id) REFERENCES cursos_aulas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cursos_feedback (
  usuario_id INT NOT NULL,
  curso_id INT NOT NULL,
  nota TINYINT NOT NULL,
  comentario TEXT NULL,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id, curso_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cursos_preferencias (
  usuario_id INT NOT NULL PRIMARY KEY,
  ranking_opt_in TINYINT(1) NOT NULL DEFAULT 0,
  meta_semanal_min INT NOT NULL DEFAULT 60,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cursos_gestores (
  usuario_id INT NOT NULL PRIMARY KEY,
  concedido_por INT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cursos_auditoria (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NULL,
  acao VARCHAR(60) NOT NULL,
  entidade VARCHAR(40) NOT NULL,
  entidade_id INT NULL,
  detalhes TEXT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cursos_auditoria (entidade, entidade_id),
  INDEX idx_cursos_auditoria_data (criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
