# v929 — Desempenho vira análise de verdade (Modelo 2, escolhido entre 4 opções)

## O pedido

Depois de corrigir o gráfico de "Prioridade de atendimento" (v927), o dono apontou o problema
de fundo: "Visão geral da carteira" (Clientes ativos, Fazer agora, Compromissos, Aguardando
cliente) é **a mesma coisa que já aparece na Home** — "desempenho não pode ser a mesma coisa que
atendimentos, senão não tem coerência". As métricas que ele quer de verdade:

> tempo no app por dia · mensagens trocadas · empreendimentos negociados · leads atendidos ·
> mensagens copiadas · análises feitas · importações · propostas feitas (com histórico)

Apresentei 4 modelos visuais (grade de cartões, lista de métricas, painéis por categoria,
destaque + apoio) num artifact pra ele escolher — decisão: **Modelo 2, lista de métricas**.

## Levantamento antes de construir

Conferido o que já existia (pra não prometer dado que não tem):
- **Prontos** (só precisavam de agregação): mensagens trocadas, leads atendidos, mensagens
  copiadas, empreendimentos negociados, propostas feitas.
- **Precisavam de instrumentação nova**: tempo no app (nada registrava isso), análises feitas
  (só existia a DATA da última análise, não uma contagem), importações (idem — só um id de
  controle de UMA importação por vez, não um histórico).

## O que mudou

**HTML/CSS (`index.html`/`styles.css`)**: a grade `.cp-metrics` (4 botões duplicando a Home) e o
título "Visão geral da carteira" saíram. No lugar, `#cpMetricasSemana` — uma lista de linhas
(ícone + rótulo + número), estilo escolhido pelo dono. O resto da tela (Próximos compromissos,
Prioridade de atendimento, Condução da carteira, Atendimentos em andamento) continua igual — não
era o que estava sendo questionado.

**Novo módulo de atividade (`app.js`, início do arquivo)**: `cpRegistrarAtividade`/
`cpContarAtividade` — um log leve em `localStorage` (só neste aparelho, guarda 90 dias, poda
sozinho) pra contar eventos de uso que o app não registrava. E `cpTempoApp*` — mede tempo com a
aba VISÍVEL (pausa em segundo plano), guardado por dia (chave BR), com flush a cada 1 min e no
`pagehide` pra sobreviver a fechamento abrupto do navegador.

**Dois pontos de instrumentação**:
- `ui670Reanalisar` (botão "Reanalisar" do lead): ao concluir com sucesso, grava 1 "análise".
- `processFile` (upload do ZIP): ao terminar o upload com sucesso, grava 1 "importação" — conta
  o ZIP recebido, não quantos leads ele gera (essa é a unidade natural de "importei uma
  conversa").

**`cpDesempenhoMetricas(items, all)`** (novo, `app.js`): agrega as 8 métricas — mensagens
trocadas/leads atendidos/mensagens copiadas contam eventos e mensagens dos ÚLTIMOS 7 DIAS (lidos
de `aprendizado.eventos`/`recentMessages`, os mesmos dados sincronizados via Supabase);
análises/importações vêm do novo log local; empreendimentos agrupa a carteira ativa por produto;
propostas soma os itens `type:"proposta"` já guardados na linha do tempo de cada lead.

**"Propostas feitas" com histórico de verdade**: clicar abre uma lista (reaproveitando
`abrirGrupoHome`, o mesmo mecanismo do "Fazer agora") com os leads que têm proposta registrada,
mais recente primeiro — abrir o lead mostra a proposta completa na timeline dele. Sem precisar
inventar uma tela nova do zero.

## Limitação conhecida (avisada ao dono)

Tempo no app, análises feitas e importações começam a contar **a partir de agora** — não tem
como reconstruir histórico de algo que nunca foi registrado antes. E tempo no app é só DESTE
aparelho (não soma celular + PC, já que não existe sessão de servidor pra isso).

## Verificação

- `tests/v929-desempenho-metricas-reais.test.mjs` (novo): roda `cpDesempenhoMetricas` de
  verdade com um dataset sintético (mensagens dentro/fora da janela de 7 dias, evento de
  atendimento fora da janela não deve contar, agrupamento de empreendimentos por quantidade),
  confirma `cpFormatarDuracao` (2h 03min / 5min / "menos de 1min"), confirma os dois pontos de
  instrumentação (`cpRegistrarAtividade("analise"/"importacao")`) e que "Propostas feitas" abre
  o histórico via `abrirGrupoHome`.
- Suíte inteira verde (`npm test`); `node --check app.js` e `node build.js` OK.

## Arquivos
- `app.js` (módulo de atividade/tempo no app, 2 hooks de instrumentação, `cpDesempenhoMetricas`,
  `cpRenderDesempenhoMetricas`, `cpAbrirHistoricoPropostas`, `renderCorretorProDashboard`
  ajustado), `index.html` (grade antiga removida, `#cpMetricasSemana` novo), `styles.css`
  (`.cp-met-*` novo), `tests/v929-desempenho-metricas-reais.test.mjs` (novo),
  `package.json`/`package-lock.json`, `NOTAS-v929.md`, versão **928 → 929**.
