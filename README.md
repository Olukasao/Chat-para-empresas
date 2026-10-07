# Intranet - Corporate Workspace

Intranet interna para comunicacao, atendimento, monitoramento, compras, materiais, treinamentos e administracao operacional. O projeto une um chat em tempo real com paineis de apoio ao NOC, areas administrativas, biblioteca interna, fluxos de compras, roleta de premios, diagnosticos de rede e ferramentas rapidas para a rotina da equipe.

Este repositorio contem somente codigo-fonte, configuracoes de exemplo, migrations e assets estaticos seguros. Dados reais de conversa, anexos, uploads, builds, `node_modules`, backups e arquivos `.env` ficam fora do Git pelo `.gitignore`.

## Stack

- Frontend: React 19, Vite, React Router, Axios, Socket.IO Client, Framer Motion, Lucide React.
- Backend: Node.js, Express 5, Socket.IO, MySQL, JWT, bcrypt, multer, sharp, helmet.
- Banco: MySQL com migrations SQL versionadas.
- Tempo real: Socket.IO para chat, notificacoes, status, eventos de mensagens e efeitos sonoros.
- Deploy: servicos systemd/PM2 em `deploy/` e build estatico do frontend servido pelo backend em producao.

## Principais funcionalidades

### Autenticacao e identidade

- Login com e-mail e senha.
- Autenticacao por JWT.
- Controle de perfil: `admin`, `admin_comercial` e `usuario`.
- Cadastro e manutencao de usuarios pelo painel administrativo.
- Atualizacao de perfil do usuario, incluindo avatar e troca de senha.
- Status online, offline e ausente.
- SSO seguro para integracao com o painel de atendimento.
- Token de integracao para endpoints internos do atendimento.

### Chat interno em tempo real

- Conversas diretas entre usuarios.
- Grupos por empresa, setor e membros.
- Mensagens em tempo real via Socket.IO.
- Indicadores de digitacao.
- Status de entrega, leitura e visualizacao.
- Mensagens de texto, imagens, audio, arquivos e figurinhas.
- Upload de anexos do chat.
- Preview, crop e visualizacao de imagens.
- Resposta a mensagens.
- Edicao e exclusao de mensagens.
- Ocultar conversas para o usuario.
- Favoritar conversas e mensagens.
- Reacoes em mensagens.
- Mensagens fixadas em grupos.
- Historico de arquivos compartilhados.
- Biblioteca de stickers, favoritos e recentes.
- Criacao e upload de stickers.
- Aparencia do chat por usuario: tema, wallpaper e preferencias.
- Aparencia por conversa/grupo.
- Notificacoes de navegador para mensagens.
- Contadores de nao lidas.
- Painel de resumo NOC dentro do chat.
- Menu de acessos rapidos personalizavel por usuario.

### Comunicados, avisos e banners

- Avisos internos para a equipe.
- Aviso geral pendente com confirmacao de leitura.
- Notificacoes internas com leitura e soneca.
- Administracao de avisos internos.
- Banner da home configuravel por administradores.
- Upload de imagem para banner.
- Changelog interno com entradas administrativas.
- Feedbacks dos usuarios com acompanhamento de status.

### Wiki, cursos e materiais internos

- Wiki interna com categorias e conteudos.
- Cursos internos com trilhas, aulas e secoes.
- Progresso por usuario em cursos e aulas.
- Configuracao administrativa de wiki, cursos e aulas.
- Biblioteca de procedimentos e materiais.
- Conteudos de rede, NOC, atendimento, vendas, seguranca e desenvolvimento.
- Busca por categorias, cursos e aulas.
- Materiais com arquivos e configuracoes no banco.

### Busca global

- Busca centralizada por conteudos internos.
- Fontes pesquisadas:
  - Wiki e cursos.
  - Textos para atendimento.
  - Avisos internos.
  - Boas praticas.
- Resultados agrupados por origem.

### Solicitacoes internas

- Abertura e acompanhamento de solicitacoes internas.
- Upload de anexos.
- Atualizacao de status.
- Conclusao de solicitacoes.
- Filtros e listagem por usuario/equipe.

### Compras e almoxarifado

