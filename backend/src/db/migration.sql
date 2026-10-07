-- ============================================
-- CHAT INTERNO - MIGRATION SQL
-- ============================================
-- Execute este arquivo no seu banco de dados MySQL

-- ============================================
-- TABELA: usuarios
-- ============================================
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS avatar LONGTEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS perfil ENUM('admin', 'admin_comercial', 'usuario') DEFAULT 'usuario',
ADD COLUMN IF NOT EXISTS status ENUM('online', 'offline', 'away') DEFAULT 'offline',
ADD COLUMN IF NOT EXISTS deletado_em TIMESTAMP DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ultimo_acesso TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE usuarios
MODIFY COLUMN avatar LONGTEXT DEFAULT NULL;

ALTER TABLE usuarios
MODIFY COLUMN perfil ENUM('admin', 'admin_comercial', 'usuario') DEFAULT 'usuario';

UPDATE usuarios
SET perfil = 'admin_comercial'
WHERE LOWER(TRIM(nome)) LIKE 'patricia%borba'
  AND deletado_em IS NULL;

ALTER TABLE empresas CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE setores CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE usuarios CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================
-- TABELA: conversas_diretas
-- Conversas 1 a 1 entre usuários
-- ============================================
CREATE TABLE IF NOT EXISTS conversas_diretas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario1_id INT NOT NULL,
  usuario2_id INT NOT NULL,
  criada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario1_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario2_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  UNIQUE KEY unique_conversa (usuario1_id, usuario2_id),
  INDEX idx_usuario1 (usuario1_id),
  INDEX idx_usuario2 (usuario2_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA: grupos
-- Grupos de conversa internos
-- ============================================
CREATE TABLE IF NOT EXISTS grupos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT DEFAULT NULL,
  criador_id INT DEFAULT NULL,
  empresa_id INT NOT NULL,
  avatar LONGTEXT DEFAULT NULL,
  fixo TINYINT(1) NOT NULL DEFAULT 0,
  setor_id INT DEFAULT NULL,
  deletado_em TIMESTAMP DEFAULT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (criador_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  FOREIGN KEY (setor_id) REFERENCES setores(id) ON DELETE SET NULL,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  INDEX idx_empresa (empresa_id),
  INDEX idx_criador (criador_id),
  INDEX idx_grupo_setor (setor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE grupos
ADD COLUMN IF NOT EXISTS fixo TINYINT(1) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS setor_id INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deletado_em TIMESTAMP DEFAULT NULL,
ADD COLUMN IF NOT EXISTS mensagem_fixada_titulo VARCHAR(180) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS mensagem_fixada_conteudo TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS mensagem_fixada_ativo TINYINT(1) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS mensagem_fixada_atualizada_em TIMESTAMP NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS mensagem_fixada_atualizada_por INT DEFAULT NULL;

-- ============================================
-- TABELA: grupo_membros
-- Membros de grupos
-- ============================================
CREATE TABLE IF NOT EXISTS grupo_membros (
  id INT AUTO_INCREMENT PRIMARY KEY,
  grupo_id INT NOT NULL,
  usuario_id INT NOT NULL,
  adicionado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  UNIQUE KEY unique_membro (grupo_id, usuario_id),
  INDEX idx_grupo (grupo_id),
  INDEX idx_usuario (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA: mensagens
-- Mensagens de conversas diretas e grupos
-- ============================================
CREATE TABLE IF NOT EXISTS mensagens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  remetente_id INT NOT NULL,
  conversa_direta_id INT DEFAULT NULL,
  grupo_id INT DEFAULT NULL,
  tipo_mensagem ENUM('texto', 'imagem', 'audio', 'arquivo', 'sticker') DEFAULT 'texto',
  anexo_nome VARCHAR(255) DEFAULT NULL,
  anexo_mime VARCHAR(100) DEFAULT NULL,
  sticker_id INT DEFAULT NULL,
  resposta_mensagem_id INT DEFAULT NULL,
  mensagem LONGTEXT NOT NULL,
  lida BOOLEAN DEFAULT FALSE,
  entregue_em TIMESTAMP DEFAULT NULL,
  lida_em TIMESTAMP DEFAULT NULL,
  editada_em TIMESTAMP DEFAULT NULL,
  deletada_em TIMESTAMP DEFAULT NULL,
  deletada_por INT DEFAULT NULL,
  criada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (remetente_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (conversa_direta_id) REFERENCES conversas_diretas(id) ON DELETE CASCADE,
  FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE,
  INDEX idx_remetente (remetente_id),
  INDEX idx_conversa (conversa_direta_id),
  INDEX idx_grupo (grupo_id),
  INDEX idx_criada (criada_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Compatibilidade com instalações antigas que já possuem a tabela mensagens.
-- O CREATE TABLE IF NOT EXISTS acima não altera uma tabela existente.
ALTER TABLE mensagens
ADD COLUMN IF NOT EXISTS conversa_direta_id INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS grupo_id INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS tipo_mensagem ENUM('texto', 'imagem', 'audio', 'arquivo', 'sticker') DEFAULT 'texto',
ADD COLUMN IF NOT EXISTS anexo_nome VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS anexo_mime VARCHAR(100) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS sticker_id INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS resposta_mensagem_id INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS lida BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS entregue_em TIMESTAMP DEFAULT NULL,
ADD COLUMN IF NOT EXISTS lida_em TIMESTAMP DEFAULT NULL,
ADD COLUMN IF NOT EXISTS editada_em TIMESTAMP DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deletada_em TIMESTAMP DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deletada_por INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS criada_em TIMESTAMP NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS atualizada_em TIMESTAMP NULL DEFAULT NULL;

ALTER TABLE mensagens
MODIFY COLUMN mensagem LONGTEXT;

ALTER TABLE mensagens
MODIFY COLUMN tipo_mensagem ENUM('texto', 'imagem', 'audio', 'arquivo', 'sticker') DEFAULT 'texto';

ALTER TABLE mensagens CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @mensagens_has_created_at = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'mensagens'
    AND COLUMN_NAME = 'created_at'
);

SET @sync_criada_em_sql = IF(
  @mensagens_has_created_at > 0,
  'UPDATE mensagens SET criada_em = COALESCE(criada_em, created_at, CURRENT_TIMESTAMP) WHERE criada_em IS NULL',
  'UPDATE mensagens SET criada_em = COALESCE(criada_em, CURRENT_TIMESTAMP) WHERE criada_em IS NULL'
);

PREPARE sync_criada_em FROM @sync_criada_em_sql;
EXECUTE sync_criada_em;
DEALLOCATE PREPARE sync_criada_em;

UPDATE mensagens
SET atualizada_em = COALESCE(atualizada_em, criada_em, CURRENT_TIMESTAMP)
WHERE atualizada_em IS NULL;

ALTER TABLE mensagens
MODIFY COLUMN criada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
MODIFY COLUMN atualizada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_mensagens_sticker ON mensagens(sticker_id);

-- ============================================
-- TABELA: stickers
-- Arquivos normalizados de figurinhas
-- ============================================
CREATE TABLE IF NOT EXISTS stickers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  created_by_user_id INT NOT NULL,
  file_url VARCHAR(600) NOT NULL,
  storage_path VARCHAR(800) NOT NULL,
  mime VARCHAR(80) NOT NULL DEFAULT 'image/webp',
  width INT NOT NULL DEFAULT 512,
  height INT NOT NULL DEFAULT 512,
  file_size INT DEFAULT NULL,
  is_animated TINYINT(1) NOT NULL DEFAULT 0,
  frame_count INT NOT NULL DEFAULT 1,
  duration_ms INT DEFAULT NULL,
  source_sticker_id INT DEFAULT NULL,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (source_sticker_id) REFERENCES stickers(id) ON DELETE SET NULL,
  UNIQUE KEY unique_sticker_file_url (file_url),
  INDEX idx_stickers_empresa_created (empresa_id, created_at),
  INDEX idx_stickers_created_by (created_by_user_id),
  INDEX idx_stickers_source (source_sticker_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE stickers
ADD COLUMN IF NOT EXISTS is_animated TINYINT(1) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS frame_count INT NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS duration_ms INT DEFAULT NULL;

-- ============================================
-- TABELA: user_stickers
-- Biblioteca pessoal de figurinhas
-- ============================================
CREATE TABLE IF NOT EXISTS user_stickers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  sticker_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (sticker_id) REFERENCES stickers(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_sticker (user_id, sticker_id),
  INDEX idx_user_stickers_user_created (user_id, deleted_at, created_at),
  INDEX idx_user_stickers_sticker (sticker_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA: sticker_favorites
-- Favoritos de figurinhas por usuario
-- ============================================
CREATE TABLE IF NOT EXISTS sticker_favorites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  sticker_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (sticker_id) REFERENCES stickers(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_sticker_favorite (user_id, sticker_id),
  INDEX idx_sticker_favorites_user_created (user_id, created_at),
  INDEX idx_sticker_favorites_sticker (sticker_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA: sticker_recents
-- Ultimas figurinhas usadas por usuario
-- ============================================
CREATE TABLE IF NOT EXISTS sticker_recents (
  user_id INT NOT NULL,
  sticker_id INT NOT NULL,
  last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  use_count INT NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, sticker_id),
  FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (sticker_id) REFERENCES stickers(id) ON DELETE CASCADE,
  INDEX idx_sticker_recents_user_used (user_id, last_used_at),
  INDEX idx_sticker_recents_sticker (sticker_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA: leituras_mensagens
-- Rastreia quem leu cada mensagem em grupos
-- ============================================
CREATE TABLE IF NOT EXISTS leituras_mensagens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mensagem_id INT NOT NULL,
  usuario_id INT NOT NULL,
  entregue_em TIMESTAMP NULL DEFAULT NULL,
  lida_em TIMESTAMP NULL DEFAULT NULL,
  FOREIGN KEY (mensagem_id) REFERENCES mensagens(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  UNIQUE KEY unique_leitura (mensagem_id, usuario_id),
  INDEX idx_mensagem (mensagem_id),
  INDEX idx_usuario (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE leituras_mensagens
ADD COLUMN IF NOT EXISTS entregue_em TIMESTAMP NULL DEFAULT NULL;

ALTER TABLE leituras_mensagens
MODIFY COLUMN lida_em TIMESTAMP NULL DEFAULT NULL;

UPDATE leituras_mensagens
SET entregue_em = COALESCE(entregue_em, lida_em)
WHERE lida_em IS NOT NULL
  AND entregue_em IS NULL;

-- ============================================
-- TABELA: group_message_reads
-- Cursor de ultima mensagem lida por usuario/grupo
-- ============================================
CREATE TABLE IF NOT EXISTS group_message_reads (
  user_id INT NOT NULL,
  group_id INT NOT NULL,
  last_read_message_id INT NULL DEFAULT NULL,
  last_read_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (user_id, group_id),
  FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES grupos(id) ON DELETE CASCADE,
  FOREIGN KEY (last_read_message_id) REFERENCES mensagens(id) ON DELETE SET NULL,
  INDEX idx_group_message_reads_group_user (group_id, user_id),
  INDEX idx_group_message_reads_message (last_read_message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO group_message_reads (
  user_id,
  group_id,
  last_read_message_id,
  last_read_at
)
SELECT
  lm.usuario_id,
  m.grupo_id,
  MAX(m.id) AS last_read_message_id,
  MAX(lm.lida_em) AS last_read_at
FROM leituras_mensagens lm
JOIN mensagens m ON m.id = lm.mensagem_id
JOIN grupo_membros gm
  ON gm.grupo_id = m.grupo_id
 AND gm.usuario_id = lm.usuario_id
WHERE lm.lida_em IS NOT NULL
  AND m.grupo_id IS NOT NULL
  AND m.deletada_em IS NULL
GROUP BY lm.usuario_id, m.grupo_id
ON DUPLICATE KEY UPDATE
  last_read_message_id = CASE
    WHEN VALUES(last_read_message_id) > COALESCE(group_message_reads.last_read_message_id, 0)
      THEN VALUES(last_read_message_id)
    ELSE group_message_reads.last_read_message_id
  END,
  last_read_at = CASE
    WHEN group_message_reads.last_read_at IS NULL
      THEN VALUES(last_read_at)
    WHEN VALUES(last_read_at) IS NULL
      THEN group_message_reads.last_read_at
    WHEN VALUES(last_read_at) > group_message_reads.last_read_at
      THEN VALUES(last_read_at)
    ELSE group_message_reads.last_read_at
  END;

-- ============================================
-- TABELA: mensagens_ocultas_usuario
-- Mensagens apagadas apenas para um usuario
-- ============================================
CREATE TABLE IF NOT EXISTS mensagens_ocultas_usuario (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mensagem_id INT NOT NULL,
  usuario_id INT NOT NULL,
  ocultada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mensagem_id) REFERENCES mensagens(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  UNIQUE KEY unique_mensagem_usuario (mensagem_id, usuario_id),
  INDEX idx_usuario (usuario_id),
  INDEX idx_mensagem (mensagem_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA: conversas_ocultas_usuario
-- Conversas removidas apenas da lista lateral de um usuario
-- ============================================
CREATE TABLE IF NOT EXISTS conversas_ocultas_usuario (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversa_direta_id INT NOT NULL,
  usuario_id INT NOT NULL,
  ocultada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversa_direta_id) REFERENCES conversas_diretas(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  UNIQUE KEY unique_conversa_usuario (conversa_direta_id, usuario_id),
  INDEX idx_conversa_oculta_usuario (usuario_id),
  INDEX idx_conversa_oculta_conversa (conversa_direta_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA: chat_favoritos
-- Favoritos pessoais de conversas diretas e grupos
-- ============================================
CREATE TABLE IF NOT EXISTS chat_favoritos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  tipo ENUM('direta', 'grupo') NOT NULL,
  referencia_id INT NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  UNIQUE KEY unique_chat_favorito (usuario_id, tipo, referencia_id),
  INDEX idx_chat_favoritos_usuario (usuario_id),
  INDEX idx_chat_favoritos_tipo_ref (tipo, referencia_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA: message_favorites
-- Favoritos pessoais de mensagens
-- ============================================
CREATE TABLE IF NOT EXISTS message_favorites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  message_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES mensagens(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_message_favorite (user_id, message_id),
  INDEX idx_message_favorites_user_created (user_id, created_at),
  INDEX idx_message_favorites_message (message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA: user_quick_access
-- Atalhos rápidos escolhidos individualmente por usuário
-- ============================================
CREATE TABLE IF NOT EXISTS user_quick_access (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  quick_access_id VARCHAR(80) NOT NULL,
  `position` INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_quick_access (user_id, quick_access_id),
  INDEX idx_user_quick_access_user_position (user_id, `position`),
  INDEX idx_user_quick_access_id (quick_access_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA: notes
-- Notas rápidas pessoais dos usuários
-- ============================================
CREATE TABLE IF NOT EXISTS notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  owner_user_id INT DEFAULT NULL,
  title VARCHAR(180) NOT NULL,
  content TEXT DEFAULT NULL,
  pinned TINYINT(1) NOT NULL DEFAULT 0,
  last_edited_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_notes_user (user_id),
  INDEX idx_notes_owner (owner_user_id),
  INDEX idx_notes_last_edited_by (last_edited_by),
  INDEX idx_notes_user_pinned_updated (user_id, pinned, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA: note_shares
-- Compartilhamentos das notas rápidas
-- ============================================
CREATE TABLE IF NOT EXISTS note_shares (
  id INT AUTO_INCREMENT PRIMARY KEY,
  note_id INT NOT NULL,
  user_id INT NOT NULL,
  permission ENUM('view', 'edit') NOT NULL DEFAULT 'view',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  UNIQUE KEY unique_note_user (note_id, user_id),
  INDEX idx_note_shares_note (note_id),
  INDEX idx_note_shares_user (user_id),
  INDEX idx_note_shares_user_permission (user_id, permission)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA: solicitacoes_internas
-- Mini chamados internos com status, resposta e anexo opcional
-- ============================================
CREATE TABLE IF NOT EXISTS solicitacoes_internas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  usuario_id INT NOT NULL,
  setor VARCHAR(120) NOT NULL,
  tipo VARCHAR(140) NOT NULL,
  prioridade VARCHAR(20) NOT NULL DEFAULT 'media',
  titulo VARCHAR(180) NOT NULL,
  descricao TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'aberto',
  resposta TEXT DEFAULT NULL,
  respondido_por INT DEFAULT NULL,
  respondido_em TIMESTAMP NULL DEFAULT NULL,
  responsavel_criacao_id INT DEFAULT NULL,
  responsavel_execucao_id INT DEFAULT NULL,
  concluido_por INT DEFAULT NULL,
  concluido_em TIMESTAMP NULL DEFAULT NULL,
  anexo_url VARCHAR(1000) DEFAULT NULL,
  anexo_nome VARCHAR(255) DEFAULT NULL,
  anexo_mime VARCHAR(180) DEFAULT NULL,
  anexo_tamanho BIGINT DEFAULT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_solicitacoes_empresa_status (empresa_id, status, atualizado_em),
  INDEX idx_solicitacoes_usuario (usuario_id, atualizado_em),
  INDEX idx_solicitacoes_responsavel (respondido_por),
  INDEX idx_solicitacoes_responsavel_criacao (responsavel_criacao_id),
  INDEX idx_solicitacoes_responsavel_execucao (responsavel_execucao_id),
  INDEX idx_solicitacoes_concluido_por (concluido_por)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE solicitacoes_internas
ADD COLUMN IF NOT EXISTS resposta TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS respondido_por INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS respondido_em TIMESTAMP NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS responsavel_criacao_id INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS responsavel_execucao_id INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS concluido_por INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS concluido_em TIMESTAMP NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS anexo_url VARCHAR(1000) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS anexo_nome VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS anexo_mime VARCHAR(180) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS anexo_tamanho BIGINT DEFAULT NULL;

-- ============================================
-- TABELA: attendance_texts
-- Textos prontos compartilhados para atendimento
-- ============================================
CREATE TABLE IF NOT EXISTS attendance_texts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  title VARCHAR(180) NOT NULL,
  content LONGTEXT NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_by INT DEFAULT NULL,
  updated_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_attendance_texts_empresa_active_order (empresa_id, is_active, sort_order),
  INDEX idx_attendance_texts_created_by (created_by),
  INDEX idx_attendance_texts_updated_by (updated_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE attendance_texts
ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_by INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS updated_by INT DEFAULT NULL;

CREATE TABLE IF NOT EXISTS attendance_texts_seed_control (
  empresa_id INT PRIMARY KEY,
  seeded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA: attendance_best_practices
-- Boas práticas rápidas para atendimento ao cliente
-- ============================================
CREATE TABLE IF NOT EXISTS attendance_best_practices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  title VARCHAR(180) NOT NULL,
  content LONGTEXT NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_by INT DEFAULT NULL,
  updated_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_attendance_best_practices_empresa_active_order (empresa_id, is_active, sort_order),
  INDEX idx_attendance_best_practices_created_by (created_by),
  INDEX idx_attendance_best_practices_updated_by (updated_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE attendance_best_practices
ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_by INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS updated_by INT DEFAULT NULL;

CREATE TABLE IF NOT EXISTS attendance_best_practices_seed_control (
  empresa_id INT PRIMARY KEY,
  seeded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA: chat_message_audit
-- Auditoria administrativa de acoes nas mensagens
-- ============================================
CREATE TABLE IF NOT EXISTS chat_message_audit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mensagem_id INT NOT NULL,
  usuario_id INT DEFAULT NULL,
  acao VARCHAR(40) NOT NULL,
  valor_antigo LONGTEXT DEFAULT NULL,
  valor_novo LONGTEXT DEFAULT NULL,
  criada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip VARCHAR(80) DEFAULT NULL,
  user_agent VARCHAR(255) DEFAULT NULL,
  FOREIGN KEY (mensagem_id) REFERENCES mensagens(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_audit_mensagem (mensagem_id),
  INDEX idx_audit_usuario (usuario_id),
  INDEX idx_audit_acao (acao),
  INDEX idx_audit_criada (criada_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA: avisos_internos_config
-- Conteudo editavel da pagina /avisos-internos por empresa
-- ============================================
CREATE TABLE IF NOT EXISTS avisos_internos_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  conteudo_json LONGTEXT NOT NULL,
  atualizado_por INT DEFAULT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_avisos_empresa (empresa_id),
  INDEX idx_avisos_empresa (empresa_id),
  INDEX idx_avisos_atualizado_por (atualizado_por)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA: wiki_interna_config
-- Conteudo editavel da pagina /wiki por empresa
-- ============================================
CREATE TABLE IF NOT EXISTS wiki_interna_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  conteudo_json LONGTEXT NOT NULL,
  atualizado_por INT DEFAULT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_wiki_interna_empresa (empresa_id),
  INDEX idx_wiki_interna_empresa (empresa_id),
  INDEX idx_wiki_interna_atualizado_por (atualizado_por)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA: wiki_cursos_config
-- Modulos e aulas editaveis dos cursos da Wiki por empresa
-- ============================================
CREATE TABLE IF NOT EXISTS wiki_cursos_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  curso_id VARCHAR(160) NOT NULL,
  conteudo_json LONGTEXT NOT NULL,
  atualizado_por INT DEFAULT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_wiki_curso_empresa (empresa_id, curso_id),
  INDEX idx_wiki_curso_empresa (empresa_id),
  INDEX idx_wiki_curso_atualizado_por (atualizado_por)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA: wiki_aulas_config
-- Conteudo e midias editaveis de cada aula da Wiki por empresa
-- ============================================
CREATE TABLE IF NOT EXISTS wiki_aulas_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  curso_id VARCHAR(160) NOT NULL,
  aula_chave VARCHAR(180) NOT NULL,
  conteudo_json LONGTEXT NOT NULL,
  atualizado_por INT DEFAULT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_wiki_aula_empresa (empresa_id, curso_id, aula_chave),
  INDEX idx_wiki_aula_empresa (empresa_id),
  INDEX idx_wiki_aula_atualizado_por (atualizado_por)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA: wiki_aulas_progresso
-- Progresso real das aulas da Wiki por usuario
-- ============================================
CREATE TABLE IF NOT EXISTS wiki_aulas_progresso (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  usuario_id INT NOT NULL,
  curso_id VARCHAR(160) NOT NULL,
  aula_chave VARCHAR(180) NOT NULL,
  concluida TINYINT(1) NOT NULL DEFAULT 0,
  acessada_em TIMESTAMP NULL DEFAULT NULL,
  concluida_em TIMESTAMP NULL DEFAULT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_wiki_aula_progresso_usuario (
    empresa_id,
    usuario_id,
    curso_id,
    aula_chave
  ),
  INDEX idx_wiki_aula_progresso_usuario (empresa_id, usuario_id, curso_id),
  INDEX idx_wiki_aula_progresso_ultima (empresa_id, usuario_id, curso_id, acessada_em),
  INDEX idx_wiki_aula_progresso_concluida (empresa_id, usuario_id, curso_id, concluida)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA: banner_home_config
-- Conteudo editavel do banner principal da home por empresa
-- ============================================
CREATE TABLE IF NOT EXISTS banner_home_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  conteudo_json LONGTEXT NOT NULL,
  atualizado_por INT DEFAULT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_banner_home_empresa (empresa_id),
  INDEX idx_banner_home_empresa (empresa_id),
  INDEX idx_banner_home_atualizado_por (atualizado_por)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA: imagens_galeria
-- Imagens publicadas pelos administradores para os funcionários acessarem
-- ============================================
CREATE TABLE IF NOT EXISTS imagens_galeria (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  titulo VARCHAR(255) NOT NULL DEFAULT '',
  descricao TEXT DEFAULT NULL,
  imagem_url VARCHAR(500) NOT NULL,
  criado_por INT DEFAULT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_imagens_galeria_empresa_criado_em (empresa_id, criado_em),
  INDEX idx_imagens_galeria_criado_por (criado_por)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA: feedbacks
-- Relatos de bugs e sugestões enviados pelos usuários
-- ============================================
CREATE TABLE IF NOT EXISTS feedbacks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  usuario_id INT DEFAULT NULL,
  nome VARCHAR(160) NOT NULL,
  tipo VARCHAR(20) NOT NULL,
  setor VARCHAR(120) DEFAULT NULL,
  prioridade VARCHAR(20) NOT NULL DEFAULT 'media',
  pagina VARCHAR(255) DEFAULT NULL,
  descricao TEXT NOT NULL,
  resposta TEXT DEFAULT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'aberto',
  resolvido_por INT DEFAULT NULL,
  resolvido_em TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_feedbacks_empresa (empresa_id),
  INDEX idx_feedbacks_usuario (usuario_id),
  INDEX idx_feedbacks_resolvido_por (resolvido_por),
  INDEX idx_feedbacks_tipo (tipo),
  INDEX idx_feedbacks_status (status),
  INDEX idx_feedbacks_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE feedbacks
  ADD COLUMN IF NOT EXISTS resposta TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS resolvido_por INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS resolvido_em TIMESTAMP NULL DEFAULT NULL;

-- ============================================
-- TABELA: changelog_entries
-- Changelogs criados pelo painel administrativo
-- ============================================
CREATE TABLE IF NOT EXISTS changelog_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  categoria VARCHAR(20) NOT NULL DEFAULT 'atualizacao',
  titulo VARCHAR(180) NOT NULL,
  versao VARCHAR(40) NOT NULL,
  data_publicacao DATE NOT NULL,
  texto TEXT NOT NULL,
  criado_por INT DEFAULT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_changelog_empresa (empresa_id),
  INDEX idx_changelog_categoria (categoria),
  INDEX idx_changelog_data (data_publicacao),
  INDEX idx_changelog_criado_em (criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA: avisos_gerais
-- Avisos obrigatórios exibidos até confirmação do usuário
-- ============================================
CREATE TABLE IF NOT EXISTS avisos_gerais (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  titulo VARCHAR(180) NOT NULL,
  mensagem TEXT NOT NULL,
  image_url VARCHAR(500) NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_por INT DEFAULT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_avisos_gerais_empresa (empresa_id),
  INDEX idx_avisos_gerais_ativo (ativo),
  INDEX idx_avisos_gerais_criado_em (criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS avisos_gerais_confirmacoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  aviso_id INT NOT NULL,
  usuario_id INT NOT NULL,
  confirmado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (aviso_id) REFERENCES avisos_gerais(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  UNIQUE KEY unique_aviso_usuario (aviso_id, usuario_id),
  INDEX idx_aviso_confirmacao (aviso_id),
  INDEX idx_usuario_confirmacao (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================
-- Índices adicionais para queries frequentes
CREATE INDEX IF NOT EXISTS idx_conversas_diretas_usuario1_data ON conversas_diretas(usuario1_id, atualizada_em DESC);
CREATE INDEX IF NOT EXISTS idx_conversas_diretas_usuario2_data ON conversas_diretas(usuario2_id, atualizada_em DESC);
CREATE INDEX IF NOT EXISTS idx_mensagens_conversa_data ON mensagens(conversa_direta_id, criada_em DESC);
CREATE INDEX IF NOT EXISTS idx_mensagens_grupo_data ON mensagens(grupo_id, criada_em DESC);
CREATE INDEX IF NOT EXISTS idx_mensagens_grupo_criada_id ON mensagens(grupo_id, criada_em DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_mensagens_grupo_id ON mensagens(grupo_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_grupo_membros_usuario_grupo ON grupo_membros(usuario_id, grupo_id);
CREATE INDEX IF NOT EXISTS idx_grupo_membros_grupo_usuario ON grupo_membros(grupo_id, usuario_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_nao_lidas ON mensagens(lida, criada_em DESC);

-- ============================================
-- DADOS DE TESTE (opcional)
-- ============================================
-- Descomente se quiser adicionar dados de teste
-- INSERT INTO conversas_diretas (usuario1_id, usuario2_id) VALUES (1, 2);
-- INSERT INTO grupos (nome, descricao, criador_id, empresa_id) VALUES ('TI', 'Equipe de TI', 1, 1);
-- INSERT INTO grupo_membros (grupo_id, usuario_id) VALUES (1, 1), (1, 2), (1, 3);
