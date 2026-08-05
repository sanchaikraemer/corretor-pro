# v1138 — o app passou a cobrar o corretor: lembrete diário de clientes sem resposta

Item 4 (último) do plano aprovado pelo dono. O motivo veio da pesquisa de mercado da auditoria de
05/08/2026: **a maioria das vendas sai depois do 5º contato — e quase metade dos corretores para no
1º**. Os concorrentes ganham exatamente aqui, no lembrete automático. O Corretor Pro já sabia QUEM
estava esperando resposta (o sino do topo), mas só avisava com o app **aberto** — e o corretor que
mais precisa do aviso é justamente o que não abriu o app.

## Como funciona (sem servidor novo, sem rota nova, sem dado saindo do aparelho)

O limite de 12 funções da Vercel está em 11 — e notificação por servidor exigiria duas rotas novas,
tabela de inscrições e chaves. Nada disso foi preciso:

1. **O app grava um retrato local** (IndexedDB) a cada carga de leads: quantos clientes estão
   esperando resposta há mais de 24h + até 3 nomes + quando isso foi calculado.
2. **O navegador acorda o service worker** uma vez por dia (Periodic Background Sync — Android com
   o app instalado) e ele mostra a notificação lendo só esse retrato. O worker não tem sessão nem
   token; nenhuma chamada de rede; nada sai do aparelho.
3. **Tocar no aviso abre o app** (foca a janela existente ou abre uma nova).

## A régua de "esperando resposta" (só dados que o app já tem)

Lead **ativo**, com **mensagem real do cliente** no histórico, onde a última mensagem real da
conversa **não é do corretor**, **sem atendimento registrado depois** dela (botão, cópia de
mensagem, observação), e com **mais de 24 horas**. Quem espera há mais tempo vem primeiro.

Dois cuidados que o teste trava:

- `Number(null) === 0`: sem mensagem do cliente o servidor manda `null` em `daysSinceClientReply`,
  e "null virando zero" colocaria na cobrança um lead que só tem anotações manuais. (O teste pegou
  este exato erro na primeira versão da régua.)
- O fallback de `lastInteractionAt` (que pode cair em `atualizado_em`) nunca decide sozinho.

## Honestidade — o produto não mente em nenhum estado

- **Anti-incômodo**: no máximo 1 aviso a cada 20h, mesmo que o navegador acorde mais vezes.
- **Retrato com mais de 48h** (app fechado há dias): o texto vira genérico, sem número — o número
  pode ter mudado.
- **Retrato com mais de 30 dias**: para de avisar. Insistir com dado de um mês só faria o corretor
  silenciar o app pra sempre.
- **Onde não é suportado** (iPhone, desktop): o botão ativa, o aviso em segundo plano não existe, e
  o texto DIZ isso — "no Android, com o app instalado, ele chega mesmo fechado; aqui, o sino do
  topo segue mostrando quem espera". Sem fingir que funciona.
- **Permissão só no clique** (gesto do corretor), nunca na abertura do app.

## Onde fica

Menu → cartão **"Lembrete diário"**, acima da Aparência. Ativar/desativar no mesmo botão;
desativar também desregistra o sync periódico.

## Arquivos

- Alterados: `app.js` (régua + retrato + liga/desliga), `service-worker.js` (o despertador:
  `periodicsync` + `notificationclick`), `index.html` (o cartão no Menu).
- Novo: `tests/v1138-lembrete-diario-cobranca.test.mjs` — roda a régua com 7 casos reais (inclusive
  os dois cuidados acima), e trava o anti-incômodo, os cortes de honestidade (48h/30 dias), o tag
  do sync e a ausência de chamada de rede no worker.

## Conferido

- Suíte completa: **311 testes verdes**.
- Visual no Chromium (celular): cartão no Menu com botão coral "Ativar lembrete diário", sem
  scroll lateral, sem erros.
