# Revisão completa do Corretor Pro — 18/08/2026 (v1292)

> Pedido do dono: *"revise o sistema todo em busca de erros ou linhas inúteis, quebradas e ou ações
> sem uso, e também funções desativadas que não são mais chamadas, e me diga se tiver dúvida quais
> funções pode retirar ou não que lhe aponto"*.
>
> **Nada foi alterado no sistema.** Nenhum arquivo de `app.js`, `api/`, `index.html`, `styles.css`
> ou `service-worker.js` foi tocado — a versão continua **1292**. Este arquivo é só o laudo; as
> remoções só acontecem depois que o dono apontar o que sai e o que fica (PARTE 3).
>
> Suíte executada nesta revisão: `24 arquivo(s) checado(s) + 447 teste(s), todos verdes.`

## Como esta revisão foi feita

Sete varreduras automáticas, todas rodadas de verdade sobre o código de hoje, e cada achado
conferido à mão depois (regex erra muito neste projeto, por causa das telas montadas dentro de
texto):

1. toda função declarada em `app.js` **em qualquer profundidade** (não só no topo, como faz o
   teste `v1186-nada-de-codigo-morto`) cruzada com todos os usos em app, telas, módulos e testes;
2. todo `onclick=`/`onchange=` das telas contra a lista de funções realmente publicadas em
   `window` (como `app.js` é módulo, botão que chama função sem ponte não faz nada);
3. toda chamada a nome que não existe no arquivo (o que quebraria na hora);
4. função declarada duas vezes, código depois de `return`, bloco vazio;
5. identificadores de tela procurados pelo código × identificadores que existem de fato;
6. ações que a tela pede × ações que o servidor atende (nos dois sentidos);
7. classes de CSS, exportações de módulo, chaves salvas no aparelho e campos de estado sem leitor.

### Grau de certeza

| Marca | Significa |
|---|---|
| **RASTREADO** | segui o caminho no código, de onde nasce até a tela, e confirmei à mão |
| **MEDIDO** | número contado no arquivo |

---

# PARTE 1 — Coisas que rodam e não aparecem pra ninguém

Estes são os achados que importam: não é lixo parado, é código que **executa** e joga o resultado
fora, porque o pedaço de tela que ele preenche não existe mais.

## E1. O aprendizado automático da carteira fala sozinho — **RASTREADO**

O aprendizado contínuo (aquele que vai lendo suas conversas em segundo plano) escreve o andamento
em nove momentos diferentes: *"Aprendendo automaticamente com os históricos…"*, *"Aprendizado
automático em andamento: 37 históricos verificados"*, *"Recuperando histórico 2/5 que não foi
aprendido na primeira tentativa"*, *"Aprendizado pausado na conversa 12: …"*.

Todas essas frases são escritas dentro de um lugar da tela chamado `#cerebroCarteiraStatus`
(`app.js:6914`) — **e esse lugar não existe em nenhuma tela do app.** Ele não está no `index.html`
nem é criado por código.

Resultado prático: o aprendizado roda, avança, falha e se recupera **sem você ver nada disso**.
Quando trava numa conversa, a mensagem que explicaria o problema é escrita no vazio.

- Onde: `app.js:6914` (a função que escreve) e as 9 chamadas entre `app.js:6979` e `app.js:7084`.

## E2. O aviso de "sistema fora do ar" nunca aparece — **RASTREADO**

Existe uma conferência que pergunta ao servidor se a transcrição de áudio e o salvamento de
conversas estão funcionando, e escreve na tela avisos como *"Transcrição de áudios indisponível no
momento"*.

Ela morre na primeira linha: procura o lugar `#statusStamp`, não encontra, e desiste
(`app.js:9780`). O pedido ao servidor nem chega a sair.

Ou seja: **se a transcrição de áudio cair, o app não te avisa.** Você descobre pelo resultado ruim
da análise.

- Onde: `app.js:9779-9798` (20 linhas que nunca passam da segunda).

## E3. Metade do quadro do Desempenho é calculada e jogada fora — **RASTREADO / MEDIDO**

A tela de Desempenho monta, a cada carregamento, quatro números e um gráfico de rosca: *atendidos
hoje*, *sem resposta há 3+ dias*, *lembretes*, *compromissos*, mais o *total de atendimentos*.

Dos 12 lugares de tela que essa função preenche, **4 não existem**: `cpActivityDonut`,
`cpActivityLegend`, `cpActivitiesDone` e `cpActivitiesTotal`. Os outros 8 existem e funcionam.

