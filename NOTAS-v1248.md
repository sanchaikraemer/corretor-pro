# v1248 — auditoria de ponta a ponta: o que travava, o que se apagava e o que aparecia errado

Rodada pedida pelo dono ("analise o sistema, corrija os problemas e melhore o produto"), com
autorização ampla e **uma fronteira explícita mantida**: o miolo do Cérebro/prompt/análise e a
estratégia das três mensagens **não foram tocados** — continuam exatamente como a v1247 os deixou
(estado do fim de 11/08/2026). Nada aqui mexe em regra comercial.

O trabalho foi feito em três frentes: varredura do `app.js`, varredura das rotas de `api/`, e
**conferência visual no navegador de verdade** (Chromium headless sobre a pasta `public/`, com uma
carteira de mentira, em 320, 360, 390 e 1280 px). Os dois defeitos de tela abaixo só apareceram na
terceira frente — a suíte estática não enxerga nenhum dos dois.

---

## 1. Compartilhar a conversa podia matar o app — sem erro, sem botão, sem saída

**O que o dono via:** compartilha a conversa do WhatsApp pro Corretor Pro e a tela fica em
"Conversa recebida. Preparando a importação… 4%" **pra sempre**. A carteira nunca carrega. Atualizar
a página cai na mesma tela. Só se cura sozinho 15 minutos depois — e a conversa se perde.

**Causa raiz (uma só, aparecendo por três lados).** A v1195 mandou as 29 funções da importação pro
arquivo `js/importacao.js`, buscado só na hora de importar. A ponte que faz esse download
(`carregarModuloImportacao`) nasceu **sem nenhum tratamento de erro** — e falhar ali é comum:
internet oscilando, ou o app tendo acabado de ser publicado (o recebedor instalado no celular ainda
procura o endereço da versão anterior).

1. **A promessa quebrada ficava guardada.** Depois da primeira falha, toda tentativa de importar
   falhava na hora, sem nem tentar a rede, até fechar e reabrir o app. O jeito certo já existia no
   próprio arquivo (`ensureJSZip` zera em caso de falha) — a ponte esqueceu.
2. **No compartilhamento, a falha subia sem ninguém pegar.** A marca `__cpShareImportActive`
   continuava ligada, e é ela que **aborta a abertura normal do app**; o endereço já tinha sido
   reescrito pra `?shared=1` (então F5 caía na armadilha de novo); e a barra de progresso ficava
   girando. Agora há `try/catch`: desliga a marca, limpa o endereço, desliga a barra e mostra um
   aviso que diz o que fazer — com a garantia de que **nenhum lead foi alterado**.
3. **O botão "Escolher o arquivo da conversa (.zip)" virava um botão morto.** A falha era engolida:
   sem toast, sem barra, sem erro. Agora avisa.

**De brinde:** o aviso genérico de "o arquivo não chegou ao armazenamento do aplicativo" continuava
com a barra de progresso girando **por cima** dele. O ramo irmão (`erro=sem-worker`) já desligava a
barra desde a v1209; este, que é o caminho mais comum, nunca recebeu a linha.

Guarda: `tests/v1248-importar-nao-trava-o-app.test.mjs`.

## 2. A trava da reanálise não travava nada

Duas reanálises do mesmo cliente ao mesmo tempo (celular e computador, ou dois toques porque
"parecia travado") **se sobrescreviam em silêncio, as duas respondendo "deu certo"**.

A trava comparava a coluna `updated_at` — que `api/reanalisar-lead.js` **nunca escreve** (a gravação
usa `atualizado_em`). Ou seja: as duas liam a mesma marca, as duas passavam. A marca certa é
`atualizado_em`, que **toda** gravação de análise do sistema atualiza — e que `_persistence.js` já
usa como trava desde a v1082. Corrigido na trava principal e na segunda tentativa.

## 3. Reanálise podia gravar dado velho por cima do que você acabou de salvar

Antes de salvar, a rota relê o cliente no banco — e o erro dessa leitura era **descartado**. Falhando
ela, o código seguia com a cópia lida no **início** da requisição. Como a reanálise leva dezenas de
segundos (é a IA trabalhando), qualquer coisa salva nesse meio-tempo — o nome do cliente corrigido,
uma observação — voltava ao valor antigo, sem erro e ainda respondendo "deu certo". Agora, falhando
a releitura, a rota **recusa e pede pra tentar de novo**: nada é gravado.

## 4. "Copiei a mensagem e não marcou o atendimento"

No botão **Copiar** do cartão da tela Hoje, duas gravações eram disparadas **ao mesmo tempo** — o
atendimento (`reanalisar-lead`) e o contador de mensagens copiadas (`lead-update`). As duas escrevem
no **mesmo campo** do cliente, lendo antes de escrever: uma apagava a outra. Quando a perdedora era
o atendimento, o cliente voltava pra fila "Fazer agora" como se você nunca tivesse falado com ele
(o velho "atendi e não marca corretamente as datas"); quando era o contador, o Desempenho mostrava
"Mensagens copiadas: 0" com uso real.

