# NOTAS v1070 — "Análises feitas" não contava a análise automática de cada importação

## Contexto

O dono mandou um print da tela Desempenho perguntando por que "Análises feitas" (19) estava tão
abaixo de "Importações" (90), já que toda conversa importada é analisada pela IA — os dois
números deveriam estar muito mais próximos.

## Causa

`cpRegistrarAtividade("analise")` (a contagem usada por "Análises feitas") só era chamada em dois
lugares:

1. Reanalisar 1 lead específico (botão dentro do lead, `ui670Reanalisar` — v929).
2. "Reanalisar todos" (`executarReanaliseTudo` — v971).

Nenhum dos dois é o caminho de uma **importação nova**. A etapa que de fato manda a conversa pra
IA analisar (`processarStorageEmEtapas`, a função que roda pra todo ZIP recebido — seja
compartilhado do WhatsApp ou pelo Atalho do iPhone) nunca registrava essa atividade. Resultado:
"Análises feitas" só contava reanálise manual, nunca a análise automática que acontece em toda
importação — por isso o número ficava muito menor do que a realidade.

## Correção

`processarStorageEmEtapas` agora registra a atividade "analise" assim que a IA termina de
analisar a conversa com sucesso (depois de confirmar que as três mensagens sugeridas passaram
pelas regras do Cérebro — não conta uma análise que ainda está pendente). Isso cobre os dois
jeitos de importar (compartilhar do WhatsApp, Atalho do iPhone), já que os dois passam por essa
mesma função.

**Importante**: essa contagem fica só neste aparelho (é assim desde a v929, não sincroniza
celular↔PC) — então o número só volta a bater de verdade daqui pra frente, contando as
importações feitas a partir desta versão. O que já passou não é recontado.

## Verificação

- `tests/v1070-analise-conta-na-importacao.test.mjs` (novo): confirma que o registro acontece
  depois da validação das 3 mensagens e nunca antes.
- Suíte inteira (`npm test`) verde.
- `npm run build` limpo.

## Arquivos

`app.js`, `tests/v1070-analise-conta-na-importacao.test.mjs` (novo), `package.json`/
`package-lock.json` (versão **1069 → 1070**), `NOTAS-v1070.md` (este arquivo).
