# v1192 — o app deixou de ficar preso na tela de importação, e os leads voltaram pra fila do dia

Duas correções urgentes, as duas relatadas pelo dono com print. Uma é um defeito antigo que só
apareceu agora; a outra é um exagero meu na v1190.

## 1. O app ficava preso numa tela de importação que nunca terminava

Palavras dele: *"eu só atualizo a página e vai pra essa merda de tela"*. Estava certo, e era grave.

O que aconteceu, na ordem:

1. O WhatsApp compartilhou um ZIP **de 0 byte** (o diagnóstico do próprio app mostrava:
   `Conversa do WhatsApp com Lidi Müller NVRIII.zip (application/zip, 0.00 MB)`).
2. O service worker gravou esse vazio como pendente e **redirecionou como se tivesse dado certo**,
   para `/?source=share-target&shared=1&shareId=...`.
3. O app entrou no modo importação, esperou 15 segundos por um conteúdo que não existia e mostrou
   *"o arquivo ainda não apareceu... toque em Tentar recuperar"*.

Três defeitos empilhados, e o terceiro é o que prendia o app:

- **O endereço continuava com `?shared=1&shareId=...`** — e é justamente ele que faz o app entrar
  no modo importação. Resultado: **toda atualização de página e toda reabertura do app caíam na
  mesma tela travada**, sem nenhuma saída pela tela. O app ficava inutilizável até alguém saber
  limpar o endereço na mão.
- **O único botão era "Tentar recuperar"** — que, com um arquivo vazio, nunca teria como funcionar.
- **O texto culpava o armazenamento do app** ("ainda não apareceu"), quando o que houve foi o
  WhatsApp entregar um arquivo vazio. Diagnóstico errado manda o dono pro caminho errado.

### O que mudou

- **O endereço é limpo na hora**, antes mesmo de desenhar o aviso. Atualizar a página volta pro app
  normal. Essa é a correção principal.
- **Botão "Voltar ao app"**, sempre. A saída que faltava.
- **Arquivo vazio tem texto próprio e honesto**: "O WhatsApp mandou o arquivo vazio (0 KB)... não é
  o Corretor Pro que perdeu a conversa, ela não chegou", com a frase que mais importa em primeiro
  plano — **"Nenhum lead seu foi alterado"**. Nesse caso o "Tentar recuperar" **nem aparece**:
  botão que só pode falhar não deve existir.
- **O service worker recusa arquivo vazio na origem**, antes de gravar qualquer coisa, com motivo
  próprio (`erro=arquivo-vazio`). Assim não sobra registro pendente vazio no aparelho.

## 2. Os leads voltaram pra fila do dia

A v1190 tirou, junto com a inferência proibida, um trecho que **não** era a mesma coisa — e o dono
sentiu na hora ("cadê mais leads?"). Devolvido.

A diferença entre os dois casos, que a v1190 não fez:

- **O nível 1 do motor de prioridade** AFIRMAVA uma pendência na tela ("cliente esperando sua
  resposta") e **furava o descanso de um lead JÁ ATENDIDO**. Isso continua removido e não volta —
  era o problema de verdade, o que o dono mandou tirar em v1158 e v1189.
- **A liberação antecipada de `entraEmRetomada`** não tem nada disso: ela só roda quando **não
  existe nenhum atendimento marcado** naquele lead (a checagem logo acima garante isso). Não há
  descanso pra furar, nada é afirmado na tela — é só "vale um toque hoje?". Segurar por 5 dias um
  lead novo que fez uma pergunta é perder venda, não evitar ruído.

Voltou como era: entra se o cliente fez uma **pergunta de verdade** — despedida ("Obrigada",
"Claro") continua não valendo, que é o achado original da v944. Na prática, o cartão
**"Fazer agora" volta a contar esses leads no mesmo dia**.

A trava sistêmica da v1190 foi ajustada pra permitir exatamente esse uso e mais nenhum: o teste
falha se `ultimaMsgClientePedeResposta` aparecer em qualquer outro lugar além de `entraEmRetomada`.

## Verificação

- `npm test` — **362 testes verdes**, 24 arquivos checados.
- `npm run build` — 28 arquivos publicados, versão 1192.
- **Reproduzido e conferido no navegador** (Chromium, app publicado, tela de celular 390×844):
  - abrindo o app com o endereço envenenado (`?shared=1&shareId=...`), o aviso aparece, **o
    endereço fica limpo** e **atualizar a página abre o app normal** — a tela de importação some;
  - com um registro de 0 byte semeado no aparelho (o caso exato do dono), aparece o texto do
    arquivo vazio, **sem** o botão "Tentar recuperar", e o "Voltar ao app" leva pra Home;
  - sem erro de página e sem estouro de largura no celular.
- Teste novo: `tests/v1192-share-falho-nao-prende-o-app.test.mjs` — trava a limpeza do endereço
  (inclusive a ordem: limpar antes de desenhar), a existência da saída, o texto do arquivo vazio,
  a ausência do botão inútil e a recusa do vazio pelo service worker antes de gravar.
- Testes ajustados: `v944` e `v1017` (voltaram a exigir a liberação antecipada, agora só com
  pergunta) e `v1190-cliente-esperando-nao-existe-em-lugar-nenhum` (permite o uso em
  `entraEmRetomada` e proíbe em qualquer outro lugar).
