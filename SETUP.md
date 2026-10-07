<!-- Chat Interno - Documentação de Setup -->

# 🚀 Chat Interno - Guia de Implementação

## Pré-requisitos

- Node.js (v16+)
- MySQL 8.0+
- npm ou yarn

## 📁 Estrutura de Pastas

```
chat-interno/
├── backend/
│   ├── src/
│   │   ├── server.js (Express + Socket.IO)
│   │   ├── db/
│   │   │   ├── db.js (Conexão MySQL)
│   │   │   └── migration.sql (Script SQL)
│   │   ├── middlewares/
│   │   │   └── middleware.js (Autenticação JWT)
│   │   └── Routes/
│   │       └── Routes.js (Endpoints da API)
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   └── Chat/
    │   │       ├── ChatPage.jsx (Componente principal)
    │   │       ├── ConversasDiretas.jsx
    │   │       ├── Grupos.jsx
    │   │       ├── MensagensDiretas.jsx
    │   │       └── MensagensGrupo.jsx
    │   ├── pages/
    │   │   ├── Chat.jsx (Página antiga)
    │   │   └── Login.jsx
    │   ├── services/
    │   │   └── api.js
    │   ├── styles/
    │   │   └── Chat.module.css
    │   └── routes/
    │       └── AppRoutes.jsx
    └── package.json
```

## 🔧 1. Configurar Banco de Dados

### 1.1 Criar banco de dados
```sql
CREATE DATABASE chat_interno;
USE chat_interno;
```

### 1.2 Criar usuário MySQL
```sql
CREATE USER 'chat'@'localhost' IDENTIFIED BY '<SENHA_FORTE_FORA_DO_REPOSITORIO>';
GRANT ALL PRIVILEGES ON chat_interno.* TO 'chat'@'localhost';
FLUSH PRIVILEGES;
```

### 1.3 Executar migration
```bash
# Abra o MySQL e execute:
source /home/noc/chat-interno/backend/src/db/migration.sql;
```

Ou use um cliente como DBeaver/Workbench para executar o arquivo `migration.sql`.

## ⚙️ 2. Backend Setup

### 2.1 Instalar dependências
```bash
cd backend
npm install
```

### 2.2 Configurar arquivo `.env` (opcional)
```
DB_HOST=localhost
DB_USER=chat
DB_PASSWORD=<SENHA_FORTE_FORA_DO_REPOSITORIO>
DB_NAME=chat_interno
SOCKET_PORT=8600
NODE_ENV=development
```

### 2.3 Rodando o servidor
```bash
npm run dev
```

Você deve ver: `🚀 Servidor Chat Interno rodando em http://localhost:8600`

## 🎨 3. Frontend Setup

### 3.1 Instalar dependências
```bash
cd frontend
npm install
```

### 3.2 Configurar URL da API
Se estiver em outra máquina/rede, atualize em `frontend/src/services/api.js`:

```javascript
const api = axios.create({ 
  baseURL: "http://SEU_IP:8600/api" 
});
```

### 3.3 Rodando o servidor de desenvolvimento
```bash
npm run dev
```

Acesse em: `http://localhost:5173`

## 📱 4. Estrutura de Dados

### Tabelas Principais

#### `usuarios`
```sql
- id (INT, PK)
- nome (VARCHAR)
- email (VARCHAR, UNIQUE)
- senha (VARCHAR, hash)
- empresa_id (INT, FK)
- setor_id (INT, FK)
- avatar (VARCHAR)
- status (ENUM: online, offline, away)
- ultimo_acesso (TIMESTAMP)
```

#### `conversas_diretas`
```sql
- id (INT, PK)
- usuario1_id (INT, FK)
- usuario2_id (INT, FK)
- criada_em (TIMESTAMP)
- atualizada_em (TIMESTAMP)
```

#### `grupos`
```sql
- id (INT, PK)
- nome (VARCHAR)
- descricao (TEXT)
- criador_id (INT, FK)
- empresa_id (INT, FK)
- avatar (VARCHAR)
- criado_em (TIMESTAMP)
- atualizado_em (TIMESTAMP)
```

#### `mensagens`
```sql
- id (INT, PK)
- remetente_id (INT, FK)
- conversa_direta_id (INT, FK, NULLABLE)
- grupo_id (INT, FK, NULLABLE)
- mensagem (LONGTEXT)
- lida (BOOLEAN)
- criada_em (TIMESTAMP)
- atualizada_em (TIMESTAMP)
```

## 🔌 5. Eventos Socket.IO

### Eventos do Cliente → Servidor

```javascript
// Conexão
socket.emit('user_connect', { usuario_id, empresa_id })
socket.emit('join_direct_chat', { conversa_id })
socket.emit('join_group', { grupo_id })

// Mensagens
socket.emit('send_direct_message', { ... })
socket.emit('send_group_message', { ... })

// Status
socket.emit('typing_direct', { conversa_id, usuario_id, usuario_nome })
socket.emit('stop_typing_direct', { conversa_id, usuario_id })
socket.emit('typing_group', { grupo_id, usuario_id, usuario_nome })
socket.emit('stop_typing_group', { grupo_id, usuario_id })
```

