# v1165 — o que fica no celular vai embora junto com a conta

Item 6 (e os passos 8 e 9 da lista de prioridades) da auditoria de 07/08/2026. É o último dos
pontos que a auditoria marcou como "corrigir antes de aumentar a base de clientes" que dependia de
código — e o único que sobrava antes de convidar corretores parceiros.

## O que estava errado

Sair da conta só encerrava a sessão e voltava pra tela de entrada. **Tudo o que o app guarda no
próprio aparelho continuava lá** — e o Cérebro Comercial mora numa chave global, sem dono
(`direciona-cerebro-config`). No mesmo celular, isso significava:

- se o servidor demorasse ou falhasse, o app cai na cópia local do Cérebro — e a conta que acabou
  de entrar veria **o método, as regras e os diferenciais do corretor anterior**;
- pior: ao salvar, essa cópia herdada seria gravada **por cima** do Cérebro da conta nova;
- o **ZIP da última conversa compartilhada** continuava no aparelho, com a conversa inteira de um
  cliente que não é do novo corretor;
- o retrato do lembrete diário guarda **até 3 nomes de clientes** — a notificação do celular sairia
  com o nome dos clientes do corretor anterior.

Nada disso é hipótese num piloto em que o dono entra na conta dos parceiros pra ajudar.

## O que a v1165 faz

Arquivo novo `js/dados-locais.js`, com uma regra em duas faixas:

| Faixa | O que é | Some quando |
| --- | --- | --- |
| **Comercial** | Cérebro em cópia local, importação pendente, fila do aprendizado, compromissos dispensados, lembrete diário, chave antiga compartilhada, período dos áudios, ZIP compartilhado (IndexedDB), retrato do lembrete com nomes (IndexedDB), caches `direciona-sharetarget-*` | **ao sair da conta** e ao trocar de dono |
| **Uso do corretor** | `cpAtividade_*`, `cpTempoAppPorDia`, tutoriais já vistos, marca de limpeza | **só quando o dono muda** |
| **Neutro do aparelho** | tema | **nunca** |

A separação das duas primeiras faixas é de propósito: os contadores de atividade **só existem neste
aparelho** (nunca sobem pro servidor). Apagá-los num logout comum tomaria do próprio corretor o
histórico da tela Desempenho — sair e voltar na mesma conta não pode ter esse preço.

**Onde entra:**

- `entrar.html` e `cadastro.html` — logo depois de o login/cadastro confirmar **quem** entrou, antes
  de abrir o app. É a passagem em que o aparelho realmente troca de dono, e por isso não existe
  janela de tempo em que o app leia dado da conta anterior.
- `app.js` — no botão **"Sair da conta"** (apaga o comercial) e na abertura, como rede de segurança
  pra uma sessão que tenha trocado sem passar pelas telas de entrada.

Nenhuma dessas chamadas pode impedir entrar ou sair: qualquer falha é ignorada e o caminho segue.

**Primeira vez depois desta atualização o app NÃO apaga nada.** Sem carimbo anterior, o dado que
está no aparelho é do próprio corretor que já usava — só adota o dono atual. Apagar ali tomaria
dele o histórico de Desempenho e uma importação em andamento sem motivo nenhum.

## Arquivos

- `js/dados-locais.js` — novo.
- `app.js` — importa o módulo; `cpSairDaConta` limpa antes de redirecionar; a abertura carimba/limpa.
- `entrar.html`, `cadastro.html` — carimbam/limpam no momento em que a conta entra.
- `service-worker.js` e `build.js` — o módulo novo entra na lista de arquivos publicados e no
  precache (senão o app instalado não teria o arquivo offline).
- `supabase/migrations/0015_travas_da_0009_fora_de_ordem.sql` — nova (ver Parte 2).
- `supabase/migrations/0009_...` — aviso no topo: hoje se aplica a `0015` no lugar dela.
- `tests/v1165-migracao-0015-nao-reabre-porta.test.mjs` — novo.
- `tests/v1129-...` — a guarda passou a olhar pra quem o GRANT é dado.
- `tests/v1165-dados-locais-nao-passam-de-uma-conta-pra-outra.test.mjs` — novo. Roda o módulo de
  verdade contra um aparelho de mentira (localStorage, IndexedDB e caches simulados), cobrindo os
  cinco casos: dono trocou, mesma conta de novo, primeira vez sem carimbo, saída da conta e sem
  sessão. Também confere que as três telas realmente chamam a limpeza.
- `ESTADO-ATUAL.md` — seção 5-A.

## Conferência

