# v1163 — o contador de uso estava com a porta aberta: dava pra apagar o Cérebro de qualquer conta

Veio de uma auditoria técnica encomendada pelo dono ("Auditoria do Corretor Pro — versão 33"). O
item que ela chamou de "a correção mais urgente de toda a auditoria" é real, e é pior do que ela
descreveu. Esta versão fecha isso.

## O que estava aberto

A migração `0012` (v1120) criou as duas funções que contam o uso de IA:

- `reservar_analise_ia(empresa, dia, mês, teto_dia, teto_mês)`
- `reservar_contador_dia(empresa, chave, dia, teto)`

As duas rodam com poder de administrador do banco (`security definer` — precisa ser assim, senão
não conseguiriam gravar o contador) e foram liberadas pro papel `authenticated`. Elas recebem a
**empresa como parâmetro** e nunca conferem se quem está chamando pertence àquela empresa.

A chave "anon" do Supabase é pública (está em `contas-config.js`, e tem que estar) e o id da conta
original está no mesmo arquivo. Ou seja: dava pra falar com o banco por fora do app e

1. **queimar o limite diário/mensal de IA de qualquer conta** — o corretor abre o app e vê "limite
   atingido" sem ter feito nada;
2. pior: `reservar_contador_dia` aceita **qualquer nome de chave** e grava `{dia, contagem}` por
   cima da linha de `direciona_config` com aquele nome. `direciona_config` é onde moram o **Cérebro
   Comercial** (`direciona-cerebro`) e o **plano contratado** (`plano-contratado`).

Isto não é teoria. Rodando as migrações `0001`→`0013` num Postgres 16 de verdade aqui e chamando a
função como um usuário comum:

```
set role authenticated;
select reservar_contador_dia('00000000-…-0001', 'direciona-cerebro', '2026-08-07', -1);
```

o Cérebro da conta principal — método, regras, diferenciais — virou `{"dia":"2026-08-07","contagem":1}`.

O mesmo teste mostrou duas coisas que a auditoria não tinha visto:

- **`anon` também conseguia chamar.** `grant … to authenticated` não tira a liberação que o
  Postgres dá sozinho pro grupo `public` — a mesma pegadinha que a `0013` já tinha documentado
  (v1128→v1129). Na prática nem precisava criar conta.
- **A exclusão de conta do painel administrativo está quebrada.** As migrações `0007` e `0009`
  revogaram `excluir_organizacao` de todo mundo e nunca concederam ao `service_role`, que é quem o
  backend usa. `has_function_privilege('service_role', 'excluir_organizacao(uuid)', 'execute')`
  respondeu **false** no Postgres de teste, depois de aplicar as 13 migrações na ordem.

## O que a v1163 faz

**`supabase/migrations/0014_permissoes_rpc_contadores.sql`** (nova — precisa ser colada no SQL
Editor do Supabase pelo dono; é o único passo que não é automático):

1. Recria `reservar_contador_dia` aceitando **só chave de contador** (`limite-diario:*` /
   `limite-mensal:*`). Mesmo que alguém reabra a permissão um dia, o Cérebro e o plano ficam fora
   do alcance dessa função.
2. Revoga as duas funções de `public`, `anon` e `authenticated` e concede **só ao `service_role`**
   (o backend). Nenhuma tela do navegador chama essas funções — `reservar_contador_dia` não tem
   nem um chamador no código todo; era superfície de ataque pura.
3. Concede `excluir_organizacao(uuid)` ao `service_role`, consertando o botão de excluir conta.

Conferido no mesmo Postgres 16, depois de aplicar a `0014`:

| | antes | depois |
| --- | --- | --- |
| `anon` chama os contadores | sim | **permission denied** |
| `authenticated` chama os contadores | sim | **permission denied** |
| `service_role` (o app) chama | sim | sim — resposta correta |
| contador grava em `direciona-cerebro` | **sim** | **recusado pela própria função** |
| `service_role` executa `excluir_organizacao` | **não** | sim |

**`api/_persistence.js`** — a releitura dirigida a um lead (`comTimeline`) passou a filtrar também
por empresa. Não havia vazamento aqui (o id vem de uma busca que já filtrou), mas o backend usa a
chave de serviço, que passa por cima da RLS: a parede entre contas depende de **toda** consulta
filtrar. Uma consulta sem o filtro, mesmo inofensiva hoje, é o molde que alguém copia amanhã.

## Arquivos

- `supabase/migrations/0014_permissoes_rpc_contadores.sql` — nova.
- `api/_persistence.js` — filtro de empresa na releitura do lead.
- `tests/v1163-migracao-0014-contadores-so-do-backend.test.mjs` — novo. Além de guardar a `0014`,
  ele **simula as permissões finais do banco** percorrendo as migrações na ordem, incluindo a
  liberação automática pro grupo `public` que toda função nova ganha sozinha, e falha se qualquer
  função que receba empresa por parâmetro sobrar ao alcance do navegador. Essa simulação pega tanto
  o furo da `0012` quanto o da primeira versão da `0013`.
- `tests/v1085-…` e `tests/v827-15-…` — os bancos de mentira passaram a aceitar o segundo filtro da
  releitura.
- `ESTADO-ATUAL.md` — a `0014` entrou na tabela de migrações.

## Conferência

- `npm test`: 24 arquivos + **329 testes**, verdes.
- Postgres 16 de verdade: migrações `0001`→`0014` aplicadas na ordem, ataque reproduzido antes e
  recusado depois (tabela acima).
- Sem mudança de tela — nada do que o corretor vê muda nesta versão.

## O que ainda depende do dono

A migração **não se aplica sozinha**. Enquanto o SQL da `0014` não for colado no SQL Editor do
Supabase, a porta continua aberta no banco de produção — publicar o código não muda isso.
