# NOTAS v1114 — "Reanalisar todos" removido do sistema

## O que o dono pediu

> "O botão reanalisar todos que tem no sistema nós vamos retirar. Porque senão vai se tornar
> muito fácil pro usuário simplesmente reanalisar todos e gastar crédito de API à toa."

Com os planos por limite (v1110–v1112), um único toque nesse botão reanalisava a carteira
inteira — queimando o limite do dia (e boa parte do mês) do cliente sem ganho real, além do
custo de OpenAI. O caminho certo continua existindo: reanalisar **um lead por vez** (botão
"Reanalisar" dentro do lead) e a reanálise automática que já acontece a cada importação.

## O que saiu

- O card **"Reanalisar todos"** do Menu (`index.html`).
- O botão **"↻ Reanalisar todos"** da folha de ações do ➕ central (mobile, `app.js`).
- As funções inteiras `reanalisarTudo` (modal de confirmação com estimativa de custo),
  `executarReanaliseTudo` (execução em lote com progresso) e `reanalisarFalhas` (repetir
  falhas) — mais a ponte `window.reanalisarTudo`.
- Uma regra morta de CSS (`#btnReanalisarTopo`, botão que já não existia desde versões atrás).

## O que continua igual

- Reanalisar **um lead** (dentro do lead) — intacto.
- Reanálise automática na importação — intacta.
- "Aprender da carteira" (que é sem custo de análise) — intacto.

## Testes

- `tests/v971-reanalisar-tudo-conta-analise.test.mjs` **removido** (protegia um comportamento
  interno do fluxo que deixou de existir).
- `tests/v905-limpeza-7-itens.test.mjs` e `tests/v1082-sem-login-vai-pra-tela-de-entrar.test.mjs`
  atualizados: agora fixam que o botão NÃO existe em lugar nenhum (se alguém recriar por
  engano, o teste acusa).

## Validação

| Verificação | Resultado |
|---|---|
| Suíte completa | 283 testes verdes |
| `npm run build` | ok, versão 1114 |
| Navegador de verdade | Menu sem o card; folha do ➕ com 4 ações (sem o Reanalisar todos) |

## Arquivos alterados

**Código:** `app.js`, `index.html`, `styles.css`

**Documentação:** `NOTAS-v1114.md` (novo)

**Versão:** `package.json`, `package-lock.json`

**Testes:** 1 removido, 2 atualizados (ver acima)
