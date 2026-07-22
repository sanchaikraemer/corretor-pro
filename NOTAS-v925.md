# v925 — "Vamos atender mais um?" quando a meta do dia é batida

## Pedido do dono

Depois da v924 corrigir o "Fazer agora" pra descer de verdade (10→0 conforme atende), o dono viu
o card zerado e sugeriu: em vez de só dizer "tudo em dia", o app podia **puxar o corretor a
continuar** — afinal o objetivo é converter venda, não só bater um número.

## O que mudou

Na Home, quando a meta de hoje é batida (`urgentes` vazio) mas ainda existem leads elegíveis
além do corte (`backlogAlemDaDose`), em vez de cair direto pra "Nenhum lead urgente" ou "Tudo em
dia", aparece um convite:

> 🎉 **Meta de hoje batida!** Ainda tem N leads esperando prioridade. Cada atendimento a mais é
> uma venda mais perto. **[Vamos atender mais um?]**

O botão chama `cpAtenderMaisUmHoje()`, que soma 1 em `state.fazerAgoraExtra` (a MESMA variável de
sessão que o botão "Atender +1" de `abrirFazerAgora` já usava) e re-renderiza a Home — o próximo
lead da fila vira o hero na hora, sem precisar abrir outra tela. Como os dois botões somam no
mesmo contador, ficam sempre sincronizados (usar um ou outro dá no mesmo).

Isso não muda a meta diária (continua 10, recalculada e decrescente conforme a v924) — é só um
convite pra ir além dela, por vontade do corretor, no mesmo dia.

## Verificação

- `tests/v925-vamos-atender-mais-um.test.mjs` (novo): confirma que `renderBotoesHome` soma
  `state.fazerAgoraExtra` na meta efetiva do dia, que o convite aparece com o texto certo e chama
  `cpAtenderMaisUmHoje()`, que `temLista` continua considerando esse backlog (pro link "Ver todas
  as oportunidades" não sumir), e que `cpAtenderMaisUmHoje` incrementa o contador certo e
  re-renderiza a Home.
- Suíte inteira verde (`npm test`); `node --check app.js` e `node build.js` OK.

## Arquivos
- `app.js` (`renderBotoesHome`: meta efetiva + convite de continuar; `cpAtenderMaisUmHoje` novo),
  `tests/v925-vamos-atender-mais-um.test.mjs` (novo), `package.json`/`package-lock.json`,
  `NOTAS-v925.md`, versão **924 → 925**.