> **ERRO DESTA AUDITORIA, corrigido na v1294:** a versão original desta linha dizia "5 não existem"
> e incluía `cpTotalAtendimentos`. Ele **existe** — é o número grande no meio da rosca "Prioridade
> de atendimento", que aparece e funciona. Foi falha da varredura automática (comparou o nome com
> uma aspa sobrando). Conferido antes de qualquer corte; ele não foi removido.

Então esse pedaço — a rosca da atividade do dia com a legenda de quatro linhas e o total de
atendimentos — é **contado sobre a carteira inteira toda vez que a tela desenha, e descartado**.
Com carteira grande isso é trabalho à toa em cada render.

- Onde: `app.js:11729-11737`, dentro de `renderCorretorProDashboard`.

## E4. A pergunta "o cliente respondeu?" não tem mais porta de entrada — **RASTREADO**

O recurso inteiro existe e está completo: os botões *sim / não / ainda aguardando*, a gravação no
servidor, o tratamento de falha de internet, o registro no aprendizado (`cliente_respondeu`) e até
o rótulo dele na linha do tempo.

Só que **nada no app desenha esses botões**. São cinco funções encadeadas (`app.js:2333`, `9546`,
`9555`, `9563`, `9568`, cerca de 55 linhas) e a primeira delas não é chamada de lugar nenhum.

Isso já estava anotado no teste do projeto como pendência ("a v1189 diz que ela continua valendo"),
e continua pendente. Como o `cliente_respondeu` alimenta o aprendizado, **o Cérebro está sendo
privado desse sinal desde que a tela sumiu.**

## E5. O convite de boas-vindas é uma caixa vazia — **RASTREADO**

No `index.html:197` existe `<div id="bannerOnboarding" hidden></div>` — uma caixa **sem nada
dentro**. O código calcula direitinho quando ela deve aparecer (corretor com 1 a 4 clientes que
ainda não dispensou, `app.js:4117-4122`) e manda mostrar: aparece uma caixa vazia, ou seja, nada.

Junto disso ficaram três linhas soltas em `js/pwa-install.js:216-228`: a função que fecha esse
convite e dois botões (`bannerOnboardingFechar`, `bannerOnboardingOk`) que não existem. E a função
`abrirOnboarding`, que segundo o próprio teste do projeto *"é chamada via onclick inline do HTML
(index.html)"* — **não é**: `abrirOnboarding` não aparece uma única vez no `index.html`. O botão do
Menu que a chamava sumiu em alguma faxina.

O tutorial que funciona hoje é outro, o da v1149 (`cp1149AbrirSePrimeiraVez`), esse sim ligado.

## E6. Um comentário do código afirma uma coisa que não é verdade — **RASTREADO**

Em `app.js:2419` está escrito: *"A régua em si (cpSemAtenderHaDias) CONTINUA, porque a fila 'Fazer
agora' usa ela."*

Conferi a fila inteira (`cpFilaFazerAgora`): ela decide por `cpCadenciaSemResposta`,
`ultimoAtendimentoTs` e `emJanelaDeEspera`. **Ela não usa `cpSemAtenderHaDias` em momento nenhum** —
ninguém no app usa. A função só continua viva porque quatro testes de calibragem a executam.

Isso importa mais do que parece: é uma anotação errada que a próxima sessão vai ler e acreditar.

---

# PARTE 2 — Peso morto, sem efeito na tela

Código que não faz nada e não quebra nada. Ocupa espaço e confunde quem lê depois.

| O que | Onde | Tamanho |
|---|---|---|
| `copiarMensagemLead` — copiar a mensagem direto do card da Home; nenhum botão chama | `app.js:3089-3120` | 32 linhas |
| `cardTop` — desenho do card do "top 3" da Home, de quando a Home tinha top 3 | `app.js:3162-3176` | 15 linhas |
| `cp704SelectMsg` — escolher qual das 3 mensagens fica selecionada; ninguém chama (os botões de copiar já mandam a opção direto) | `app.js:5417-5419` | 3 linhas |
| `cp704OpenWhats` — abrir o WhatsApp com a mensagem escolhida, da tela do cliente | `app.js:5479-5484` | 6 linhas |
| `renderCarteiraTabela` | `app.js:13152-13155` | 4 linhas |
| `reagendarDias` — atalho de reagendar sem abrir o painel (o próprio comentário diz que é opcional) | `app.js:6108-6112` | 5 linhas |
| `aprendizadoRefresh` — botão de recarregar a tela de aprendizado, que não existe | `app.js:7108` | 1 linha |
| `legacyRestoreBtn` / `legacyRestoreStatus` — botão e status da restauração antiga; a restauração funciona, só esses dois pedaços de tela é que não existem | `app.js:461-462` | 2 linhas |
| `state.obsCarregada` — gravado duas vezes, lido nunca | `app.js:9236` e `9274` | 2 linhas |
| ~~`cp-ja-entrou`~~ — **ERRO DESTA AUDITORIA, corrigido na v1293:** ela É lida pela tela de entrar, através de uma constante que a varredura automática não enxergou. É o que faz quem acabou de criar a conta ver o login em vez do convite. **Não foi removida.** | `cadastro.html` | — |
| 12 classes de CSS sem nenhum uso (viraram 13 na execução): `dash-btn`, `dash-card`, `dash-desemp`, `dash-stats`, `dash-sub`, `gauge`, `gv`, `dh`, `home-saud-acoes`, `ins-ic`, `ins-item`, `seq-link` | `styles.css` | — |

