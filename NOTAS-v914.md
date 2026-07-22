# v914 — "Fazer agora" sempre 10 + "Atender +1" + fim de semana + Atendimentos no PC

## "Fazer agora" reformado (pedido do dono)
Antes o card dava **0** em dias sem retomada "madura" — mesmo com a carteira cheia de leads
parados. Contraditório: "sem urgência, bom momento pra prospectar" enquanto tinha gente parada
150+ dias. Agora:

- **Todo dia útil tem até 10 leads** pra atender — os de **maior probabilidade de venda**,
  ranqueados pela **quantidade de mensagens que o cliente mandou** (mais engajamento primeiro;
  desempate por mais tempo parado). Fica de fora quem já foi atendido hoje ou tem compromisso
  marcado (isso é da Agenda).
- **Botão "Atender +1"**: depois de esgotar a dose, aparece um botão que revela mais um da fila,
  e assim por diante enquanto o corretor quiser atender naquele dia (`state.fazerAgoraExtra`).
- **Carryover automático**: como a fila é recalculada toda vez (sem guardar "quem foi sorteado
  ontem"), quem não foi atendido simplesmente **continua no topo** no dia seguinte — a régua de
  ranking (mais mensagens, mais tempo parado) garante isso sem precisar de estado extra.
- **Sábado e domingo**: a fila fica **vazia de propósito** (`cpFimDeSemana()`), e o card mostra
  **"Final de semana"** no lugar do número — na home, na Condução e no Desempenho. A saudação da
  home também troca de frase no fim de semana.
- "Oportunidades esquecidas" não repete mais quem já está na dose de "Fazer agora" do dia.

## Atendimentos no PC — ajustes visuais
- **Sem rolagem horizontal**: as 7 colunas viram um `grid` de largura total (`repeat(7,minmax(0,1fr))`)
  em vez de uma linha rolável — preenchem o espaço que antes sobrava.
- **Nomes dos clientes**: sem negrito (`font-weight:600` em vez de 800) e fonte menor (`11px`),
  pra não cortar nomes curtos.

## Verificação
- `tests/v914-fazer-agora-dose-e-fds.test.mjs` (novo): executa `cpFilaFazerAgora`/`cpFimDeSemana`
  com um cenário controlado (rank por mensagens, atendido-hoje fora, fim de semana vazio) + confere
  o botão "Atender +1", o rótulo "Final de semana" e o CSS do grid/nomes.
- Ajustados os testes que fixavam a lógica antiga: v881, v884.
- Suíte inteira verde; `node --check` e build OK.

## Arquivos
- `app.js` (fila, dose, saudação, KPIs, Condução, Desempenho, "Oportunidades esquecidas"),
  `styles.css` (grid do PC + nomes + `.cp-fds`/`.cp-atender-mais`),
  `tests/v914-fazer-agora-dose-e-fds.test.mjs` (novo), v881/v884 (ajustes), `NOTAS-v914.md`,
  versão **911 → 914** (pulo intencional a pedido do dono).
