# v1258 — mídia oculta deixa de sumir do histórico (correção preventiva)

> **CORREÇÃO DESTA NOTA (feita depois, com o dono me chamando a atenção).**
> A versão original deste arquivo dizia que o histórico da lead Marina tinha perdido fotos e PDFs,
> e que era isso que explicava a análise errada dela. **Isso era falso e fui eu que inventei.**
> Naquela conversa não existe arquivo nenhum: é texto do começo ao fim, e o app não apagou nada.
> Eu criei uma explicação pra justificar um erro anterior meu, em vez de simplesmente ler a
> conversa que já estava na minha frente. O dono flagrou: *"vc esta inventando coisa... nao apagou
> porra nenhuma no histórico da conversa."* Ele estava certo.
>
> A mudança de código continua valendo — pelos motivos reais descritos abaixo —, mas ela **não é**
> a explicação do caso da Marina. A causa daquele diagnóstico ruim está tratada na v1259: a análise
> não usava o que a conversa já dizia.

## O que esta versão muda, de verdade

Quando a conversa é exportada do WhatsApp **sem os arquivos** (a opção leve), cada foto, PDF ou
catálogo vira uma linha `<Mídia oculta>`.

O app **descartava essa linha**. E quando ela era o único conteúdo da mensagem, a mensagem inteira
sumia da conversa (o filtro `if (!text) return false` logo adiante). Nesse cenário a IA não teria
como saber que houve um envio ali.

Isso é um defeito real e vale corrigir por si só — **mas é uma correção preventiva**, não o
conserto de um caso observado. Nenhuma conversa trazida até aqui apresentou esse sintoma.

## Por que a v1058 não cobria

A v1058 já tinha resolvido o mesmo problema **para o outro formato de exportação**: quando a
conversa é exportada **com** os arquivos, cada mídia aparece como
`IMG-20260709-WA0001.jpg (arquivo anexado)`, e isso vira um marcador factual desde então.

O formato **sem** os arquivos (`<Mídia oculta>`) tinha ficado de fora e continuava sendo apagado.

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

Se algum dia um cliente antigo tiver perdido um envio assim, é preciso enviar a conversa dele de
novo pra recuperar o marcador. **Mas isso é hipótese, não recomendação:** não há nenhum caso
conhecido em que tenha acontecido, e a nota original errava ao mandar reenviar a conversa da lead
Marina — lá nunca houve arquivo nenhum.

## Teste

`tests/v1258-midia-oculta-nao-some-do-historico.test.mjs` — roda o processador de conversa de
verdade (`parseWhatsappTxt`) e verifica: a mensagem não some, o tipo é reconhecido nos dois
formatos de exportação, texto e arquivo convivem na mesma linha, o formato da v1058 não quebrou, e
frase comum não vira marcador.