A ordem certa **já estava em uso nos outros dois botões de copiar** (v1097/v1142) e este ficou pra
trás: atendimento primeiro (se só uma sobreviver, que seja a que importa), contador depois, com
`keepalive` — copiar é exatamente quando o app vai pro fundo, indo pro WhatsApp — e **em sequência,
nunca em paralelo**.

## 5. Apagar um cliente podia dar erro com o cliente já apagado

`acaoApagar` fazia **duas varreduras da carteira inteira**:

- `aprenderRespostasDaCarteira` — lê a **conversa completa** (`timeline_json`) de até 3.000 clientes,
  e rodava **depois** do apagar já efetivado. Em carteira grande o download estourava o tempo da
  função (60 s): o corretor via erro, tentava de novo e recebia "Lead não encontrado". **E o pior:**
  a lista que ela produz (`corretor-respostas`) **não é lida em lugar nenhum do sistema** — desde a
  v1212 os exemplos de escrita que vão pra IA saem da própria conversa analisada
  (`exemplosDoCorretor`). Era o trabalho mais pesado da rota, feito pra alimentar quem não existe.
  **Removida do caminho do apagar.**
- `removerVinculosComLeadsApagados` — baixava a análise comercial de até 5.000 clientes pra achar os
  poucos que têm vínculo. Agora **o filtro vai pro banco** (`oportunidadesVinculadas` não nula), com
  queda pra varredura antiga se o banco não aceitar o filtro — nunca deixa de limpar o vínculo.

## 6. Memória do servidor e backup

- **Cache da listagem sem teto** (`api/leads-recentes.js`): cada entrada guarda a carteira formatada
  de até 2.000 clientes e **nada nunca era apagado** — o prazo de 5 s só marcava a entrada como
  velha. Numa máquina quente atendendo várias contas isso crescia até a função morrer sem memória,
  e o sintoma aparecia como erro aleatório pra quem nem estava fazendo nada pesado. Agora toda
  gravação faz faxina do que venceu e há teto de 12 entradas.
- **Backup completo indentado**: o `JSON.stringify(payload, null, 2)` montava uma **segunda cópia
  inteira** da carteira na memória só pra deixar o arquivo espaçado. Em carteira grande, era o
  suficiente pra estourar. O backup tem os mesmos dados; só não vem mais espaçado.

## 7. Microfone que ficava ligado

Ao ditar uma observação, se o gravador falhasse **depois** de o microfone já ter sido aberto, o
aparelho continuava **gravando** (bolinha acesa no celular) até fechar o app — mesmo com o aviso de
erro na tela. O desligamento só existia no fim de uma gravação bem-sucedida.

## 8. "Hoje" pelo relógio do aparelho, não pelo calendário de Brasília

Dois cálculos (a barra de compromisso do topo e a faixa "hoje" da Home) usavam a meia-noite do
aparelho. Com o celular em outro fuso — corretor viajando, ou relógio do Android em UTC, que
acontece em app reinstalado — das 21 h à meia-noite o "hoje" do aparelho já era o dia seguinte: a
barra anunciava como "hoje" um compromisso de amanhã, e a faixa deixava de listar o de hoje. Agora
os dois usam `inicioDoDiaBR`, como o resto do app.

## 9. Bloco de notas somava vigias de clique

Abrir o Bloco de notas com ele já aberto (gesto natural pra fechar) empilhava mais um vigia de
clique em `document`, e nada nunca os removia. Ao longo de um dia de uso, cada toque na tela acordava
todos. Agora só existe um por vez, e fechar o painel retira o que estiver de pé.

---

## O que aparecia errado NA TELA (achado no navegador, não na suíte)

### "Casa em condomínio" virava a palavra solta **"em"**

