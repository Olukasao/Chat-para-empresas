# 💬 Chat Interno - Documentação Completa

## Visão Geral

Chat Interno é uma aplicação de mensageria em tempo real desenvolvida para comunicação interna entre funcionários de uma empresa. Funciona no estilo WhatsApp Web com design profissional e moderno.

### Características

✨ **Conversas Diretas** - Chat 1 a 1 entre usuários  
👥 **Grupos** - Salas de conversa em grupo  
⏱️ **Mensagens em Tempo Real** - Socket.IO para transmissão instantânea  
🔴 **Status Online/Offline** - Indicador de disponibilidade  
⌨️ **Indicador de Digitação** - Veja quando alguém está escrevendo  
🔔 **Notificações** - Contador de mensagens não lidas  
📱 **Responsivo** - Desktop e mobile  
🔐 **Seguro** - Autenticação JWT e validação de autorização  

## Arquitetura

```
┌─────────────────────────────────────────────────────┐
│                   NAVEGADOR (FRONTEND)              │
│  ┌──────────────────────────────────────────────┐  │
│  │ React + React Router                         │  │
│  │ Socket.IO Client                             │  │
│  │ Axios (HTTP)                                 │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
           │                            │
        HTTP/HTTPS                   WebSocket
           │                            │
┌─────────────────────────────────────────────────────┐
│                 SERVIDOR (BACKEND)                  │
│  ┌──────────────────────────────────────────────┐  │
│  │ Express.js                                   │  │
│  │ Socket.IO Server                             │  │
│  │ JWT Authentication                           │  │
│  │ bcrypt (Password Hash)                       │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
           │
        MySQL/TCP
           │
┌─────────────────────────────────────────────────────┐
│              BANCO DE DADOS (MYSQL)                 │
│  ┌──────────────────────────────────────────────┐  │
│  │ usuarios, mensagens, grupos, etc.            │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## Fluxo de Autenticação

```
┌────────────┐
│  Usuário   │
└────────────┘
     │
     ▼
┌──────────────────────────┐
│  Login                   │
│  email + senha           │
└──────────────────────────┘
     │
     ▼
┌──────────────────────────┐
│  Validar credenciais     │
│  (backend)               │
└──────────────────────────┘
     │
     ├─ ✓ Válido
     │   ├─ Gerar JWT
     │   └─ Retornar token
     │
     └─ ✗ Inválido
         └─ Erro 401
     │
     ▼
┌──────────────────────────┐
│ Armazenar token no       │
│ localStorage             │
└──────────────────────────┘
     │
     ▼
┌──────────────────────────┐
│ Conectar ao Socket.IO    │
│ com token                │
└──────────────────────────┘
     │
     ▼
┌──────────────────────────┐
│ Acessar Chat             │
└──────────────────────────┘
```

## Fluxo de Mensagem

```
Usuário A                           Usuário B
    │                                   │
    ├─ Digita mensagem                  │
    │   "Olá!"                          │
    │                                   │
    ├─ Clica enviar                     │
    │   │                               │
    │   ├─ POST /chat/enviar-direto     │
    │   │   (salva no banco)            │
    │   │                               │
    │   ├─ Socket.emit('send_direct_message')
    │   │   │                           │
    │   │   └─────────────────────────> │
    │   │   Socket.on('receive_direct_message')
    │   │                               │
    │   │       ┌──────────────────┐   │
    │   │       │ Bolha de mensagem│   │
    │   │       └──────────────────┘   │
    │   │                           ◄──┤
    │   │       (UI atualizada)
    │   │
    └── (Scroll automático)
