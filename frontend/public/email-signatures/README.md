# Assinaturas de e-mail

Esta pasta contém modelos editáveis em HTML para assinatura de e-mail:

- `projecta-assinatura.html`
- `dias-gestao-assinatura.html`
- `acessa-net-assinatura.html`
- `index.html` com links para todos os modelos

Os arquivos usam `table layout` e CSS inline para melhor compatibilidade com Gmail, Outlook e webmail. A estrutura dos dois modelos é a mesma, então ela também funciona como base reutilizável: copie um HTML, troque marca, cores e contatos, e salve com outro nome.

## Como usar o gerador editável

1. Abra `index.html` no navegador.
2. Escolha a empresa.
3. Preencha nome, cargo, telefone, e-mail, site, logo, endereço, redes sociais e frase.
4. Confira a prévia.
5. Clique em `Copiar assinatura`.
6. Cole no campo de assinatura do Gmail, Outlook ou webmail.

O botão `Copiar link preenchido` gera um link com os dados no endereço da página. Esse link pode ser enviado para outra pessoa abrir, conferir e copiar a assinatura.

O botão `Abrir e-mail com link` abre o programa de e-mail com uma mensagem pronta contendo o link preenchido. Esse fluxo não envia a assinatura instalada automaticamente; ele envia um link para a pessoa copiar e instalar a assinatura no próprio e-mail.

O botão `Baixar HTML` gera um arquivo HTML com a assinatura preenchida.

## Como enviar foto profissional

Use o campo `Enviar foto profissional` para escolher uma imagem do computador.

O gerador:

- recorta a imagem no centro;
- transforma em uma foto quadrada;
- aplica a foto no lugar da logo, no bloco esquerdo da assinatura.

Essa foto enviada fica embutida no HTML gerado. Ela funciona para copiar a assinatura no momento, mas não é colocada no link preenchido porque deixaria o link grande demais. Para enviar um link já pronto para outra pessoa, use uma URL pública HTTPS no campo `Foto do colaborador` ou peça para a pessoa enviar a foto novamente ao abrir o link.

## Como selecionar membros do chat interno

O gerador possui o campo `Selecionar membro do chat interno`.

Para carregar a lista:

1. Acesse a intranet/chat interno e faça login.
2. Abra a página `email-signatures/index.html` no mesmo navegador.
3. A lista de membros será carregada automaticamente.
4. Escolha um colaborador.

Ao selecionar um membro, o gerador preenche:

- Nome
- E-mail
- Cargo sugerido com base no setor cadastrado
- Foto de perfil, quando existir

Telefone, cargo exato e outros campos ainda devem ser revisados manualmente, porque o cadastro atual do chat não possui telefone ou cargo específico.

Observação importante: fotos de perfil salvas como imagem interna/base64 podem funcionar na cópia direta da assinatura, mas não são ideais para compartilhamento por link. Para assinatura definitiva ou distribuição em massa, prefira usar uma URL pública HTTPS para imagens.

## Como editar nome, cargo, telefone e e-mail

1. Abra o HTML desejado em um editor de texto.
2. Procure pelos comentários `EDITE O NOME COMPLETO`, `EDITE O CARGO`, `EDITE O TELEFONE / WHATSAPP` e `EDITE O E-MAIL`.
3. Substitua os textos de exemplo:
   - `NOME DO COLABORADOR`
   - `CARGO DO COLABORADOR`
   - `(00) 00000-0000`
   - `email@empresa.com.br`
4. Atualize também os links `tel:` e `mailto:` para manter telefone e e-mail clicáveis.

## Como trocar a logo

1. Hospede a logo em uma URL pública com HTTPS.
2. No HTML, procure o comentário `EDITE A LOGO`.
3. Troque o valor de `src` da tag `<img>` pela URL pública da logo.
4. Ajuste `width`, se necessário, mantendo uma largura entre 120px e 160px para boa leitura.

Recomendação: use logo por URL pública, não arquivo local. Arquivos locais não aparecem para quem recebe o e-mail.

## Como copiar para o Gmail

1. Abra o arquivo HTML no navegador.
2. Selecione a assinatura renderizada na página.
3. Copie com `Ctrl+C`.
4. No Gmail, acesse `Configurações` > `Ver todas as configurações` > `Assinatura`.
5. Crie uma nova assinatura ou edite uma existente.
6. Cole com `Ctrl+V`, salve as alterações e envie um e-mail de teste.

## Como copiar para o Outlook

1. Abra o arquivo HTML no navegador.
2. Selecione a assinatura renderizada na página.
3. Copie com `Ctrl+C`.
4. No Outlook, acesse `Arquivo` > `Opções` > `Email` > `Assinaturas`.
5. Crie ou edite uma assinatura.
6. Cole com `Ctrl+V`, salve e envie um e-mail de teste.

No Outlook Web, acesse `Configurações` > `Email` > `Redigir e responder` > `Assinatura de email`.

## Cuidados com imagens hospedadas

- Use URLs públicas com HTTPS.
- Evite imagens pesadas; prefira logos otimizadas em PNG ou JPG.
- Não use imagem em base64.
- Não use caminho local como `C:\logo.png` ou `/home/usuario/logo.png`.
- Teste o envio para Gmail e Outlook, pois alguns clientes bloqueiam imagens externas até o usuário permitir.
- Mantenha um texto alternativo (`alt`) claro na imagem.

## Cores

As cores ficam diretamente nos estilos inline do HTML.

- Projecta: azul escuro, cinza e branco.
- Dias Gestão: azul petróleo, cinza escuro e branco.
- Acessa Net: azul, ciano, cinza escuro e branco.

Para trocar as cores, procure o comentário `CORES DA MARCA` e substitua os códigos hexadecimais nos estilos inline.

## Logo da Acessa Net

A logo da Acessa Net usada pelo gerador está em `acessa-net-logo.png`, copiada a partir do arquivo do projeto `frontend/src/assets/logo.png`.

No gerador, ao selecionar `Acessa Net`, o campo de logo é preenchido automaticamente com a URL dessa imagem dentro de `/email-signatures/acessa-net-logo.png`.

## Logo da Projecta

A logo da Projecta usada pelo gerador está em `projecta-logo.png`.

No gerador, ao selecionar `Projecta Empreendimentos`, o campo de logo é preenchido automaticamente com a URL dessa imagem dentro de `/email-signatures/projecta-logo.png`.
