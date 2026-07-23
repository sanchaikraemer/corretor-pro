# v943 — ranking do "Fazer agora" por probabilidade de fechamento + ajustes visuais da v942

## Os pedidos do dono (print + mensagem explícita)

1. **Visual mobile ruim.** A barra de mensagens ficava toda cheia e igual (carteira com
   contagens de 56 a 218 msgs, teto fixo de 30) e os nomes cortavam no celular.
2. **Ordem errada, de novo.** "Henrique Leite" liderava a lista com 218 mensagens, contatado há
   só 2 dias — na frente de leads parados há 40+ dias. O dono foi taxativo: *"a ordem não é por
   mais parado primeiro (...) não é mais mensagem, não é mais antigo, é uma junção de fatores
   como maior interação, maior quantidade de perguntas, quem voltou a conversar em datas
   diferentes, probabilidade de fechamento, quem a gente falou de valores, de condições de
   pagamento (...) você tem que analisar o histórico inteiro e me dizer quem tem mais
   probabilidade de fechamento."*

## 1. Barra de mensagens relativa + layout mobile em 2 linhas

`cpBarraMensagensMini` (`app.js`) deixou de saturar num teto fixo (30) e passou a ser
**proporcional ao maior da lista mostrada** (`maxMsgs`, calculado em `renderBotoesHome` sobre a
dose do dia) — agora dá pra ver a diferença entre quem tem mais e menos engajamento dentro da
mesma lista. `cpHomeLeadRow`/`.cp-hoje-row` ganharam `grid-template-areas`: desktop continua 1
linha; no mobile (`≤560px`) vira 2 linhas — nome + dias em cima (nome com a largura toda, sem
cortar), barra + produto embaixo.

## 2. Ranking por "probabilidade de fechamento" — junção de fatores

Nova função `cpProbabilidadeFechamento(l)` (`app.js`), que `cpFilaFazerAgora` usa pra ordenar a
fila (a mesma fila do "Fazer agora", card e "Puxar da fila"). Combina, com pesos calibrados pra
nenhum fator sozinho dominar:

- **Engajamento** (mensagens do cliente) — teto BAIXO (30) e peso 1, de propósito: um lead
  "explosão de mensagens" não pode vencer só por volume.
- **Recorrência** (`clientMessageDays` — em quantos DIAS DIFERENTES o cliente voltou a
  conversar) — peso 8. Interesse sustentado no tempo pesa mais que uma sequência de mensagens
  num dia só.
- **Perguntas feitas** (`clientQuestionCount`) — peso 6. Dúvida real = engajamento ativo.
- **Sinal de negociação avançada** (`contextoPrioridadeIA` — já lê o resumo da IA sobre a
  conversa inteira: se já se falou de valor/condição/proposta/contraproposta) — peso 35 por
  sinal (até 2).
- **Bônus de responsividade**: +30 se o cliente é quem está esperando a resposta do corretor
  agora — deixou de ser um estágio isolado que travava tudo o resto (era assim na correção
  anterior, do mesmo dia) e passou a ser só mais um fator somado.

`clientMessageDays` e `clientQuestionCount` são calculados no **servidor**
(`api/_persistence.js`), na mesma varredura que já calculava `clientMessageCount` (v942), sobre
o **histórico inteiro** salvo no banco — a lista no navegador só recebe uma prévia de ~8
mensagens, então esses fatores não davam pra calcular no cliente.

## Achado incidental: regex fragilizado por função de 1 linha

`cpFimDeSemana` era escrita numa linha só. Vários testes extraem funções de `app.js` via regex
`/\n\}/` (procurando a chave de fechamento numa linha própria) — como a função não tinha `\n}`
dentro dela, o regex "atravessava" e engolia a função SEGUINTE inteira sem dar erro (foi assim
que um teste passou mesmo com uma função faltando no stub, mascarando o problema até essa
sessão). Reformatada pra multi-linha — deixa de ser uma armadilha pros testes.

## Verificação

- `tests/v943-probabilidade-fechamento-junta-fatores.test.mjs` (novo): cobre os 4 fatores do
  score, o caso real (Henrique vs. lead qualificado), os campos novos no servidor, e a barra
  relativa.
- `tests/v914-fazer-agora-dose-e-fds.test.mjs`, `v924-fazer-agora-meta-decrescente.test.mjs`,
  `v938-fila-nao-oferece-aguardando-resposta.test.mjs` atualizados pra usar
  `cpProbabilidadeFechamento` (substituindo a ordenação por mensagens/dias parado isolados).
- Suíte inteira verde (`npm test`); `node build.js` OK, versão 943.

## Observação
`clientMessageDays`/`clientQuestionCount` valem pra dados novos imediatamente; leads em cache
pegam os campos no próximo fetch da lista.

## Arquivos
- `app.js` (`cpProbabilidadeFechamento`, `cpFilaFazerAgora`, `cpBarraMensagensMini`,
  `cpHomeLeadRow`, CSS mobile da lista, `cpFimDeSemana` reformatada),
  `api/_persistence.js` (`clientQuestionCount`, `clientMessageDays`),
  `tests/v943-…` (novo) + `v914`/`v924`/`v938`/`v942` (atualizados),
  `package.json`/`package-lock.json`, `NOTAS-v943.md`, versão **942 → 943**.
