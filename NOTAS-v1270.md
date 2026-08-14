# v1270 — conversa grande volta a importar (o beco sem saída dos 150 MB)

Print do dono (14/08/2026): *"Conversa do WhatsApp com Patricia Frasson Renaissance.zip (183.5 MB)"*
→ **"ZIP maior que o limite permitido de 150 MB."** com dois botões, "Tentar novamente" e
"Descartar".

O "Tentar novamente" dava **exatamente o mesmo erro**, todas as vezes. Na prática, aquela conversa —
provavelmente uma das mais importantes da carteira, porque conversa grande é conversa de cliente
antigo — **não tinha como ser importada**. Nenhuma.

## O desperdício que causava isso

O app já enxugava a conversa no celular antes de enviar: jogava fora **foto, vídeo e documento**, que
nunca entram na análise. Mas mandava **todo o áudio, de qualquer data**.

E aí está o problema, porque do outro lado o servidor **só transcreve o áudio dos últimos 90 dias**.
O áudio mais antigo era:

1. carregado na memória do celular,
2. empacotado,
3. enviado pela internet do dono (dados móveis, muitas vezes),
4. e **descartado no servidor sem virar uma única linha de texto**.

Numa conversa de dois anos, é esse áudio velho — que não ia ser usado de jeito nenhum — que sozinho
estourava o limite e barrava a importação inteira.

## O que mudou

O celular agora escolhe o que enviar, nesta ordem:

1. **o texto da conversa nunca sai** — é dele que sai a análise inteira;
2. **áudio fora do período sai sempre** — o servidor não ia transcrever mesmo;
3. se ainda não couber, sai o áudio que o app não consegue datar;
4. se ainda não couber, sai o áudio **mais antigo** de dentro do período, um a um, até caber.

Resultado: **a conversa sempre entra**. No pior caso ela entra sem alguns áudios antigos — nunca mais
com a importação inteira barrada.

E, quando algum áudio precisa ficar de fora por tamanho, **isso aparece escrito no resultado**, junto
com o aviso de período que já existia:

> ⚠️ Esta conversa é grande demais pra enviar inteira. O texto foi completo, e dos 730 áudios foram os
> 91 mais recentes — os mais antigos ficaram de fora.

## Medido no navegador, com um ZIP de verdade

Montei no Chromium um ZIP no formato do WhatsApp com 400 dias de conversa (um áudio por dia, mais
fotos) e rodei nele exatamente o preparo que o celular faz:

| | antes | agora |
|---|---|---|
| tamanho enviado | **158,3 MB** (recusado) | **35,6 MB** |
| texto da conversa | completo | completo |
| áudios enviados | 400 (309 seriam descartados no servidor) | 91 — todos dentro do período |
| áudios datados corretamente | — | 400 de 400 |

Ou seja: além de destravar a importação, uma conversa grande passou a subir com **menos de um quarto**
do que subia — que é o mesmo que dizer menos espera, menos dado móvel e menos chance de a conexão cair
no meio (o problema da v1217).

## As duas redes de segurança

- **No app:** se mesmo depois de todo o corte o arquivo não couber (só aconteceria com um texto
  gigantesco, ou se o preparo falhasse), o app **não tenta enviar**: diz o que fazer — reexportar a
  conversa no WhatsApp escolhendo "Sem mídia".
- **No servidor:** a recusa por tamanho deixou de ser um beco sem saída. Onde estava *"ZIP maior que o
  limite permitido de 150 MB."* agora está *"Esta conversa passou do limite de 150 MB por envio. No
  WhatsApp, exporte a conversa de novo escolhendo 'Sem mídia' — o texto entra inteiro e a análise sai
  igual."*

## Onde a regra mora

Em `js/enxugar-zip.js`, sozinha — sem tela, sem rede, sem biblioteca de ZIP. É o mesmo caminho da
v1217 (`js/envio-retentativa.js`) e pelo mesmo motivo: assim o teste
`tests/v1270-conversa-grande-cabe-no-envio.test.mjs` **executa a regra de verdade**, em vez de
conferir o código por leitura. São 10 checagens, incluindo:

- o limite do app tem que continuar **igual** ao da rota de envio (se um dia se separarem, o teste
  quebra apontando — era esse descompasso que produzia o erro do print);
- o texto **nunca** é sacrificado, nem quando um único áudio é maior que o limite inteiro;
- quem fica é sempre o áudio **mais recente**, quem sai é o **mais antigo**;
- conversa que já cabia **não perde nada** (o caminho normal continua igual);
- os formatos de export que precisam ser entendidos: o do Android (`nome.opus (arquivo anexado)`), o
  do iPhone (`[13/08/26, 09:12:44] ... <anexado: ...>`, com ano de dois dígitos) e a menção **sem** a
  extensão do arquivo — o mesmo casamento que o servidor faz.

Suíte completa verde: 23 arquivos + 425 testes.
