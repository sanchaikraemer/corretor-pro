# v1224 — compartilhou a conversa? a primeira coisa na tela é a rodinha em 0%

Dono, 11/08/2026: *"Ainda aparece um frame assim, um flash de uma outra tela antes de começar a
importação. Quando eu vou exportar um lead, em vez de começar já do zero e ir crescendo a rodinha
ali do percentual, ele ainda mostra uma tela, um frame, uma coisa antes de começar, que dá a
impressão de ser erro. Então, quando exportar o cliente não pode ter nenhuma tela antes do
percentual que começa a crescer."*

## O que era

Quando o WhatsApp compartilha a conversa, o celular **abre o app do zero** num endereço especial
(`/?source=share-target&…`). Quem manda a tela cheia da importação aparecer é o `app.js` — e ele é
um **módulo**, o que significa que só começa a rodar **depois que a página inteira foi lida**.

Nesse intervalo o celular já pintou o app normal: a Home, o esqueleto cinza de "Carregando os
leads…", a faixa de instalar. Só então a importação tomava conta. Esse pedaço de segundo é o
"frame de outra tela" — e, como aparece e some sozinho, parece erro.

Não era um defeito recente: sempre foi assim. Só ficou visível agora que o resto do caminho está
limpo.

## O que mudou

A correção **não pode depender do `app.js`**, porque o problema é justamente o tempo até ele rodar.
Então:

1. Um script minúsculo no **`<head>`** — que roda **antes de qualquer pintura** — reconhece que a
   abertura veio do compartilhamento e marca a página.
2. O **CSS** dessa marca já mostra a tela cheia da importação **em 0%** e esconde o app atrás dela.
   Sem JavaScript, sem esperar nada: vale na primeira pintura.
3. Quando a importação de verdade assume, a marca sai e tudo segue como sempre.

A rodinha nasce em 0% no próprio HTML, então ela **cresce do zero** — que é exatamente o pedido.

### Três saídas, pra ninguém ficar preso numa tela de 0%

- A importação assumiu → a marca sai (é o caminho normal).
- Abertura comum do app (endereço antigo guardado, atalho reaberto) → a marca sai na hora.
- A conversa não chegou (o "recebedor" estava desligado, v1209) → a marca sai pra o **aviso**
  aparecer, em vez de ficar coberto.
- E, como rede de segurança, se nada disso acontecer em 8 segundos ela sai sozinha.

## Medição (Chromium, 412×915, rede lenta de celular, quadro a quadro, sobre `public/`)

| Abertura | Quadros | Com a tela cheia | **Com o app aparecendo** | 1º quadro |
|---|---|---|---|---|
| Compartilhando uma conversa | 69 | 68 | **0** | rodinha em **0%** |
| Abertura normal do app | 74 | 0 | 73 | app, como sempre |

Antes, o app aparecia nos primeiros quadros. Agora não aparece em nenhum.

## Arquivos alterados

- `index.html` — o script no `<head>` (com a rede de segurança de 8s).
- `styles.css` — as regras que mostram a rodinha e escondem o app enquanto a marca existir.
- `app.js` — a marca sai quando o app assume, na abertura comum e no aviso de conversa que não
  chegou.
- `tests/v1224-sem-frame-antes-da-rodinha.test.mjs` — guarda de que o script está **no head e antes
  do app.js** (é a ordem que faz a correção funcionar), de que o CSS não depende de JS, e das três
  saídas.
- `package.json` / `package-lock.json` — versão 1224.
