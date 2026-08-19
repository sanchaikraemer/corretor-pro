# v1314 — o aviso vermelho em português (e menor)

Print do dono, 19/08/2026 às 17h38: *"pq aparece esse monte de merda aí?"* — o aviso de análise
reaproveitada estava exibindo o texto cru da OpenAI, em inglês e com código:

> `[HTTP 429 · code=credit_balance_exhausted · type=insufficient_quota] You have no credits`
> `remaining. Add credits to continue using the API at https://platform.openai.com/...`

## Por que voltou, se a v1310 já traduzia isso

A tradução da v1310 acontece **no servidor, na hora em que a falha acontece**. Só que esse motivo
fica **gravado junto da análise do cliente** — e as análises que falharam ANTES daquela versão
guardaram o texto em inglês. Ao abrir o cliente, era o texto salvo que aparecia.

Agora a tradução acontece **também na hora de desenhar a tela**: análise velha e análise nova saem
iguais, em português. Vale para o aviso vermelho do cliente e para o quadro de falha da importação.

## E o aviso encolheu

Era um bloco de seis linhas repetindo a mesma ideia. Ficou:

> **Estas três mensagens são da análise ANTERIOR deste cliente** — a nova não foi concluída, então
> provavelmente você já enviou essas mensagens.
> **Motivo:** (a frase em português)
> [Página de créditos da OpenAI] — só quando o motivo for esse
> Toque em ↻ Reanalisar pra gerar as novas.

## Arquivos

- `app.js` — `cpErroDaIAEmPortugues` (tradução na hora de mostrar) e o aviso enxuto.
- `js/importacao.js` — o mesmo tratamento no quadro de falha da importação.
- Testes `v1309` e `v1310` atualizados: as linhas que eles guardavam mudaram de forma.
