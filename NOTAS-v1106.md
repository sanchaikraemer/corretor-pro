# NOTAS v1106 — Desempenho ganhou o "mês passado"

## O que o dono perguntou

Dia 1º de agosto, Desempenho zerado:

> *"pra ver resultados do mês passado como faço?"*

Não fazia. Virou o mês, a tela zerava e julho sumia da vista. Os dados nunca se perderam — tudo
tem data — mas a tela só sabia olhar o mês corrente.

## O que mudou

No topo do "Seu mês no Corretor Pro" agora tem **dois botões: "Este mês" e "Julho"** (sempre o
nome do mês fechado anterior). Um toque alterna tudo:

- Mensagens trocadas, leads atendidos, mensagens copiadas, análises, importações e propostas —
  todos passam a contar **dentro do mês escolhido**.
- Os textos acompanham: "Com clientes, **em julho**" — nunca fica escrito "este mês" olhando julho.
- O "Tempo no app" na visão do mês passado mostra o **total do mês** (esse número é gravado só no
  aparelho, então mostra o tempo daquele celular/computador).

## Validação

| Verificação | Resultado |
|---|---|
| Suíte completa | 280 testes verdes |
| `npm run build` | 27 arquivos, versão 1106 |
| Navegador de verdade | chips alternando e rótulos certos |

O teste novo prova a separação dos meses com dados reais (mensagem de julho não vaza pra agosto e
vice-versa), a janela fechada das contagens locais, e a virada de ano (janeiro → dezembro).

## Arquivos alterados

**Código:** `app.js`, `styles.css`

**Versão:** `package.json`, `package-lock.json`

**Documentação:** `NOTAS-v1106.md` (novo)

**Testes (novo):** `tests/v1106-desempenho-mes-passado.test.mjs`

**Testes (atualizados):** `tests/v929-desempenho-metricas-reais.test.mjs`,
`tests/v984-copiar-hero-registra-lead-certo.test.mjs`
