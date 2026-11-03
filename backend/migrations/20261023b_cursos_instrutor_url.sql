-- Link clicável do responsável/instrutor do curso (ex.: perfil do GitHub de quem criou).
ALTER TABLE cursos ADD COLUMN IF NOT EXISTS instrutor_url VARCHAR(300) NULL AFTER instrutor;
