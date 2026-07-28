# NOTAS v1055 — o histórico de atendimento aparece de verdade dentro do lead + texto padronizado

## Os dois relatos

1. "não é ela, ninguém aparece como atendido no histórico... mesmo que clique em atender, isso
   não é marcado na linha de tempo."
2. Sobre a v1054 (o texto "atendido há Xd" vs "há Xd"): "isso deve ser desde último atendimento e
   não última mensagem... e por que um diz 'atendido há x d' e os outros 'há x d', tem que ficar
   tudo padrão."

## Achado real (não era a Karine especificamente)

Fui atrás do primeiro relato e achei uma função **órfã**: `renderHistoricoContatos`, que monta um
bloco "Histórico de contatos" mostrando os últimos 5 registros de atendimento (Marcar atendimento,
Copiar sugestão, ligação, visita, observação...), existia no código e funcionava — só que **nunca
era chamada de lugar nenhum**. Provavelmente ficou pra trás numa reforma anterior da tela do lead.
Resultado: o clique era salvo de verdade no banco (os dados sempre estiveram certos — por isso a
regra dos 7 dias já funciona), mas **você nunca via nenhum sinal disso na tela**, em lead nenhum,
não só na Karine. Reconectei essa função na tela do lead — agora, se ele foi atendido, aparece
visivelmente ali, na hora.

## Sobre o texto "atendido há" vs "há"

Isso era uma tentativa minha (v1054) de deixar visível, direto na lista, se um lead tinha
atendimento reconhecido ou não — mas causou inconsistência visual chata de olhar. Voltei o texto
pra ser sempre "há Xd", igual pra todo mundo. **O número em si continua vindo do atendimento
quando ele existe** (isso já tinha sido resolvido na v1053 e continua valendo) — só o texto que
ficou padronizado de novo.

## Testes

- `tests/v1055-historico-contatos-visivel-no-lead.test.mjs` (novo): confirma que
  `renderLeadFoco` agora chama `renderHistoricoContatos`, e que um lead com atendimento registrado
  mostra o bloco "Histórico de contatos" com a palavra "Atendido" visível.
- `tests/v1055-2-rotulo-padrao-sempre-ha.test.mjs` (novo): confirma que o texto voltou a ser
  sempre "há Xd", igual pra leads com e sem atendimento reconhecido — só o número (não mais o
  texto) diferencia os dois casos agora.
- `tests/v1054-rotulo-atendido-visivel-na-lista.test.mjs` removido — a distinção que ele travava
  não existe mais.
- `npm test`: suíte inteira verde.
- `npm run build`: build limpo, 27 arquivos publicados.

## Arquivos

`app.js` (`renderLeadFoco` passa a chamar `renderHistoricoContatos`; `cpHomeLeadRow` volta ao
rótulo padrão "há"), `tests/v1055-historico-contatos-visivel-no-lead.test.mjs` (novo),
`tests/v1055-2-rotulo-padrao-sempre-ha.test.mjs` (novo),
`tests/v1054-rotulo-atendido-visivel-na-lista.test.mjs` (removido),
`tests/v1018-atendimento-e-nao-mensagem-define-espera.test.mjs`,
`tests/v1053-numero-fila-hoje-usa-atendimento-nao-mensagem.test.mjs` (ajustados),
`package.json`/`package-lock.json` (versão + script `test`), `NOTAS-v1055.md`, versão
**1054 → 1055**.
