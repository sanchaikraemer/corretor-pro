# Migrações do banco

## Antes de tudo: este arquivo NÃO diz o que está aplicado em produção

Nenhum documento diz. Documento envelhece e ninguém percebe — foi exatamente o que aconteceu:
em 07/08/2026 descobrimos que a migração `0009` **nunca tinha sido aplicada**, embora da `0010`
à `0014` já estivessem. O código estava numa versão e o banco em outra, e a única forma de
descobrir foi conferir função por função, à mão.

**Para saber o estado real, pergunte ao banco:**

```
/api/diagnostico?mode=banco
```

(precisa estar logado como administrador da plataforma)

Ele responde a lista completa — o que está aplicado, o que falta e qual arquivo rodar — porque a
migração `0017` ensinou o banco a se conferir sozinho, olhando o catálogo do Postgres. Ela não
acredita em "alguém marcou que rodou": ela procura a tabela, a função, o índice, a trava e a
permissão que cada migração deveria ter deixado.

Se o diagnóstico responder que o banco ainda não sabe se reportar, é porque falta rodar a própria
`0017` — é o único caso em que você precisa aplicar algo às cegas.

## Como aplicar uma migração

1. Supabase → **SQL Editor** → **New query**.
2. Cole o arquivo **inteiro** e clique em **Run**.
3. Rode `/api/diagnostico?mode=banco` de novo e confirme que ela saiu da lista de faltando.

Regras que valem pra todas:

- **Na ordem.** Migração fora de ordem pode desfazer o que outra fechou — a `0009` rodada hoje,
  depois da `0013`, reabriria a criação de empresa pelo navegador. Foi por isso que a `0015` foi
  escrita: ela faz o que faltava da `0009` sem tocar em permissão nenhuma.
- **Rodar duas vezes não quebra.** Todas são escritas pra suportar isso.
- **Se uma parar com mensagem em português, leia a mensagem.** Ela para de propósito, e o texto
  diz o que decidir (ex.: a `0015` para se algum login estiver vinculado a duas empresas).

## O que cada uma faz

A descrição de cada migração, com o motivo e o histórico, está em **`ESTADO-ATUAL.md`, seção 4**.
É lá que a lista é mantida — aqui ficaria uma segunda cópia pra envelhecer.

## O ponto de partida: `0000_baseline.sql` (v1285)

Até 17/08/2026 o repositório **não conseguia reconstruir o banco**. As duas tabelas principais — a
das conversas dos clientes (`whatsapp_processamentos`) e a das configurações (`direciona_config`,
onde vivem o Cérebro, o plano e os contadores) — foram criadas à mão no começo do projeto e nunca
existiram em migração nenhuma; da `0001` em diante elas só eram **alteradas**. Num banco vazio,
`alter table if exists` não faz nada, em silêncio.

A `0000_baseline.sql` cria essas duas tabelas no formato que elas tinham **antes** da `0001` — sem
o dono das linhas, sem as colunas de deduplicação — pra a corrente `0001 → 0018` continuar contando
a mesma história.

**É seguro rodar em produção, e lá ela não faz nada.** Tudo é `create table if not exists`. Num
banco que já tem as tabelas, é um NO-OP completo.

**Conferido num Postgres 16 de verdade (17/08/2026):** banco vazio + as 19 na ordem →
`conferir_migracoes()` devolve as 18 como "aplicada". Rodar a `0000` de novo num banco pronto:
28 colunas antes, 28 depois.

### Como trocar este baseline pelo formato REAL de produção

O `0000` foi **derivado do código**, não exportado do banco (a sessão que o escreveu não tem acesso
ao Supabase). Os nomes das colunas vêm do que o código grava e lê, então estão certos; os **tipos**
são a melhor inferência possível e podem diferir em detalhe. Isso não afeta produção — o arquivo
não a toca —, mas um banco novo criado a partir dele pode sair sutilmente diferente do original.

Pra fechar essa diferença, rode isto no **SQL Editor do Supabase de produção** e mande o resultado
para quem for atualizar o arquivo:

```sql
select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('whatsapp_processamentos', 'direciona_config')
order by table_name, ordinal_position;
```

É uma consulta de **leitura**: não altera nada e pode ser rodada a qualquer momento.
