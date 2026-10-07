-- ============================================
-- CHAT INTERNO - FIGURINHAS ANIMADAS
-- ============================================

ALTER TABLE stickers
ADD COLUMN IF NOT EXISTS is_animated TINYINT(1) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS frame_count INT NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS duration_ms INT DEFAULT NULL;
