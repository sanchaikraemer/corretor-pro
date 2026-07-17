# v863 — card de lead padronizado entre "Fazer agora" e "Atendimentos"

## Contexto

Os cards de lead das telas **"Fazer agora"** (condução/pipeline) e **"Atendimentos"**
tinham estruturas visuais diferentes:

- **Atendimentos** (`.cp788-att-row`): **barra colorida verde** na lateral esquerda do card,
  **fonte do título maior** (18px, 17px no mobile), 1 linha de texto (contexto: produto).
- **Fazer agora** (`.ui-priority-row`): **sem barra lateral**, **fonte do título menor**
  (14px), 2 linhas de texto (situação + próxima ação).

O dono pediu para unificar **adotando o padrão de "Fazer agora" como base**.

## O que mudou (só `styles.css`)

- **Removida a barra lateral verde** de Atendimentos: apagada a regra
  `.cp788-att-row:before` (que desenhava a faixa `#68ff95` de 4px na esquerda). Junto, o
  recuo que existia só pra acomodar a barra saiu — o `padding` da linha ficou simétrico
  (`12px` no desktop, `11px 8px` no mobile), no lugar do antigo `… 12px 18px` / `… 11px 17px`.
- **Fonte do título igualada**: `.cp788-att-copy strong` passou de **18px → 14px** (desktop)
  e **17px → 14px** (mobile), batendo com o título de "Fazer agora" (`.ui-row-copy strong` = 14px).

## O que **não** mudou (de propósito)

- A diferença de **1 linha (Atendimentos) vs. 2 linhas (Fazer agora)** foi mantida — é
  conteúdo diferente, não estilo: Atendimentos não tem "próxima ação" porque o lead já foi
  resolvido.
- O **verde continua existindo só na etiqueta de status "Atendido há X min"**
  (`.cp788-att-time`), não no card — exatamente como pedido.
- Nenhuma mudança em `app.js` (a estrutura HTML dos dois cards já servia; só o CSS diferia).

## Verificação

- Novo teste-guarda `v863-cards-padronizados`: confere que a barra
  (`.cp788-att-row:before`) sumiu, que o título das duas telas tem o **mesmo** tamanho de
  fonte (14px), e que o verde `#68ff95` continua **só** na etiqueta `.cp788-att-time` (não
  no `.cp788-att-row`).
- `npm test`: suíte completa verde.
