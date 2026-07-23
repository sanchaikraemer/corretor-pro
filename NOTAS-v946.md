# v946 — ranking explicável: mostra por que o lead está no topo do "Fazer agora"

## O problema de fundo

Um diagnóstico completo do produto (análise de IA/pipeline, sugestões de mensagem, Cérebro e
UX, feita nesta sessão) apontou uma causa-raiz por trás do retrabalho recorrente no ranking do
"Fazer agora": o dono via a ordem da fila e achava "errada" (Henrique v943, Fábio v944, Mariana
v941, Sara v942) porque o motivo da priorização era uma caixa-preta — `cpProbabilidadeFechamento`
soma cinco fatores com pesos calibrados, mas o corretor só via o resultado (a posição na fila),
nunca o "porquê". Cada correção anterior tratou um caso real; esta v946 ataca o padrão: torna o
raciocínio da IA visível, pra parar o ciclo de "a ordem tá errada de novo".

## O que mudou

**Duas funções novas, `cpFatoresRankingLead(l)` e `cpMotivoFechamento(l)`** (`app.js`, logo depois
de `cpFilaFazerAgora`). Elas espelham os MESMOS fatores de `cpProbabilidadeFechamento` (recorrência
`l.clientMessageDays`, perguntas `l.clientQuestionCount`, sinal de negociação via
`contextoPrioridadeIA`, e o bônus "cliente esperando você" com a checagem anti-despedida da v944
via `ui670UltimaMensagemReal`) — mas em vez de somar um score, montam uma frase curta com as razões
que de fato contribuíram. Deliberadamente **duplicado**, não fatorado num helper comum: o corpo de
`cpProbabilidadeFechamento` é travado por regex nos testes v943/v944 (eles extraem a função inteira
e checam substrings literais nela); chamar uma função nova de dentro dela quebraria esses testes.
`cpProbabilidadeFechamento` continua 100% intocada.

**A frase NUNCA cita a contagem bruta de mensagens.** É a decisão de design mais importante desta
versão: mensagens é justamente o fator que tem peso baixo de propósito (pra um lead "explosão de
mensagens" tipo Henrique, 218 msgs, não vencer sozinho) — mostrá-lo como "motivo" recriaria
exatamente a confusão que a v943/v944 corrigiram. `cpMotivoFechamento` só cita: negociação avançada
(se houver proposta/retorno em aberto), "cliente esperando sua resposta" (mesma regra anti-despedida
da v944), recorrência (só se voltou a falar em ≥2 dias diferentes) e perguntas (se fez ≥1). Máximo
3 razões, separadas por " · ". Sem nenhum fator real aplicável, a frase é vazia — nunca inventa
motivo (mesma regra do projeto pra qualquer dado comercial).

**Dois lugares mostram o motivo:**
1. **Lista "Hoje" da Home** (`cpHomeLeadRow`): quando há motivo, a linha ganha um atributo
   `data-exp="1"` no `<button>` e um `<span class="chr-exp">` depois do `chr-dd`, virando uma
   2ª linha via uma nova regra CSS `.cp-hoje-row[data-exp="1"]{grid-template-areas:...}` (desktop
   e mobile). Linhas sem motivo mantêm a altura original de 1 linha — nada muda pra elas. O
   atributo `data-exp` (em vez de uma classe modificadora tipo `chr-has-exp` na própria `class`)
   foi escolhido de propósito pra não tocar na substring literal `class="cp-hoje-row"` que o
   teste v942 trava.
2. **Card "Fazer agora" do detalhe do lead** (`renderLeadFoco`): o mesmo motivo aparece como
   `<div class="cp704-metaline">`, reaproveitando a classe já usada para "Última análise"/"Última
   mensagem" — sem CSS novo ali.

## Verificação visual real (não só testes)

Como é mudança de UI, rodei o HTML+CSS gerado de verdade num Chromium headless (não o app inteiro,
que precisa de Supabase — sem acesso nesta sessão): screenshots em 900px (desktop) e 375px
(mobile) confirmaram que linhas sem motivo ficam com a altura original e linhas com motivo ganham
a 2ª linha sem cortar. **Achado incidental, não relacionado**: um bug pré-existente no mobile
(`.chr-bar`/`.chr-pr` já se sobrepunham com produto + contagem de mensagens longos, ANTES desta
mudança — confirmado com uma linha de controle idêntica sem `data-exp`, que reproduz o mesmo
problema). Fora do escopo desta versão, não foi mexido; provável causa é a falta de `min-width:0`
no `.chr-bar` dentro de uma coluna `minmax(0,1fr)` — fica registrado aqui pra uma sessão futura.

## Verificação

- `tests/v946-ranking-explicavel.test.mjs` (novo): confere que as funções novas usam os mesmos
  campos/condições de `cpProbabilidadeFechamento` (inclusive a regra anti-despedida da v944);
  que `cpProbabilidadeFechamento` continua intocada; os casos reais de calibragem (Henrique sem
  motivo, lead qualificado com motivo rico sem citar a contagem de mensagens, despedida vs.
  pergunta real); robustez contra lead nulo/vazio/NaN/negativo; o HTML condicional de
  `cpHomeLeadRow` (com e sem motivo, ordem `chr-nm→chr-pr→chr-dd` preservada, classe
  `cp-hoje-row` intacta); as novas regras CSS aditivas; e a integração no card de detalhe.
- Suíte inteira verde (`npm test`); `node build.js` OK, versão 946.

## Arquivos
- `app.js` (`cpFatoresRankingLead`, `cpMotivoFechamento` — novas; `cpHomeLeadRow` e CSS inline de
  `renderBotoesHome` — novo atributo `data-exp`/span `chr-exp`; `renderLeadFoco` — nova
  `cp704-metaline` com o motivo), `tests/v946-ranking-explicavel.test.mjs` (novo),
  `package.json`/`package-lock.json`, `NOTAS-v946.md`, versão **945 → 946**.