- Portal do solicitante para criar e acompanhar requisicoes de compra.
- Painel de compras/almoxarifado.
- Permissoes por usuario, perfil e departamento.
- Perfis de permissao reutilizaveis.
- Categorias de compra.
- Cadastro e reaproveitamento de fornecedores.
- Sequenciamento de codigos de solicitacao.
- Itens por solicitacao com quantidade, prioridade, centro de custo e justificativa.
- Fluxos de status para solicitacao e itens.
- Cotacoes por item, com fornecedor, valores, prazo, anexos e status.
- Selecao de cotacao vencedora.
- Aprovacoes.
- Registro de pedidos de compra.
- Registro de recebimentos parciais ou totais.
- Comentarios e anexos no fluxo.
- Historico/auditoria de alteracoes.
- Notificacoes de compras.
- Relatorios e exportacao.
- Busca por solicitacoes, fornecedores e pedidos.
- Exclusao permanente restrita a permissao administrativa.

### Monitoramento, NOC e diagnostico de rede

- Monitoramento Total com visao operacional do NOC.
- Indicadores de clientes, status, prioridades, atendimentos, instalacoes, massivos e tecnicos.
- Diagnostico de conexao de cliente.
- Busca de cliente via SGP.
- Consulta de sessao, trafego atual, qualidade e historico.
- Integracao configuravel com SGP URA, SGP Web ou endpoints genericos.
- Integracao configuravel com Hillstone/StoneOS.
- Testes de ping, perda, latencia e jitter.
- Historico de diagnosticos.
- Permissoes especificas para visualizar, executar, ver historico e administrar diagnosticos.
- Limites de concorrencia, rate limit e cooldown por cliente.
- Teste de conectividade de sites HTTP/HTTPS/DNS.
- Cadastro administrativo dos sites testados.
- Teste de perda de pacote para destinos cadastrados.
- Cadastro administrativo dos alvos de packet loss.
- Pagina de falhas gerais com links de apoio para status externos, DNS, BGP e testes de qualidade.
- Plantao de domingo por setor.
- Controle Operacional opcional por flag, com auditoria, resumo, feed, busca e detalhes por entidade.

### Atendimento e apoio rapido

- Textos prontos para atendimento.
- Administracao de textos de atendimento.
- Boas praticas de atendimento.
- Administracao de boas praticas.
- Pagina de duvidas e boas praticas com perguntas dos usuarios e respostas administrativas.
- Procedimentos financeiros.
- Modelos copiaveis para uso durante o atendimento.
- Notas rapidas pessoais e compartilhadas.
- Compartilhamento de notas com permissao de leitura ou edicao.

### Comercial e vendas

- Biblioteca de materiais de vendas.
- Tipos de material: imagem, PDF, DOCX, PPTX, link e outros.
- Cadastro, edicao, ativacao e remocao de materiais.
- Upload de arquivos comerciais.
- Area de acesso rapido para vendas.
- Calculadora de semi-dedicado.
- Calculadora de acordo.
- Calculadora de troca de plano em modal no chat.
- Dados e regras de precificacao versionados no frontend.

### Imagens, assinaturas e assets

- Galeria interna de imagens.
- Upload e exclusao administrativa de imagens.
- Pagina de assinaturas de e-mail.
- Modelos de assinatura para Acessa Net, Projecta e Dias Gestao.
- Assets publicos de logos e sons padrao.
- Uploads reais ficam em `uploads/` e nao sao versionados.

### Efeitos sonoros

- Lista de efeitos sonoros padrao.
- Upload de efeitos customizados.
- Validacao de formato e tamanho de audio.
- Permissao para usar efeitos sonoros.
- Permissao para gerenciar efeitos sonoros por usuario.
- Disparo remoto de efeito para usuarios online via Socket.IO.
- Sons customizados gerados em runtime ficam fora do Git.

### Competicao CCNA

- Pagina da competicao CCNA.
- Entrada de participantes.
- Modulos com status e comprovantes.
- Upload de comprovantes/provas.
- Administracao de participantes e status.
- Configuracao administrativa da competicao.

### Roleta de premios

- Campanhas de roleta por empresa.
- Restricao de campanha por departamento.
- Premios com nome publico, nome real, imagem, icone, cor, tipo, estoque, peso e valor estimado.
- Premios misterio e jackpot.
- Saldo de giros por usuario.
- Concessao de giros por usuario, setor ou regras administrativas.
- Giro com controle de idempotencia por `requestId`.
- Historico de giros.
- Meus premios.
- Solicitar resgate de premio.
- Fluxo administrativo de resgates.
- Dashboard administrativo da campanha.
- Historico administrativo.
- Logs administrativos.
- Notificacoes da roleta.
- Upload de imagem de premio.

### Administracao

