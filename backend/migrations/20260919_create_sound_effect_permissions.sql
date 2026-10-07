CREATE TABLE IF NOT EXISTS sound_effect_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  can_use TINYINT(1) NOT NULL DEFAULT 1,
  can_manage TINYINT(1) NOT NULL DEFAULT 0,
  granted_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES usuarios(id) ON DELETE SET NULL,
  UNIQUE KEY unique_sound_effect_permission_user (user_id),
  INDEX idx_sound_effect_permissions_can_use (can_use),
  INDEX idx_sound_effect_permissions_can_manage (can_manage)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
