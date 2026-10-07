# Chat Interno 24/7 na VM com PM2

Este projeto roda 24/7 pelo `PM2`. O processo `chat-interno` fica visivel em `pm2 status`, reinicia sozinho se cair e entrega o frontend React compilado em `frontend/dist`.

## 1. Gerar o frontend

```bash
cd /home/noc/chat-interno/frontend
npm run build
```

## 2. Subir no PM2

```bash
cd /home/noc/chat-interno
pm2 start ecosystem.config.cjs
pm2 save
```

Depois disso, o chat aparece em `pm2 status`.

## 3. Subir automaticamente no reboot

O usuario `noc` usa o servico `systemd --user` abaixo para restaurar o dump do PM2 no boot:

```bash
install -Dm644 /home/noc/chat-interno/deploy/pm2-noc.user.service /home/noc/.config/systemd/user/pm2-noc.service
systemctl --user daemon-reload
systemctl --user enable --now pm2-noc.service
```

O `linger` tambem precisa estar habilitado uma vez:

```bash
loginctl show-user noc -p Linger
```

O esperado e `Linger=yes`.

## 4. Acessar

Abra no navegador:

```text
http://192.168.1.133:8600
```

## 5. Comandos uteis

```bash
pm2 status
pm2 logs chat-interno
pm2 restart chat-interno
pm2 stop chat-interno
systemctl --user status pm2-noc.service --no-pager
```

## 6. Quando alterar o frontend

Sempre que mudar arquivos do `frontend/src`, rode:

```bash
cd /home/noc/chat-interno/frontend
npm run build
pm2 restart chat-interno
pm2 save
```

## 7. Porta e firewall

O servico fica na porta `8600`. Se a VM tiver firewall ativo, libere:

```bash
sudo ufw allow 8600/tcp
```

## 8. MySQL

O servico espera o MySQL ligado. Para manter o MySQL ativo no boot:

```bash
sudo systemctl enable --now mysql
```

Se a distro usar MariaDB:

```bash
sudo systemctl enable --now mariadb
```