- Dashboard administrativo.
- Resumo geral da intranet.
- Gestao de usuarios.
- Gestao de setores.
- Gestao de grupos e membros.
- Mensagem fixada em grupos.
- Adicao de acessos a grupos.
- Historico de mensagens por usuario.
- Historico administrativo do chat.
- Exclusao administrativa de mensagens.
- Forcar refresh do chat para usuarios conectados.
- Administracao de avisos internos.
- Administracao de banner da home.
- Administracao de aviso geral.
- Administracao de permissoes de compras.
- Administracao da roleta de premios.
- Administracao de changelog, feedbacks, textos e boas praticas.
- Auditoria operacional quando `CONTROLE_OPERACIONAL_ENABLED=true`.

## Rotas principais do frontend

| Rota | Finalidade |
| --- | --- |
| `/login` | Login |
| `/atendimento-sso` | Entrada SSO do atendimento |
| `/` e `/chat` | Chat e dashboard principal |
| `/avisos-internos` | Comunicados internos |
| `/imagens` | Galeria de imagens |
| `/wiki` e `/cursos` | Wiki, cursos e aulas |
| `/busca-global` | Busca global |
| `/solicitacoes-internas` | Solicitacoes internas |
| `/solicitacoes` | Portal do solicitante de compras |
| `/solicitacoes-compras` e `/painel-almoxarifado` | Painel de compras |
| `/changelog` | Changelog interno |
| `/notas-rapidas` | Notas pessoais e compartilhadas |
| `/plantao-domingo` | Plantao por setor |
| `/boas-praticas-duvidas` | Perguntas e respostas de boas praticas |
| `/textos-atendimento` | Textos prontos |
| `/boas-praticas-atendimento` | Boas praticas de atendimento |
| `/acesso-rapido/vendas` | Materiais de vendas |
| `/acesso-rapido/falhas-gerais` | Ferramentas de diagnostico externo |
| `/teste-conectividade-sites` | Teste de sites |
| `/teste-perda-pacote` | Packet loss |
| `/diagnostico-conexao-cliente` | Diagnostico de cliente |
| `/monitoramento-total` | Painel NOC |
| `/controle-operacional` | Auditoria operacional |
| `/competicao-ccna` | Competicao CCNA |
| `/roleta-premios` | Roleta do usuario |
| `/acesso-rapido/calculadora-semi-dedicado` | Calculadora semi-dedicado |
| `/acesso-rapido/calculadora-acordo` | Calculadora de acordo |
| `/assinaturas-email` | Assinaturas de e-mail |
| `/admin` | Administracao geral |
| `/admin/avisos-internos` | Admin de avisos |
| `/admin/banner-home` | Admin de banner |
| `/admin/usuarios/:id/mensagens` | Historico por usuario |
| `/admin/chat-historico` | Historico do chat |
| `/admin/permissoes-compras` | Permissoes de compras |
| `/admin/roleta-premios` | Admin da roleta |

## API e modulos de backend

O backend expõe a API sob `/api` e organiza as rotas em:

- `backend/src/Routes/Routes.js`: autenticacao, perfil, quick access, chat, wiki, avisos, imagens, CCNA, plantao, feedbacks, changelog, sons, administracao e controle operacional.
- `backend/src/Routes/purchaseModule.js`: compras, almoxarifado, cotacoes, pedidos, recebimentos, relatorios e permissoes.
- `backend/src/Routes/networkDiagnosticsRoutes.js`: diagnostico de conexao, permissoes e historico.
- `backend/src/Routes/rouletteRoutes.js`: campanhas, giros, premios, resgates e administracao da roleta.

Endpoints estaticos servem conteudos gerados em runtime:

- `/uploads/chat`
- `/uploads/stickers`
- `/uploads/wallpapers`
- `/uploads/wiki`
- `/uploads/solicitacoes`
- `/uploads/compras`
- `/uploads/vendas`
- `/uploads/ccna-competition`
- `/uploads/banner-home`
- `/uploads/avisos`
- `/uploads/roulette`
- `/uploads/imagens`
- `/sounds`
- `/email-signatures`

Essas pastas podem existir em producao, mas nao devem ser versionadas quando contiverem dados reais.

## Estrutura do projeto

```text
chat-interno/
├── backend/
│   ├── migrations/
│   ├── src/
│   │   ├── Routes/
│   │   ├── config/
│   │   ├── db/
│   │   ├── middlewares/
│   │   ├── repositories/
│   │   ├── services/
│   │   ├── validators/
│   │   └── server.js
│   ├── test/
│   └── package.json
├── deploy/
├── email-signatures/
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── data/
│   │   ├── pages/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── styles/
│   │   └── utils/
│   └── package.json
├── .env.example
├── SETUP.md
├── OPERACAO.md
└── README.md
```

## Banco de dados e migrations

