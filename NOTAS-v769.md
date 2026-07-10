# v769 — Reanálise apagava o nome do cliente

## O problema (relatado pelo usuário)

Um lead apareceu na tela como "Janaína [CSV 2c6fb2fd]" — a tag interna de deduplicação da importação por CSV vazou pro nome exibido.

## Causa raiz

No fluxo padrão de reanálise (`api/reanalisar-lead.js`), o objeto salvo depois de qualquer reanálise era montado assim:

```js
let merged = { ...novoAnalysis, venda: ..., memoria: ..., aprendizado: ..., scoreAjuste: ..., reanalisadoEm: ... };
```

`novoAnalysis` (o retorno da IA) nunca teve `clientName`/`lead` — só campos comerciais. Como o merge não recomeça de `...freshPrevious`, só copia campos específicos, `clientName` e `lead` eram descartados em TODA reanálise (reanalisar agora, marcar atendimento com observação nova, importação em lote etc.). Sem esses dois campos, a tela de leads cai pro fallback `nome_arquivo` — que pra leads de CSV inclui a tag `[CSV xxxxxxx]` usada só para deduplicar importações, nunca deveria aparecer pro usuário.

## O que foi corrigido

- `merged` agora preserva `clientName` e `lead` do registro anterior (`freshPrevious`), do mesmo jeito que já preservava `venda`/`aprendizado`.
- Autocorreção: se um lead já ficou sem `clientName` (corrompido por reanálises anteriores a essa correção), o próximo `nome_arquivo` é lido removendo a tag `[CSV ...]`/`[SISTEMA ...]` em vez de mostrá-la crua — então leads já afetados se corrigem sozinhos na próxima reanálise.

## Testes

- `npm test` e `npm run build` passaram.
- Validar reanalisando o lead "Janaína [CSV 2c6fb2fd]" em produção e conferindo se o nome volta a aparecer limpo.
