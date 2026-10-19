# AcessaNet Design System — camada operacional

Identidade visual compartilhada para os sistemas internos da AcessaNet. A primeira
aplicação é a Agenda Técnicos.

## Fonte da identidade

| Referência | Onde | Uso |
|---|---|---|
| AcessaNetLab (código) | `~/acessanet-lab/src/styles/tokens.css`, `base.css`, `components/header.css` | Tokens oficiais (cores, fontes, raios, sombras, movimento) |
| Site no ar | https://acessanet.com.br/ | Mesmo build do Lab (o CSS servido, `index-kOEM1mXL.css`, é o de `acessanet-lab/dist`) |
| Logotipo | `~/acessanet-lab/src/assets/logo-acessanet-3d.png` | Copiado e reduzido para `brand/acessanet-logo.png` (320 px) |
| Fontes | `@fontsource-variable/sora` e `@fontsource-variable/manrope` do Lab | Copiadas para `fonts/` (latin e latin-ext), com licença OFL |

As outras pastas de site da máquina (`Site-Acessanet`, `SiteAcessanetV2`) estão
desatualizadas e **não** são referência.

## Padrões observados no site (17/10/2026, desktop 1440 px e mobile 390 px)

- **Fundo:** navy profundo (`#050b1f`, `#030716`) com brilho radial azul. Seções de conteúdo claras (`#ffffff`, `#f4f7fc`).
- **Header:** barra translúcida `rgba(5, 11, 31, .72)` com blur e borda inferior `rgba(143, 178, 255, .16)`.
- **Ação principal:** pílula azul elétrico `#2f6bff`, texto branco, sombra/brilho `0 10px 30px -10px rgba(47, 107, 255, .8)` e realce interno de 1 px no topo.
- **Ação secundária:** pílula transparente com borda fina clara.
- **Eyebrow:** caixa alta, 12–14 px, peso 700, espaçamento largo, às vezes com traço azul à esquerda.
- **Títulos:** Sora 700, `letter-spacing: -0.025em`, line-height 1.08. Destaque em gradiente branco → ciano (`#8ae8ff`).
- **Texto:** Manrope 400–600, `#0b1630` sobre claro e `#eef3ff` sobre escuro.
- **Cartões:** raio 22–32 px no marketing, borda fina, sombra difusa. Cartões escuros com gradiente navy e brilho azul.
- **Foco:** contorno ciano `#3ad6ff` de 2 px com afastamento.
- **Movimento:** `cubic-bezier(.16, 1, .3, 1)`, 180 / 420 / 900 ms.

**Fica de fora dos sistemas internos:** globo 3D, carrossel do hero, preços,
banners promocionais, botão flutuante de WhatsApp e títulos em escala de hero.

## Arquitetura dos tokens

```
acessanet-ds.css
├─ 1. Primitivas de marca   --an-navy-*, --an-blue-*, --an-cyan-*, --an-ink*, --an-line*  (oficiais)
│                           --an-navy-850, --an-mist-*                                  (derivadas)
├─ 2. Status operacional    --an-status-*, --an-alert-*                                 (independentes da marca)
├─ 3. Tipografia            --an-font-*, --an-text-2xs…3xl (produto), --an-fs-hero/h2/h3 (marca)
│     Espaço / controles    --an-space-0…12 (base 4 px), --an-control-sm/md/lg
│     Raio                  --an-radius-xs/sm/md/lg/xl/pill
│     Movimento             --an-ease-out, --an-ease-spring, --an-dur-*
│     Camadas e estados     --an-z-*, --an-state-*
├─ 4. Semânticos por tema   --an-bg, --an-surface*, --an-border*, --an-text*, --an-accent*,
│                           --an-focus-ring, --an-overlay, --an-shadow-*, --an-scrollbar*
└─ 5. Componentes base      .an-btn(--primary|--ghost|--danger|--sm), .an-input, .an-select,
                            .an-card, .an-eyebrow, .an-badge, .an-tabs/.an-tab, .an-kbd,
                            .an-skeleton, .an-spinner, .an-brand-mark
```

**Regra:** componentes consomem apenas tokens semânticos (camada 4) e de status
(camada 2). Primitivas só aparecem dentro do próprio DS ou em remapeamento de CSS legado.

