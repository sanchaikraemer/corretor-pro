# NOTAS v1072 — "Sem atender 30d+" agora abre a lista, do mais antigo pro mais recente

## Contexto

Pedido direto do dono, na sequência do contador criado na v1071: ao clicar no card "Sem atender
30d+" da Home, abrir a lista de quem está nessa situação — ordenada do mais antigo (mais
atrasado) pro mais recente.

## O que mudou

O card deixou de ser só um número: agora, ao tocar nele, abre a mesma tela de lista usada por
"Fazer agora"/"Propostas feitas" (com busca e cards clicáveis), mostrando todos os leads sem
atendimento há 30 dias ou mais.

**Ordem da lista**: quem nunca foi atendido aparece primeiro (é sempre o caso mais atrasado,
mesmo sem uma data pra comparar); depois, entre quem já foi atendido alguma vez, o de
atendimento mais antigo vem antes do mais recente.

## Verificação

- `tests/v1072-sem-atender-30d-abre-lista-ordenada.test.mjs` (novo): confirma que o card chama a
  função nova, que ela filtra pelo mesmo prazo de 30 dias do contador (v1071), e que a ordem
  (nunca atendido → mais antigo → mais recente) sai correta.
- Suíte inteira (`npm test`) verde.
- `npm run build` limpo.

## Arquivos

`app.js`, `tests/v1072-sem-atender-30d-abre-lista-ordenada.test.mjs` (novo), `package.json`/
`package-lock.json` (versão **1071 → 1072**), `NOTAS-v1072.md` (este arquivo).
