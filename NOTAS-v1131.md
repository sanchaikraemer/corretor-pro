# v1131 — "Não foi possível analisar" era, na verdade, "falta configurar o Cérebro"

O dono criou uma conta de teste do zero (pra conferir o cadastro depois da v1129), importou uma
conversa de 8,2 MB e relatou: *"está demorando demais pra analisar e enviar para o app na versão de
teste"* — e mandou o print. O print mostrava mais do que lentidão: **Recebendo ✓, Enviando ✓,
Extraindo ✓, Transcrevendo ✓** e, no fim, **"Não foi possível analisar."**

São dois problemas diferentes, os dois corrigidos aqui.

## 1. Toda conta nova batia numa parede sem explicação

**A causa.** Conta recém-criada não tem a Inteligência Comercial (o Cérebro) configurada — é o
Cérebro que ensina a IA a falar como o corretor. Sem ele, o servidor não inventa sugestão nenhuma
(isso é regra do projeto, e está certo): devolve a análise marcada como pendente e **escreve o
motivo junto**, em `validacaoSugestoes`: *"Cérebro Comercial sem instruções carregadas."*

O app recebia esse motivo e **jogava fora**. Olhava só o marcador de "pendente", descartava a
análise inteira e escrevia na tela uma frase genérica: *"Não foi possível analisar."* O motivo, que
o servidor tinha mandado de bandeja, nunca chegava aos olhos de ninguém.

O efeito é pior do que parece: **é a primeira coisa que qualquer cliente novo tenta fazer no app.**
Ele se cadastra, importa a primeira conversa, espera o processamento inteiro rodar — e recebe um
erro que não diz nada e não sugere nada. Não há como adivinhar que bastava configurar o Cérebro uma
vez.

Isso também contrariava uma regra registrada em `CLAUDE.md` desde a v827-12: *"A análise de uma
conversa NUNCA pode ser descartada inteira só porque as 3 sugestões de mensagem não passaram nas
regras do Cérebro."* O servidor respeitava a regra (tem fallback determinístico pra isso). O app,
duas linhas depois, descartava assim mesmo — em dois pontos diferentes.

**Como ficou.** O motivo real agora atravessa até a tela, traduzido pra português de gente:

> **A conversa foi lida, mas a IA ainda não pode sugerir as mensagens.**
> A Inteligência Comercial ainda não foi configurada. É ela que ensina a IA a falar como você — sem
> isso não há o que sugerir. Configure uma vez e importe de novo (a conversa já está guardada, você
> não precisa exportar outra).
>
> **[ Configurar a Inteligência Comercial ]** · Tentar analisar novamente · Descartar importação

E os outros dois motivos que o servidor sabe informar também passaram a aparecer:

- **Limite diário atingido** (5 análises/dia numa conta em teste): mostra o número real e avisa que
  amanhã zera — e que a conversa continua guardada.
- **IA não configurada no servidor** (falta a chave da OpenAI): deixa claro que é configuração do
  sistema, não problema da conta do corretor.

A caixa deixou de ser vermelha de erro: não é erro, é um passo que falta. E a importação **não é
descartada** — quem for configurar o Cérebro volta e clica em "Tentar analisar novamente", sem
exportar a conversa de novo.

## 2. A correção de lentidão da v1122 não estava valendo nada

**A causa.** A v1122 atacou exatamente a lentidão que ele relata agora: subiu a capacidade do
**servidor** de 4 pra 10 áudios transcritos ao mesmo tempo. Só que o **app nunca mandou mais de 3
áudios por chamada** (`LOTE = 3`). O servidor jamais chegava perto de usar os 10 lugares — ele
recebia 3, e ficava esperando o próximo pedido.

Ou seja: a correção estava publicada, documentada em `NOTAS-v1122.md` como resolvida, e **não
produzia efeito nenhum**. Uma conversa com 30 áudios continuava virando 10 idas e voltas em
sequência, cada uma relendo o manifesto e baixando arquivos de novo.

**Como ficou.**

- O app passa a mandar **8 áudios por chamada** (não 10 de propósito: a função tem 60 segundos de
  teto na Vercel, e cada lote também lê o manifesto e baixa os arquivos — 8 corta as idas e voltas
  pela metade e ainda deixa folga).
- No servidor, a leitura do cache e o download de cada áudio **deixaram de ser uma fila**. Num lote
  de 8 eram 16 idas e voltas ao Storage, uma atrás da outra, antes de a transcrição começar. Agora
  acontecem em paralelo, com o mesmo teto de simultaneidade. A ordem do lote é preservada.

Um teste novo trava as duas pontas juntas: se o lote do app voltar a ficar menor que a capacidade
do servidor, a suíte acusa — foi assim que a correção da v1122 passou despercebida.

## O que isto NÃO resolve

A cota do Supabase continua estourada (o painel dele marca **"EXCEEDING USAGE LIMITS"** no plano
grátis). `NOTAS-v1122.md` já tinha registrado o recado, que vale igual aqui: **enquanto a cota
estiver estourada, qualquer lentidão precisa ser lida à luz disso antes de se procurar bug no app.**
As correções acima diminuem o número de idas e voltas ao banco — o que ajuda justamente num banco
lento —, mas não substituem subir o plano.

## Arquivos

- Alterados: `app.js` (motivo real na tela, lote de 3 → 8, os dois pontos que descartavam a
  análise), `api/processar-storage.js` (leituras em paralelo + o pool),
  `tests/v1070-analise-conta-na-importacao.test.mjs` (apontava pra uma frase que deixou de existir;
  o que ele protege — só contar análise que deu certo — continua igual).
- Novos: `tests/v1131-conta-nova-sem-cerebro-explica-o-que-fazer.test.mjs`,
  `tests/v1131-transcricao-em-lotes-maiores.test.mjs`.

## Conferido

- Suíte completa: **304 testes verdes**.
- O aviso novo renderizado no Chromium, no celular e no computador, com o caso real (conta sem
  Cérebro): título, texto, os três botões e nada saindo pro lado da tela.