### Primitivas — oficiais (cópia de `tokens.css` do Lab)

| Token | Valor | | Token | Valor |
|---|---|---|---|---|
| `--an-navy-950` | `#030716` | | `--an-blue-500` | `#2f6bff` |
| `--an-navy-900` | `#050b1f` | | `--an-blue-400` | `#4f86ff` |
| `--an-navy-800` | `#0a1633` | | `--an-blue-300` | `#8fb2ff` |
| `--an-navy-700` | `#10224a` | | `--an-cyan-400` | `#3ad6ff` |
| `--an-navy-600` | `#1a3266` | | `--an-cyan-300` | `#8ae8ff` |
| `--an-ink` | `#0b1630` | | `--an-line` | `#e3e9f3` |
| `--an-ink-2` | `#33415c` | | `--an-line-dark` | `rgba(143,178,255,.16)` |
| `--an-ink-3` | `#5d6b85` | | `--an-surface-0/1/2` | `#ffffff` / `#f4f7fc` / `#eaf0fa` |

Fontes: **Sora Variable** (títulos e números de destaque) e **Manrope Variable** (todo o resto).

### Primitivas — derivadas (não existem no site; documentadas aqui)

| Token | Valor | Por quê |
|---|---|---|
| `--an-navy-850` | `#0d1a3a` | Superfície elevada no escuro (modais, menus), entre 800 e 700 |
| `--an-mist-200` | `#d5deec` | Borda forte no claro |
| `--an-mist-300` | `#c8d2e6` | Texto secundário sólido sobre navy |
| `--an-mist-400` | `#a5adc1` | `on-dark-2` composto sobre `navy-900`, como cor sólida |
| `--an-mist-500` | `#7d88a3` | Placeholder / desabilitado sobre navy |
| `--an-radius-xs` | `6px` | Badges e células densas da grade |
| escala `--an-text-*` | 10–28 px | Densidade de software operacional; a escala do site é de marketing |

### Temas

- `:root` = **claro** (padrão do site). `:root[data-an-theme="dark"]` = **escuro**.
- Sem o atributo, o tema segue `prefers-color-scheme`.
- O destaque é `blue-500` nos dois temas. No escuro, o texto de destaque é `blue-300` e o foco é ciano. No claro, o foco é azul.

### Status operacional — separado da marca

| Token | Valor | Significado na Agenda |
|---|---|---|
| `--an-status-open` | `#2563eb` | OS aberta |
| `--an-status-done` | `#16a34a` | OS encerrada |
| `--an-status-running` | `#facc15` | Em execução |
| `--an-status-scheduled` | `#9800f7` | Agendada / compromisso |
| `--an-status-iracema` | `#3ad6de` | Fila Iracema |
| `--an-status-lunch` | `#f59e0b` | Almoço |
| `--an-status-other` | `#14b8a6` | Bloqueio "outro" |
| `--an-alert-critical` | `#ef4444` | Atrasos, simultâneos, erros |
| `--an-alert-warning` | `#f59e0b` | Atenção |
| `--an-alert-success` | `#22c55e` | Sucesso, online |

Os valores são os que a operação já conhece; o rebranding não os alterou. Nunca use
azul ou ciano de marca para comunicar estado, nem cor de status como decoração.
Exemplo: antes, `#3ad6de` era ao mesmo tempo a cor de marca da Agenda e o status
"Iracema". Agora a interface usa `--an-accent` e `#3ad6de` ficou só para Iracema.

## Como usar em outro sistema

```html
<html lang="pt-BR" data-an-theme="dark">
<head>
  <link rel="stylesheet" href="/design-system/acessanet-ds.css">
</head>
<body>
  <header class="topbar">
    <a class="an-brand-mark" href="/">
      <img src="/design-system/brand/acessanet-logo.png" alt="AcessaNet">
      <span class="an-brand-mark__divider"></span>
      <span class="an-brand-mark__product">Nome do Sistema</span>
    </a>
  </header>
  <button class="an-btn an-btn--primary">Salvar</button>
  <button class="an-btn">Cancelar</button>
  <span class="an-badge"><i class="an-badge__dot" style="color: var(--an-status-done)"></i> Encerrada</span>
</body>
</html>
```

