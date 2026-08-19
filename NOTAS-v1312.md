# v1312 — parou de reler o que já tinha sido lido

"Demorando demais pra analisar, sendo que já tem histórico de monte e acho que nada de novo"
(dono, 19/08/2026).

Ele estava certo, e a conta é grande.

## O que estava sendo repetido

O **áudio** já transcrito de um cliente é reaproveitado desde a v1141 — ninguém transcreve duas
vezes o mesmo áudio. Mas a **imagem**, o **PDF** (v1306) e o **link** (v1307) eram lidos **de novo,
do zero, em toda importação** — mesmo quando o texto daquela leitura já estava guardado na conversa
do cliente, do jeitinho que ficou da vez anterior.

Numa conversa como a da Noemi (várias imagens, um PDF de tabela e um mapa), isso é:

- até **22 segundos** relendo imagem/PDF + até **20 segundos** relendo link, toda vez;
- e uma **chamada paga à IA para cada arquivo**, gasta pra produzir exatamente o texto que já estava
  salvo.

Era esse o "demorando demais mesmo sem nada de novo".

## O que mudou

Antes de ler qualquer coisa, a importação agora procura na conversa salva deste cliente o que já foi
lido antes. O que já tem texto guardado **entra pronto**: não desce pra IA, não gasta segundo da
janela e não conta no teto do dia. Só o que é realmente novo é lido.

Vale o mesmo critério de sempre: leitura salva vazia (arquivo que não deu pra ler da outra vez) não
conta como lida — essa é refeita.

## Arquivos

- `api/processar-storage.js` — `leiturasVisuaisDoLeadAnterior` e `leiturasDeLinksDoLeadAnterior`
  (irmãs de `transcricoesDoLeadAnterior`), usadas antes da leitura; contadores de reaproveitamento.
- Teste: `v1312-nao-relê-o-que-ja-foi-lido` (executa a leitura da conversa salva e trava o uso dela
  antes de qualquer chamada paga).
