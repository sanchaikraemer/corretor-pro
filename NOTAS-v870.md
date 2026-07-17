# v870 — banner "Baixar app" aparece já ao abrir o link (não precisa ir em Configurações)

## Contexto

Quando o app NÃO está instalado, o convite pra instalar só aparecia como um botão dentro do
Menu (Configurações). O dono quer que a opção de baixar **apareça na hora que abre o link**.

## Causa

O `#bannerInstalar` (banner do topo da Hoje) **existia mas vinha vazio** no `index.html` —
então, mesmo com `js/pwa-install.js` mandando ele aparecer quando não está em standalone, não
havia conteúdo pra mostrar. Sobrava só o botão do Menu.

## Mudança (`index.html` + `styles.css`)

- O `#bannerInstalar` foi **preenchido** com um convite de verdade: ícone ⬇, "Instalar o
  Corretor Pro", uma linha explicando, botão **"Baixar app"** (`#bannerInstalarBtn`), o "✕"
  pra dispensar (`#bannerInstalarFechar`) e a dica de passo a passo (`#bannerInstalarDica`,
  pra iPhone/Safari) — todos os IDs que `pwa-install.js` já espera.
- Foi **movido pro topo da Hoje** (logo abaixo do título), então aparece assim que o link
  abre — sem precisar ir em Configurações.
- CSS `.cp-install-*` novo (barra coral prominente, responsiva).
- Comportamento mantido: some quando já está instalado (standalone); no clique, abre o
  instalador nativo (Chrome/Android) ou mostra o passo a passo manual (iPhone); o "✕" lembra
  a dispensa (localStorage), e o botão do Menu continua existindo.

## Verificação

- Novo teste `tests/v870-banner-instalar`: garante que o `#bannerInstalar` não vem mais vazio,
  tem o botão "Baixar app" (+ fechar + dica), fica no topo (antes da grade) e tem CSS.
- `npm test`: suíte completa verde. Prévia renderizada do banner.
