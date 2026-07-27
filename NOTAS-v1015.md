# NOTAS v1015 — Setinha da conta na barra lateral virou clicável de verdade

## O relato

O dono percebeu, olhando o cartão da conta na barra lateral (avatar + nome + uma setinha "⌄"),
que a seta dá a entender que existe um menu ali — mas clicar não fazia nada.

## Causa

`.cp-sidebar-user` era um `<div>` simples, sem `onclick` nem nenhuma lógica associada. A seta
"⌄" era puramente decorativa, sugerindo uma interação que nunca existiu.

## Correção

O cartão inteiro virou um `<button>` de verdade. Como a única ação que já faz sentido nesse
lugar é "Sair da conta" (o botão dedicado já existia logo abaixo, sempre visível quando logado),
o clique no cartão agora chama a mesma função `cpSairDaConta()`.

CSS ajustado pra neutralizar a aparência padrão de `<button>` do navegador (fonte, alinhamento,
largura) e manter o visual idêntico ao `<div>` de antes — só ganhou `cursor:pointer` e um leve
destaque ao passar o mouse, deixando claro que agora é clicável de verdade.

## Teste novo

`tests/v1015-seta-conta-lateral-clicavel.test.mjs` — confirma que o elemento é um `<button>` com
`onclick="cpSairDaConta()"`, que a estrutura visual (avatar/nome/seta) não mudou, e que o CSS
neutraliza os estilos padrão de botão do navegador.

## `npm test`

Suíte inteira verde.
