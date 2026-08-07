# v1169 — painel administrativo mais discreto (o dono viu no ar e achou ainda gritante)

Retoque direto na v1168, publicada minutos antes: o dono abriu o painel de verdade e disse
"deixe esses botões menos coloridos e gritantes e menores".

## O que mudou

A v1168 tinha corrigido a HIERARQUIA (a cor certa pra ação certa), mas manteve fundo tingido +
texto na cor cheia em toda ação, de toda linha — numa lista com várias contas, isso empilhava
muitos blocos coloridos e pesava na tela.

Reduzido ao mínimo que ainda separa uma ação da outra:

- **Fundo neutro** em tudo (o mesmo cinza do "+7 dias teste", que já era discreto).
- **"Pago · Pro" / "Pago · Pro Master" / "Bloquear"** perderam o preenchimento e o texto colorido
  — sobrou só uma **bolinha** antes do texto (verde/âmbar), a mesma linguagem que a pílula de
  status já usa (`.pill::before`).
- **"Excluir"** é a exceção de propósito: continua com texto e ícone vermelhos, sem preenchimento
  tingido. É a única ação irreversível — essa precisa continuar pulando aos olhos.
- Botões **menores**: `padding:5px 10px` e `font-size:11px` (era `7px 13px` / `12px`).

## Arquivos

- `contas-estilo.css` — `.acoes-linha .pequeno`, `.btn-plano`/`.btn-atencao` (viraram `::before` +
  `:hover`, não mais fundo tingido), `.btn-perigo` (mantém cor, perde o fundo).
- `tests/v1168-painel-admin-sino-e-agenda-hoje.test.mjs` — as três classes continuam obrigatórias
  e distinguíveis; a checagem de "três cores de texto diferentes" (que descrevia o desenho antigo)
  virou checagem do desenho novo: bolinha verde/âmbar nas duas primeiras, texto vermelho mantido
  só no Excluir.

## Conferência

- `npm test`: 24 arquivos + **335 testes**, verdes.
- Chromium headless, painel publicado com 3 contas em estágios diferentes (7 dias / vencido /
  ativa com plano): botões neutros e pequenos, bolinha colorida visível, Excluir em vermelho,
  zero erro de JavaScript.

## Sobre a segunda pergunta da mesma mensagem

"Tem como saber quanto cada um está usando de API?" — **já existe**, um pouco mais abaixo na
mesma tela: a seção **"Uso de IA por empresa"**, com chamadas e custo estimado por conta, hoje e
nos últimos 30 dias (não é nota fiscal, é estimativa). Não precisou de código novo — só avisar
onde já está.
