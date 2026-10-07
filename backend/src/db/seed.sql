-- ============================================
-- CHAT INTERNO - DADOS DE TESTE
-- ============================================
-- Use este arquivo para popular com dados de teste

USE chat_interno;

-- ============================================
-- LIMPAR DADOS ANTIGOS (OPCIONAL)
-- ============================================
-- DELETE FROM leituras_mensagens;
-- DELETE FROM mensagens;
-- DELETE FROM grupo_membros;
-- DELETE FROM grupos;
-- DELETE FROM conversas_diretas;
-- DELETE FROM usuarios;

-- ============================================
-- INSERIR EMPRESAS (se não existirem)
-- ============================================
INSERT INTO empresas (nome, cnpj) VALUES 
('Empresa XYZ', '12.345.678/0001-90')
ON DUPLICATE KEY UPDATE id=id;

-- ============================================
-- INSERIR SETORES (se não existirem)
-- ============================================
INSERT INTO setores (nome, empresa_id) VALUES 
('TI', 1),
('RH', 1),
('Financeiro', 1),
('Vendas', 1)
ON DUPLICATE KEY UPDATE id=id;

-- ============================================
-- INSERIR USUÁRIOS DE TESTE
-- ============================================
-- Senha: senha123 (hash bcrypt)
INSERT INTO usuarios (nome, email, senha, empresa_id, setor_id, status) VALUES 
('João Silva', 'joao@empresa.com', '$2b$10$xK7.Z6F6Q5t5K5t5K5t5K.u5K5t5K5t5K5t5K5t5K5t5K5t5K5tGa', 1, 1, 'online'),
('Maria Santos', 'maria@empresa.com', '$2b$10$xK7.Z6F6Q5t5K5t5K5t5K.u5K5t5K5t5K5t5K5t5K5t5K5t5K5tGa', 1, 1, 'online'),
('Pedro Oliveira', 'pedro@empresa.com', '$2b$10$xK7.Z6F6Q5t5K5t5K5t5K.u5K5t5K5t5K5t5K5t5K5t5K5t5K5tGa', 1, 2, 'offline'),
('Ana Costa', 'ana@empresa.com', '$2b$10$xK7.Z6F6Q5t5K5t5K5t5K.u5K5t5K5t5K5t5K5t5K5t5K5t5K5tGa', 1, 3, 'away'),
('Carlos Ferreira', 'carlos@empresa.com', '$2b$10$xK7.Z6F6Q5t5K5t5K5t5K.u5K5t5K5t5K5t5K5t5K5t5K5t5K5tGa', 1, 4, 'online')
ON DUPLICATE KEY UPDATE id=id;

-- ============================================
-- CRIAR CONVERSAS DIRETAS
-- ============================================
INSERT INTO conversas_diretas (usuario1_id, usuario2_id) VALUES 
(1, 2),
(1, 3),
(2, 4),
(3, 5)
ON DUPLICATE KEY UPDATE id=id;

-- ============================================
-- CRIAR GRUPOS
-- ============================================
INSERT INTO grupos (nome, descricao, criador_id, empresa_id) VALUES 
('TI Team', 'Equipe de Tecnologia da Informação', 1, 1),
('RH Chat', 'Comunicação do Departamento de Recursos Humanos', 3, 1),
('Todos', 'Comunicação geral da empresa', 1, 1)
ON DUPLICATE KEY UPDATE id=id;

-- ============================================
-- ADICIONAR MEMBROS AOS GRUPOS
-- ============================================
INSERT INTO grupo_membros (grupo_id, usuario_id) VALUES 
(1, 1), (1, 2), (1, 5),  -- TI Team
(2, 3), (2, 4),          -- RH Chat
(3, 1), (3, 2), (3, 3), (3, 4), (3, 5)  -- Todos
ON DUPLICATE KEY UPDATE id=id;

-- ============================================
-- INSERIR MENSAGENS DE TESTE
-- ============================================
INSERT INTO mensagens (remetente_id, conversa_direta_id, mensagem) VALUES 
(1, 1, 'Oi Maria! Tudo bem?'),
(2, 1, 'Oi João! Tudo certo por aqui!'),
(1, 1, 'Que bom! Conseguiu terminar a tarefa?'),
(2, 1, 'Consegui sim! Enviei o arquivo para você'),
(1, 2, 'Pedro, você viu meu e-mail?'),
(3, 2, 'Vi não, vou verificar agora'),
(1, 2, 'Tá bom, sem pressa');

-- ============================================
-- INSERIR MENSAGENS DE GRUPOS
-- ============================================
INSERT INTO mensagens (remetente_id, grupo_id, mensagem) VALUES 
(1, 1, 'Galera, o servidor está down?'),
(2, 1, 'Não, está tudo ok. Deve ser algo local'),
(1, 1, 'Achei, era minha conexão mesmo'),
(3, 2, 'Alguém sabe quando sai a folha de ponto?'),
(4, 2, 'Na próxima terça-feira'),
(1, 3, 'Boa tarde a todos!'),
(2, 3, 'Boa tarde!'),
(5, 3, 'Olá pessoal');

-- ============================================
-- MARCAR ALGUMAS MENSAGENS COMO LIDAS
-- ============================================
UPDATE mensagens SET lida = TRUE WHERE id <= 5;

-- ============================================
-- REGISTRAR LEITURAS DE GRUPO
-- ============================================
INSERT INTO leituras_mensagens (mensagem_id, usuario_id, entregue_em, lida_em) VALUES 
(1, 1, NOW(), NOW()), (1, 2, NOW(), NOW()),
(2, 1, NOW(), NOW()), (2, 2, NOW(), NOW()),
(3, 1, NOW(), NOW()), (3, 2, NOW(), NOW())
ON DUPLICATE KEY UPDATE id=id;

-- ============================================
-- VERIFICAR DADOS
-- ============================================
SELECT 'Usuários:' as Tipo;
SELECT id, nome, email, status FROM usuarios;

SELECT 'Conversas Diretas:' as Tipo;
SELECT * FROM conversas_diretas;

SELECT 'Grupos:' as Tipo;
SELECT id, nome, descricao, (SELECT COUNT(*) FROM grupo_membros WHERE grupo_id = grupos.id) as total_membros FROM grupos;

SELECT 'Mensagens:' as Tipo;
SELECT m.id, u.nome, m.mensagem, m.criada_em FROM mensagens m JOIN usuarios u ON m.remetente_id = u.id ORDER BY m.criada_em DESC LIMIT 10;
