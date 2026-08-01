# NOTAS v1099 — Cliente que não saía da lista por mais que você apertasse apagar

## O que o dono mandou

Print com o aviso **"Erro: Lead não encontrado"**, e a pergunta: *"pq nao ta deletando esse lead?"*

## O que estava acontecendo

Esse cliente **já não existia mais no banco**. Foi apagado antes, ou virou um só com outro numa
reimportação.

Só que a lista carregada no seu aparelho ainda tinha a cópia dele. Então, toda vez que você
apertava apagar, o app pedia pro servidor apagar uma coisa que não existe — e o servidor recusava,
com razão. Aí voltava o "não encontrado", e o cliente continuava na tela. Sem fim.

## O que mudou

Quando o servidor responde que aquele cliente não existe mais, o app entende que **o que você
queria já é verdade** — ele não está mais no banco. Então tira o fantasma da tela na hora, atualiza
as listas e avisa:

> *"Esse cliente já não existia mais no banco. Tirei ele da lista."*

Vale nos dois lugares onde dá pra apagar.

**Um cuidado:** isso só acontece quando o servidor diz especificamente que **não encontrou**. Erro
de verdade (sem conexão, falha do banco) continua aparecendo como erro — um cliente não pode sumir
da sua tela por causa de um problema passageiro.

---

## Validação feita antes de publicar

| Verificação | Resultado |
|---|---|
| Suíte completa | 275 testes verdes |
| `npm run build` | 27 arquivos, versão 1099 |
| Verificação no navegador de verdade | reproduzido o caso do print |

No navegador foi reproduzido exatamente o cenário do print: o servidor respondendo "não
encontrado" a cada tentativa. Conferido que a confirmação aparece, que o aviso novo aparece, que o
erro seco **não** aparece mais, e que não há nenhum erro na tela.

---

## Arquivos alterados

**Código:** `app.js`

**Versão:** `package.json`, `package-lock.json`

**Documentação:** `NOTAS-v1099.md` (novo)

**Testes (novo):** `tests/v1099-lead-fantasma-some-da-lista.test.mjs`
