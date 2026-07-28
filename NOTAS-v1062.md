# NOTAS v1062 — Removido de vez o filtro que mexia no nome do lead

## O relato

Depois da correção da v1061 (que fazia o nome editado à mão escapar do filtro de limpeza), o
dono foi taxativo: "retire esse 'filtro' de limpesa, nao pode ter isso, tenque salvcar como
quiser e como esta salno no celular na hora de importar, simples assim."

## O que mudou

A v1061 tinha resolvido o sintoma (nome editado manualmente deixava de ser filtrado) mas mantinha
o filtro (`limparRuidoNome`, em `api/_persistence.js`) ativo pra nome vindo direto da importação —
ainda apagando palavras como "cel", "celular", "whatsapp", "terreno(s)", "lote(s)", "apto(s)",
"apartamento(s)", "fone", "tel" de dentro do nome do contato. O dono deixou claro que não quer
esse comportamento em hipótese nenhuma: o nome tem que aparecer exatamente como está salvo no
celular do corretor (o nome do contato no WhatsApp), sem nenhum filtro — editado à mão ou não.

Esta versão remove a função `limparRuidoNome` por completo (não só o pula em alguns casos) e,
junto, desfaz o mecanismo intermediário da v1061 que ficou sem função depois disso: a marca
`resultado_analise.nomeEditadoManualmente` (em `api/lead-update.js`) e sua preservação na
reanálise (`api/reanalisar-lead.js`) — sem o filtro, não existe mais nada de que precisem
"escapar", então mantê-los seria complexidade sem propósito. `nameFrom()` agora só faz o mínimo
necessário pra não mostrar o arquivo `.zip` bruto ou um telefone no lugar do nome; nunca mexe no
conteúdo do nome em si.

## Testes

- `tests/v1061-nome-editado-manualmente-nao-e-limpo.test.mjs` (reescrito): confirma que um nome
  com "terreno" aparece intacto tanto editado à mão quanto vindo direto da importação (sem
  precisar de nenhuma marca especial), e que `limparRuidoNome` não existe mais em
  `api/_persistence.js`.
- `npm test`: suíte inteira verde.

## Arquivos

`api/_persistence.js` (`limparRuidoNome` removida, `nameFrom` simplificado), `api/lead-update.js`
e `api/reanalisar-lead.js` (marca `nomeEditadoManualmente` da v1061 removida — sem uso depois do
filtro sair), `tests/v1061-nome-editado-manualmente-nao-e-limpo.test.mjs` (reescrito),
`package.json`/`package-lock.json` (versão + script `test`), `NOTAS-v1062.md`, versão
**1061 → 1062**.
