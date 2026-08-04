# v1129 — a trava da v1128 não estava travando nada

## O que estava errado

A v1128 criou a trava contra cadastro falso em massa e, junto, a migração `0013` — que é a peça que
faz a trava valer de verdade, tirando do navegador o direito de criar empresa direto no banco. Sem
esse fechamento a trava é decorativa: a chave "anon" do Supabase é pública (está em
`contas-config.js`), então dá pra chamar o banco por fora e pular qualquer checagem que só exista
no servidor do app.

**O fechamento não fechava.** A migração revogava a permissão de `anon` e `authenticated`, mas o
Postgres, ao criar qualquer função, já libera a execução dela pro grupo `public` — todo mundo — sem
ninguém pedir. Como `anon` e `authenticated` são membros de `public`, tirar o acesso deles não muda
nada: os dois continuam podendo chamar. A porta seguia escancarada.

## Como foi descoberto

O dono pediu o comando pra colar no Supabase. Antes de mandar, a migração foi aplicada num
PostgreSQL 16 de verdade montado aqui — com os papéis `anon`/`authenticated`/`service_role`, um
`auth.uid()` de mentira e as migrações `0001` a `0012` rodadas antes, na ordem, pra reproduzir o
banco dele. Depois de rodar a `0013` inteira, a pergunta direta ao banco:

```
select has_function_privilege('authenticated','criar_empresa_e_dono(text,text,text,text,text)','execute');
```

respondeu **`t`** (sim, ainda pode). Era pra ser `f`.

Vale registrar o que NÃO teria pego isso: a suíte inteira (299 testes verdes), a publicação, a
verificação visual no navegador. Nenhuma dessas coisas encosta em permissão de banco de dados. E o
sintoma no mundo real seria **zero** — cadastro funcionando, app normal, tudo verde, só que sem
proteção nenhuma. É o tipo de falha que só aparece se alguém for conferir de propósito.

## A correção

Uma palavra na migração: o `revoke` passa a incluir `public`.

```sql
revoke execute on function criar_empresa_e_dono(text, text, text, text, text) from public, anon, authenticated;
```

Rodando de novo no mesmo banco de teste, agora dá `f` pros dois papéis do navegador e `t` só pro
backend — e um corretor logado tentando criar empresa por fora é recusado pelo banco. A migração
continua podendo ser rodada duas vezes por engano sem quebrar nada (conferido).

## A guarda pra não voltar

`tests/v1129-migracao-0013-fecha-porta-do-navegador.test.mjs`. Ele confere, direto no texto da
migração, que:

1. as duas assinaturas de `criar_empresa_e_dono` são revogadas **incluindo `public`**;
2. a função nova (`criar_empresa_e_dono_para`) é revogada de `public` antes de ser concedida só ao
   backend;
3. a tabela do contador fica com RLS ligada e **sem nenhuma policy** (é contador interno — o
   navegador não pode ler nem escrever);
4. **nenhuma migração futura** reconcede `criar_empresa_e_dono` a `anon`/`authenticated`/`public`,
   o que desfaria a trava em silêncio.

Confirmado que a guarda pega o erro: rodada contra a versão anterior da migração, ela falha com a
mensagem explicando o problema.

## Lição pra próxima migração

Permissão de banco de dados não se confere lendo o SQL — se confere perguntando ao banco depois de
rodar. `has_function_privilege` / `has_table_privilege` respondem em uma linha, e é barato montar um
Postgres descartável pra isso (o próprio `supabase/migrations/README.md` já registrava esse hábito
nas migrações `0001`/`0002`; ele tinha se perdido pelo caminho).

## Arquivos

- Alterado: `supabase/migrations/0013_limite_cadastro_por_conexao.sql` (o `public` no `revoke`, com
  o comentário explicando por que ele não pode ser removido), `ESTADO-ATUAL.md`.
- Novo: `tests/v1129-migracao-0013-fecha-porta-do-navegador.test.mjs`.

## Conferido

- Suíte completa: **300 testes verdes**.
- Migração aplicada num PostgreSQL 16 real, em cima das migrações `0001`→`0012`, e rodada duas
  vezes seguidas: sem erro, e a porta fechada nas duas vezes.
