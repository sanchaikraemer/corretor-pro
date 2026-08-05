# v1140 — importação e carteira param de morrer por tempo

Dia de fogo (05/08/2026, prints do dono na conversa): reimportação com POUQUÍSSIMO conteúdo novo
travando SEMPRE aos 92% ("Analisando — validando as três mensagens pelo Cérebro" → "Demorou
demais — servidor não respondeu" → na segunda tentativa "Não foi possível analisar"), e a Home
desistindo da carteira ("Carregamento demorou mais que o normal", beco sem saída). Palavras dele:
"não dá pra usar o sistema assim com essa lentidão" e "de novo esses papos e nunca resolve?".

Sem acesso aos logs de produção (a conexão da Vercel desta sessão não enxerga o projeto), o
diagnóstico saiu de prints + leitura do código — e as três causas eram de CÓDIGO, reproduzíveis
na leitura:

## Causa 1 — análise: duas tentativas iguais de 26s (retry não conserta lentidão)

`analyzeWithBrain` fazia a chamada principal da IA com janela de 26s e repetia UMA vez a mesma
chamada (v946/v947: 2 × 26s + 0,8s ≈ 52,8s < 60s do teto da Vercel). O desenho assume que falha
é sempre transitória — mas quando a análise REAL precisa de mais de 26s (conversa grande + Cérebro
grande = prompt enorme), as duas tentativas estouram em sequência, o corretor espera ~2 minutos
(o app ainda repete a ação inteira uma vez, com 150s de espera cada) e recebe "não deu".

**Como ficou** (mesmo orçamento ~52s, folga sob o `maxDuration:60`):

- 1ª tentativa: modelo principal com **janela grande** (34s por padrão,
  `DIRECIONA_ANALYSIS_TIMEOUT_MS`) — a análise honesta que só precisava de mais fôlego agora
  termina.
- Se ela falhar (timeout OU 429/5xx), a 2ª roda no **modelo rápido** (`modeloTarefasSimples`)
  com o tempo que sobrou do orçamento (`DIRECIONA_ANALYSIS_BUDGET_MS`, 52s) — mesmo prompt,
  mesmas regras do Cérebro. Análise um pouco mais simples é infinitamente melhor que nenhuma; o
  resultado leva `modeloFallback: true` pra ficar registrado.
- Sem tempo pra 2ª (sobra < 12s), falha na hora — sem fingir tentativa que não cabe.
- NÃO é reprompt de conteúdo (o padrão proibido desde v827-12/v827-18 continua proibido e
  travado por teste): são no máximo 2 tentativas de conseguir UMA análise, nunca "IA corrigindo
  IA".

Vale pros dois caminhos: importação (`processar-storage`) e botão Reanalisar (`reanalisar-lead`).

## Causa 2 — a rota da carteira era a única pesada sem teto de 60s

`api/leads-recentes.js` (carrega a carteira INTEIRA, com as duas consultas e regravações de cache
da v1136) ficou de fora do mapa `functions` do `vercel.json` — rodava com o teto padrão da
Vercel, bem menor. Dia de cache frio + banco lento = morte no meio. Entrou no mapa com
`maxDuration: 60`, igual às outras rotas pesadas.

## Causa 3 — o app desistia antes do servidor (e virava beco sem saída)

- A busca da carteira esperava **15s** (o padrão do `fetchComTimeout`) — MENOS que o teto da
  própria rota. O app desistia com o servidor ainda trabalhando. Agora espera **65s** e, se a
  primeira tentativa cair (rede/timeout), **respira 1,5s e tenta mais uma vez** antes de desistir.
- O vigia da Home aos **9s** trocava a tela por "Carregamento demorou mais que o normal" com um
  único botão de fuga — com a busca AINDA viva. Virou **dois estágios**: aos 9s só avisa que está
  demorando e MANTÉM o spinner (a busca continua; quando os dados chegam, a Home desenha normal);
  o beco só aparece aos **75s** (depois do prazo real de servidor + retentativa), agora com o
  botão **"Atualizar a página"** além do "Abrir Atendimentos".

## O que este pacote NÃO resolve sozinho

Se a OpenAI ou o Supabase tiverem um dia MUITO ruim, ainda pode falhar — mas agora falha no fim
do prazo real, com caminho de volta, em vez de morrer cedo por conta própria. Pra enxergar o lado
do servidor em produção (confirmar tempos reais), a conexão da Vercel precisa ser refeita com
acesso ao projeto do app — hoje ela devolve lista vazia de projetos.

## Arquivos

- `api/_pipeline.js` — orçamento de tempo + fallback de modelo na análise (flag `modeloFallback`).
- `vercel.json` — `api/leads-recentes.js` com `maxDuration: 60`.
- `app.js` — busca da carteira com 65s + retentativa; vigia da Home em dois estágios (9s/75s).
- Testes: novo `tests/v1140-importacao-e-carteira-sem-estourar-tempo.test.mjs`; refeitos pro
  desenho novo mantendo a intenção original: `v947` (envelope de tempo) e `v827-18` (proibição de
  reprompt de conteúdo — continua valendo, agora com 2 pontos de chamada de transporte).

## Conferido

- Suíte completa verde (incluindo v1139 e v1140).
- Visual no Chromium headless com servidor local ATRASANDO a rota da carteira de propósito: aos
  10s a Home mostra o estágio 1 (spinner + "está demorando"), sem beco sem saída; quando a rota
  responde, a carteira desenha; versão 1140 no rodapé da marca.