- `npm test`: 24 arquivos + **332 testes**, verdes.
- Teste de mutação: desligando a limpeza no módulo, o teste novo falha (não é guarda de enfeite).
- **Chromium headless (390×844), com o app publicado**: celular do "corretor A" montado com Cérebro,
  importação pendente, ZIP compartilhado, nomes no lembrete, contador de atividade e tema. Depois de
  o "corretor B" entrar:

  | | resultado |
  | --- | --- |
  | Cérebro do A | apagado |
  | importação pendente do A | apagada |
  | ZIP compartilhado (IndexedDB) | apagado |
  | nomes de clientes do lembrete (IndexedDB) | apagados |
  | caches de compartilhamento | apagados |
  | cache do app (`direciona-static-*`) | **mantido** (senão o app não abriria sem internet) |
  | contador de atividade do A | apagado |
  | tema do aparelho | **mantido** |
  | carimbo de dono | passou a ser o corretor B |

  E saindo da conta na mesma tela: Cérebro e chave antiga apagados, carimbo removido, **histórico de
  uso do próprio corretor mantido**. Zero erro de JavaScript nos dois cenários.

## Parte 2 — a conferência do banco achou a `0009` faltando (e a minha consulta com um erro)

O dono rodou a consulta de conferência das migrações e mandou o print: **`0004` e `0009` apareceram
como "FALTA APLICAR"**.

**A `0004` era falso alarme — erro meu, na consulta.** Ela procurava o índice
`direciona_config_org_chave_uidx` pelo nome, e a migração `0005` **apaga esse índice de propósito**
(ele vira redundante quando `(organization_id, chave)` passa a ser a chave primária). Num banco
corretamente migrado, esse índice **não existe mesmo**. O erro só não apareceu quando testei porque
a minha própria sequência de teste rodou a `0004` depois da `0005`. A consulta corrigida (no lugar
de procurar o nome do índice) pergunta o que interessa: `direciona_config` tem `organization_id`
obrigatório **e** unicidade sobre `(organization_id, chave)`, com qualquer nome.

**A `0009` está faltando de verdade** — e o reflexo óbvio ("então roda a 0009") seria um erro: no
passo 1 dela existe `grant execute on function criar_empresa_e_dono(text) to authenticated`, que é
exatamente o que a `0013` revogou. Aplicá-la hoje, fora de ordem, **desfaria a `0013` em silêncio**.

Por isso a migração nova **`0015_travas_da_0009_fora_de_ordem.sql`**, que faz os três pedaços que
faltavam sem tocar em permissão nenhuma:

1. trava de **uma empresa por login** no banco (`memberships_um_por_usuario`) — hoje duas
   requisições simultâneas de cadastro podem criar duas empresas e dois testes grátis pro mesmo
   login, porque a checagem que existe é no código, e código não é atômico;
2. **`organization_id` obrigatório** em `whatsapp_processamentos` (com o preenchimento antes) — sem
   isso nada no banco impede um lead nascer sem empresa, e lead sem empresa **some da carteira**
   sem ninguém conseguir ver;
3. **`search_path` fixo** em toda função `security definer`, via `alter function` — que fixa sem
   reescrever o corpo, e por isso não ressuscita versão antiga de função nenhuma.

E, no fim, **reafirma os revokes da `0013` e da `0014`**: rodar a `0015` conserta qualquer aplicação
fora de ordem que tenha reaberto alguma porta. Se algum login estiver vinculado a duas empresas, ela
**para com uma mensagem em português** dizendo quais, em vez de um erro cru de banco.

O arquivo `0009` ganhou um aviso no topo: hoje se aplica a `0015` no lugar dele.

**Conferido num Postgres 16 de verdade**, com as migrações `0001`→`0014` aplicadas na ordem e a
`0009` desfeita pra simular o banco do dono:

| | antes da 0015 | depois |
| --- | --- | --- |
| uma empresa por login (trava no banco) | falta | **SIM** |
| lead sempre com empresa | falta | **SIM** |
| funções com `search_path` fixo | falta | **SIM** |
| `anon`/`authenticated` chamam criar empresa ou os contadores | não | **continua não** |
| `service_role` (o app) | funciona | **continua funcionando** |

Rodar a `0015` duas vezes não quebra nada, e com login duplicado ela para com aviso claro (as duas
coisas testadas no mesmo banco).

Ainda: a guarda `v1129` (que impede uma migração nova devolver a criação de empresa pro navegador)
passou a olhar **pra quem** o `GRANT` é dado, em vez do trecho inteiro — do jeito antigo ela acusava
a `0015`, que faz o contrário do que ela procura. Continua pegando uma reconcessão de verdade
(testado).

## O que isso fecha

Com esta versão, os itens que a auditoria classificou como "corrigir antes de aumentar a base de
clientes" e que dependiam de código ficam assim: política de privacidade (v1164), CPF fora do site
(v1164), filtro de empresa na releitura (v1163) e agora armazenamento local isolado por conta.
Continuam abertos — e não bloqueiam um piloto pequeno — o cadastro atômico, a fila de nova tentativa
na exclusão e o prazo automático de descarte do registro de conexão.