**Já documentadas pelo próprio projeto** (estão na lista de exceções do teste
`v1186-nada-de-codigo-morto`, cada uma com o motivo): `aprenderDaCarteira`, `importarTelefonesCSV`,
`reanalisarEmSegundoPlano`, `renderRespostaCliente`, `auditarDadosV681`, `excluirLeadDefinitivo`,
`cpNotaPrioridade`, `cpPrecisaAcaoHoje`, `cp786PrecisaAcao`, `cp786AguardandoCliente`,
`cp786MetaConducao`. Somadas às da tabela acima, são **20 funções sem chamador** em `app.js`.

## P2.1 — A rede de segurança da saudação está desligada (de propósito)

`garantirSaudacaoAbertura` (`js/saudacao.js:90`) é a função que, quando a IA devolvia uma sugestão
sem cumprimentar, colocava *"Bom dia, Gabriel! "* na frente. Na reescrita que você entregou na
v1291, ela saiu do caminho: hoje quem manda na saudação é o Cérebro, e o teste da v1274 **exige**
que a análise não a chame mais.

Ou seja: ela está correta, testada e desligada. Não é erro — é uma decisão sua. Só está aqui porque
é a única função do projeto nessa situação, e alguém vai tropeçar nela.

---

# PARTE 3 — As dúvidas: o que eu preciso que você decida

Divido em três grupos. Nenhum será mexido sem sua palavra.

### Grupo A — recursos que sumiram da tela: religar ou apagar?

Cada um destes está pronto e funcionando por dentro, só sem porta de entrada. Não dá pra decidir
por você, porque religar muda o que aparece no app:

1. **A pergunta "o cliente respondeu?"** (E4) — religar num botão na tela do cliente, ou apagar de
   vez? Lembrando: enquanto está fora, o Cérebro não recebe esse sinal.
2. **O andamento do aprendizado da carteira** (E1) — quer ver esse texto em algum lugar (Cérebro,
   Menu), ou o aprendizado deve seguir silencioso e eu apago as 9 mensagens?
3. **O aviso de "transcrição fora do ar"** (E2) — quer o aviso de volta no topo, ou apago?
4. **O quadro "atividade do dia" do Desempenho** (E3) — rosca + legenda + total de atendimentos:
   devolvo pra tela ou apago o cálculo?
5. **O convite de boas-vindas vazio** (E5) — o tutorial da v1149 já cobre isso; posso apagar a
   caixa vazia e as linhas soltas, ou você quer o convite antigo de volta?
6. **`aprenderDaCarteira` e `importarTelefonesCSV`** — já estavam na lista de pendências desde a
   v1268 ("aguarda decisão do dono"). Continua em aberto: religa num botão ou apaga?

### Grupo B — posso apagar sem você perder nada? (minha recomendação: sim)

Tudo da PARTE 2 que **não** tem recurso por trás: `cardTop`, `cp704SelectMsg`, `renderCarteiraTabela`,
`aprendizadoRefresh`, `legacyRestoreBtn`/`legacyRestoreStatus`, `state.obsCarregada`, `cp-ja-entrou`
e as 12 classes de CSS. São cerca de 30 linhas e nenhuma delas chega na tela hoje.

Dois casos do grupo B que quero confirmar antes, porque são *ações* e não sobras:

- **`copiarMensagemLead`** (32 linhas) — copiar a mensagem pronta **direto do card da Home**, sem
  abrir o cliente. Hoje você só copia entrando no cliente. Isso já foi um botão. Quer de volta?
- **`cp704OpenWhats`** — botão *"Abrir WhatsApp já com a mensagem"* dentro da tela do cliente. Hoje
  o WhatsApp abre pela bolinha verde do card (sem a mensagem junto) e você cola à mão. Quer de volta?

### Grupo C — arrumar a documentação errada

