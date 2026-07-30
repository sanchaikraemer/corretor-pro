# NOTAS v1081 — "Registrar observação" no computador: a tela pulava e o texto não aparecia

## Contexto

O dono relatou, com print, que no computador: **"quando clico dentro de observações, ele joga
lá pra baixo a tela e não escreve"** — e complementou que **"só na terceira vez que abri o lead
de novo é que consegui escrever e salvar"**. O print mostra a tela do **Menu / Configurações**,
ou seja: ele estava dentro de um lead, foi digitar a observação e o app o levou pra OUTRA TELA,
levando junto o que ele achava estar escrevendo.

São duas causas somadas — uma explica o texto sumindo, a outra explica a tela pulando pra
outro lugar.

## Causa 1: o detalhe do lead se remonta por baixo e destrói o campo em uso

A tela de um lead é montada **mais de uma vez**: ao abrir, o app pinta primeiro com o que já
tem na memória e, quando o servidor responde, pinta tudo de novo (e reanalisar, marcar
atendimento e salvar observação também remontam). Cada remontagem trocava a área inteira do
zero — inclusive a caixa "Registrar observação".

Se o corretor clicasse na caixa e começasse a digitar dentro dessa janela (o normal: a resposta
do servidor pode demorar alguns segundos), a caixa era **jogada fora e criada de novo, vazia**:
o texto sumia, o cursor ia parar no corpo da página e a página se reposicionava sozinha. Na
terceira vez que ele abria o mesmo lead, os dados já estavam guardados na memória do app, a
remontagem acontecia antes dele começar a digitar — e por isso "na terceira vez funcionou".

**Corrigido:** antes de remontar, o app guarda o que está na caixa de observação (texto, posição
do cursor, se estava em uso) e a posição da rolagem da página; logo depois de remontar, devolve
tudo pro lugar. Quem estava escrevendo continua escrevendo, no mesmo ponto, sem a tela pular.

## Causa 2: letra solta virava navegação por cima da digitação

O app tem atalhos de teclado no computador que ninguém documentou em lugar nenhum da tela:
`h` = Hoje, `m` = Menu, `z` = importar ZIP, `c` = Cérebro, `/` = busca, `1`/`2`/`3` = cards.
Eles só eram ignorados enquanto o cursor estivesse dentro de um campo de texto.

Como a Causa 1 tirava o cursor do campo sem o corretor perceber, a digitação dele deixava de
ser texto e virava navegação: a letra "m" de qualquer palavra o mandava pro **Menu** — que é
exatamente a tela do print. Era isso, e não a rolagem, o "joga lá pra baixo a tela".

**Corrigido:** com um lead aberto, letra solta **nunca** navega (a trava vale pra todos os
atalhos, inclusive `/` e 1/2/3). E combinação do navegador (Ctrl+H, Alt+M, Cmd+Z) ou acento/ç
de teclado ABNT também não viram mais navegação — antes o app engolia a tecla e navegava no
lugar do navegador. Na Home, sem lead aberto, os atalhos continuam funcionando como antes.

## Verificação

- Suíte inteira (`npm test`) verde, incluindo o teste novo
  `tests/v1081-observacao-nao-perde-texto-nem-foco.test.mjs`, que trava as duas correções:
  a ordem guardar → remontar → devolver (texto, cursor, foco e rolagem) e a trava dos atalhos
  antes de qualquer tecla ser interpretada.
- Sem mudança de CSS/layout: a aparência da tela do lead é exatamente a mesma. O que mudou é
  *quando* o app mexe no foco, no texto e na rolagem.

## Arquivos

`app.js` (`renderLeadFoco` e o bloco de atalhos de teclado do desktop),
`tests/v1081-observacao-nao-perde-texto-nem-foco.test.mjs` (novo), `package.json` (lista de
testes + versão **1080 → 1081**), `package-lock.json` (sincronizado), `NOTAS-v1081.md`
(este arquivo).
