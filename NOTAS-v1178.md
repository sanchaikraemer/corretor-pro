# v1178 — áudio que não vira texto agora DIZ por quê

Dono, 07/08/2026: *"ta louco cara? parou de transcrever os áudios?"*

## O que estava acontecendo

O app tem três motivos possíveis pra um áudio da conversa não virar texto:

1. **teto de áudios do dia** (criado na v1119 pra segurar o custo — a transcrição é a parte mais
   cara da importação): o que passa da conta do dia fica sem transcrever;
2. **transcrição indisponível** no momento;
3. **erro na transcrição** de um áudio específico.

Nos três casos o áudio simplesmente **não aparecia** na análise — sem uma linha de explicação em
lugar nenhum da tela. Pior: o servidor SEMPRE mandou o aviso do teto junto com a resposta
(`transcricaoLimiteAtingido`), e o próprio comentário no código dizia que aquilo era *"só metadado
pra um aviso futuro"*. O aviso futuro nunca foi feito. Quem importa não tem como adivinhar: ou o
motivo está escrito na tela, ou o app "parou de funcionar".

## O que a v1178 faz

- **Durante o progresso** (a tela cheia da importação), a linha de andamento passa a dizer, na
  hora: *"2 áudios ficaram sem transcrever — teto de áudios do dia atingido"*.
- **No "Concluído"** — a linha que fica na tela e que muitas vezes é a única que dá tempo de ler
  antes do cliente abrir — o mesmo resumo aparece junto do resto (*"lead atualizado · 2 áudios
  ficaram sem transcrever (teto de áudios do dia)"*).
- **No resultado da importação**, um quadro laranja com o motivo por extenso e o que fazer. No caso
  do teto: importar a mesma conversa amanhã que os áudios entram — **o que já foi transcrito não é
  cobrado de novo**.

Nada disso muda o teto nem o custo: só para de esconder o que está acontecendo.

## Conferência visual (regra do CLAUDE.md)

Conferido no Chromium headless sobre a pasta publicada, em tela de celular (412px):
a linha de andamento aparece com o texto certo, e o quadro do resultado sai legível
(cor `rgb(255,217,168)` sobre `rgba(255,180,80,.1)`, 13px, 354px de largura) **sem estourar a
largura da página**.

## Testes

`tests/v1178-audio-sem-texto-diz-o-motivo.test.mjs` (novo): o servidor continua avisando o teto; o
app agora lê esse aviso, conta quantos áudios ficaram sem texto, leva os dois pro resultado e
explica os três motivos em português; e, sem áudio faltando, nenhum aviso é inventado.

`tests/v1162-reaproveitamento-aparece-no-progresso.test.mjs` foi atualizado: a linha do "Concluído"
agora soma o resumo do reaproveitamento **e** o aviso de áudio.

Suíte completa verde: 24 arquivos, 344 testes.
