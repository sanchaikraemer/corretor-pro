# v1294 — as duas contas que o app fazia pra ninguém ver

Fecha a revisão começada na `AUDITORIA-v1292.md` e continuada na v1293. São as duas últimas
decisões que estavam com o dono.

## 1. A rosca "Atividade do dia" foi apagada

*"item 3 - apaga"* — depois de ver o desenho de como o bloco ficaria na tela.

Toda vez que a tela de Desempenho desenhava, o app varria a carteira inteira cinco vezes para
montar: atendidos hoje, sem resposta há 3+ dias, lembretes, compromissos e a porcentagem da rosca.
Os quatro lugares onde esses números seriam escritos não existem em tela nenhuma há muitas versões.
Tudo isso saiu.

**Numa carteira grande, é uma varredura completa a menos por desenho de tela** — foi por isso que
entrou como otimização, não só como limpeza.

### Um susto que vale registrar

O laudo da v1292 dizia que **cinco** lugares estavam mortos, incluindo o `cpTotalAtendimentos`.
Estava errado: esse é o **número grande no meio da rosca "Prioridade de atendimento"**, que aparece
e funciona. O erro foi da varredura automática (a busca comparou o nome com uma aspa sobrando).
Conferido antes de cortar — ele ficou onde estava. O teste novo tranca isso: se alguém tentar
apagá-lo, a suíte reclama.

**O que continua na tela do Desempenho, conferido no navegador:** a rosca "Prioridade de
atendimento" com o total de clientes ativos e a legenda (Fazer agora / Agenda / Aguardando
cliente), os próximos compromissos, a condução da carteira e os atendimentos em andamento.

## 2. As mensagens de andamento do aprendizado foram apagadas

*"nao precio ver nada de 'rosca' - o aprendizado estando funcionando é o que importa"*.

As nove frases de progresso ("Aprendendo automaticamente com os históricos…", "37 históricos
verificados", "Recuperando histórico 2/5…", "Aprendizado pausado na conversa 12…") eram escritas
num lugar da tela que nunca existiu — ninguém nunca leu uma linha delas.

**O aprendizado em si não foi tocado, e isso está trancado por teste:** a varredura das conversas,
a lista de conversas que falharam, a repetição automática depois de uma falha, a trava que impede
duas abas aprendendo a mesma coisa, o fechamento do aprendizado e o único aviso que o corretor
realmente vê — *"✓ Carteira aprendida. As próximas sugestões já consultam suas conduções reais."*

## O teste que protege as duas decisões

`tests/v1294-nada-calculado-a-toa.test.mjs`. A regra que ele tranca: **conta que ninguém lê não
pode voltar**. Se um desses recursos for reativado um dia, ele volta junto com o lugar dele na
tela — o teste cobra o par (a conta E o lugar), nunca a conta sozinha. E cobra, item por item, que
o aprendizado continue inteiro.

## Verificação visual

Chromium sobre o app publicado, celular (390px) e computador (1440px), tela de Desempenho aberta:
todos os blocos que devem aparecer estão lá e medidos, nada sobrou do bloco removido, nenhum erro
de JavaScript, sem estouro de largura.

## Suíte

`29 arquivo(s) checado(s) + 448 teste(s), todos verdes.`

## O que ainda está aberto (e é só isto)

Duas funções que existem prontas, não são chamadas por nada, e estão esperando decisão desde a
v1268 — nenhuma das duas foi tocada:

1. **`aprenderDaCarteira`** — um botão para mandar o app reprocessar a carteira inteira na hora, em
   vez de esperar o aprendizado automático chegar nela.
2. **`importarTelefonesCSV`** — importar uma planilha de telefones para preencher os contatos que
   estão sem número. A v905 registrou que essa importação "deveria continuar existindo".

Fora isso, todos os achados da revisão foram resolvidos.

---

**Registro do que a revisão inteira (v1292 → v1294) devolveu:**

| | |
|---|---|
| Recursos que voltaram pra tela | 1 (o aviso de serviço fora do ar) |
| Recursos removidos por ordem do dono | 2 ("o cliente respondeu?" e a rede de saudação) |
| Linhas de código morto removidas | ~470 |
| Varreduras da carteira eliminadas por desenho de tela | 5 |
| Comentários e testes que afirmavam coisa falsa, corrigidos | 6 |
| Redes de proteção consertadas | 2 (o teste de código morto e a conferência de digitação) |
| Erros da própria auditoria, corrigidos | 2 (`cp-ja-entrou` e `cpTotalAtendimentos`) |
