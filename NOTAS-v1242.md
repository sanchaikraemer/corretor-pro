# NOTAS v1242 — as três suspeitas que ficaram sem prova. Eram todas reais.

Data: 13/08/2026. Na v1241 eu escrevi *"fica pra próxima rodada"* sobre três achados que a
auditoria automática levantou mas ninguém verificou (22 dos 30 revisores morreram por limite de
sessão). O dono respondeu: **"faça agora!"**.

Conferidas uma a uma. **As três eram reais**, e duas delas piores do que a descrição sugeria.

## 1. Observação ditada continuava viva depois de apagada

Apagar uma observação tirava ela do histórico, mas **não** do texto de observações guardado na
memória do lead — e essa memória **aparece na tela** (na busca e no detalhe do cliente).

O motivo é fino e o efeito é grande: o corte comparava **linha a linha** com o bloco inteiro
`[data hora] texto`. Isso só casa quando o texto cabe numa linha só. **Ditado quebra linha o tempo
todo** — que é justamente como o dono registra observação. Com duas linhas, nunca casava.

Agora os blocos são separados pelo carimbo `[dd/mm/aaaa hh:mm]`, não por linha: a observação sai
inteira, com parágrafos e tudo. As outras não são tocadas.

## 2. O aviso de "aguardar" sumia da tela

A análise marca `recomendacaoContato.aguardar` quando o cliente pediu espaço, e a tela usa isso pra
avisar *"ainda não é hora de mandar mensagem"*, com o motivo. Esse campo **não viajava junto da
carteira** — só chegava quando o detalhe completo do cliente terminava de carregar.

Ou seja: nos primeiros segundos depois de abrir o cliente, o aviso não existia. É exatamente o
aviso que evita mandar mensagem em quem pediu para não ser incomodado.

## 3. Um pedido em voo ressuscitava a observação apagada

Ao apagar, o sistema limpa o que estava guardado daquele cliente. Mas um pedido de detalhe que já
**tinha saído antes** continuava correndo com o dado velho na mão e, ao chegar, **gravava o dado
velho de volta** — a observação apagada voltava e ficava lá pelo tempo de vida do cache.

Agora cada cliente tem um número de geração: apagar avança o número, e uma resposta que voltou
depois disso é entregue a quem pediu mas **não é guardada**. O que foi apagado não volta.

## Validação

- Versão: `7.1242.0` / exibida **1242**.
- Novo teste `tests/v1242-tres-suspeitas-confirmadas.test.mjs`. O primeiro caso roda a rota **de
  verdade** contra um banco simulado, com uma observação ditada em três linhas — o caso real.
- **O teste foi conferido contra o código ANTIGO e falha lá.** Não é teste que passa de qualquer
  jeito: ele prova os três defeitos.
- `npm test` inteiro verde (407 testes).
