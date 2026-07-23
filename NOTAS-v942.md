# v942 — reforma da Home (Tela 1 + lista compacta), fim do amarelo, barra de mensagens e performance

Atualização grande, tudo a pedido do dono numa mesma leva. Ele escolheu, vendo mockups: **Tela 1**
(números em cima + lista compacta), **lista Opção 3** (densa), e **barra de mensagens Modelo A**
(barra + número, cor por nível).

## 1. Fim do card amarelo "Nenhum lead prioritário" — sempre mostra os leads do dia

O dono odiava o card amarelo que aparecia dizendo que "não tem trabalho" com 160+ leads na
carteira. Removido de vez. `renderBotoesHome` (`app.js`) agora **sempre** mostra os leads do dia
numa lista compacta (1 coluna), puxando direto da **fila ranqueada completa** (`cpFilaFazerAgora`)
quando o balde estrito de urgentes está vazio. Só quando a fila está realmente vazia (fim de
semana / ninguém elegível) aparece uma linha neutra — sem box, sem amarelo. "Oportunidades
esquecidas" continua só depois dos leads do dia.

Removidos: os cards "Meta de hoje batida" (v925) e "Nenhum lead prioritário" (v933). O mecanismo
"Atender mais um" (`cpAtenderMaisUmHoje`, `state.fazerAgoraExtra`) virou um botão discreto abaixo
da lista. A saudação voltou a ser "N leads pra atender hoje, de cima pra baixo" (agora é verdade,
porque a lista sempre existe) — mostrando o número real da lista (`min(meta, elegíveis na fila)`).

## 2. Lista compacta, 1 coluna, com barra de status das mensagens

Novas funções em `app.js`: `cpHomeLeadRow` (linha densa: dot de status, nome, produto, barra de
mensagens, dias) e `cpBarraMensagensMini` (barra horizontal + número, cor por nível — cinza
`<5`, coral claro `5-14`, coral `15+`; nunca amarelo). A lista (`.cp-hoje-list`/`.cp-hoje-row`) é
uma coluna só, com o produto escondido no mobile pra nunca estourar a lateral. A tela expandida do
"Fazer agora" (`.lista-leads-grid` em `styles.css`) também virou 1 coluna fixa (antes ia pra 2/3
colunas em tela larga e cortava os nomes — task pendente do dono).

## 3. "0 mensagens do cliente" — removida a janela de 90 dias

O dono flagrou um lead (Sara) mostrando "0 mensagens do cliente" mesmo tendo escrito ~15 — porque
a v896 só contava mensagens dos últimos 90 dias, e ela estava quieta desde fevereiro. Isso parecia
quebrado. `mensagensDoCliente` (`app.js`) agora conta o **total** de mensagens do cliente, sem
janela de tempo (a coldness já é mostrada pelos "dias parado"). O servidor (`api/_persistence.js`)
passa a mandar `clientMessageCount` (total real, calculado sobre o histórico inteiro no banco, na
mesma varredura que já achava a última msg do cliente) — a lista da Home só recebe uma prévia de
~8 msgs, então sem esse número a barra ficaria sempre quase vazia. `mensagensDoCliente` prefere
`clientMessageCount` quando o histórico completo ainda não foi carregado.

## 4. Amarelo queimado eliminado no app todo → cinza claro

O token `--morno` (era `#F5C36B`) virou cinza claro (`#B8C2C9` dark / `#C2CBD1` / `#6E7A82` light),
o que já troca a maioria dos usos de uma vez. Os amarelos cravados (hardcoded — `rgba(255,201,107,…)`,
`rgba(255,155,59,…)`, `rgba(245,195,107,…)`, `#ffd28a`, `#ffd9ad`, `#ffbf5a`) em `styles.css` e
`app.js` foram trocados por cinza neutro: card "Oportunidades esquecidas" (`.radar-card`),
`.cp704-stale`, `.cp704-pill`, `.cp704-empty-analysis`, `.tag.warn`, `.agenda-item .urgency.medio`,
`.diag-alerta`, `.cp697-row.pending`, o badge da 2ª sugestão de mensagem, e os avisos de
importação/mídia.

## 5. Performance — service worker serve do cache na hora

A lentidão ("clico e demora pra carregar", até o hover atrasado) vinha do service worker buscando
`app.js`/`styles.css`/etc. **da rede primeiro** a cada carregamento, mesmo com tudo já salvo no
aparelho — todo clique esperava a rede ir e voltar pelo proxy. Trocado por **stale-while-revalidate**
(`staleWhileRevalidate` em `service-worker.js`): os assets estáticos são servidos do cache na hora
e revalidados por trás. Como cada asset tem `?v=__VERSION__` na URL, uma versão nova = URL nova =
cache miss = busca fresca automática — instantâneo E sem nunca servir versão velha. O HTML
(navegações) continua network-first, pra apontar sempre pros assets novos.

## Verificação

- `tests/v942-home-lista-densa-barra-cinza-e-perf.test.mjs` (novo): cobre a linha densa + barra,
  a lista 1 coluna, o `--morno` cinza e a ausência de hardcodes amarelos, a contagem sem janela +
  `clientMessageCount`, e o `staleWhileRevalidate` no service worker.
- Testes atualizados pra refletir o comportamento novo (mudanças intencionais, a pedido do dono):
  `v925` (Atender mais um sem card grande), `v926` (dose sempre da fila ranqueada), `v933` (guarda
  contra os cards voltarem), `v937`/`v881` (saudação com número real da lista), `v896` (contagem
  sem janela de 90 dias), `v876` (`.cp704-stale` cinza).
- Suíte inteira verde (`npm test`); `node build.js` OK, versão 942.

## Observação
`clientMessageCount` (servidor) e a contagem sem janela valem imediatamente pra dados novos; leads
já em cache pegam o número certo no próximo fetch da lista.

## Arquivos
- `app.js` (`renderBotoesHome`, `renderSaudacao`, `mensagensDoCliente`, `cpHomeLeadRow`,
  `cpBarraMensagensMini`, CSS da lista + amarelos), `styles.css` (`--morno` + hardcodes +
  `.lista-leads-grid`), `service-worker.js` (SWR), `api/_persistence.js` (`clientMessageCount`),
  `tests/v942-…` (novo) + `v876`/`v881`/`v896`/`v925`/`v926`/`v933`/`v937` (atualizados),
  `package.json`/`package-lock.json`, `NOTAS-v942.md`, versão **941 → 942**.