### Eventos do Servidor → Cliente

```javascript
// Status
socket.on('user_status_changed', { usuario_id, status })

// Mensagens
socket.on('receive_direct_message', { ... })
socket.on('receive_group_message', { ... })

// Digitando
socket.on('user_typing_direct', { usuario_id, usuario_nome })
socket.on('user_stop_typing_direct', { usuario_id })
socket.on('user_typing_group', { usuario_id, usuario_nome })
socket.on('user_stop_typing_group', { usuario_id })
```

## 📡 6. Endpoints da API

### Autenticação
```
POST   /api/login              - Fazer login
POST   /api/register           - Registrar novo usuário
GET    /api/me                 - Dados do usuário logado
```

### Chat - Conversas Diretas
```
GET    /api/chat/conversas-diretas         - Listar conversas
GET    /api/chat/conversa-direta/:usuario_id - Mensagens de uma conversa
POST   /api/chat/enviar-direto             - Enviar mensagem
PUT    /api/chat/status/:status            - Atualizar status
```

### Chat - Grupos
```
GET    /api/chat/grupos        - Listar grupos
GET    /api/chat/grupo/:grupo_id - Mensagens de um grupo
POST   /api/chat/enviar-grupo  - Enviar mensagem de grupo
```

### Utilitários
```
GET    /api/chat/usuarios      - Listar usuários da empresa
GET    /api/setores/:empresa_id - Listar setores
```

## 🔐 7. Segurança

### Implementado
- ✅ JWT para autenticação
- ✅ Hash de senha com bcrypt
- ✅ Validação de autorização (usuário só acessa suas conversas)
- ✅ CORS configurado
- ✅ Socket.IO apenas para usuários autenticados

### Melhorias Recomendadas
- [ ] HTTPS/SSL em produção
- [ ] Rate limiting nos endpoints
- [ ] Validação de entrada mais rigorosa
- [ ] Logs de auditoria
- [ ] 2FA para usuários

## 🧪 8. Testando o Chat

### 1. Criar dados de teste
```sql
-- Adicionar usuários de teste
INSERT INTO usuarios (nome, email, senha, empresa_id, setor_id, status) 
VALUES ('João', 'joao@empresa.com', BCRYPT('123456'), 1, 1, 'online');

INSERT INTO usuarios (nome, email, senha, empresa_id, setor_id, status) 
VALUES ('Maria', 'maria@empresa.com', BCRYPT('123456'), 1, 1, 'online');
```

### 2. Fazer login
- Acesse `http://localhost:5173`
- Email: `joao@empresa.com`
- Senha: `123456`

### 3. Testar chat
- Abra duas abas do navegador
- Faça login em diferentes usuários
- Inicie uma conversa

## 🐛 Troubleshooting

### Erro: "Cannot find module 'socket.io'"
```bash
npm install socket.io socket.io-client
```

### Erro: "CORS error"
Verifique se o `SOCKET_URL` em `ChatPage.jsx` está correto:
```javascript
const SOCKET_URL = 'http://192.168.1.133:8600'; // Seu IP/localhost
```

### Banco de dados não conecta
```bash
# Teste a conexão MySQL
mysql -u chat -p chat_interno
```

### Mensagens não aparecem
1. Verifique o console (F12) do navegador
2. Verifique o terminal do backend
3. Confirme que o Socket.IO está conectado

## 🚀 9. Deploy (Produção)

### Backend
```bash
# Build
npm run build

# Usar PM2 para manter rodando
npm install -g pm2
pm2 start src/server.js --name "chat-backend"
```

### Frontend
```bash
# Build
npm run build

# Servir com nginx ou apache
npm install -g serve
serve -s dist -l 3000
```

## 📚 Referências Úteis

- [Socket.IO Documentation](https://socket.io/docs/)
- [Express.js Guide](https://expressjs.com/)
- [React Router Documentation](https://reactrouter.com/)
- [MySQL Documentation](https://dev.mysql.com/doc/)

## 📝 Notas

- O chat suporta conversas diretas 1-a-1 e grupos
- Todas as mensagens são salvas no banco de dados
- Status online/offline é atualizado em tempo real
- Indicador de digitação funciona em tempo real
- Mensagens não lidas são contadas

## ✅ Checklist de Implementação

- [x] Banco de dados completo
- [x] Endpoints da API
- [x] Socket.IO com eventos
- [x] Interface React profissional
- [x] Autenticação JWT
- [x] Status online/offline
- [x] Indicador de digitação
- [x] Contador de mensagens não lidas
- [x] Scroll automático para última mensagem
- [x] Responsividade mobile/desktop

---

**Versão**: 1.0.0  
**Última atualização**: 13 de maio de 2026  
**Desenvolvedor**: Chat Interno Team
