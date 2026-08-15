# v1281 — o mesmo mês não pode dar dois números de mensagens

## O que aconteceu

Print do dono (15/08/2026, 13:19), com o painel **Seu mês** aberto na tela inicial:

- Clientes atendidos: **208** (1 hoje · 119 nesta semana)
- Mensagens trocadas: **1.469** — 934 enviadas por ele (64%), 535 recebidas (36%)

Pergunta dele: **"isso ta certo mesmo?"**, e em seguida **"confere e resolve"**.

## A conferência

**Os "208 clientes atendidos" estão certos, e não podem estar errados por construção.** São 208
clientes DIFERENTES tocados entre 1º e 15 de agosto — cada cliente entra uma vez só, por mais
vezes que tenha sido atendido no mês. A conta percorre a carteira INTEIRA que o app já tem em mãos
(a mesma lista que alimenta "Total de leads" e "Arquivados") e marca quem tem pelo menos um
atendimento no período. Como é um filtro sobre essa lista, o número **nunca** pode passar do total
de clientes cadastrados — a dúvida que ficou no ar na resposta anterior ("confira se sua carteira
tem menos de 208") não tinha como acontecer. A listagem ainda junta cadastro repetido do mesmo
cliente antes de tudo isso (dedupe por nome, em `api/_persistence.js`), então cliente cadastrado
duas vezes também não conta dobrado.

Conta como atendimento: copiar a mensagem sugerida, apertar "Marcar atendimento", salvar uma
observação ou marcar um compromisso na agenda. Cliente atendido e arquivado depois continua
contando (regra do dono, v1183). A semana é de segunda até hoje; o mês é do dia 1 ao último dia.

Os números do painel também fecham entre si: 934 + 535 = 1.469, 64% + 36% = 100%, e o "1 hoje"
bate com a barrinha vermelha na ponta do gráfico.

## O que estava errado de verdade (e foi resolvido)

A **tela de resultados** ("Seu mês no Corretor Pro", a do menu) mostra uma linha **"Mensagens
trocadas"** falando do MESMO mês — e ela vinha de outra fonte: contava as mensagens da **prévia**
que a listagem manda, que são só as **últimas ~8 mensagens de cada cliente**. Numa carteira de
conversas de verdade isso sai muito abaixo do real. Ou seja: duas telas do app respondiam a mesma
pergunta com números bem diferentes no mesmo mês. Foi exatamente o defeito que a v1251 corrigiu no
painel da tela inicial — e que ficou pra trás na tela de resultados.

Agora as duas leem a mesma fonte: a contagem feita no **servidor**, sobre a conversa inteira de
cada cliente.

## O que mudou

- **`api/_persistence.js`** — na mesma varredura que já contava as mensagens do mês corrente,
  entrou também a contagem do **mês fechado anterior** (total, do cliente, do corretor). A tela de
  resultados tem o botão do mês passado (v1106) e precisava do número certo lá também. O cache de
  estatísticas subiu pra versão 5 — isso obriga UMA varredura completa por cliente na primeira
  carga depois de publicar; depois disso volta ao regime barato de sempre (o cache já se refaz
  todo dia).
- **`app.js`** — a linha "Mensagens trocadas" da tela de resultados passou a somar os campos que o
  servidor manda prontos (mês corrente ou mês anterior, conforme o botão), em vez de contar a
  prévia de 8 mensagens. Se a carteira vier de um cache antigo, sem esses campos, ela cai na
  contagem antiga em vez de mostrar zero. O número também ganhou separador de milhar, igual ao do
  painel da tela inicial.

Nada mudou no painel **Seu mês** da tela inicial nem na régra de "cliente atendido" — os dois já
estavam certos.

## Um ponto que continua frágil (não mexi, é decisão do dono)

A divisão entre "Enviadas por você" e "Recebidas dos clientes" usa o **nome que aparece na conversa
exportada** pra saber quem escreveu cada mensagem. Quando o cliente está salvo no celular com um
nome diferente do nome dele no app — ou aparece só como número de telefone — as mensagens dele
podem cair no lado do corretor e inflar os 64%. Se o dono achar essa divisão estranha em algum
cliente, dá pra endurecer a regra numa próxima versão.

## Teste

`tests/v1281-mensagens-do-mes-mesma-fonte.test.mjs` — trava as duas pontas: o servidor precisa
contar e devolver as mensagens do mês passado (na MESMA passada, como "senão" do mês corrente, pra
um mês não entrar no outro) com o cache na versão 5; e a tela de resultados precisa ler os campos
do servidor, não a prévia. No fim, monta uma carteira de exemplo e confere que o painel da tela
inicial e a tela de resultados chegam ao mesmo total (49), enquanto a conta antiga daria 16.
