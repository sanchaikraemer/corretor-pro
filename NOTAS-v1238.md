# NOTAS v1238 — corte de clichê feito pelo código, e apagar não bagunça mais a tela

Data: 12/08/2026. Três problemas relatados pelo dono em sequência, todos com print.

## 1. "Conforme conversamos" chegou na tela — eu tinha dito que não chegaria

Print das 19:54. A sugestão 2 saiu com **"detalhando entrada e parcelas conforme conversamos"**.
Essa expressão está na lista dura desde a v1235, e eu disse a ele, com todas as letras, que
frase proibida não chegava mais na tela dele.

**Não era verdade. Dois furos, os dois meus:**

1. A releitura era aceita no **empate** da conferência — ou seja, ela podia devolver a MESMA
   frase proibida e passar assim mesmo.
2. Se a releitura falhasse, desse erro ou não coubesse no tempo, valiam as mensagens
   originais — proibições e tudo.

Ou seja: eu tinha construído uma rede que dependia da IA colaborar. Pedir pro modelo já tinha
falhado duas vezes (v1212 e v1219 já proibiam por escrito e ele passou por cima).

**Agora o corte é do código, e roda SEMPRE** — tenha havido releitura ou não, tenha ela
funcionado ou não.

Como o corte funciona, e por que não é ingênuo: cortar palavra por palavra parece mais
delicado e é **pior** — tirar "à disposição" de *"Fico à disposição."* devolve *"Fico."*, texto
quebrado assinado pelo corretor. O corte é por **oração**, e a frase inteira sai quando a
oração é a frase toda:

| Antes | Depois |
|---|---|
| "…detalhando entrada e parcelas **conforme conversamos**." | "…vou enviar agora a simulação prometida." |
| "Passando pra saber se você ainda tem interesse — **fico à disposição**." | "Passando pra saber se você ainda tem interesse." |
| "Boa noite! **Espero que esteja bem.** Consegui as duas vagas…" | "Boa noite! Consegui as duas vagas…" |
| "tudo bem? **Tranquilo por aqui**, vi que você prefere aguardar…" | "tudo bem? Vi que você prefere aguardar…" |

Quando existem duas versões do texto (a que a IA escreveu e a reescrita), o código corta as
duas e fica com a que **sobrou mais inteira** — senão uma reescrita que virasse só "Boa noite!"
iria pra tela tendo coisa melhor do lado.

Só a lista **dura** entra aqui. "Separei", "preparei", "conferi" continuam sendo julgados por
quem leu a conversa — podem ser verdade.

## 2. "Depois q apaguei veio pra essa tela"

Ele apagou uma observação e a página foi parar no "Histórico de contatos".

**Não foi a rolagem que falhou — foi o card "Últimas mensagens" fechar.** A v1028 já preservava
aberto/fechado, mas só no caminho de ABRIR o lead; quem remonta a tela depois (apagar, marcar
atendimento, reanalisar) recriava o card fechado. Fechado o card, a página encolhe de altura, e
a restauração de rolagem (que devolve o mesmo número de pixels) passa a pousar lá embaixo.

Agora o card volta aberto **antes** de a rolagem ser restaurada, então a altura não muda e ele
fica exatamente onde estava.

## 3. A observação apagada continuava na tela

Print seguinte, o pior dos três: o aviso dizia "Observação apagada", o contador do card caía de
3 pra 2 — **e a observação continuava na lista**. Tocando o ✕ dela de novo: *"Essa observação
não está mais no histórico."* Sumiu do servidor, ficou na tela.

A causa é uma proteção antiga e legítima: a LISTA de leads traz só um recorte das mensagens,
então existe uma regra que diz *"se a cópia local tem mais mensagens que a que chegou agora,
fica com a local"* (sem ela, a barra de interesse despencava de 108 pra 4 ao marcar
atendimento). Depois de APAGAR, essa regra é exatamente o contrário do certo: a cópia local tem
mais mensagens justamente porque ainda tem a que acabou de ser apagada.

Consertado na origem: **quem apaga tira a linha da cópia local antes de recarregar**. A
proteção antiga continua fazendo o que sempre fez, sem nunca ressuscitar o que foi apagado.

## O que eu NÃO consigo garantir daqui

Esta sessão não tem acesso à produção (nem Supabase, nem os projetos do Vercel). **Não consigo
confirmar qual versão estava no ar quando ele testou às 19:54** — as versões 1236 e 1237 foram
mescladas, mas o tempo de publicação eu não vejo. O furo do item 1 é real e existiria de
qualquer forma; só não dá pra afirmar que era o único motivo do que ele viu naquele print.

## Sobre as três sugestões insistirem na simulação

Vale registrar, porque muda a leitura: entre um print e outro ele **apagou uma observação**, e a
conversa passou de 41 pra 40 mensagens. Uma das observações apagadas era justamente a que dizia
*"o cliente não autorizou a mandar a simulação"*. Sem ela, a última coisa que o cliente diz na
conversa é **"Sim, sim, pode ser!"** para receber a simulação — então a IA concluir "mandar a
simulação" passou a ser a leitura honesta do que sobrou. O que continua errado é as três
sugestões serem a MESMA coisa; isso é a regra da v1236 (três caminhos para o mesmo passo) e
segue valendo.

## Validação

- Versão: `7.1238.0` / exibida **1238**.
- Novo teste `tests/v1238-apagar-nao-pula-tela-nem-ressuscita.test.mjs`: cobre os três problemas,
  com o texto exato do print. Roda a análise ponta a ponta no **pior caso** (a IA insistindo no
  clichê nas duas chamadas) e exige que nenhuma das três mensagens chegue com frase proibida.
- `tests/v1235-…` atualizado: recusar a reescrita não é mais desculpa pra clichê chegar na tela.
- `npm test` inteiro verde (404 testes).
