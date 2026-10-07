-- ============================================
-- CHAT INTERNO - STICKERS / FIGURINHAS
-- ============================================

ALTER TABLE mensagens
ADD COLUMN IF NOT EXISTS sticker_id INT DEFAULT NULL;

ALTER TABLE mensagens
MODIFY COLUMN tipo_mensagem ENUM('texto', 'imagem', 'audio', 'arquivo', 'sticker') DEFAULT 'texto';

CREATE INDEX IF NOT EXISTS idx_mensagens_sticker ON mensagens(sticker_id);

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
