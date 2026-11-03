-- Histórico diário das filas de suporte (Suporte Técnico, N1, N2, N3), para o
-- "Resumo da semana" da IA local ter números reais em vez de só o instante atual.
-- Uma linha por dia/empresa: cada vez que alguém pede um resumo, o app registra
-- o número de agora (upsert do dia), então o histórico cresce com o uso.
CREATE TABLE IF NOT EXISTS ia_resumo_diario (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  dia DATE NOT NULL,
  suporte_tecnico INT NULL,
  n1 INT NULL,
  n2 INT NULL,
  n3 INT NULL,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ia_resumo_diario (empresa_id, dia)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
