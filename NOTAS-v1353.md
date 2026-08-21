# v1353 — o celular estava APAGANDO as fotos e os PDFs antes de enviar

Achei. E é isso: **a leitura de imagem e PDF nunca teve chance de funcionar**.

## O que estava acontecendo

Antes de mandar a conversa pro servidor, o app "enxuga" o arquivo no seu celular — tira o que não
vai ser usado, pra caber no envio. A regra dessa limpeza dizia, com essas palavras:

> "Imagem, vídeo e documento saem sempre (nunca entram na análise)."

Isso era verdade **antes** de você mandar botar leitura de imagem, link e PDF. O servidor aprendeu
a ler foto e PDF, aprendeu a abrir link — mas a regra do celular nunca foi atualizada junto.

Resultado: **o servidor sabia ler, e os arquivos nunca chegavam nele.** Em toda importação feita
pelo celular — que são todas — as fotos e os PDFs eram apagados no caminho. Não era o Cérebro, não
era o prompt, não era teto de custo. Eram os arquivos sendo jogados fora antes de sair do aparelho.

## O que mudou

Foto (JPG, PNG, WEBP, HEIC…) e PDF passam a viajar junto com a conversa. Vídeo continua fora — o
app não lê vídeo, decisão sua.

A ordem de prioridade no envio é conservadora, pra não estragar o que já funcionava:

1. **o texto da conversa** — nunca sai;
2. **o áudio** — escolhido pela mesma regra de antes, sem perder espaço;
3. **as fotos e PDFs** — entram no que sobrar, do mais recente pro mais antigo, até 12 por envio
   (que é o quanto o servidor lê por importação).

Se o envio ficar apertado, sai a foto mais antiga primeiro; e se não sobrar espaço nenhum, nenhuma
foto entra — a conversa continua sendo enviada, nunca barrada por tamanho.

## O que isso muda na prática

Da próxima importação em diante, o que estiver escrito nas artes, nas tabelas de preço e nos PDFs
que vocês trocaram entra na análise. É o que você tinha pedido e o que não estava acontecendo.

## E o áudio

O áudio nunca foi apagado por essa regra — ele sempre viajou. Fica valendo o que já estava: se o
arquivo veio dentro da conversa, é transcrito e aparece na mensagem.
