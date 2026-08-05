# v1139 — resgate diário configurável, régua única de 90 dias e adeus "Pular próximo"

A rodada nasceu de uma pergunta do dono ("por que cada um desses está na lista de prioridades?
quais critérios foram usados aí?") e terminou com três decisões aprovadas por ele — mais uma
sugestão descartada por ele mesmo, com razão.

## 1. Resgates por dia (novo campo do Cérebro)

Pedido literal: "pode deixar um número por dia para resgate configurável no cérebro — como tem
atendimento por dia, crie resgates por dia".

O problema: a ordem por probabilidade deixa quem tem conversa rica sempre em cima. Numa carteira
de 238 leads com meta de ~13/dia, lead de conversa curta afundava e nunca aparecia — o card "Sem
atender 30d+" (86 na tela do dono) só crescia. A promessa do produto ("o prazo vence e eu te aviso
de novo") não se cumpria pra cauda da carteira.

Como ficou:

- Dentro da própria dose do dia, as **últimas N vagas são de resgate**: vão pra quem está há mais
  tempo sem atendimento, na MESMA régua do card "Sem atender 30d+" (nunca contatado primeiro,
  depois o contato mais antigo — `cpUltimoContatoCorretorTs`).
- **N é do corretor**: campo "Resgates por dia" no Cérebro (0–20; **0 desliga**; padrão 2), ao
  lado de "Atendimentos por dia". Entra no sanitize do servidor (`clampResgatesDia`), no save da
  rota, no formulário e na sincronização inicial entre aparelhos (mudar o número em outro
  aparelho re-renderiza a Home, igual meta/descanso desde a v1066).
- **Ninguém entra por fora**: `cpAplicarResgatesNaFila` só REORDENA a fila elegível
  (`cpFilaFazerAgora`) — descanso, dias de atendimento e a cadência de quem nunca respondeu
  continuam decidindo quem PODE aparecer. Reordenar não muda contagens (saudação, card, sino).
- Home e a lista do card "Fazer agora" usam a mesma fila (`cpFilaFazerAgoraComResgates`) — as
  duas telas nunca divergem.
- Detalhe de forma: 0 é escolha VÁLIDA (desliga), então campo vazio nunca vira 0 à força — vazio
  cai no salvo/padrão (`cpLerResgatesDiaDoFormulario`; mesma pegadinha do `||` que já mordeu
  outros campos).

## 2. Régua única de 90 dias no ranking

A barrinha da Home conta mensagens dos últimos 90 dias (v1017), mas a ORDEM contava a conversa
inteira desde sempre. Foi exatamente isso que confundiu o dono na tela que abriu a rodada: lead
com barra "2" acima de lead com barra "36". Pior: papo de proposta de meses atrás pesava pra
sempre como negociação ativa (+35/+70 eternos, sem data).

Como ficou (`cpProbabilidadeFechamento`):

- Engajamento → `mensagensDoClienteRecente` (90 dias, a régua da barra).
- Recorrência/perguntas → `clientMessageDays90d`/`clientQuestionCount90d`, calculados no servidor
  **na mesma varredura** do `_statsCache` (sem custo extra), gravados no cache e enviados na
  lista.
- Sinal de negociação (vem de TEXTO da análise, sem data própria) usa a última fala do cliente
  como relógio: cliente calado há mais de 90 dias = negociação fria, não soma.
- **Fallback honesto**: cache gravado antes desta versão não tem os campos novos — o app cai nos
  totais históricos (comportamento anterior). Como o cache vence na virada do dia, em no máximo
  um dia todos os leads passam pra régua nova, sem forçar varredura geral no meio do dia (por
  isso o cache continua `v: 3`, sem bump).
- Quem esfriou **não some** — o caminho de volta é o resgate diário (item 1). `leadsEsquecidos` e
  elegibilidade continuam com histórico inteiro, de propósito (reconhecer lead antigo precisa do
  total — lição da v942, quando a janela de 90 dias zerou a barra da "Sara" e pareceu bug).

## 3. "Pular próximo" removido

Palavras do dono: "nunca pulei ninguém pra falar a verdade, tô até achando isso obsoleto e
desnecessário e nada usual (empurrar atendimento pra frente é coisa de preguiçoso)". Saíram o
botão, `pularProximo()`, `state.pulados`, a reordenação por sessão na Home e o CSS órfão
(`.seq-link`/`.home-saud-acoes`). Menos uma peça pra manter.

## Sugestão descartada (registro pra ninguém reviver)

A sugestão nº 1 da conversa ("cliente que responde durante o descanso volta pra fila na hora da
importação") foi **descartada pelo dono com um fato do fluxo real**: ele SEMPRE atende no ato da
importação — "nunca será importado e ficar em descanso, isso não tem nem coerência". O ciclo é:
cliente responde → importa e atende junto → descanso → venceu sem resposta, a fila cobra de novo.
Não existe o caso que a sugestão resolvia. Não reimplementar.

## Arquivos

- `app.js` — resgate (novas `cpResgatesPorDia`/`cpAplicarResgatesNaFila`/
  `cpFilaFazerAgoraComResgates` + Home/lista usam), régua 90d no ranking, remoção do pular,
  plumbing do campo novo (sanitize, form, salvar, zerar, sync).
- `api/cerebro-config.js` — `resgatesPorDia` (DEFAULTS, `clampResgatesDia`, sanitize, save).
- `api/_persistence.js` — `clientMessageDays90d`/`clientQuestionCount90d` na varredura, no
  `_statsCache` e na resposta da lista (null quando o cache é antigo → app usa fallback).
- `index.html` — campo "Resgates por dia" no Cérebro.
- `styles.css` — CSS do botão removido.
- Testes: novo `tests/v1139-resgates-por-dia-e-regua-90-dias.test.mjs`; atualizados por âncora ou
  comportamento novo: v905 (a div de ações da saudação sumiu com o último botão), v925/v926/v1093
  (marcadores da Home), comentário da v925 em `app.js` reescrito sem o texto que o guarda da v933
  proíbe no trecho da Home.

## Conferido

- Suíte completa: **313 testes verdes** (312 + o novo arquivo).
- Visual no Chromium headless: Home sem o botão "Pular próximo"; Cérebro com o campo "Resgates
  por dia" (0–20, padrão 2).
