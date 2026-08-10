# v1204 — as três sugestões podem convergir para o mesmo próximo passo (fim da briga com o Cérebro)

## O que aconteceu

O dono trouxe o documento novo do Cérebro Comercial (Corretor Pro | Cérebro Comercial V3 —
Revisado, 10/08/2026), com os 6 blocos prontos pra colar nas 6 caixas da Inteligência Comercial,
e pediu uma avaliação antes de usar. Na leitura comparada com o que o sistema já manda pra IA
apareceu uma contradição direta — a única do documento inteiro.

O documento diz, em dois lugares (Método, item 11; Regras comerciais, item 21):

> As três devem nascer da mesma verdade factual e ter ângulos comerciais diferentes. Não invente
> um próximo passo pior apenas para diferenciá-las. Se existir objetivamente um único próximo
> passo adequado, as três podem convergir para ele por caminhos diferentes.

E o pedido fixo da análise (`api/_pipeline.js`, o texto que vai em TODA execução, fora do Cérebro,
e que o corretor não vê nem edita) dizia o contrário, com todas as letras:

> AS TRÊS MENSAGENS PRECISAM SER TRÊS CAMINHOS DIFERENTES (...) Cada uma segue uma estratégia
> distinta, com um próximo passo diferente (...) Se as três acabarem propondo a MESMA ação,
> reescreva até virarem três caminhos realmente distintos.

As duas instruções chegavam juntas, na mesma chamada, e se contradiziam. O prompt de sistema diz
que o Cérebro é "a única autoridade sobre análise, estratégia e criação das mensagens", mas a
ordem contrária estava escrita de forma muito mais insistente no pedido — resultado imprevisível
de análise pra análise. E, no pior caso, o efeito era exatamente o que a regra 21 proíbe: quando
só existia um próximo passo honesto (ex.: o cliente acabou de autorizar o envio da simulação),
a IA era obrigada a inventar um terceiro passo pior, prematuro ou artificial só pra diferenciar
a mensagem.

Havia ainda uma segunda contradição, menor, na mesma família: a regra 20 do documento diz que a
DIRETA "conduz para avanço concreto **somente quando a maturidade real da conversa permitir**",
enquanto o pedido fixo exigia sempre "UM próximo passo concreto e um convite claro" (visita,
ligação, proposta) — ou seja, empurrava avanço mesmo em conversa que ainda não amadureceu.

## Correção (só no pedido fixo — o Cérebro do corretor não foi tocado)

Em `api/_pipeline.js`, no pedido da análise:

- A exigência passou de "três **caminhos** diferentes" para "três **ângulos comerciais**
  diferentes". Continua proibido devolver a mesma ideia reescrita 3 vezes.
- Próximos passos diferentes continuam sendo **o padrão**, e a ordem de reescrever continua
  valendo quando as três repetem a mesma pergunta de sempre ("quer que eu te mande as
  propostas?").
- **Exceção nova, explícita**: quando existir objetivamente um único próximo passo adequado
  naquele momento, as três podem convergir para ele, cada uma chegando lá por um caminho e um
  enquadramento diferentes.
- **Proibição nova**: nunca inventar um próximo passo pior, prematuro ou artificial só pra
  diferenciar as mensagens — diferença forçada que não serve ao cliente é pior que convergência
  honesta.
- "maisDireta" deixou de exigir avanço concreto em conversa imatura: quando não houver maturidade
  pra visita/proposta/decisão, ela vira a versão mais objetiva e direta do passo que É adequado
  agora.

Nada foi mexido no conteúdo do Cérebro, nas caixas da tela, no banco, nas rotas ou em qualquer
tela do app. Nenhuma informação comercial foi cravada no código.

## Testes

- Novo: `tests/v1204-tres-mensagens-podem-convergir.test.mjs` — roda uma análise com a IA
  simulada, captura o pedido que realmente foi enviado e confere que a ordem antiga e absoluta
  ("reescreva até virarem três caminhos realmente distintos") sumiu, que a exceção de convergência
  está escrita, que a proibição de inventar passo pior está escrita, que ângulos diferentes
  continuam sendo o padrão e que a "maisDireta" respeita a maturidade da conversa.
- Atualizado: `tests/v865-mensagens-distintas.test.mjs` — o guard que travava a redação antiga
  passou a travar a redação nova. A intenção original da v865 (impedir a mesma ideia reescrita 3
  vezes) continua sendo verificada, agora sem exigir três próximos passos diferentes em qualquer
  situação.
- `npm test`: 24 arquivos checados + 372 testes, todos verdes.

Sem verificação visual em navegador nesta atualização: a mudança é só no texto que o sistema manda
pra IA — nenhum arquivo de tela (`index.html`, `styles.css`, layout) foi tocado.

Não há criação de tabela, coluna ou função nova no Supabase nesta atualização.

## O que ficou pro dono fazer

Colar os 6 blocos do documento V3 nas 6 caixas do Cérebro. Sugestões de ajuste no texto dele que
foram passadas junto (não dependem de código): deixar claro no item 8 do Método que "ignore
avisos automáticos e eventos operacionais" vale pra contagem do tempo e não anula as observações
que ele registra à mão no lead; prever no Tom de voz o caso de a mensagem ser enviada horas depois
da análise (saudação de período); enxugar as repetições entre "O que evitar", "Método" e "Regras
comerciais"; e acrescentar duas linhas que faltam — transcrição de áudio pode ter erro (não tratar
palavra estranha como fato) e um limite concreto de tamanho de mensagem.
