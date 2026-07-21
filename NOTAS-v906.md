# v906 — "Aguardando cliente" com significado real

## Pedido do dono
"até hoje não entendi esse 'Aguardando cliente' — é incoerente, pois quando o cliente responde no
meu WhatsApp eu já atendo." O número (231) não dizia nada. O dono propôs o significado certo:
seriam os clientes que ele **atendeu** (copiou mensagem ou marcou atendimento) e que **ainda não
responderam** — aí sim a bola está com o cliente.

## Antes (por que dava 231 e não fazia sentido)
`cp786Categoria` jogava em "aguardando" um balde de sobra: atendido hoje, atendido nos últimos 5
dias, **lead raso (<5 msgs do cliente)** e **todo lead que sobrava**. Os dois últimos não têm nada
a ver com "esperando o cliente".

## Agora
- Nova `cpAguardandoResposta(l)`: verdadeira só quando **você atendeu** (`ultimoAtendimentoTs > 0`
  — cópia de mensagem ou "marcar atendimento") **e** a última mensagem do cliente é **anterior** a
  esse atendimento (`ultimaMsgClienteTs(l) <= ultimoAtendimentoTs(l)`) — ou seja, ele não respondeu
  depois. Nova `ultimaMsgClienteTs(l)` acha a hora da última fala do cliente na timeline.
- `cp786Categoria` reescrita:
  - compromisso → `programados` (Agenda);
  - **atendi e o cliente não respondeu → `aguardando`** (a bola está com ele);
  - lead raso (poucas msgs do cliente) → **`sem-acao`** (fica só em "Total de leads");
  - vale um toque proativo → `agora` (Fazer agora); senão → `sem-acao`.
- O leftover (`sem-acao`) **não some**: continua no "Total de leads" e volta a "Fazer agora" quando
  for hora — só não infla mais o card "Aguardando cliente".

## Efeito colateral bom
Se o cliente RESPONDE depois do seu atendimento, o lead deixa de ser "aguardando" e passa a
"Fazer agora" (você deve uma resposta) — em vez de descansar cego por 5 dias.

## Verificação
- `tests/v906-aguardando-cliente-real.test.mjs` (novo) executa `cpAguardandoResposta`/
  `ultimaMsgClienteTs` com cenários (atendi sem resposta → aguardando; cliente respondeu depois →
  não; nunca atendido → não) e confere a estrutura da `cp786Categoria`.
- Ajustados os testes que fixavam o balde antigo: v818, v824, v885, v886.
- Suíte inteira verde; `node --check` OK.

## Arquivos
- `app.js` — `ultimaMsgClienteTs`, `cpAguardandoResposta` (novas) + `cp786Categoria` reescrita.
- `tests/v906-aguardando-cliente-real.test.mjs` (novo); v818/v824/v885/v886 (ajustes).
- `NOTAS-v906.md`, versão **905 → 906**.

## Fila anotada (próximas — ainda NÃO feitas)
8. Mover "Atualizado em…" pra perto de "X dias de contato / sem resposta".
9. Mostrar "Última atualização" nas metalinhas do lead (reconciliar com o 8).
10. Alinhar a contagem "atendidos hoje" da home com a Meta do dia (arquivado atendido hoje conta).
11/13. Ações do lead (Gerar proposta/Arquivar/Excluir/Últimas mensagens) — aguardando o dono
    decidir se sobem pro topo em ícones e quantas.
12. Tela Atendimentos por dia (colunas) — aguardando decisão do dono (redesenho x só limpar nomes).