```

## Estrutura de Pastas

```
chat-interno/
│
├── backend/
│   ├── src/
│   │   ├── server.js
│   │   │   └─ Express + Socket.IO
│   │   │   └─ Eventos de conexão
│   │   │   └─ Eventos de mensagens
│   │   │
│   │   ├── db/
│   │   │   ├─ db.js (Pool MySQL)
│   │   │   ├─ migration.sql (Criar tabelas)
│   │   │   └─ seed.sql (Dados de teste)
│   │   │
│   │   ├── Routes/
│   │   │   └─ Routes.js
│   │   │      ├─ /login
│   │   │      ├─ /register
│   │   │      ├─ /me
│   │   │      ├─ /chat/conversas-diretas
│   │   │      ├─ /chat/conversa-direta/:usuario_id
│   │   │      ├─ /chat/grupos
│   │   │      ├─ /chat/grupo/:grupo_id
│   │   │      ├─ /chat/usuarios
│   │   │      ├─ /chat/enviar-direto
│   │   │      ├─ /chat/enviar-grupo
│   │   │      └─ /chat/status/:status
│   │   │
│   │   └── middlewares/
│   │       └─ middleware.js (authMiddleware)
│   │
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── Chat/
│   │   │       ├─ ChatPage.jsx (Componente Principal)
│   │   │       ├─ ConversasDiretas.jsx
│   │   │       ├─ Grupos.jsx
│   │   │       ├─ MensagensDiretas.jsx
│   │   │       ├─ MensagensGrupo.jsx
│   │   │       └─ index.js
│   │   │
│   │   ├── pages/
│   │   │   └─ Chat.jsx (Antigo, pode remover)
│   │   │   └─ Login.jsx
│   │   │
│   │   ├── services/
│   │   │   └─ api.js (Axios config)
│   │   │
│   │   ├── styles/
│   │   │   └─ Chat.module.css (Estilos)
│   │   │
│   │   ├── routes/
│   │   │   └─ AppRoutes.jsx
│   │   │
│   │   └── main.jsx
│   │
│   └── package.json
│
├── SETUP.md (Guia de setup)
├── .env.example (Configurações)
├── README.md
└── package-lock.json
```

## 🚀 Quick Start

### 1️⃣ Clone o repositório
```bash
cd /home/noc/chat-interno
```

### 2️⃣ Configure o banco de dados
```bash
# Crie o banco
mysql -u root -p < backend/src/db/migration.sql

# Adicione dados de teste
mysql -u chat -p chat_interno < backend/src/db/seed.sql
```

### 3️⃣ Instale e rode o backend
```bash
cd backend
npm install
npm run dev
```

### 4️⃣ Instale e rode o frontend
```bash
cd frontend
npm install
npm run dev
```

### 5️⃣ Acesse
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8600`
- API: `http://localhost:8600/api`

### 6️⃣ Faça login
```
Email: joao@empresa.com
Senha: senha123
```

## 📊 Modelos de Dados

### Usuário
```javascript
{
  id: 1,
  nome: "João Silva",
  email: "joao@empresa.com",
  empresa_id: 1,
  setor_id: 1,
  status: "online", // online | offline | away
  avatar: "https://...",
  ultimo_acesso: "2026-05-13 14:30:00"
}
```

### Conversa Direta
```javascript
{
  id: 1,
  usuario1_id: 1,
  usuario2_id: 2,
  usuario_outro_nome: "Maria",
  usuario_outro_status: "online",
  nao_lidas: 3,
  ultima_mensagem: "Oi João!",
  atualizada_em: "2026-05-13 14:30:00"
}
```

### Mensagem
```javascript
{
  id: 1,
  remetente_id: 1,
  remetente_nome: "João",
  mensagem: "Olá!",
  lida: false,
  criada_em: "2026-05-13 14:30:00",
  editada_em: null
}
```

### Grupo
```javascript
{
  id: 1,
  nome: "TI Team",
  descricao: "Equipe de Tecnologia",
  criador_id: 1,
  empresa_id: 1,
  total_membros: 5,
  nao_lidas: 2,
  ultima_mensagem: "Alguém viu...",
  atualizado_em: "2026-05-13 14:30:00"
}
```

## 🔌 Eventos Socket.IO

### Cliente → Servidor
```javascript
// Conectar
socket.emit('user_connect', {
  usuario_id: 1,
  empresa_id: 1
});

// Enviar mensagem
socket.emit('send_direct_message', {
  remetente_id: 1,
  usuario_id: 2,
  conversa_id: 1,
  mensagem: "Olá!",
  remetente_nome: "João",
  remetente_avatar: "..."
});

// Digitando
socket.emit('typing_direct', {
  conversa_id: 1,
  usuario_id: 1,
  usuario_nome: "João"
});
```

### Servidor → Cliente
```javascript
// Status mudou
socket.on('user_status_changed', {
  usuario_id: 1,
  status: 'online'
});

// Mensagem recebida
socket.on('receive_direct_message', {
  id: 1,
  remetente_id: 2,
  remetente_nome: "Maria",
  mensagem: "Olá João!",
  criada_em: "2026-05-13 14:30:00"
});

// Usuário digitando
socket.on('user_typing_direct', {
  usuario_id: 2,
  usuario_nome: "Maria"
});
```

## 🔐 Segurança

### Implementado
- ✅ Autenticação JWT
- ✅ Hash de senha (bcrypt)
- ✅ Validação de autorização
- ✅ CORS configurado
- ✅ Proteção de rotas

### Validações
```javascript
// No backend
- Verificar token JWT em cada request
- Confirmar que usuário é membro do grupo/conversa
- Validar entrada de dados
- Limpar dados de resposta (não expor dados sensíveis)
```

