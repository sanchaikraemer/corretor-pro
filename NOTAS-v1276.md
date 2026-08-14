# v1276 — Atendimentos mostra o mês inteiro, não só a semana

Dono, 14/08/2026, com print da tela Atendimentos:

> "quero ver o histórico do mes todo e nao da semana nessa parte... todos q atendi a cada dia
> desde dia 1"

## O problema

A tela era fixa em **últimos 7 dias**. No dia 14 ele enxergava do dia 8 pra cá e mais nada — o
resto do mês estava registrado no banco e não tinha onde ser visto. O cabeçalho ("Últimos 7 dias ·
83 atendimentos") também media a semana, não o mês.

## O que mudou

**A lista começa no dia 1 do mês e vai até hoje**, do mais recente pro mais antigo, do mesmo jeito
de antes: cada dia com o prediozinho da meta, a contagem do dia (`17/20`) e os nomes de todos os
clientes atendidos naquele dia, clicáveis.

O cabeçalho passou a nomear o período de verdade: **"Agosto, do dia 1 até hoje · 111 atendimentos ·
meta 20/dia"**.

**Fim de semana segue a mesma régua do gráfico do mês (v1273):** sábado ou domingo **sem**
atendimento não aparece — senão a lista vira um serrote de zeros e parece queda de produção. Fim de
semana em que ele **trabalhou** continua na lista, porque apagá-lo seria justamente esconder
trabalho feito.

## Por que o layout mudou junto

No computador a tela era uma **grade de 7 colunas** — uma coluna por dia da semana. Com o mês
inteiro isso viraria 5 fileiras de colunas estreitas, sem nenhuma leitura de "um dia embaixo do
outro". O formato que o **celular** já usava desde a v910 (uma faixa por dia: prédio pequeno + dia +
contagem, e os nomes em chips embaixo) virou o formato **único**, igual nos dois.

No celular nada mudou de aparência — é exatamente o que o print dele já mostrava, só que agora
descendo até o dia 1.

## Conferência antes de publicar

Regra do CLAUDE.md: mudança que altera o que aparece na tela não sobe só com a suíte verde.

- Chromium headless com o CSS publicado, nos dois tamanhos (celular 393px e computador 1280px),
  desenhando 14 dias de agosto com dados de teste — inclusive um sábado trabalhado (fica) e dois
  domingos vazios (somem).
- Resultado computado conferido: 12 dias desenhados dos 14, `display:flex` em coluna nos dois
  tamanhos, **nenhuma rolagem horizontal** (`scrollWidth === clientWidth` em 393 e em 1280), prédio
  de 46px na ponta de cada faixa e os nomes quebrando linha em chips.
- Suíte completa verde: 23 arquivos + 430 testes.

## Arquivos alterados

- `app.js` — a tela passa a montar o mês inteiro e a esconder só o fim de semana vazio.
- `styles.css` — a faixa por dia virou o formato único (a grade de 7 colunas saiu).
- `tests/v1276-atendimentos-mes-inteiro.test.mjs` — teste novo (período, fim de semana e layout).
- `tests/v867-predio-atendimentos.test.mjs`, `tests/v908-acoes-topo-e-atendimentos-dia.test.mjs`,
  `tests/v910-atendimentos-limpo.test.mjs`, `tests/v914-fazer-agora-dose-e-fds.test.mjs` — guardas
  que travavam os 7 dias e as 7 colunas, atualizadas pro formato novo.
- `package.json` / `package-lock.json` — versão 1276.

## Por que 1276 e não 1275

Outra sessão publicou uma v1275 (o app instalado voltando a procurar versão nova sozinho) enquanto
esta mudança estava em preparo. As duas foram juntadas e esta ficou com o número seguinte.
