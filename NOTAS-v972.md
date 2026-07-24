# v972 — clareza na fila "Fazer agora" da Home: 4 achados do dono num print de produção

## O pedido do dono

Print real da Home em produção (`corretor-pro-zeta.vercel.app`), pergunta direta: "o q vc percebe
e nota q esta ruim logo na tela inicial?". Depois de uma auditoria (sem mexer em código),
4 problemas concretos foram confirmados no código-fonte e o dono pediu correção imediata dos 4.

## Os 4 achados e o que mudou

### 1. O número mais chamativo da linha não bate com a ordem da fila

`cpBarraMensagensMini` mostra a contagem BRUTA de mensagens do cliente — um lead podia aparecer
com "62" e estar abaixo, na lista, de um lead com "55" ou "50". Isso é esperado (v943/v944
baixaram de propósito o peso do volume de mensagens no ranking — "Henrique" tinha 218 mensagens e
não podia liderar só por isso), mas a TELA nunca comunicou isso: o número mais bold e colorido da
linha parecia "a nota", e não era.

**Não mexemos em `cpBarraMensagensMini`** (travada bit-a-bit pelos testes v942/v943 — limiares de
cor e proporção da barra são decisão explícita e testada do dono). Em vez disso, `cpHomeLeadRow`
ganhou um badge de posição (`chr-rank`, "1º"/"2º"/...) usando o `pos` que a função já recebia e
nunca exibia — esse número É a ordem real (`cpFilaFazerAgora` já ordena por
`cpProbabilidadeFechamento`), então nunca pode contradizer a lista. Tom neutro (`--muted`) de
propósito, pra não competir com o coral do resto da linha.

### 2. "Xd" sem rótulo, ambíguo do lado de "cliente esperando sua resposta"

`daysSinceLastInteraction` conta dias desde a última interação de QUALQUER lado (não
necessariamente há quanto tempo o cliente espera) — mas aparecia como número solto ("78d"),
convidando a leitura errada. Ganhou prefixo "há" no texto visível e `title` que explica o que é de
fato, mudando a frase conforme o dot já indica ("cliente esperando sua resposta há Xd" quando
`nivel===1`; "Xd desde a última interação, sua ou do cliente" caso contrário). O cálculo do dado
em si não mudou.

### 3. Motivo parece frase idêntica quando vários leads do topo batem os mesmos fatores

`propostaAtiva`/`retornoProposta` (+35) e `clienteEsperaVoce` (+30) pesam tanto na fórmula que é
comum vários dos primeiros lugares da fila compartilharem os 2 primeiros motivos — o texto real
(gerado por `cpMotivoFechamento`) já varia no número de recorrência/perguntas, mas essa diferença
passava despercebida visualmente. `cpHomeLeadRow` agora embrulha os dígitos do motivo renderizado
em `<b>` com sublinhado, pra esse número saltar aos olhos ao escanear a lista.
**`cpMotivoFechamento` não foi tocada** — o texto que ela devolve é travado por regex no teste
v946; o destaque é só de apresentação, aplicado depois.

### 4. Lista de produtos corta no meio da palavra sem jeito de ver o texto completo

`produtosLabel` sempre devolveu a lista completa; o corte é só visual (`text-overflow:ellipsis`
em `.chr-pr`), mas sem `title` não tinha como o corretor ver o que ficou de fora. Adicionado
`title` com o texto completo no span.

## O que foi considerado e DELIBERADAMENTE NÃO mudado

A auditoria original também apontou "vermelho/coral em quase tudo reduz a hierarquia visual"
(cor da barra de mensagens + cor do motivo). Investigando o histórico: a cor do motivo
(`--accent`, coral) foi decisão EXPLÍCITA do dono na v949, corrigindo a v948 que tinha usado
`--cyan` — "não gostei da cor, tá fora da paleta e identidade visual" — e está travada por
asserção literal no teste v946. Recolorir isso de novo repetiria um erro já corrigido uma vez.
O badge de posição (achado 1) resolve o problema de fundo (falta de um número confiável pra
ancorar o olho) sem reabrir essa decisão. Comentários foram adicionados no código
(`cpBarraMensagensMini`, `cpHomeLeadRow`) deixando esse histórico explícito, pra nenhuma sessão
futura "corrigir" a cor sem perceber que já foi discutido.

## Verificação

- `tests/v972-clareza-fila-hoje.test.mjs` (novo): cobre os 4 ajustes — badge de posição presente
  mesmo sem motivo e independente da contagem de mensagens, título/rótulo do contador de dias
  variando por `nivel`, dígitos do motivo em negrito no HTML renderizado (sem alterar
  `cpMotivoFechamento`), `title` do produto com o texto completo, e reconfirma que
  `cpBarraMensagensMini` continua bit-a-bit igual (limiares/proporção intocados).
- Suíte inteira verde (`npm test`), incluindo v942/v943/v944/v946 (as travadas pelas funções
  mexidas).

## Arquivos

- `app.js` (`cpBarraMensagensMini` — só comentário; `cpHomeLeadRow` — badge de posição, rótulo de
  dias, destaque dos números do motivo, title do produto; CSS `.chr-rank` e `.chr-exp b`),
  `tests/v972-clareza-fila-hoje.test.mjs` (novo), `package.json`/`package-lock.json`,
  `NOTAS-v972.md`, versão **971 → 972**.
