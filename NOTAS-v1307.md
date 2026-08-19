# v1307 — o link que você manda passa a ser lido, e a data da última mensagem volta pra tela

Duas coisas pedidas por você em 19/08/2026.

## 1. "E um link enviado, como fica?"

Ficava como texto puro. A IA via o endereço escrito, sabia que você tinha mandado um link — e não
abria a página. No seu print, aquele link levava à seleção de 8 apartamentos do Boulevard com fotos,
plantas e **valores**: a IA sabia quais unidades você mandou (porque os nomes estavam escritos na
mensagem) e não sabia o preço de nenhuma.

**Agora o app abre o link e traz o que está escrito na página para dentro da conversa**, do mesmo
jeito que passou a fazer com imagem e PDF na versão anterior:

> [Link lido pela IA] Boulevard Residence — Apto 501 — R$ 1.200.000 — 3 suítes, 145 m².

O texto original da sua mensagem continua igual; a leitura entra logo abaixo dela.

### As fronteiras, todas estreitas de propósito

- **Só links que VOCÊ mandou.** Link enviado pelo cliente nunca é aberto pelo servidor — é a regra
  que impede alguém de usar o app para abrir endereço que não deveria.
- **Só endereço seguro e público** (https). Endereço interno, IP e "localhost" são recusados na hora.
- **No máximo 2 links por importação**, os mais recentes, com tempo e tamanho limitados.
- **Teto diário**, o mesmo das imagens, conferido antes de gastar.

### O caso em que não vai funcionar — e o app avisa em vez de inventar

Se a página monta os valores por programação, na hora que abre no navegador, a leitura simples só
enxerga a casca vazia. Nesse caso o app marca **"página sem texto legível"** e **não inventa nada**.
É por isso que vale reimportar uma conversa com link e olhar o contador: se aparecer link lido, sua
página é do tipo que dá para ler; se não aparecer, precisamos da leitura pesada (que abre a página
como um navegador).

No fim da importação aparece: **Imagens/PDFs lidos: 2 · links lidos: 1 · arquivos ignorados: 1**.

## 2. A data da última mensagem, no cartão do cliente

Você marcou o lugar no print: embaixo de "Última análise" e "Último atendimento".

Desde a v1266 a linha de baixo mostrava **"Último atendimento"** quando havia atendimento registrado
— e, quando mostrava isso, a data da conversa sumia da tela. São duas informações diferentes: uma é
quando **você** atendeu, a outra é quando a **conversa** parou de verdade. Agora aparecem as duas,
uma embaixo da outra:

> Última análise — 14/08/2026 • 15:10
> Último atendimento — 14/08/2026 • 15:10
> Última mensagem — 12/08/2026 • 09:42

Tanto faz de quem é a última mensagem (sua ou do cliente), como você pediu. Quando não há
atendimento registrado, a linha de cima já é a da mensagem e ela não se repete.

## Conferido

`tests/v1307-link-do-corretor-e-ultima-mensagem.test.mjs`: endereço proibido é recusado, link de
cliente nunca é aberto, página vazia/404/erro de rede não quebra nem inventa, o texto lido entra na
mensagem certa da conversa, e a linha nova está no cartão sem repetir a de cima. Tela conferida em
navegador, em tamanho de celular.
