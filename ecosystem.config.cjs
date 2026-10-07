const fs = require('fs');
const path = require('path');

// Carrega o .env da raiz do projeto para dentro de process.env (sem sobrescrever
// variaveis ja definidas no ambiente do PM2), para que os valores abaixo como
// JWT_SECRET nao virem string vazia quando o PM2 inicia o processo.
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

module.exports = {
  apps: [
    {
      name: 'chat-interno',
      cwd: '/home/noc/chat-interno/backend',
      script: 'src/server.js',
      interpreter: '/usr/local/bin/node',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        HOST: '192.168.1.133',
        PORT: '8600',
        JWT_SECRET: process.env.JWT_SECRET || '',
        JWT_EXPIRES_IN: '7d',
        DB_HOST: 'localhost',
        DB_PORT: '3306',
        DB_USER: 'chat',
        DB_PASSWORD: process.env.DB_PASSWORD || '',
        DB_NAME: 'chat_interno',
        TRUST_PROXY: process.env.TRUST_PROXY || 'loopback',
        CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS || '',
        SOCKET_CORS_ORIGIN: process.env.SOCKET_CORS_ORIGIN || '',
        ATENDIMENTO_INTEGRATION_TOKEN: process.env.ATENDIMENTO_INTEGRATION_TOKEN || '',
        ATENDIMENTO_SSO_REDIRECT_ORIGINS: process.env.ATENDIMENTO_SSO_REDIRECT_ORIGINS || 'http://192.168.1.133:9520,http://localhost:9520,http://127.0.0.1:9520,http://localhost:5173,http://127.0.0.1:5173,https://atendimento.acessanet.com.br',
        ATENDIMENTO_SSO_CODE_TTL_MS: process.env.ATENDIMENTO_SSO_CODE_TTL_MS || '60000',
        MERCADO_LIVRE_ACCESS_TOKEN: process.env.MERCADO_LIVRE_ACCESS_TOKEN || '',
        SGP_API_ENABLED: process.env.SGP_API_ENABLED || 'true',
        SGP_PROVIDER: process.env.SGP_PROVIDER || 'ura',
        SGP_URA_ENABLED: process.env.SGP_URA_ENABLED || 'true',
        SGP_URA_BASE_URL: process.env.SGP_URA_BASE_URL || '',
        SGP_URA_CONSULTA_CLIENTE_PATH: process.env.SGP_URA_CONSULTA_CLIENTE_PATH || '/api/ura/consultacliente/',
        SGP_URA_USERNAME: process.env.SGP_URA_USERNAME || '',
        SGP_URA_PASSWORD: process.env.SGP_URA_PASSWORD || '',
        SGP_WEB_TRAFFIC_ENABLED: process.env.SGP_WEB_TRAFFIC_ENABLED || 'true',
        SGP_WEB_BASE_URL: process.env.SGP_WEB_BASE_URL || '',
        SGP_WEB_USERNAME: process.env.SGP_WEB_USERNAME || '',
        SGP_WEB_PASSWORD: process.env.SGP_WEB_PASSWORD || '',
        SGP_WEB_TIMEOUT_SECONDS: process.env.SGP_WEB_TIMEOUT_SECONDS || '30',
        SGP_TIMEOUT_SECONDS: process.env.SGP_TIMEOUT_SECONDS || '10',
        SGP_CACHE_SECONDS: process.env.SGP_CACHE_SECONDS || '20',
      },
    },
  ],
};
