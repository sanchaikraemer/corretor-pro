# NOTAS v1056 — o tempo parado volta a pesar contra a posição na fila

## O relato original (o que motivou toda essa rodada de conversas)

A primeiríssima mensagem desta sequência inteira: um print de leads com "há 141d", "há 46d",
barra de mensagens em 0 — disputando espaço na fila "Fazer agora" ao lado de leads realmente
quentes. Na época, expliquei o critério de verdade (nenhum fator de ranking perde força com o
tempo parado) e propus a correção: "fazer o tempo parado pesar contra a posição na fila". O dono
aceitou só tirar o número de posição naquele momento, e eu deixei escrito: "o CRITÉRIO de quem
entra continua o mesmo... se quiser que lead muito parado pare de disputar espaço com lead quente
de verdade, é só me falar."

Depois de uma rodada inteira sobre outro assunto (o "descanso pós-atendimento", v1048–v1055), o
dono voltou a apontar o problema original com um print novo (Adao/Jonatas com poucos dias, mas o
padrão de fundo era o mesmo de sempre): "vc não vai resolver nunca né? o que eu falei sobre isso?"

## A correção

Essa é a correção proposta lá no início, agora implementada de verdade: `cpProbabilidadeFechamento`
(a nota que ordena a fila "Fazer agora") passa a **descontar uma penalidade proporcional ao tempo
parado** — o toque mais recente entre mensagem e atendimento, até um teto de 90 dias (depois disso
a penalidade para de crescer). Um lead frio de verdade cai pra trás de quem está realmente ativo —
sem sumir da lista (o critério de QUEM ENTRA continua o mesmo; só a ORDEM muda).

Negociação avançada real (proposta já discutida) continua pesando mais que um pouco de tempo
parado sozinho — não virou um critério só de "tempo parado", virou mais um fator na mesma junção
de sempre.

## Testes

- `tests/v1056-tempo-parado-pesa-contra-posicao-na-fila.test.mjs` (novo): reproduz o caso real
  (lead parado 141 dias vs. lead com engajamento parecido tocado há 2 dias — o ativo pontua mais),
  confirma o teto de 90 dias, e confirma que negociação real ainda pode superar um pouco de tempo
  parado.
- `npm test`: suíte inteira verde — os testes antigos que já travavam `cpProbabilidadeFechamento`
  (v943, v944, v914) continuam passando porque a penalidade usa `daysSinceLastTouch` (não
  `daysSinceClientReply`, que já tinha outro significado no bônus "cliente espera você") e afeta
  igualmente os cenários comparados nesses testes, preservando as diferenças que eles travam.

## Arquivos

`app.js` (`cpProbabilidadeFechamento` desconta penalidade por tempo parado, teto 90 dias),
`tests/v1056-tempo-parado-pesa-contra-posicao-na-fila.test.mjs` (novo),
`package.json`/`package-lock.json` (versão + script `test`), `NOTAS-v1056.md`, versão
**1055 → 1056**.
