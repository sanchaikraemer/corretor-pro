# v881 — saudação da home bate com o card "Fazer agora"

## O problema (print do corretor)

No topo da home aparecia, em laranja, **"10 leads pra atender hoje"** — mas logo abaixo
o card **"Fazer agora"** mostrava **0**, e a lista "Top conversão de hoje" dizia
**"Tudo em dia! Nenhum lead pendente agora"**. Três números na mesma tela contando
coisas diferentes, com o mais chamativo (o laranja) inflado.

## A causa

Toda a home — card "Fazer agora", KPIs e a lista "Top conversão" — é calculada por
`cp786Categoria` (via `cp788Grupos` / `renderResumoDia`): um lead só é "agora" quando
realmente precisa de uma ação sua agora.

A saudação (`renderSaudacao`), porém, usava um cálculo **próprio e divergente**:
`entraEmRetomada(l)` limitado por uma meta de 12 (`META_DIA`). O `entraEmRetomada`
considera "pra retomar" qualquer lead parado 5+ dias — inclusive os de reativação fria
(as "Oportunidades esquecidas", paradas 30/40/140 dias), que **não** precisam de resposta
imediata. Por isso o cabeçalho contava 10 enquanto o resto da home, corretamente, contava 0.

O próprio comentário no código já dizia a intenção ("Calcula igual à lista, pra o número
da saudação bater com o que aparece embaixo") — só que a saudação tinha desalinhado da lista.

## A correção

`renderSaudacao` agora conta **exatamente os leads da categoria `"agora"`** (`cp786Categoria`),
a mesma fonte de verdade do card "Fazer agora" e da lista abaixo. O número laranja passa a
bater com o card. As demais frases seguem iguais:

- `acaoMostrada > 0` → "N leads pra atender hoje" (agora idêntico ao "Fazer agora");
- senão, se houve atendidos hoje → "Mandou bem! N leads atendidos hoje";
- senão → "Sem urgências agora. Bom momento pra prospectar."

Removido o teto artificial de 12 (`META_DIA`) e o uso de `entraEmRetomada` dentro da
saudação — a fila de reativação continua aparecendo em "Oportunidades esquecidas", que é o
lugar certo dela, sem ser contada como "pra atender hoje".

## Arquivos

- `app.js` — `renderSaudacao`: contagem por `cp786Categoria(l) === "agora"`.
- `tests/v881-saudacao-bate-fazer-agora.test.mjs` — regressão (isola o corpo de
  `renderSaudacao` e garante que conta a categoria "agora" e não voltou a usar
  `entraEmRetomada`/`META_DIA`).
- `package.json` — versão 880 → 881.