Para trocar o tema em tempo de execução:
`document.documentElement.dataset.anTheme = "light" | "dark"`.

**Logo no tema claro:** o logotipo oficial tem "acessa" em branco e o site só o
usa sobre navy. Em fundo claro, coloque-o sobre um bloco `var(--an-grad-deep)`
(como na Agenda). Não recolorir nem criar variantes.

## Aplicação na Agenda Técnicos

| Arquivo | Papel |
|---|---|
| `design-system/acessanet-ds.css` | DS compartilhado (não contém nada específico da Agenda) |
| `agenda-brand.css` | Camada de produto: mapeia os seletores existentes da Agenda para os tokens. Carregado depois do `<style>` legado; seletores `html[data-an-theme] …` vencem o legado sem `!important` |
| `index.html` `<style>` | Neutros Tailwind (slate/gray) trocados pela família navy/ink equivalente via `var(--an-*)`. Ciano de UI → `--an-accent`. Status → `--an-status-*` |
| `login.html`, `historico.html` | Variáveis locais apontam para os tokens do DS |
| `chat-widget.css` | Variáveis `--cw-*` usam tokens do DS, com fallback para os valores antigos |

Mapeamento de neutros aplicado ao CSS legado:

| Antes (Tailwind) | Depois |
|---|---|
| `#111827` `#0c131d` | `--an-navy-900` |
| `#0f172a` | `--an-navy-800` |
| `#1f2937` `#1e293b` | `--an-navy-700` |
| `#374151` `#334155` `#253041` | `--an-navy-600` |
| `#4b5563` `#475569` / `#6b7280` `#64748b` | `--an-ink-2` / `--an-ink-3` |
| `#9ca3af` `#94a3b8` / `#cbd5e1` `#d1d5db` | `--an-mist-400` / `--an-mist-300` |
| `#e5e7eb` `#e2e8f0` / `#f3f4f6` `#f1f5f9` / `#f8fafc` | `--an-line` / `--an-surface-2` / `--an-surface-1` |
| `rgba(148,163,184,a)` | `rgba(var(--an-neutral-rgb), a)`, sensível ao tema |
| `#3ad6de` / `rgba(58,214,222,a)` (UI) | `--an-accent` / `rgba(var(--an-accent-rgb), a)` |

**Exceções intencionais:** cores de equipe (`--cor-equipe`), de rota (`--rota-cor`),
de filas N1/N2/ST, de tipos de ação do histórico (`--c-*`) e a página 404 temática
(identidade própria, deliberada).

## Aplicação no Chat Interno

| Arquivo | Papel |
|---|---|
| `frontend/public/design-system/` | Mesma cópia do DS da Agenda (manter os dois arquivos idênticos) |
| `frontend/index.html` | Carrega `/design-system/acessanet-ds.css` antes do bundle |
| `frontend/src/utils/theme.js` | `applyThemeToDocument` também grava `data-an-theme` (`claro` → `light`) |
| `frontend/src/index.css` | Variáveis globais da intranet (`--bg-main`, `--accent`…) apontam para o DS; corpo em Manrope |
| `frontend/src/styles/Chat.module.css` | Variáveis semânticas do chat → tokens; cores fixas remapeadas; camada "ACESSANET" no fim do arquivo |

Regras do chat:

- A personalização do usuário (`--user-*`, modal "Personalização do Chat") continua tendo prioridade. A camada de marca só muda os *fallbacks*. O preset "Padrão AcessaNet" não grava cores, então segue o DS.
- Ícones: só Lucide (`lucide-react`). Os ícones de departamento dos grupos saem de `utils/grupoIcones.js` (`renderIconeGrupo`).
- Composer: superfície única e flutuante, com anel de foco azul. É o único elemento "expressivo" da tela.
- Sem barras laterais coloridas em itens de lista. Estado ativo, não lida e menção usam fundo e anel de 1 px. A exceção é o filete de citação (2 px).
- Status (online/ausente/offline, avisos) continuam verde/âmbar/vermelho, fora da paleta de marca.
