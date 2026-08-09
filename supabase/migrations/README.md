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
