# v1222 — analisa sempre, mas relê só o que ainda não foi analisado

Dono, 11/08/2026: *"Tem que fazer análise somente do que já não está no histórico, preste bem
atenção, são duas coisas distintas. Não quero que faça análise inteira, senão vou perder dinheiro
com retrabalho e reanálise. Agora, se eu fizer uma importação, que as conversas forem diferentes,
você tem que sim fazer a reanálise. Agora, se as conversas forem a mesma, eu também quero que você
faça uma reanálise porque o prompt pode ter mudado."*

**São duas coisas distintas, e o sistema estava tratando como uma só.** A v1221 acertou a
primeira e piorou a segunda: passou a analisar sempre — relendo a conversa inteira toda vez.

| | Antes da v1221 | v1221 | **Agora (v1222)** |
|---|---|---|---|
| **Quando** analisa | só se tinha mensagem nova | sempre | **sempre** (inclusive sem mensagem nova) |
| **O que** relê (e paga) | conversa inteira | conversa inteira | **só o que ainda não foi analisado** |

## Como funciona agora

Na **primeira** análise de um cliente, a conversa vai inteira — não há o que aproveitar.

Da segunda em diante, o que a IA recebe é:

1. **O resumo consolidado do que já foi analisado** — o que a análise anterior concluiu: resumo da
   conversa, etapa em que parou, produto em jogo, objeção principal, pendência financeira, perfil
   do cliente e o próximo passo combinado. Isso **substitui** as mensagens antigas, que não são
   reenviadas.
2. **As últimas mensagens já conhecidas** (cerca de 3 mil caracteres do fim) — pra IA pegar o fio
   e o tom real da conversa, não só um resumo frio.
3. **As mensagens novas**, inteiras — é sobre elas que a leitura de hoje se debruça.

Quando **não há mensagem nova** (mesma conversa reimportada), a análise acontece do mesmo jeito —
é o que ele pediu, porque as regras podem ter mudado — só que sobre o resumo + as últimas
mensagens, e com um aviso explícito pra IA de que a conversa é a mesma e ela **não pode inventar
movimento que não houve**.

**Medido no teste, com uma conversa de 120 mensagens:** o pedaço da conversa enviado à IA caiu de
**12.881 para 3.897 caracteres — 70% a menos**, a cada reimportação.

### Onde a conversa continua indo inteira (de propósito)

- **Primeira análise** do cliente: não existe resumo pra colocar no lugar.
- **Conversa curta** (menos de ~6 mil caracteres): resumir não economizaria nada e a leitura
  completa é melhor. O limiar é configurável (`DIRECIONA_INCREMENTAL_MIN_CHARS`).
- **Análise anterior imprestável** (incompleta, com falha ou de versão antiga): sem resumo
  confiável, ninguém analisa no escuro.
- **Botão "Reanalisar"** do cadastro: é ação manual e rara, feita justamente pra ter uma leitura
  fresca (em geral depois de registrar uma observação). Continua lendo tudo.

## O que muda na tela

- durante a análise: *"analisando de novo, relendo só o que ainda não foi analisado"*;
- no quadro do resultado: *"N mensagens antigas não precisaram ser relidas — o que já tinha sido
  analisado entrou como resumo, não como texto pago de novo."*

## Risco assumido (dito com clareza)

A IA passa a decidir com **resumo + fim da conversa**, não com a conversa inteira. Se a análise
anterior tiver entendido algo errado, esse erro é herdado em vez de ser corrigido por uma releitura
completa. É o preço da economia que ele pediu — e é reversível: o botão **Reanalisar** sempre lê
tudo de novo, e os dois limiares são configuráveis sem mexer no código.

## Arquivos alterados

- `api/_pipeline.js` — `montarEntradaIncremental` (o resumo consolidado + cauda + novidade) e o uso
  do parâmetro `contextoIncremental`, que existia desde sempre na assinatura de `analyzeWithBrain`
  e nunca tinha sido implementado; `incrementalMeta.analiseIncremental` e `mensagensPoupadasDaIA`.
- `js/importacao.js` — os dois textos acima.
- `tests/v1222-analisa-so-o-que-nao-esta-no-historico.test.mjs` — guarda nova que **chama a análise
  de verdade** com um cliente falso da OpenAI e mede o pedido que saiu: o que foi, o que não foi, e
  quanto encolheu. Também tranca os quatro casos em que a conversa continua indo inteira.
- `tests/v1162-...` — texto da etapa 4 atualizado.
- `package.json` / `package-lock.json` — versão 1222.
