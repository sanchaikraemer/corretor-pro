# v1360 — apagado o que eu criei sem você mandar, e os dois defeitos do seu print

## Apagado (tudo isso era invenção minha, sem seu pedido)

1. **O aviso "a IA não leu N fotos/PDFs"** — na ficha do cliente e na tela da importação. Desde
   ontem foto e PDF não são enviados, então esse aviso alertava sobre algo que não pode acontecer, e
   ainda mandava reimportar, o que não resolveria nada.
2. **O botão "Ler fotos, PDFs e áudios"** no card de observação, e a rota que ele usava no servidor.
3. **A linha vermelha clicável** no histórico ("Toque para mandar este arquivo"), e a rota que
   escrevia o texto dentro da mensagem.
4. **A galeria no seletor de arquivos** — existia só pra servir o botão acima.
5. **A linha da figurinha.** Figurinha agora simplesmente **some** da conversa: não aparece no
   histórico, não conta como nada, não vai pra lugar nenhum.

Junto saíram os testes que sustentavam essas coisas. Não ficou remendo nem código pendurado.

**O que NÃO foi levado junto:** "Ler print da resposta" (esse é seu, pedido por você) e a capacidade
do servidor de ler foto/PDF — o que mudou foi o que o celular envia, não o que o servidor sabe fazer.

## Consertado — "Faz 7 dias"

As três mensagens abriam com *"Faz 7 dias que deixamos a visita..."*. A última mensagem tinha sido
**no dia anterior**. Os 7 dias são o **prazo de retomada que você configurou** — um prazo pra frente,
pra decidir quando falar. Os dois números chegavam lado a lado e a inteligência somou tudo numa
frase só.

Agora o app calcula e diz o número de verdade — *"Última mensagem: 21/08/2026 — ONTEM, 1 dia
parado"* — e separa as duas coisas com todas as letras: o prazo de retomada é tempo pra frente, nunca
pode ser escrito como dia que já passou.

E mais: **abrir mensagem contando dia parado está proibido**. "Faz X dias que...", "há X dias sem
falar" — isso soa como cobrança. Era por isso que aparecia a tarja vermelha *"abre contando os dias
parados"*: o app já reprovava a mensagem, mas ela saía assim mesmo.

## Consertado — "Sr" em toda frase

Esse foi estrago da minha correção de ontem. Pra tirar o "vocês", eu mandei o app dizer *"mantenha
esse tratamento"* — e a inteligência entendeu como "escreva 'o Sr' em cada frase". Troquei um
defeito por outro.

Agora a instrução é clara: **no máximo uma vez por mensagem**, e só se fizer falta. O normal é
chamar pelo **nome** na abertura e depois falar direto, sem repetir pronome de tratamento.

O conserto do "vocês" continua de pé — singular quando o cliente é um, plural quando são dois.
