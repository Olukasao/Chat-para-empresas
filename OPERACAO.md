// ============================================
// GUIA DE OPERAÇÃO E MANUTENÇÃO
// Chat Interno - v1.0.0
// ============================================

/**
 * 📋 ÍNDICE
 * 1. Iniciar o Sistema
 * 2. Parar o Sistema
 * 3. Monitoramento
 * 4. Backup & Restore
 * 5. Troubleshooting
 * 6. Performance
 * 7. Segurança
 * 8. Atualizações
 */

// ============================================
// 1. INICIAR O SISTEMA
// ============================================

/**
 * Ordem correta de inicialização:
 * 
 * 1️⃣ MySQL
 * 2️⃣ Backend (Node.js)
 * 3️⃣ Frontend (React)
 */

// Verificar MySQL
$ mysql -u chat -p chat_interno
mysql> SELECT 1;
mysql> exit

// Iniciar Backend (Terminal 1)
$ cd backend
$ npm run dev
// Esperado: "🚀 Servidor Chat Interno rodando em http://localhost:8600"

// Iniciar Frontend (Terminal 2)
$ cd frontend
$ npm run dev
// Esperado: "Local: http://localhost:5173/"

// ============================================
// 2. PARAR O SISTEMA
// ============================================

// Ordem de parada (inverso da inicialização)

// 1. Parar Frontend (Ctrl+C na Terminal do Vite)
$ # Ctrl+C

// 2. Parar Backend (Ctrl+C na Terminal do Node)
$ # Ctrl+C

// 3. Verificar se processosexistem ainda
$ lsof -i :8600  # Verificar backend
$ lsof -i :5173  # Verificar frontend

// Se necessário, kill forçado
$ kill -9 <PID>

// ============================================
// 3. MONITORAMENTO
// ============================================

/**
 * Verificar logs em tempo real
 */

// Backend - Monitorar conexões
// Verifique a saída do npm run dev

// Frontend - Abrir DevTools
// F12 > Console (ver erros)

// MySQL - Logs
$ tail -f /var/log/mysql/error.log

// Socket.IO - Verificar conexões
// Backend mostra: "[SOCKET] Novo cliente conectado: xxx"

// ============================================
// 4. BACKUP & RESTORE
// ============================================

/**
 * Backup do Banco de Dados
 */

// Fazer backup completo
$ mysqldump -u chat -p chat_interno > backup_chat_$(date +%Y%m%d_%H%M%S).sql

// Exemplo com data: backup_chat_20260513_143000.sql

/**
 * Restaurar banco de dados
 */

// Restaurar de um backup
$ mysql -u chat -p chat_interno < backup_chat_20260513_143000.sql

// Restaurar e criar novo banco (se não existir)
$ mysql -u root -p < backup_chat_20260513_143000.sql

/**
 * Backup da aplicação
 */

// Backup de configurações
$ cp -r backend backend_backup_$(date +%Y%m%d)
$ cp -r frontend frontend_backup_$(date +%Y%m%d)

// Excluir node_modules (são reconstruíveis)
$ rm -rf backend_backup/node_modules
$ rm -rf frontend_backup/node_modules

// ============================================
// 5. TROUBLESHOOTING
// ============================================

/**
 * Problema: "Port 8600 already in use"
 * Solução:
 */
$ lsof -i :8600
$ kill -9 <PID>

/**
 * Problema: "Cannot connect to MySQL"
 * Verificação:
 */
$ mysql -u chat -p
$ # Digite a senha configurada fora do repositorio

// Se falhar, reinicie MySQL
$ sudo systemctl restart mysql

/**
 * Problema: "CORS error"
 * Verificação:
 */
// Em backend/src/server.js
const io = new Server(server, {
  cors: { origin: '*' }  // Muito permissivo em dev
});

// Em produção, restrinja:
// cors: { origin: 'https://seu-dominio.com' }

/**
 * Problema: "Socket desconecta constantemente"
 * Verificação:
 */
// 1. Verifique autenticação
// 2. Verifique firewall/proxy
// 3. Aumente timeout no backend
socket.io-client config: reconnectionDelay: 1000

/**
 * Problema: "Mensagens não aparecem"
 * Debug:
 */
// 1. Abra F12 no navegador
// 2. Verifique console para erros
// 3. Verifique Network tab
// 4. Verifique banco de dados
$ mysql -u chat -p chat_interno
mysql> SELECT * FROM mensagens ORDER BY criada_em DESC LIMIT 10;

// ============================================
// 6. PERFORMANCE
// ============================================

/**
 * Índices SQL (já configurados)
 * Verificar:
 */
$ mysql -u chat -p chat_interno
mysql> SHOW INDEX FROM mensagens;
mysql> SHOW INDEX FROM conversas_diretas;

/**
 * Query lenta? Analisar:
 */
mysql> EXPLAIN SELECT * FROM mensagens WHERE conversa_direta_id = 1;

/**
 * Limpeza de dados antigos
 */
// Deletar mensagens com mais de 1 ano
mysql> DELETE FROM mensagens 
WHERE criada_em < DATE_SUB(NOW(), INTERVAL 1 YEAR);

