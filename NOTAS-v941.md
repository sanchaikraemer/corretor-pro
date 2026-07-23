# v941 — "Negociação aguardando você" furava a janela de espera normal

## O bug (achado pelo dono, mesmo lead da v938/v939 — Mariana)

Depois da v938/v939 (corrigir `cpFilaFazerAgora`/"Puxar da fila"), a Mariana AINDA aparecia como
**hero da Home** ("PRIORIDADE AGORA") — mesmo tendo sido contatada ONTEM e ainda dentro do prazo
normal de resposta ("ontem de contato" / "ontem sem resposta" na própria tela). O dono, com
razão: "já falamos sobre isso e você não resolveu".

## Por que a v938/v939 não bastou

A v938/v939 corrigiu `cpFilaFazerAgora` — usada por "Puxar da fila"/"Atender +1"/a contagem do
card "Fazer agora". Mas o **hero principal da Home** (o card grande "PRIORIDADE AGORA" que
aparece direto, sem precisar clicar em nada) vem de uma função TOTALMENTE DIFERENTE:
`prioridadeAtendimento`/`filaPorFatos` — o sistema de "fila por fatos" da v826. Eu tinha corrigido
um lugar e não o outro.

## Causa raiz

`filaPorFatos` decide a prioridade por uma cadeia de fatos, em ordem de precedência. Um desses
fatos, `negociacaoAguardando`, vem de um **regex sobre o TEXTO da análise da IA** (bate palavras
como "proposta", "condição", "contraproposta", "retorno...proposta") — um sinal FUZZY que
dispara fácil demais, porque praticamente toda negociação de imóvel usa esse vocabulário. Esse
sinal era checado **ANTES** de `emJanela` (o fato concreto — "eu contatei há N dias, ainda dentro
do prazo normal de 3 ou 5 dias pra resposta") na cadeia de `if`s. Resultado: o sinal fuzzy furava
a proteção da janela de espera pra qualquer lead com negociação em andamento — ou seja, quase
todos.

## O que mudou

`filaPorFatos` (`app.js`) agora checa `emJanela` (fato concreto, com prazo) **antes** de
`negociacaoAguardando` (sinal fuzzy). Fatos concretos com data real
(`lembreteAtrasado`/`retornoParaHoje`/`compromissoProgramado`) continuam com prioridade sobre a
janela de espera, como já era — só o sinal fuzzy que passa a respeitar o prazo normal de
resposta.

## Verificação

- `tests/v941-negociacao-respeita-janela-espera.test.mjs` (novo): cobre o caso real (dentro da
  janela + sinal fuzzy → "pode-aguardar"; fora da janela → sinal fuzzy volta a valer; fatos
  concretos continuam vencendo a janela).
- `tests/v826-fila-fatos.test.mjs` atualizado: a precedência `negociacaoAguardando` ×
  `compromissoProgramado` mudou intencionalmente (fato concreto agora vence sinal fuzzy);
  comentário explica o porquê e aponta pro teste novo.
- Suíte inteira verde (`npm test`); `node build.js` OK, versão 941.

## Observação
Como a classificação usa dados já calculados (não depende de reanálise), o efeito é imediato
pra qualquer lead — não precisa reanalisar pra este fix valer.

## Arquivos
- `app.js` (`filaPorFatos`), `tests/v941-negociacao-respeita-janela-espera.test.mjs` (novo),
  `tests/v826-fila-fatos.test.mjs` (atualizado), `package.json`/`package-lock.json`,
  `NOTAS-v941.md`, versão **940 → 941**.
