# NOTAS v1061 — Editar o nome do lead voltava pro nome antigo na tela

## O relato

Print do celular: dono abriu "Editar lead", trocou o nome de "Cristiano nvr" pra "Cristiano
terreno nvr", salvou — e a tela continuou mostrando "Cristiano nvr", como se a edição não
tivesse pego. Pergunta: "porque nao salva exatamente como to digitando no editar do lead?"

## Causa

O banco gravava certo: `api/lead-update.js` (ação `editar-dados`) já salvava
`resultado_analise.clientName` exatamente com o texto digitado. O problema estava na LEITURA.
Toda vez que a tela mostra um lead (lista, carteira, detalhe), o nome passa por `nameFrom()` em
`api/_persistence.js`, que tem um filtro (`limparRuidoNome`) pra tirar palavras como "cel",
"celular", "whatsapp", "terreno(s)", "lote(s)", "apto(s)", "apartamento(s)", "fone", "tel" do
nome — pensado pra limpar contato salvo torto no WhatsApp na hora da importação automática (ex.:
contato salvo como "Fulano Cel"). Esse filtro rodava em TODA renderização, sem saber se o nome
tinha acabado de ser digitado à mão pelo corretor — então "Cristiano **terreno** nvr" virava
"Cristiano nvr" de novo a cada vez que a tela recarregava, mesmo com o nome certo salvo no banco.

## A mudança

- `api/lead-update.js`: ao salvar um nome pela tela "Editar lead", grava também
  `resultado_analise.nomeEditadoManualmente = true`.
- `api/_persistence.js` (`nameFrom`): quando essa marca existe, devolve o nome exatamente como
  está salvo, sem passar pelo filtro de "ruído de nome de WhatsApp" — o filtro continua valendo
  normalmente pra nome bruto vindo da importação (comportamento de sempre, sem mudança).
- `api/reanalisar-lead.js`: a marca é preservada quando o lead é reanalisado (botão "Reanalisar"
  do topo), senão a próxima reanálise apagava a marca e o bug voltava a aparecer depois.

## Testes

- `tests/v1061-nome-editado-manualmente-nao-e-limpo.test.mjs` (novo): reproduz o caso do print
  (`"Cristiano terreno nvr"`) batendo direto em `listRecentProcessings` — confirma que, sem a
  marca, o filtro antigo continua tirando "terreno" (documenta o comportamento intencional pra
  nome de importação); com a marca, o nome aparece exatamente como digitado, tanto na listagem
  quanto no detalhe completo do lead. Confirma também que `editar-dados` grava a marca e que
  `reanalisar-lead.js` a preserva ao gravar de novo.
- `npm test`: suíte inteira verde.

## Arquivos

`api/lead-update.js` (marca `nomeEditadoManualmente` ao editar o nome), `api/_persistence.js`
(`nameFrom` respeita a marca), `api/reanalisar-lead.js` (preserva a marca ao reanalisar),
`tests/v1061-nome-editado-manualmente-nao-e-limpo.test.mjs` (novo), `package.json` /
`package-lock.json` (versão + script `test`), `NOTAS-v1061.md`, versão **1060 → 1061**.