/**
 * Compactar tabelas
 */
mysql> OPTIMIZE TABLE mensagens;
mysql> OPTIMIZE TABLE usuarios;

// ============================================
// 7. SEGURANÇA
// ============================================

/**
 * Checklist de Segurança
 */

// ✅ Senhas fortes
// Mudar senha do usuário MySQL
$ mysql -u root -p
mysql> ALTER USER 'chat'@'localhost' IDENTIFIED BY 'nova_senha_forte';
mysql> FLUSH PRIVILEGES;

// ✅ JWT Secret
// Em backend/Routes/Routes.js e server.js
const SECRET = "chat_secret"; // MUDAR EM PRODUÇÃO!
// Use um secret longo e aleatório

// ✅ HTTPS em produção
// Gerar certificado SSL
$ certbot certonly --standalone -d seu-dominio.com

// ✅ Rate Limiting
// npm install express-rate-limit
// Implementar em todos os endpoints sensíveis

// ✅ Backup regular
// Agendar script para rodar diariamente
$ crontab -e
// 0 2 * * * /caminho/para/backup.sh

/**
 * Script de backup automático (backup.sh)
 */
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mysqldump -u chat -p'senha' chat_interno > /backups/chat_$DATE.sql
gzip /backups/chat_$DATE.sql
# Manter apenas últimos 30 dias
find /backups -name "chat_*.sql.gz" -mtime +30 -delete

// ============================================
// 8. ATUALIZAÇÕES
// ============================================

/**
 * Atualizar dependências
 */

// Backend
$ cd backend
$ npm outdated  # Ver versões antigas
$ npm update    # Atualizar todas
$ npm update package-name  # Atualizar específica

// Frontend
$ cd frontend
$ npm outdated
$ npm update

/**
 * Atualizar MySQL
 */
$ sudo apt update
$ sudo apt upgrade mysql-server

/**
 * Atualizar Node.js
 */
$ nvm list
$ nvm install 18.0.0  # Ou versão mais recente
$ nvm use 18.0.0

// ============================================
// CHECKLIST SEMANAL
// ============================================

/*
☐ Backup do banco (segunda-feira)
☐ Verificar logs de erro (diariamente)
☐ Testar chat em diferentes navegadores (segunda-feira)
☐ Limpar mensagens deletadas permanentemente (sexta-feira)
☐ Revisar permissões de arquivo (segunda-feira)
☐ Atualizar dependências (primeira segunda do mês)
☐ Testar plano de desastres (última sexta do mês)
*/

// ============================================
// CHECKLIST MENSAL
// ============================================

/*
☐ Backup completo da aplicação
☐ Análise de performance (EXPLAIN queries)
☐ Revisão de segurança
☐ Atualização de SSL/certificados
☐ Backup de configurações
☐ Teste de restauração de banco (criar test database)
☐ Audit de usuários/permissões
*/

// ============================================
// EMERGÊNCIA - RECOVERY
// ============================================

/**
 * Banco corrompido?
 */
$ mysqlcheck -u root -p chat_interno --repair

/**
 * Perder acesso ao socket?
 */
// 1. Reiniciar backend
$ pm2 restart chat-backend

// 2. Limpar cookies do navegador
// F12 > Application > Clear All

/**
 * Desastre total?
 */
// 1. Restaurar backup mais recente
$ mysql -u root -p < backup_chat_20260513_000000.sql

// 2. Verificar integridade
$ mysql -u chat -p chat_interno
mysql> SELECT COUNT(*) FROM usuarios;
mysql> SELECT COUNT(*) FROM mensagens;

// 3. Reiniciar aplicação
$ npm run dev

// ============================================
// CONTATOS IMPORTANTES
// ============================================

/*
Suporte MySQL:      https://dev.mysql.com/
Suporte Node.js:    https://nodejs.org/
Suporte Express:    https://expressjs.com/
Suporte React:      https://react.dev/
Socket.IO:          https://socket.io/
*/

// ============================================
// LOGS RECOMENDADOS
// ============================================

/**
 * Estrutura de logs
 */
/var/log/chat/
├── backend.log       # Logs do Node
├── mysql.log         # Logs do MySQL
├── error.log         # Erros gerais
└── access.log        # Requisições HTTP

/**
 * Rotação de logs (logrotate)
 */
// Criar arquivo: /etc/logrotate.d/chat-interno

/*
/var/log/chat/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
}
*/

// ============================================
// MÉTRICAS IMPORTANTES
// ============================================

/**
 * Monitorar:
 */
- Memória do Node (deve ser < 500MB em uso normal)
- Conexões MySQL ativas (show processlist)
- Tamanho do banco de dados (du -sh /var/lib/mysql/chat_interno)
- Latência de rede (ping/latência entre servidores)
- Taxa de erro (revisar logs semanalmente)

// ============================================
// DICAS IMPORTANTES
// ============================================

✨ Manter documentação atualizada
✨ Testar restauração de backup mensalmente
✨ Monitorar uso de disco
✨ Manter backups em local seguro (externo)
✨ Versionar código (git)
✨ Documentar todas as alterações
✨ Treinar equipe em procedimentos
✨ Ter plano de contingência
