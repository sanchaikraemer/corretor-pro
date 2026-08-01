# NOTAS v1096 — A importação morrendo em "salvando no banco de dados"

## O que o dono mandou

Um print: importação em **94%**, parada em *"Salvando — salvando no banco de dados..."*, com o
aviso **"Não foi possível salvar: Sem conexão com a internet ou o servidor caiu."**

O celular estava no wi-fi, com sinal cheio. Não era a internet dele.

---

## O que aconteceu de verdade — e a culpa é minha

Foi uma regressão que **eu criei na versão 1092**, e ela só aparece em quem **ainda não aplicou a
melhoria opcional de banco** (que é o seu caso, e o de todo mundo hoje).

Explicando sem termo técnico:

Na 1092 o app passou a gravar **três informações novas** junto com cada cliente — são as
"etiquetas" que deixam a busca rápida. Só que essas três colunas ainda não existem no seu banco.

E o jeito como o app lida com coluna que não existe é o mais caro possível: ele **manda a ficha
inteira do cliente** (com a conversa completa dentro), o banco recusa reclamando de **uma** coluna,
o app tira aquela coluna e **manda tudo de novo**. Uma viagem inteira por coluna faltando.

Ou seja: onde antes havia **1 gravação**, passaram a existir **4**. E o salvamento tenta duas
vezes se a primeira falha — então **8**. Com uma conversa grande, isso passa do tempo que o
servidor tem pra responder, ele é desligado no meio, e o navegador entende que a conexão caiu.

**Daí a mensagem enganosa sobre internet.**

---

## O que foi corrigido

**1. O app agora aprende, uma vez só.** Quando o banco recusa uma coluna, ele **anota** e não manda
mais aquela coluna. A gravação seguinte já vai de primeira.

**2. E aprende antes mesmo de gravar.** A busca por cliente repetido roda segundos antes, no mesmo
pedido, e já descobre que essas colunas não existem. Agora ela avisa a gravação. Resultado: até o
**primeiro** salvamento depois do servidor ligar já vai direto.

De 4 viagens (ou 8) para **1**.

**3. A mensagem parou de culpar sua internet.** Quando a gravação não termina a tempo, o aviso
agora diz o que importa:

> *"A gravação não terminou a tempo. Sua análise NÃO foi perdida — toque em 'Salvar lead' pra
> tentar de novo."*

**Isso já era verdade antes** — a análise nunca se perdeu, os botões sempre voltaram. Só que o app
não te contava, e você não tinha como saber que era só tocar de novo.

---

## Uma observação honesta

Não tenho acesso aos registros do seu servidor, então **não posso provar com 100% de certeza** que
foi só isso. O que posso afirmar: essa multiplicação de viagens ao banco é real, foi criada por mim
na 1092, bate exatamente com o momento da falha (o passo de salvar) e com o sintoma (o servidor
desligado no meio, sem resposta).

Se acontecer de novo mesmo depois desta versão, me manda o print outra vez — o caminho seguinte a
investigar seria o tamanho da conversa e o tempo que o banco leva pra responder.

**E tem um jeito de eliminar isso de vez:** aplicar aquela melhoria opcional de banco. Com as
colunas existindo, não há nada pra descartar, e a busca ainda fica bem mais rápida. É colar um
arquivo no Supabase e apertar Run — pode ser com o app no ar, e não quebra nada.

---

## Validação feita antes de publicar

| Verificação | Resultado |
|---|---|
| Suíte completa | 272 testes verdes |
| `npm run build` | 27 arquivos, versão 1096 |
| App aberto no navegador de verdade | versão 1096, sem rolagem lateral, zero erro |

O teste novo **conta as viagens ao banco** — é o número que precisa ficar pequeno. Ele prova que
sem a correção seriam 4, e com ela é 1. E prova também que a trava de campo crítico continua de pé:
o app segue interrompendo a gravação se faltar um campo essencial, em vez de gravar dado quebrado.

**Limitação dita abertamente:** esta sessão não acessa o banco nem os registros de produção. Tudo
foi verificado aqui, com bancos de mentira que imitam um banco sem a migração aplicada.

---

## Arquivos alterados

**Código:** `api/_persistence.js`, `app.js`

**Versão:** `package.json`, `package-lock.json`

**Documentação:** `NOTAS-v1096.md` (novo)

**Testes (novo):** `tests/v1096-gravacao-nao-repete-ida-ao-banco.test.mjs`

**Testes (atualizados):** `tests/v1080-salvar-lead-timeout-e-modo-limpo.test.mjs`,
`tests/v1088-importacao-tela-cheia.test.mjs`
