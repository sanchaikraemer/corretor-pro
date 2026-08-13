# v1252 — tela Hoje do celular limpa: sai o botão de enviar conversa e sai a legenda da lista

Pedido direto do dono, com um print do celular e as duas coisas circuladas de vermelho:

> "tire isso daí no Mobile onde circulei"
>
> "o botão de importar que já falei mil vez que não precisa aí nem aquela legenda fora de contexto
> que não dá pra entender nada"

As duas ocupavam espaço no alto da tela Hoje — justamente onde os clientes do dia deveriam
aparecer sem precisar rolar.

## O que mudou na tela

| Onde | Antes | Agora |
|---|---|---|
| Alto da tela Hoje (celular) | Faixa larga "⇪ Enviar conversa do WhatsApp" logo abaixo do título | **Não existe mais** |
| Acima da lista de clientes (celular) | "Barra/número: mensagens do cliente (90 dias). 'há Xd': dias sem contato." | **Não aparece mais** |
| Acima da lista de clientes (computador) | Mesma frase | **Continua igual** |

No celular, a busca "Buscar lead..." agora vem direto e a lista de clientes começa logo em
seguida — os clientes sobem na tela e cabem mais deles antes de rolar.

## Por que a legenda ficou no computador

Ela foi criada na v1203 porque o próprio dono não lembrava mais o que a barrinha e o "há Xd"
significavam. No computador ela cabe em **uma linha só**, colada na lista que explica, e não custa
espaço nenhum. No celular era o contrário: virava um texto solto entre a busca e a lista, longe do
que explicava — "fora de contexto", nas palavras dele. Então ela sai do celular e fica no
computador.

A explicação detalhada continua existindo pra quem passa o mouse em cada linha (no computador),
como sempre foi.

## Por onde enviar a conversa agora, no celular

O caminho continua existindo, só não ocupa mais o alto da tela Hoje:

- Barra de baixo → **Mais** → cartão **"Enviar conversa"**.

No computador nada mudou: o item **"Enviar conversa"** segue no menu da esquerda (criado na v1248
e mantido).

## Conferência antes de publicar

Além da suíte verde, o app publicado foi aberto num navegador de verdade em **390×844** (celular) e
**1280×900** (computador), com clientes de teste na lista:

- Celular: o botão não existe mais e a legenda está com `display: none` — a lista começa logo
  abaixo da busca.
- Computador: a legenda continua visível (`display: block`), em uma linha, acima da lista.

## Testes

- **Novo:** `tests/v1252-hoje-sem-botao-e-sem-legenda.test.mjs` — trava que o botão não volte pra
  tela Hoje (nem a marcação, nem o estilo órfão), que o caminho pelo Menu continue existindo, e que
  a legenda suma na mesma largura que o app inteiro trata como celular (999px).
- **Ajustados:** `v1248-caminho-curto-e-versao-visivel` e `v1249-a-conversa-e-enviada-nunca-importada`
  — os dois travavam a existência do botão do celular criado na v1248; a parte do computador (item
  do menu da esquerda, vocabulário, ícone de enviar) continua trancada igual.
- `v1203-legenda-da-barra-e-dos-dias-na-home` segue valendo sem mudança: a legenda continua no app,
  só não aparece no celular.
