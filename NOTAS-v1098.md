# NOTAS v1098 — Os filtros estavam certos; a tela é que mostrava o número errado

## O que o dono mandou

Dois relatos no mesmo dia, com print:

1. **"por que aguardando cliente aparece com mais dos 14 dias pré-definidos? eles não teriam que
   voltar para as prioridades após o prazo?"** — clientes com 16 e 18 dias numa lista cujo prazo é 14.
2. **"e sem atender 30+, veja os dias ao lado, isso é incoerente, não tá funcionando meus
   filtros"** — uma lista de "30 dias ou mais" mostrando **1 dia**, **12 dias**, e fora de ordem.

---

## O diagnóstico: seus filtros estão funcionando

Conferi as duas regras rodando de verdade. **Os filtros estão certos.** Quem estava errado era o
número que a tela mostrava do lado.

O app tem **duas contas diferentes** de tempo, e elas não querem dizer a mesma coisa:

- **dias desde a última MENSAGEM** (de qualquer um dos dois lados);
- **dias desde o SEU último ATENDIMENTO marcado.**

Todas essas listas mostravam sempre a **primeira**. Mas as duas listas que você abriu são
definidas pela **segunda**. Postos lado a lado do título, os números faziam a lista parecer quebrada.

### "Aguardando cliente" com 18 dias

O descanso conta a partir do **seu último atendimento** — é a regra única que você mesmo pediu.
Um cliente calado há 18 dias, mas que **você atendeu há 3**, está corretamente em espera. A tela
só mostrava o 18 (o silêncio dele) e dava a entender que o prazo tinha estourado.

### "Sem atender 30d+" mostrando 1 dia

Entra nessa lista quem está **30 dias ou mais sem atendimento — ou nunca foi atendido**. O
primeiro da sua lista nunca tinha sido atendido, mas mandou mensagem ontem: a tela mostrava
**"1 dia"**. E a ordem parecia bagunçada porque a lista é ordenada pelo atendimento enquanto o
número exibido era outro.

---

## O que mudou

Cada lista passa a mostrar **o número que a define**, com o título certo em cima:

| Lista | Antes | Agora |
|---|---|---|
| Aguardando cliente | "Parado há **18** dias" | "Volta em **12** dias" — e embaixo, *atendido há 3d* |
| Sem atender 30d+ | "**1** dia" | "**nunca** — sem atendimento" |
| Sem atender 30d+ | "**12** dias" | "**53** dias" (os dias sem atendimento de verdade) |
| Demais listas | "Parado há" | igual, sem mudança |

Agora a coluna "Volta em" responde direto a sua pergunta: **por que esse cliente ainda está aqui e
quando ele volta.**

---

## Validação feita antes de publicar

| Verificação | Resultado |
|---|---|
| Suíte completa | 274 testes verdes |
| `npm run build` | 27 arquivos, versão 1098 |
| Verificação no navegador de verdade | as duas listas montadas com dados reais, no celular e no computador |

No navegador foram montadas as duas listas exatamente com os casos dos seus prints — inclusive
plantando o seu descanso de 14 dias — e conferido na tela: "Sem atender há" mostrando **nunca** e
**53** (nunca mais o 1 e o 12 das mensagens), e "Volta em" mostrando **12 dias** com a explicação
*atendido há 3d*. Sem rolagem lateral e sem erro nenhum.

**Limitação dita abertamente:** esta sessão não acessa seus dados de produção. Os casos foram
reproduzidos aqui com os mesmos números dos prints.

---

## Arquivos alterados

**Código:** `app.js`, `styles.css`

**Versão:** `package.json`, `package-lock.json`

**Documentação:** `NOTAS-v1098.md` (novo)

**Testes (novo):** `tests/v1098-listas-mostram-o-numero-que-as-define.test.mjs`
