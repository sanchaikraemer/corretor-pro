# NOTAS v1082 — Revisão geral do sistema: vazamento entre contas, cliente arquivado que voltava sozinho e quem não estava logado

## Contexto

Esta versão não saiu de um problema relatado com print: foi uma **revisão completa do sistema**
pedida pelo dono — olhar tudo (parte técnica, segurança, e também a experiência de uso e o lado
comercial), achar o que está errado de verdade e corrigir na raiz, não só o sintoma.

A varredura passou por: as 12 rotas do servidor (`api/`), o app inteiro (`app.js`), as telas de
conta, o app publicado rodando num navegador de verdade, e as migrações do banco. Sete problemas
reais foram encontrados e corrigidos. Nenhum deles aparecia como erro na tela — é justamente por
isso que passaram tanto tempo despercebidos: **o trabalho simplesmente sumia, em silêncio.**

---

## 1. Cliente de um corretor podia acabar na conta original (o mais grave)

**O que estava acontecendo.** Existem duas tabelas antigas no banco (`leads` e `direciona_leads`)
que são anteriores ao sistema de contas por login. Elas **nunca ganharam a coluna que diz de qual
empresa é cada linha** — as migrações só acrescentaram essa coluna nas tabelas novas. Mesmo assim,
**todo salvamento de lead, de qualquer corretor, também jogava uma cópia do cliente lá dentro**:
nome, telefone e a análise inteira, num balde sem dono.

O problema aparecia depois. As três funções que leem essas tabelas antigas (Restaurar leads,
backup completo e Apagar tudo) tratam **tudo que está lá como sendo da conta original**. Então, se
a conta original rodasse uma "Restauração de leads", ela enxergava o cliente de outro corretor como
um lead "que estava faltando" e o trazia pra si — reescrevendo o registro do outro corretor por
cima. Resultado: **o corretor perdia aquele cliente e ele reaparecia na conta original.**

**Corrigido em duas pontas:**
- **A gravação:** só a conta original escreve nessas tabelas antigas. Nenhum outro corretor
  alimenta mais o balde sem dono. Isso não tira nada de ninguém — o registro que vale, pra todo
  mundo, sempre foi o da tabela nova, que carrega a empresa dona.
- **A restauração:** antes de restaurar qualquer coisa, o sistema levanta quais leads hoje
  pertencem a outra empresa e **nunca encosta neles** — nem na opção "forçar", que antes pulava
  todas as conferências. O relatório da restauração agora informa quantos foram deixados de fora
  por esse motivo.

> Observação pro dono: essa correção impede que o problema continue acontecendo e impede que uma
> restauração futura cause estrago. Se alguma conta já perdeu um cliente por isso antes desta
> versão, isso não é desfeito sozinho — precisaria ser olhado caso a caso no banco.

---

## 2. Cliente arquivado voltava sozinho pra fila do dia

**O que estava acontecendo.** Desde a v1069 só existem dois estados pra um cliente: **Ativo** e
**Geladeira** (arquivado). Mas três caminhos do sistema ainda gravavam nesse campo o **palpite de
etapa da inteligência artificial**, que é texto livre (ela devolve coisas como "Atendimento",
"Negociação" ou "Não identificado").

Como a tela inicial considera ativo tudo que não está escrito exatamente "Geladeira", bastava o
corretor **arquivar um cliente e depois tocar em "Reanalisar"** — ou reimportar a conversa dele —
pra que a IA sobrescrevesse o estado e **o cliente voltasse pras prioridades do dia, sem aviso
nenhum**. A decisão de arquivar era perdida.

Havia até uma trava no código que deveria impedir isso, mas ela procurava por "vendido" e
"perdido" — vocabulário de funil que **deixou de existir na v1069**. Ou seja, ela nunca protegeu
nada desde então.

**Corrigido:** o estado do cliente voltou a ser **decisão exclusiva do corretor**. A importação
nova grava "Ativo"; reimportar mantém o estado que já estava salvo; e a reanálise não mexe mais
nesse campo. O palpite da IA continua guardado e aparecendo na tela do lead como sempre — ele só
não manda mais no arquivamento.

---

## 3. A memória que o corretor digita à mão sumia ao reanalisar