- O comentário mentiroso do `app.js:2419` (E6) — corrijo o texto e mantenho a função (os testes de
  calibragem dependem dela)?
- O teste `js-pwa-install-module.test.mjs` afirma que `abrirOnboarding` é chamada pelo `index.html`,
  e não é mais. Corrijo a afirmação junto com a decisão do item 5 do Grupo A.

---

# PARTE 4 — O que eu conferi e está limpo

Para ficar registrado que estas frentes foram varridas e não têm achado:

- **Botão que não faz nada:** zero. Todo `onclick=` das telas aponta pra função que existe e está
  publicada — conferido contra as 209 pontes `window.*` do `app.js` e as dos módulos.
- **Chamada pra função inexistente** (o que quebraria na hora): zero. As quatro suspeitas
  (`atualizarVoltarProposta`, `cp1148JuntarCliente`, `cp704CopyMsg`, `cp903Confirm`) resolvem
  corretamente em tempo de execução, e `cp903Confirm` ainda é chamada com proteção.
- **Função declarada duas vezes** (a segunda apagaria a primeira em silêncio): zero, em todos os
  arquivos de `app.js`, `js/` e `api/`.
- **Código depois de `return`/`throw`** e bloco vazio: zero.
- **Ação que a tela pede e o servidor não atende:** zero. As duas suspeitas eram falso positivo —
  `atualizar-analise-comercial` só existe dentro de um comentário (a v1186 já tinha corrigido), e
  `excluir-conta` é atendida em `api/admin-contas.js:315`.
- **Arquivo citado que não existe:** zero no `service-worker.js`, no `vercel.json` e no
  `index.html` (o `vendor/` é gerado no build).
- **Rota de `api/` sem quem chame:** nenhuma. As 11 rotas públicas têm consumidor na tela.
- **Módulo de `js/` sem quem importe:** nenhum. Os 10 estão em uso.
- **Exportação sem consumidor:** só as de apoio a teste (`_colunasInexistentesEstado`,
  `_colunasInexistentesResetar`, `_dedupeIndexadoResetar`, `CEREBRO_DEFAULTS`), o que é correto.
- **Chave salva no aparelho e nunca lida:** só a `cp-ja-entrou`, já listada.
- **Campo do estado sem leitor:** só `state.obsCarregada`, já listado.

---

# PARTE 5 — Um buraco na rede de proteção (independe das decisões acima)

Não é código morto, é sobre a suíte que protege o app. Vale corrigir de qualquer jeito.

A checagem de digitação (`node --check`, em `tests/run-all.mjs:27-33`) roda sobre uma lista escrita
à mão. Essa lista:

- **ainda cita `js/tema.js`**, apagado na v1268 (não quebra nada, porque o executor pula arquivo que
  não existe — mas é linha morta dentro da própria rede de proteção);
- **não inclui `js/importacao.js`** — as 1.495 linhas da importação inteira, o segundo maior arquivo
  do front. Os 50 testes que falam dele só **leem o texto** do arquivo; nenhum executa. **MEDIDO:**
  `node tests/run-all.mjs --somente-sintaxe` confere 24 arquivos, e `js/importacao.js` não é um
  deles.

Tradução: hoje, um erro de digitação em `js/importacao.js` passa pela suíte inteira verde e só
aparece no celular, na hora em que você for importar uma conversa. As rotas de `api/` já são
descobertas sozinhas; os módulos de `js/` não. A correção é de uma linha (descobrir a pasta `js/`
sozinha, como já se faz com `api/`), e recomendo fazer junto com o que você decidir acima.

---

# O QUE FOI FEITO DEPOIS DESTE LAUDO

O dono respondeu item a item no mesmo dia. O resultado está em **`NOTAS-v1293.md`**: o aviso de
serviço fora do ar voltou pra tela, a pergunta "o cliente respondeu?" e a rede de segurança da
saudação foram removidas, e a faxina do peso morto tirou 429 linhas — revelando, no caminho, uma
cadeia de nove funções que só estavam vivas por causa de uma décima (o card do "top 3" da Home).

As duas redes furadas apontadas na PARTE 5 e no item E6 foram consertadas: a régua do teste de
código morto agora enxerga o arquivo inteiro, e a conferência de digitação passou a incluir a
importação (24 → 29 arquivos).

Na sequência, a **v1294** fechou os dois últimos: a rosca "Atividade do dia" (E3) e o andamento do
aprendizado (E1) foram apagados a pedido do dono — cinco varreduras da carteira a menos por desenho
de tela, com o aprendizado em si intacto e trancado por teste.

**Continua pendente, só isto:** `aprenderDaCarteira` e `importarTelefonesCSV`, esperando decisão
desde a v1268.
