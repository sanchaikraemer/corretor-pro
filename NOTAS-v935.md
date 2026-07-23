# v935 — unidades específicas escolhidas pelo cliente se perdiam da análise

## O bug (achado pelo dono numa conversa real)

A Angelica, no WhatsApp, escolheu 3 lotes específicos: "105 da quadra 77, 37 quadra 157, 31
quadra 155". Isso está bem claro na conversa importada. Mas em NENHUM lugar da tela do lead —
resumo, "Detalhes comerciais", nem nas sugestões de mensagem — aparecia qual lote ela tinha
escolhido. Só aparecia o nome genérico do empreendimento ("Terrenos no Loteamento Nova Vila
Rica III"). A escolha real da cliente, que está achável ali no meio da conversa, se perdia.

## Causa raiz

1. **Prompt da análise (`api/_pipeline.js`)**: o schema já tinha um campo `produtosInteresse`
   (array), pensado exatamente pra isso — várias opções/unidades de interesse — mas o prompt
   nunca instruiu a IA a separar identificadores específicos (lote/quadra/apartamento/bloco)
   quando o cliente os citava. Sem essa instrução, a IA colapsava tudo no nome genérico do
   empreendimento em `produtoInteresse`, e `produtosInteresse` só recebia o mesmo item genérico
   como fallback (`api/_pipeline.js`, linha ~2600).
2. **Frontend (`app.js`)**: mesmo se `produtosInteresse` viesse populado corretamente, ele nunca
   era lido em lugar nenhum da tela — `cp704DetailRows` ("Detalhes comerciais") só mostrava
   `mc.oportunidade.produto` (o nome genérico), nunca o array de unidades específicas.

## O que mudou

1. `api/_pipeline.js`: nova instrução explícita no prompt de análise ("PRODUTO ESPECÍFICO: ...")
   pedindo pra IA incluir identificadores específicos de unidade em `produtoInteresse` quando o
   cliente os citar, e listar cada unidade separadamente em `produtosInteresse` quando houver
   mais de uma. Sem inventar nome de empreendimento — o exemplo do prompt usa placeholder
   genérico (`<nome do empreendimento citado na conversa>`), nunca um nome real cravado (regra
   §7.5, ver `tests/v827-catalogo.test.mjs`).
2. `app.js` (`cp704DetailRows`): nova linha "Unidades específicas de interesse" em "Detalhes
   comerciais", que só aparece quando `analysis.produtosInteresse` tem 2+ itens — evita duplicar
   a linha "Produto" no caso comum (uma unidade só / nada específico citado).

## Verificação

- `tests/v935-unidades-especificas-produto.test.mjs` (novo): confirma a instrução no prompt e a
  nova linha condicional em `cp704DetailRows`.
- Suíte inteira verde (`npm test`), incluindo `v827-catalogo` (garante que o exemplo novo no
  prompt não cravou nome de empreendimento real no código).
- `node build.js` OK, versão 935.

## Observação
Como a extração depende da IA seguir a instrução nova do prompt, leads JÁ analisados antes desta
versão não ganham a linha nova automaticamente — precisam ser reanalisados pra ela aparecer.

## Arquivos
- `api/_pipeline.js` (prompt de análise), `app.js` (`cp704DetailRows`),
  `tests/v935-unidades-especificas-produto.test.mjs` (novo), `package.json`/`package-lock.json`,
  `NOTAS-v935.md`, versão **934 → 935**.