O schema principal esta em `backend/src/db/migration.sql`. Migrations incrementais ficam em `backend/migrations/`.

Modulos cobertos por tabelas/migrations:

- Chat, conversas, grupos, leituras, favoritos, reacoes e stickers.
- Acessos rapidos.
- Notas rapidas.
- Solicitacoes internas.
- Textos de atendimento e boas praticas.
- Wiki, cursos, aulas e progresso.
- Avisos, banners, imagens e feedbacks.
- Changelog.
- Materiais de vendas.
- Compras e almoxarifado.
- Diagnostico de rede.
- Auditoria operacional.
- Roleta de premios.
- Efeitos sonoros.
- Aparencia do chat.

## Configuracao de ambiente

Copie `.env.example` para `.env` e preencha os valores reais somente no ambiente local/producao.

Principais grupos de variaveis:

- Banco: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`.
- Servidor: `SERVER_PORT`, `NODE_ENV`, `TRUST_PROXY`, `CORS_ALLOWED_ORIGINS`.
- JWT: `JWT_SECRET`, `JWT_EXPIRES_IN`.
- Socket.IO: `SOCKET_CORS_ORIGIN`.
- Atendimento/SSO: `ATENDIMENTO_INTEGRATION_TOKEN`, `ATENDIMENTO_SSO_REDIRECT_ORIGINS`.
- SGP: `SGP_API_ENABLED`, `SGP_PROVIDER`, `SGP_URA_*`, `SGP_WEB_*`.
- Hillstone: `HILLSTONE_ENABLED`, `HILLSTONE_*`.
- Diagnostico: `NETWORK_DIAGNOSTIC_*`.
- Teste remoto: `REMOTE_SPEED_TEST_*`.
- Frontend: `VITE_API_URL`, `VITE_SOCKET_URL`, `VITE_ENV`.

Em producao, use um `JWT_SECRET` forte com pelo menos 32 caracteres.

## Como rodar em desenvolvimento

Instale as dependencias:

```bash
cd backend
npm install

cd ../frontend
npm install
```

Configure o banco e rode as migrations conforme `SETUP.md`.

Suba o backend:

```bash
cd backend
npm run dev
```

Suba o frontend:

```bash
cd frontend
npm run dev
```

URLs padrao:

- Backend: `http://localhost:8600`
- API: `http://localhost:8600/api`
- Frontend Vite: `http://localhost:5173`

## Scripts

Backend:

```bash
npm run dev
npm start
npm test
```

Frontend:

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

## Testes e validacao

Comandos usados para validar o projeto:

```bash
cd backend
npm test

cd ../frontend
npm run build
```

O build do frontend pode emitir alerta de chunk grande do Vite; isso nao impede a geracao do build.

## Deploy e operacao

Arquivos de apoio:

- `deploy/chat-interno.service`: servico systemd do projeto.
- `deploy/chat-interno.user.service`: servico systemd de usuario.
- `deploy/pm2-noc.user.service`: suporte a PM2.
- `deploy/install-systemd.sh`: instalacao dos servicos.
- `ecosystem.config.cjs`: configuracao PM2.
- `OPERACAO.md`: guia operacional.
- `VM_ALWAYS_ON.md`: orientacoes para manter a VM ativa.

Fluxo comum de producao:

```bash
cd frontend
npm run build

cd ../backend
npm start
```

O backend pode servir o build estatico do frontend quando `frontend/dist` existir.

## Seguranca e privacidade

- Nunca versionar `.env`, `.env.*`, backups, dumps, logs ou chaves.
- Nunca versionar `uploads/`, pois pode conter conversas, documentos, imagens, audios, comprovantes e dados pessoais.
- Nunca versionar `frontend/dist/` gerado localmente.
- Nunca versionar `node_modules/`.
- Tokens de SGP, Hillstone, atendimento e JWT devem ficar apenas no ambiente.
- A pasta `frontend/public/sounds/custom/` fica ignorada porque representa conteudo customizado de runtime.
- O repositorio deve conter codigo, migrations e assets estaticos seguros.

## Documentacao complementar

- `SETUP.md`: configuracao inicial.
- `OPERACAO.md`: operacao, servicos e manutencao.
- `README_CHAT.md`: documentacao historica e tecnica do chat.
- `QUICK_REFERENCE.txt`: comandos e referencias rapidas.
- `COMECE_AQUI.txt`: guia inicial antigo.

## Estado do repositorio

Branch principal: `main`.

O primeiro commit foi criado sem anexos reais do chat, sem uploads, sem `.env`, sem backups e sem dados sensiveis operacionais.