**O que estava acontecendo.** Na tela do lead existem os campos de memória — preferências ("quer
térrea, aceita permuta"), quem participa da decisão ("decide com a esposa"), pontos sensíveis.
Tudo isso é digitado à mão pelo corretor e é o que a IA usa nas próximas análises.

Ao tocar em **"Reanalisar"**, o sistema **substituía o bloco inteiro de memória**, mantendo só as
observações. Todo o resto voltava em branco: sumia da tela, sumia do banco e parava de ser mandado
pra IA. O corretor preenchia com calma e perdia na reanálise seguinte.

Curiosamente, o caminho irmão (salvar uma observação) sempre fez certo — era só a reanálise
completa que apagava.

**Corrigido:** a reanálise preserva tudo que já estava na memória e troca apenas as observações,
exatamente como o outro caminho sempre fez.

---

## 4. O refresh da tela inicial desfazia o que tinha acabado de ser feito

**O que estava acontecendo.** Uma vez por dia, ao montar a lista de clientes, o sistema aproveita
pra guardar um resumo de contas de cada lead. Só que, pra guardar esse resuminho, ele **regravava a
análise inteira do lead do jeito que ela estava no começo da listagem**.

Isso abria uma janela perigosa: o corretor tocava em **"Reanalisar"** (que pode levar até um
minuto), a tela inicial fazia o refresh normal no meio, e o refresh terminava **depois** —
devolvendo a análise velha por cima da nova. O mesmo valia pra "Copiar mensagem" e "Marcar
atendimento" registrados nesse intervalo. **Os dois lados diziam que deu certo.**

**Corrigido:** essa gravação de resumo agora só acontece se o lead não tiver sido tocado desde que
foi lido. Se tiver, ela é simplesmente pulada — é só um cache, a próxima carga refaz.

---

## 5. Apagar um lead podia varrer as transcrições de áudio da conta original

Existe uma pasta compartilhada, de antes da separação por empresa, onde ficam guardadas as
transcrições de áudio já feitas (pra não pagar de novo pela mesma transcrição). Essa pasta é da
conta original.

Ao apagar um lead, o sistema varria essa pasta inteira sempre que o lead não tivesse uma referência
específica de arquivos — e, como a reanálise reconstrói a análise sem essa referência, **todo lead
já reanalisado se encaixava nessa condição**. Ou seja: qualquer corretor apagando um lead qualquer
podia limpar as transcrições da conta original, que voltava a pagar transcrição na importação
seguinte.

Junto disso, a limpeza dos arquivos da importação ainda procurava pelas pastas **do formato
antigo** — as importações de hoje ficam em pastas separadas por empresa, então na prática **nenhum
arquivo de importação inacabada estava sendo apagado** junto com o lead (e o arquivo de trabalho da
importação guarda a conversa inteira já lida).

**Corrigido:** só a conta dona pode limpar a pasta compartilhada, e a limpeza passou a cobrir
também o formato atual das pastas (sem deixar de cobrir o antigo).

---

## 6. Salvar lead ficava mais lento conforme a carteira crescia

Toda vez que um lead era salvo (importação, cadastro manual, ZIP do Atalho do iPhone), o sistema
varria a carteira pra saber se aquele cliente já existia. Só que, nessa varredura, ele **baixava
junto a conversa inteira de até 5 mil leads** — sendo que só precisava do nome e do telefone pra
comparar.

Numa carteira grande isso são dezenas (às vezes centenas) de megabytes baixados e processados **a
cada clique de salvar** — a causa provável do "salvar lead travou" que aparece de forma
intermitente e só nas contas mais cheias.

**Corrigido:** a varredura leva só o que precisa; a conversa é buscada depois, só a do cliente
encontrado. Junto, uma contagem interna da reimportação que refazia o mesmo trabalho milhares de
vezes (numa conversa de 4 mil mensagens eram 16 milhões de comparações) foi arrumada pra ser feita
uma vez só.

---

## 7. Quem não estava logado via uma caixinha incompreensível

**O que estava acontecendo.** Quem abrisse o app sem estar conectado — nunca entrou, ou saiu, ou
limpou o navegador — não era mandado pra tela de entrar. Em vez disso, o navegador abria uma
**caixinha crua pedindo "a chave de segurança do Corretor Pro"** (um acesso antigo, de antes das
contas por login, que cliente nenhum tem nem sabe o que é), e a tela ficava presa em
"Reconectando…". Pior: como a tela inicial faz várias chamadas de uma vez, **a caixinha aparecia
várias vezes seguidas**.

**Corrigido:** sem login e sem chave guardada no aparelho, o app vai **direto pra tela de entrar**.
A caixinha só continua existindo pra aparelho que de fato usa o acesso antigo. E, pra esse acesso
antigo não ficar sem porta nenhuma, a tela de entrar ganhou um link discreto no rodapé —
**"Acesso por chave de segurança"** — bem abaixo do "Criar conta grátis", sem competir com ele.

---

## Faxina e manutenção da mesma versão

- **Código morto removido do `app.js`:** a geração antiga do "Arquivar" (que ainda usava a
  caixinha do navegador, substituída na v1073) e uma linha repetida. O arquivo inteiro foi varrido
  com um analisador de sintaxe e **não há mais nenhuma função duplicada** — a pendência que estava
  anotada no `ESTADO-ATUAL.md` desde a v1068 já tinha sido resolvida na v1069 e o documento estava
  desatualizado. Agora está corrigido, com um aviso pra não mexer em três reatribuições que
  **parecem** duplicadas mas são propositais.
- **A suíte de testes estava vermelha desde a meia-noite de hoje**, sem ninguém ter mexido em nada:
  um teste de Desempenho montava a data "mês passado" de um jeito que quebra sozinho em dia 31
  (31/07 vira "31 de junho", data que não existe, e o JavaScript normaliza pra 01/07 — dentro do
  mês corrente). Corrigido pra calcular a data a partir do próprio começo do mês, sem depender do
  dia em que roda.
- **Um teste passava olhando pra código morto:** o teste do "Reativar" exigia dois envios de etapa
  com valor fixo, e o segundo vinha justamente da geração antiga do Arquivar, que ninguém executava
  desde a v1073. Agora ele confere o caminho vivo de verdade.

## Testes

`npm test` verde (a suíte inteira, com o código de saída conferido de verdade). Três testes novos:

- `v1082-sem-login-vai-pra-tela-de-entrar`
- `v1082-lead-de-um-corretor-nao-vaza-pra-conta-original`
- `v1082-arquivado-nao-volta-e-memoria-sobrevive`

Além dos testes, o app publicado foi aberto num navegador de verdade (Chromium, no celular e no
computador): as 9 telas navegam sem erro, o "sem login" cai na tela de entrar, o link do acesso
antigo salva a chave e abre o sistema, e a tela de entrar foi conferida no resultado computado
(sem rolagem lateral, link discreto no lugar certo).
