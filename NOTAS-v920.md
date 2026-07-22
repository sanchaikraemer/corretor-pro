# v920 — remove "Aprender de vídeo / link"

## Pedido do dono

Depois de remover "Ensinar por áudio", "Aprender de um print" e "Reprocessar toda a carteira"
na v919, o dono perguntou se "Aprender de vídeo / link" realmente funcionava. Explicamos que o
recurso lê a legenda do YouTube (não é transcrição de áudio de verdade) fazendo raspagem não
oficial da página — frágil por natureza, sem usar a API do Google.

O dono testou com um vídeo real
(`youtube.com/watch?v=HUM1_kqAb4M`), confirmou no próprio YouTube que o vídeo TEM legenda (CC
ativo), e mesmo assim o app devolveu "Não consegui extrair texto suficiente desse vídeo" — ou
seja, o recurso falha mesmo no caso que deveria funcionar. Decisão: em vez de tentar consertar
uma raspagem inerentemente instável, remover o recurso. Alternativa do próprio dono: colar o
link no ChatGPT, pedir um resumo, e colar o resumo direto na caixa de Regras comerciais — mais
simples e mais confiável.

Com isso, os 4 recursos de "ensinar automaticamente" que existiam no Cérebro (áudio, print,
vídeo/link, reprocessar carteira) saem todos — resta só a caixa de texto livre "Regras
comerciais", que o corretor edita direto.

## O que saiu

**`index.html`** — o bloco "Aprender de vídeo / link" (input de URL + botão "Aprender").

**`app.js`** — o handler `#cerebroLinkBtn`, e duas funções que ficaram órfãs por causa dessa e
da remoção anterior (v919):
- `mostrarSugestoesCerebro` — só era chamada pelo "Aprender de um print" (já removido) e
  duplicada inline no handler de link (agora também removido).
- `acrescentarRegraAoBloco` — só era usada pelas sugestões de áudio/print/link, todas removidas.

**`api/cerebro-config.js`** — a ação `aprender-link` e as funções exclusivas dela: `youtubeId`,
`youtubeTranscript` (a raspagem de legenda que falhou no teste), `paginaTexto`,
`extrairTextoDeUrl`, `extrairLicoesComIA`, `validarUrlSegura` (guarda de SSRF que só protegia
essa ação), e o import não usado de `modeloTarefasSimples`.

## O que ficou (recursos diferentes, não tocados)

- `transcrever-audio` (backend) + `cp7ObsTranscreverBlob` (frontend): nota de voz dentro de um
  lead — recurso separado, não relacionado ao Cérebro.
- `aprender-carteira` (backend) + `iniciarAprendizadoContinuoAutomatico` (frontend): o
  aprendizado automático contínuo, que roda sozinho sem nenhum botão manual.

## Verificação
- `tests/v920-remove-aprender-video-link.test.mjs` (novo): confirma que o bloco de UI, o handler
  e as funções exclusivas (frontend e backend) saíram; que a nota de voz por lead e o
  aprendizado automático continuam intactos; e que a caixa de Regras comerciais continua
  existindo.
- `tests/v919-remove-ensinar-audio-print-carteira.test.mjs` ajustado (não afirma mais que
  "Aprender de vídeo/link" ficaria intacto — isso mudou nesta versão).
- `tests/v858-cerebro-blocos-texto.test.mjs` ajustado (não exige mais `acrescentarRegraAoBloco`,
  que virou órfã e foi removida).
- Suíte inteira verde; `node --check` nos 3 arquivos alterados e build OK.

## Arquivos
- `index.html`, `app.js`, `api/cerebro-config.js`,
  `tests/v920-remove-aprender-video-link.test.mjs` (novo),
  `tests/v919-remove-ensinar-audio-print-carteira.test.mjs` (ajustado),
  `tests/v858-cerebro-blocos-texto.test.mjs` (ajustado), `NOTAS-v920.md`,
  versão **919 → 920**.
