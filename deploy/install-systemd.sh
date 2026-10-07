#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/noc/chat-interno}"
SERVICE_NAME="${SERVICE_NAME:-chat-interno}"
ENV_FILE="${ENV_FILE:-/etc/chat-interno/chat-interno.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Crie $ENV_FILE com permissao 600 antes de instalar o servico." >&2
  exit 1
fi

cd "$APP_DIR/frontend"
npm run build

sudo cp "$APP_DIR/deploy/chat-interno.service" "/etc/systemd/system/${SERVICE_NAME}.service"
sudo systemctl daemon-reload
sudo systemctl enable --now "$SERVICE_NAME"
sudo systemctl status "$SERVICE_NAME" --no-pager
