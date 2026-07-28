# NOTAS v1057 — "Fazer agora" é só pra quem já foi atendido, ponto final

## O relato

Depois de uma volta inteira sobre "mensagem vs. atendimento" (v1048–v1056), o dono deu a palavra
final, bem clara: "na lista de prioridades só pode aparecer clientes que já foram atendidos e que
respeita o tempo descrito no cérebro. Ponto final... quem não tem atendimento tem que ir lá nas
oportunidades esquecidas... atendidos respeita o tempo de descanso do último atendimento e cai na
prioridade. Quem não tem atendimento tem que ir lá nas oportunidades esquecidas e essa sim vai
classificar pelo prazo mais antigo."

## O que mudou

Regra nova, direta: **"Fazer agora" só aceita lead que já foi atendido pelo menos uma vez** (um
clique reconhecido pelo app — Marcar atendimento, Copiar sugestão, ligação, visita, observação).
Lead que nunca foi atendido — não importa quantas mensagens tenha, nem há quanto tempo conversa —
não entra mais nessa lista. Quem já foi atendido continua respeitando o tempo de descanso
configurado no Cérebro (regra que já existia desde a v1052), e volta a aparecer normalmente depois
desse prazo.

**"Oportunidades esquecidas"** já era exatamente o destino certo pra quem não tem atendimento — já
aceitava esse caso (lead com atendimento manual OU 5+ mensagens reais) e já ordenava pelo mais
parado primeiro. Não precisou mudar nada ali, só confirmei que continua assim.

Com essa regra mais simples e definitiva, a penalidade de "tempo parado" na ordenação (v1056)
também ficou mais correta: como agora todo lead do "Fazer agora" já tem atendimento garantido, ela
passou a usar **somente** a data do atendimento (nunca mais mensagem) — exatamente como o dono
pediu: "não interessa a contagem de última mensagem, somente de último atendimento, ponto final."

## Testes

- `tests/v1057-so-atendidos-entram-prioridade.test.mjs` (novo): confirma que lead nunca atendido
  (mesmo com 50 mensagens) não aparece em "Fazer agora", e que lead já atendido continua
  aparecendo normalmente fora do prazo de descanso. Confirma também que "Oportunidades esquecidas"
  continua aceitando quem não tem atendimento e ordenando pelo mais antigo primeiro.
- `tests/v1056-tempo-parado-pesa-contra-posicao-na-fila.test.mjs`: reescrito pra usar só
  atendimento (não mais mensagem) na penalidade de tempo parado.
- 4 testes antigos (`v914`, `v924`, `v938`, `v1024`) ajustados com um "atendimento simulado" nos
  cenários de teste, já que agora é pré-requisito pra entrar na fila.
- `npm test`: suíte inteira verde.
- `npm run build`: build limpo, 27 arquivos publicados.

## Arquivos

`app.js` (`cpFilaFazerAgora` exige atendimento marcado; `cpProbabilidadeFechamento` usa só
atendimento na penalidade de tempo parado), `tests/v1057-so-atendidos-entram-prioridade.test.mjs`
(novo), `tests/v1056-tempo-parado-pesa-contra-posicao-na-fila.test.mjs` (reescrito),
`tests/v914-fazer-agora-dose-e-fds.test.mjs`, `tests/v924-fazer-agora-meta-decrescente.test.mjs`,
`tests/v938-fila-nao-oferece-aguardando-resposta.test.mjs`,
`tests/v1024-lentidao-cache-scores-vermais-ultima-analise-timeout-import.test.mjs` (ajustados),
`package.json`/`package-lock.json` (versão + script `test`), `NOTAS-v1057.md`, versão
**1056 → 1057**.
