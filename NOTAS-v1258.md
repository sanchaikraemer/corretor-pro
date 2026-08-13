# v1258 — foto, PDF e catálogo paravam de existir no histórico (bug real)

O dono achou o bug com uma pergunta de uma linha, depois de duas análises erradas seguidas sobre a
mesma conversa (lead Marina):

> "e isso deve estar no histórico em texto tb, nao esta?"

**Não estava.** E era um bug de verdade, não interpretação da IA.

## O bug

Quando a conversa é exportada do WhatsApp **sem os arquivos** — a opção leve, e a que quase todo
mundo escolhe — cada foto, PDF, catálogo ou tabela vira uma linha `<Mídia oculta>`.

O app **descartava essa linha**. E quando ela era o único conteúdo da mensagem, a mensagem inteira
**sumia da conversa** (o filtro `if (!text) return false` logo adiante).

Ou seja: o corretor mandava as opções por imagem ou PDF e, pra IA, **aquela mensagem nunca tinha
existido**.

## O estrago que isso causou

1. A análise concluiu que a cliente *"pediu 3 dormitórios três vezes e nunca recebeu uma opção"* —
   quando ele tinha enviado.
2. Pior: a regra da v1253 ("pedido em aberto manda na sugestão nº 1, que precisa ENTREGAR") ia
   fazer o corretor **reenviar como novidade** algo que ele já tinha mandado. Pro cliente, isso lê
   como desatenção.
3. E eu mesmo errei duas vezes em cima disso — primeiro afirmando que não foi enviado, depois
   afirmando que foi (sem verificar). O dado simplesmente não existia em lugar nenhum pra conferir.

## Por que a v1058 não pegava

A v1058 já tinha resolvido exatamente este problema — **mas só pro outro formato de exportação**.
Quando a conversa é exportada **com** os arquivos, cada mídia aparece como
`IMG-20260709-WA0001.jpg (arquivo anexado)`, e desde a v1058 isso vira um marcador factual.

O formato **sem** os arquivos (`<Mídia oculta>`) ficou de fora e continuou sendo apagado. Foi por
isso que uma conversa (a da lead Rose) mostrava os marcadores e a outra (a da Marina) não mostrava
nada: as duas foram exportadas de jeitos diferentes.

## O que mudou

`<Mídia oculta>` e as variações do iPhone sem `<>` (*"imagem omitida"*, *"documento omitido"*,
*"áudio ocultado"*) agora viram o mesmo marcador da v1058, com o tipo reconhecido quando o WhatsApp
informa:

| No WhatsApp | O que a IA passa a ver |
|---|---|
| `<imagem oculta>` / `imagem omitida` | Arquivo enviado nesta mensagem: **imagem** |
| `<vídeo oculto>` | Arquivo enviado nesta mensagem: **vídeo** |
| `documento omitido` | Arquivo enviado nesta mensagem: **documento/PDF** |
| `áudio ocultado` | Arquivo enviado nesta mensagem: **áudio** |
| `<Mídia oculta>` (Android não diz o tipo) | Arquivo enviado nesta mensagem: **arquivo** |

E quando a linha tem texto **e** arquivo junto (*"Segue a tabela `<Mídia oculta>`"*), os dois
sobrevivem: o texto do corretor e o registro de que houve envio.

O conteúdo do arquivo continua **não** sendo lido — isso não mudou e não pode mudar sem custo. O
que muda é a IA saber que **houve um envio ali**, que é o que faltava.

## Cuidado com falso positivo

A lista de palavras é fechada de propósito. Frase normal do corretor que por acaso contenha
"omitido" ou "oculta" (*"Nenhum dado foi omitido na proposta"*) continua chegando inteira, sem
virar marcador e sem sumir. O teste cobre isso.

## Importante: só vale pras conversas enviadas de agora em diante

A limpeza acontece **no momento em que a conversa é enviada pro app**, não na hora da análise.
As conversas que já estão lá dentro perderam essas mensagens de forma definitiva no banco.

**Pra corrigir um cliente antigo, é preciso enviar a conversa dele de novo.** Depois disso, uma
reanálise já enxerga os envios.

## Teste

`tests/v1258-midia-oculta-nao-some-do-historico.test.mjs` — roda o processador de conversa de
verdade (`parseWhatsappTxt`) e verifica: a mensagem não some, o tipo é reconhecido nos dois
formatos de exportação, texto e arquivo convivem na mesma linha, o formato da v1058 não quebrou, e
frase comum não vira marcador.