Na tela Hoje o produto passa por um encurtador que tira palavras genéricas de tipo de imóvel
("casa", "condomínio") pra sobrar só o nome do empreendimento. A lista de conectivos que ele também
tira **não tinha "em"** — então de "Casa em condomínio" sobrava o conectivo sozinho, no lugar do
nome. Agora "em/com/e/ou/sem/por/entre/até…" também saem e, se não sobrar nenhuma palavra de 3
letras ou mais, o texto conta como 100% genérico — e a tela mostra o **texto original inteiro**, que
é informação de verdade. Nome próprio junto continua sobrevivendo ("Casa em condomínio Vila
Horizonte" → "Vila Horizonte").

### Aviso embolado no Desempenho

O quadro de compromissos mostrava
**"Nenhum compromisso registradoVisitas, reuniões e lembretes aparecerão aqui."** como se fosse o
título. O acabamento dos avisos vazios montava o título com `texto.split('.')[0]` em cima do
`textContent` — que **cola** as duas linhas sem espaço nenhum. Agora o título sai do próprio
`<strong>` do aviso e a explicação que já estava escrita ali é **preservada**, em vez de ser trocada
por uma frase genérica de sistema. De quebra, o acabamento passou a reescrever **só o bloco mais
interno**: como ele varria de fora pra dentro, o cartão inteiro (título + botão) era candidato a ser
reescrito por inteiro.

### O número da versão aparecia cortado no celular: **"#124"** no lugar de **"#1247"**

Ele dividia a linha com o nome "Corretor Pro" e o excedente passava **por baixo** do bloco de
contadores do topo, que tem fundo próprio. A causa de fundo: a palavra "Atualização" é um `<span>` e
herdava o tamanho de **14 px do nome da marca** (regra `.cp-mobile-brand span`), quase o dobro do
que devia. Agora a versão tem **linha própria**, no tamanho certo, e a palavra "Atualização" volta a
caber inteira — conferido em 320, 360, 390 e 430 px. Esse número é a referência que o dono usa pra
saber se está vendo a versão certa; não podia aparecer pela metade. (A v1246 já tinha brigado com
este mesmo espaço quando o bloco foi de 2 pra 4 contadores.)

---

## Melhoria de uso: importar conversa a um toque

**Importar a conversa do WhatsApp é a ação de onde sai toda análise do produto** — e era a única sem
caminho curto. No computador, só por *Configurações → Importar conversa*; no celular, só por *Mais →
Importar conversa*: dois toques, dentro da tela de ajustes, que é onde ninguém procura uma tarefa do
dia a dia. O atalho que existia na tela Hoje (`.pickZipShortcut`) só é desenhado pra conta **sem
nenhum cliente** — ou seja, sumia exatamente pra quem usa o app todo dia.

Agora:
- **No computador**: item **"Importar conversa"** no menu da esquerda, logo abaixo de "Hoje".
- **No celular** (onde não existe menu da esquerda): botão **"Importar conversa do WhatsApp"** na
  tela Hoje, logo abaixo do título — some quando um cliente está aberto, como o resto do cabeçalho.

Os dois usam a navegação padrão do app (classe `go` + `data-target="zip"`), sem código próprio. O
botão do celular fica escondido no computador pra não duplicar o caminho.

---

## Testes

`npm test` verde: **24 arquivos checados + 407 testes**. Novos:

- `tests/v1248-importar-nao-trava-o-app.test.mjs`
- `tests/v1248-gravacoes-nao-se-atropelam.test.mjs`
- `tests/v1248-produto-e-avisos-vazios.test.mjs`
- `tests/v1248-caminho-curto-e-versao-visivel.test.mjs`

Dois testes existentes foram atualizados porque o comportamento que eles descreviam mudou **de
propósito**: `attendance-refresh.test.mjs` (o `done` do botão Copiar virou sequencial) e
`v1168-painel-admin-sino-e-agenda-hoje.test.mjs` (a faixa de hoje agora depende de `inicioDoDiaBR`).

Conferência visual: Chromium headless sobre `public/`, telas Hoje / Atendimentos / Agenda /
Desempenho / Propostas / Cérebro / Menu / Planos / Importar / Arquivados, em 320, 360, 390 e 1280 px,
antes e depois — com clique real nos dois atalhos novos de importação, confirmando que os dois abrem
a tela de importar.

## O que NÃO foi mexido (e por quê)

- **Cérebro, prompt, análise e as três mensagens**: intocados, por decisão registrada na v1247.
- **Contador diário de transcrição** (`registrarConsumoTranscricaoImport`, `_pipeline.js`): tem a
  mesma corrida de ler-somar-gravar que o contador de análises já resolveu com uma função atômica no
  banco (`reservar_analise_ia`, migração 0012). Consertar direito exige **migração nova** — ficou
  fora desta rodada de propósito, pra não misturar mudança de estrutura de banco com correção de
  defeito. Efeito hoje: o teto diário de transcrição pode ser ultrapassado por pouco quando dois
  lotes chegam no mesmo instante. É custo, não perda de dado.
- **Rota do Atalho do iPhone** (`receber-zip-atalho.js`): faz ZIP + todas as transcrições + análise
  numa requisição só, sem lote e sem orçamento de tempo — o caminho pelo Storage foi quebrado em
  etapas justamente por isso, e esta rota não recebeu o mesmo tratamento. Numa exportação com muitos
  áudios ela pode ser morta por tempo, e a unidade reservada no teto do dia não é devolvida.
  Refatoração de porte, fica anotada.
- **Mensagens de erro cruas do banco** repassadas ao app em várias ações (`lead-update`,
  `reanalisar-lead`): o corretor recebe texto técnico em inglês no lugar de instrução. Melhoria de
  clareza já mapeada, sem risco funcional — fica pra uma rodada dedicada, porque toca dezenas de
  pontos de resposta.
- **"Fazer agora" com números diferentes** na tela Hoje (a dose do dia) e no Desempenho (a
  distribuição por próxima ação): os dois estão certos pelas próprias réguas, mas usam **o mesmo
  rótulo** pra coisas diferentes, e isso confunde. Unificar é decisão de produto, não correção —
  precisa da palavra do dono antes.
