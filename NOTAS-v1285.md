# v1285 — o banco volta a poder nascer do repositório

## O problema (achado A5 da auditoria de 16/08/2026)

O repositório **não conseguia reconstruir o banco**. Das 7 tabelas que o código usa, 5 nasciam de
alguma migração — mas as **duas principais** não:

- `whatsapp_processamentos` — a tabela dos leads: a conversa inteira e a análise de cada cliente;
- `direciona_config` — o Cérebro Comercial, o plano contratado, os contadores de uso e a chave do
  Atalho do iPhone.

Elas foram criadas **à mão**, no começo do projeto, e nunca existiram em migração nenhuma. Da
`0001` em diante, as migrações só as **alteram** — e `alter table if exists` num banco vazio não
faz nada, **em silêncio**.

O que isso significava na prática:

- **Banco perdido ou corrompido = sem volta.** O Git não trazia de volta.
- **Impossível montar ambiente de teste igual ao de produção** — que é justamente o passo que
  faltava pra parar de testar mudança de banco direto na produção.

## O que entrou

### `0000_baseline.sql` — o ponto de partida

Cria as duas tabelas no formato que elas tinham **antes da `0001`**: sem `organization_id`, sem as
colunas de deduplicação. Isso é de propósito — assim a corrente `0001 → 0019` continua contando
exatamente a mesma história (a `0001` acrescenta o dono das linhas, a `0005` troca a chave primária
da config, a `0010` acrescenta a deduplicação). Se o baseline entregasse tudo pronto, as migrações
seguintes virariam no-ops e o histórico perderia o sentido.

**É seguro rodar em produção — e lá não faz nada.** Tudo é `create table if not exists`. Num banco
que já tem as tabelas, é um NO-OP completo.

### `0019_conferencia_inclui_baseline.sql` — pra o baseline não ficar invisível

A regra do projeto desde a v1185 é que **o banco se reporte sozinho**: nenhuma migração pode ficar
fora do diagnóstico. O baseline seria a única peça sem conferência — e o teste da v1185 pegou isso
sozinho, como foi feito pra pegar.

Esta migração é aditiva e pequena: só reescreve `conferir_migracoes()` (nascida na `0017`,
reescrita pela `0018`) para incluir duas linhas novas:

- **linha 0** — as tabelas base existem mesmo?
- **linha 19** — a conferência em uso realmente cita o baseline? Ela se confere lendo o próprio
  corpo da função no catálogo do Postgres: se alguém reinstalar uma versão antiga por cima, acende
  na hora.

## Conferido num Postgres 16 de verdade (17/08/2026)

Não foi leitura de código — foi banco rodando:

| Cenário | Resultado |
|---|---|
| Banco **vazio** + as 20 migrações na ordem | todas aplicaram sem erro; **8 tabelas** criadas |
| `conferir_migracoes()` nesse banco novo | **20 de 20** reportadas como "aplicada" |
| Rodar a `0000` de novo num banco que já tem tudo | **28 colunas antes, 28 depois** — NO-OP confirmado |
| Banco montado **sem** a `0000` | linha 0 acende como **"faltando"** |

## Ressalva registrada: derivada do código, não exportada do banco

A sessão não tem acesso ao Supabase de produção (`CLAUDE.md`). Cada coluna foi levantada lendo o
que o código realmente grava e lê (`_persistence.js`, `lead-update.js`, `leads-recentes.js`,
`reanalisar-lead.js`). Os **nomes** das colunas vêm do código, então estão certos. Os **tipos** são
a melhor inferência possível e podem diferir em detalhe do que existe em produção (ex.: um inteiro
que lá é `bigint`).

**Isso não afeta produção** — o arquivo não a toca. Afeta um banco novo criado a partir dele, que
pode sair sutilmente diferente do original.

Pra fechar essa diferença de vez, `supabase/migrations/README.md` traz a consulta de **leitura** a
rodar no SQL Editor de produção; com o resultado em mãos, o baseline é substituído pelo formato
real. Enquanto isso não for feito, o essencial já está resolvido: **o banco volta a poder nascer do
repositório.**

## Guarda

`tests/v1285-banco-nasce-do-repositorio.test.mjs` — descobre sozinho todas as tabelas que o código
consulta e exige que cada uma nasça de alguma migração (as legadas `leads`/`direciona_leads` ficam
de fora de propósito: só existem no banco original do dono). Confere também que o baseline existe,
usa `if not exists`, **não contém nada destrutivo** (`drop`, `truncate`, `delete`, `alter column`),
não cria `organization_id` (quem faz isso é a `0001`) e é o primeiro arquivo da ordem alfabética.

**Suíte: 24 arquivos checados + 441 testes, todos verdes.**

## O que o dono precisa fazer

**Em produção, nada.** As tabelas já existem lá; a `0000` não teria efeito.

Vale rodar a **`0019`** no SQL Editor quando for conveniente — é o que faz o diagnóstico do banco
(`/api/diagnostico?mode=banco`) passar a mostrar as duas linhas novas. Sem ela nada quebra; o
relatório só fica sem esses dois itens.

E, quando quiser montar o ambiente de teste, agora é possível: banco novo → rodar as 20 na ordem →
pronto.