## 🧪 Testes

### Testar Conversa Direta
1. Abra 2 abas do navegador
2. Login como "joao@empresa.com" e "maria@empresa.com"
3. Clique em uma conversa em uma aba
4. Envie uma mensagem
5. Verifique se apareceu na outra aba em tempo real

### Testar Grupo
1. Abra 2 abas com usuários diferentes
2. Clique em um grupo em ambas as abas
3. Envie uma mensagem de uma aba
4. Verifique se apareceu na outra em tempo real

### Testar Digitação
1. Clique no input de mensagem
2. Comece a digitar
3. Veja o indicador "usuário está digitando..." aparecer

### Testar Status Online
1. Abra 2 abas
2. Veja o status online na lista de conversas
3. Feche uma aba
4. Veja o status virar offline

## 🐛 Erros Comuns

### Erro: Connection refused
```
❌ Error: connect ECONNREFUSED 127.0.0.1:8600
```
**Solução**: Certifique-se de que o backend está rodando
```bash
cd backend && npm run dev
```

### Erro: No database selected
```
❌ Error: No database selected
```
**Solução**: Execute a migration SQL
```bash
mysql -u chat -p chat_interno < backend/src/db/migration.sql
```

### Erro: CORS blocked
```
❌ Access to XMLHttpRequest blocked by CORS policy
```
**Solução**: Verifique a URL do frontend no CORS do backend

### Erro: Token inválido
```
❌ Token inválido
```
**Solução**: Faça logout e login novamente
```javascript
localStorage.removeItem('token');
```

## 📝 Dicas de Desenvolvimento

### Como adicionar um novo evento Socket.IO?

**1. Backend (server.js)**
```javascript
socket.on('novo_evento', (data) => {
  console.log('Evento recebido:', data);
  io.to('sala').emit('resposta_evento', {
    mensagem: 'Processado'
  });
});
```

**2. Frontend (ChatPage.jsx)**
```javascript
useEffect(() => {
  socket.on('resposta_evento', (data) => {
    console.log('Resposta:', data);
  });
}, [socket]);

// Emitir
socket.emit('novo_evento', { dados });
```

### Como adicionar um novo endpoint?

**1. Backend (Routes.js)**
```javascript
route.get('/novo-endpoint', authMiddleware, async (req, res) => {
  try {
    const dados = await db.query('SELECT * FROM tabela');
    res.json(dados);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

**2. Frontend**
```javascript
const res = await api.get('/novo-endpoint', {
  headers: { Authorization: `Bearer ${token}` }
});
console.log(res.data);
```

## 📱 Responsividade

O chat é totalmente responsivo:
- **Desktop** (> 1024px): Layout em 2 colunas
- **Tablet** (768px - 1024px): Layout adaptado
- **Mobile** (< 768px): Layout em stack

### Testar responsividade
```bash
# Firefox
F12 > Responsive Design Mode

# Chrome
F12 > Device Toolbar (Ctrl+Shift+M)
```

## 🚀 Deploy

### Build Frontend
```bash
cd frontend
npm run build
# Gera pasta 'dist' pronta para produção
```

### Build Backend
```bash
cd backend
npm install --production
# Copie o servidor para o servidor de produção
```

### Usar PM2 para manter rodando
```bash
npm install -g pm2
pm2 start backend/src/server.js --name "chat-api"
pm2 save
pm2 startup
```

## 📚 Recursos Úteis

- [Socket.IO Docs](https://socket.io/docs/)
- [Express Middleware](https://expressjs.com/en/guide/using-middleware.html)
- [React Hooks](https://react.dev/reference/react)
- [MySQL Docs](https://dev.mysql.com/doc/)
- [JWT.io](https://jwt.io/)

## 📞 Suporte

Para dúvidas ou problemas:
1. Verifique os logs do backend: `npm run dev`
2. Verifique o console do navegador: F12
3. Verifique o banco de dados: `mysql -u chat -p`
4. Leia o arquivo SETUP.md

## ✅ Checklist Final

- [x] Banco de dados criado
- [x] Tabelas migradas
- [x] Dados de teste inseridos
- [x] Backend rodando
- [x] Frontend rodando
- [x] Conversas diretas funcionando
- [x] Grupos funcionando
- [x] Status online/offline
- [x] Indicador de digitação
- [x] Mensagens em tempo real
- [x] Autenticação JWT
- [x] Responsividade
- [x] Documentação completa

## 📄 Licença

Desenvolvido para uso interno. Todos os direitos reservados.

---

**Versão**: 1.0.0  
**Última atualização**: 13 de maio de 2026  
**Status**: ✅ Pronto para Produção
