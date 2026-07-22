# v919 — remove "Ensinar por áudio", "Aprender de um print" e reprocessar manual da carteira

## Pedido do dono

Remover do Cérebro três blocos que geravam confusão desnecessária: "Ensinar por áudio",
"Aprender de um print" e "Reprocessamento manual da carteira" (botão "Reprocessar toda a
carteira"), com tudo que estivesse amarrado especificamente a eles.

Antes de remover, confirmamos o funcionamento do reprocessamento manual: o aprendizado normal
**já é automático** — dispara sozinho toda vez que uma conversa é importada/reimportada ou uma
observação/memória é salva (o "Aprendizado contínuo" que já rodava em segundo plano, mostrado
na própria tela: "271 históricos e 564 casos já aprendidos"). O botão manual só servia pra dois
casos raros (recuperação de falha silenciosa, ou reler tudo do zero depois de mudar as regras
do Cérebro) — nenhum dos dois é uso do dia a dia.

## O que saiu

**`index.html`** — os 3 blocos de UI dentro do card "Regras comerciais" do Cérebro:
- "Ensinar por áudio" (upload de áudio → transcreve → vira regra)
- "Aprender de um print" (upload de imagem → IA extrai lições)
- "Reprocessamento manual da carteira" (botão "Reprocessar toda a carteira")

"Aprender de vídeo / link" **não** foi pedido e continua exatamente como estava.

**`app.js`** — os handlers específicos de cada botão removido (`#cerebroAudioBtn`/
`#cerebroAudioInput`, `#cerebroImgBtn`/`#cerebroImgInput`, `#cerebroCarteiraBtn`).

**`api/cerebro-config.js`** — a ação `aprender-imagem` (usada só pelo "Aprender de um print")
e a função `extrairLicoesDeImagem` que ela chamava, junto com o import não usado de
`modeloVisao`.

## O que ficou (propositalmente — são recursos compartilhados, não vestígio)

- **`transcrever-audio`** (backend): continua existindo — é usado pela nota de voz dentro de um
  lead (gravar observação falada), recurso diferente do "Ensinar por áudio" do Cérebro.
- **`aprender-carteira`** (backend) e `iniciarAprendizadoContinuoAutomatico` (frontend):
  continuam — são o motor do aprendizado automático contínuo, que roda sozinho sem precisar de
  nenhum botão manual.
- `cpAprendAtualizarStatus`: continua — reporta status do aprendizado automático em segundo
  plano; só perdeu o elemento de tela que mostrava esse status junto ao botão removido.

## Verificação
- `tests/v919-remove-ensinar-audio-print-carteira.test.mjs` (novo): confirma que os 3 blocos e
  seus IDs saíram do HTML/JS, que "Aprender de vídeo/link" não foi afetado, que o backend mantém
  `transcrever-audio`/`aprender-carteira` (compartilhados) mas perdeu `aprender-imagem`/
  `extrairLicoesDeImagem` (exclusivos do recurso removido), e que a nota de voz por lead
  (`cp7ObsTranscreverBlob`) e o aprendizado automático contínuo continuam intactos.
- Suíte inteira verde; `node --check` nos 3 arquivos alterados e build OK.

## Arquivos
- `index.html`, `app.js`, `api/cerebro-config.js`,
  `tests/v919-remove-ensinar-audio-print-carteira.test.mjs` (novo), `NOTAS-v919.md`,
  versão **918 → 919**.
