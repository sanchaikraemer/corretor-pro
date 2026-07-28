# NOTAS v1054 — "atendido há" fica visível na lista, sem precisar abrir o lead

## O relato

Depois da v1053, o dono continuou vendo "há 5d" na Karine, mesmo tendo dito que a atendeu no app.
Analisando a lógica: se o número mostrasse os dias do atendimento sempre que ele existisse (regra
da v1053) e ainda assim mostrava "5d", só havia uma explicação — **o app não estava encontrando
nenhum atendimento registrado pra ela**. O dono confirmou: ela também nunca aparece na aba
"Atendimentos".

## O problema real

Não era mais um bug de cálculo — era falta de informação visível. A diferença entre "esse número é
de um atendimento reconhecido" e "esse número é só da última mensagem, o lead nunca foi atendido"
só existia no `title` (o texto que aparece passando o mouse) — invisível no celular, sem jeito de
ver sem abrir cada lead um por um.

## A correção

O texto visível na lista agora diferencia os dois casos direto:

- **"atendido há Xd"** — existe um atendimento reconhecido pelo app (algum clique em "Marcar
  atendimento" ou "Copiar sugestão" já registrado).
- **"há Xd"** (sem a palavra "atendido") — não existe nenhum atendimento reconhecido; esse número é
  só a última mensagem trocada.

Com isso, dá pra ver na hora, olhando só a lista, se um lead nunca foi marcado como atendido —
sem precisar abrir cada card pra descobrir.

## O que descobri no caminho

Revisei o código que grava "Marcar atendimento" e "Copiar sugestão" e ele está correto — registra
o clique certinho, com aviso de erro se falhar. Como a Karine nunca aparece nem na aba
"Atendimentos", o mais provável é que o clique de atendimento pra ela nunca tenha sido concluído
de verdade (falha de rede no momento, lead errado, ou as mensagens de divulgação enviadas por
outra ferramenta, fora do botão "Copiar" do app). Pedi pro dono testar clicando em "Marcar
atendimento" pra ela agora, pra confirmar se o sistema passa a reconhecer — se não passar, é sinal
de bug de verdade, e aí vou atrás com essa confirmação em mãos.

## Testes

- `tests/v1054-rotulo-atendido-visivel-na-lista.test.mjs` (novo): confirma que o texto visível
  diferencia "atendido há" (com atendimento reconhecido) de "há" simples (sem nenhum atendimento).
- `npm test`: suíte inteira verde (3 testes antigos ajustados pro novo texto visível: v972, v1018,
  v1053).
- `npm run build`: build limpo, 27 arquivos publicados.

## Arquivos

`app.js` (`cpHomeLeadRow`: rótulo "atendido há" vs "há"), `tests/v1054-rotulo-atendido-visivel-na-lista.test.mjs`
(novo), `tests/v972-clareza-fila-hoje.test.mjs`, `tests/v1018-atendimento-e-nao-mensagem-define-espera.test.mjs`,
`tests/v1053-numero-fila-hoje-usa-atendimento-nao-mensagem.test.mjs` (ajustados),
`package.json`/`package-lock.json` (versão + script `test`), `NOTAS-v1054.md`, versão
**1053 → 1054**.
