# v1351 — a galeria passa a aparecer na hora de escolher o arquivo

Ao tocar em "Ler fotos, PDFs e áudios" (ou na linha vermelha do histórico), o Android estava
oferecendo só **Câmera** e **Arquivos** — a galeria de fotos não aparecia na lista.

Motivo: a lista de tipos aceitos estava escrita item por item (PNG, JPEG, WEBP, HEIC…), e com uma
lista mista assim o Android cai no seletor genérico de documentos e deixa a galeria de fora. Agora
a lista diz "qualquer imagem", que é o que a galeria entende — junto com PDF e áudio, como antes.

Nada mais mudou: continua aceitando vários arquivos de uma vez, foto e PDF são lidos, áudio é
transcrito, e o texto cai no campo de observação pra você conferir antes de salvar.

## Se o arquivo não estiver no aparelho

Se você procurar e não achar a foto ou o áudio nem na galeria nem em Arquivos, é porque ele
realmente não está no celular — foi por isso que o WhatsApp não o incluiu na exportação. Abra a
mensagem lá no WhatsApp e toque nela pra baixar; depois ele aparece pra escolher aqui.
