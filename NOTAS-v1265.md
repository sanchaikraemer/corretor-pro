# v1265 — "parado há 100 dias" numa cliente que ele tinha mandado mensagem há 17

Relato do dono (13/08/2026, três prints em sequência):

1. **Carteira ativa**, 1ª da lista: *"Dani De Sm — PARADO HÁ 100 dias"*.
2. **Dentro da cliente**: *"Última análise — 28/07/2026 · 18:16 / Última mensagem — 05/05/2026 · 20:01"*.
3. **O histórico logo abaixo, aberto**: a mensagem do TOPO é de **28/07/2026 · 18:16**, mandada por
   ele — *"Boa noite Dani, tudo bem? Faz um tempo que conversamos..."*.

A mesma tela mostrava a mensagem de 28/07 e, dois centímetros acima, dizia que a cliente estava
parada desde 05/05.

## A causa (uma só, aparecendo em dois lugares)

Quando o corretor copia a sugestão, o app grava a mensagem no histórico como **"Mensagem enviada
(você)"** — e essa entrada nasce marcada como registro manual. As duas contas abaixo descartam
tudo que é manual:

- **A coluna "Parado há"** usava `daysSinceLastInteraction`, que só enxerga mensagem importada do
  WhatsApp → 100 dias (05/05), ignorando o toque de 28/07.
- **A linha "Última mensagem"** usava `cp786UltimaMensagemReal`, que descarta `source: "manual"` →
  05/05, enquanto o histórico logo abaixo abria com a de 28/07.

Descartar registro manual está **certo** para observação, ligação e visita — nada disso é mensagem.
Está **errado** para "Mensagem enviada (você)", que é uma mensagem que ele realmente mandou.

## O que mudou

**Coluna "Parado há"** (Carteira ativa e as outras listas abertas pelos cards): passa a usar
`diasParado`, que já existia e o ranking já usava — *"desde o último toque REAL: mensagem OU
atendimento marcado"*. Nada de régua nova; a coluna só não estava usando a que o app já tinha. Quem
não tem toque nenhum registrado continua mostrando o tempo da conversa, e "atendido hoje" continua
igual.

**Linha "Última mensagem"** do cabeçalho do cliente: passa a mostrar a última mensagem **exibida**
(inclui a que ele mandou pelo app), e agora diz **de quem ela é** — *"Última mensagem — 28/07/2026 ·
18:16 (sua)"* ou *"(do cliente)"*. Sem essa marcação, ver a data da própria mensagem no lugar onde
ele procura "a cliente respondeu?" trocaria uma confusão por outra.

De propósito, isso ficou **só na exibição**: a peça nova (`cp1265UltimaMensagemExibida`) não é usada
na classificação do cliente. Quem decide "esperando você" / "aguardando cliente" continua olhando só
conversa de WhatsApp — regra da casa desde a v1189 (o app lê o retrato exportado, não o WhatsApp ao
vivo).

## Conferência na tela (obrigatória)

App publicado (`public/`) aberto em Chromium headless, 390×844, com dois clientes de teste:

| Cliente | Antes | Agora |
|---|---|---|
| Dani (calada há 100d, mensagem enviada há 17d) | PARADO HÁ 100 dias | **PARADO HÁ 17 dias** |
| Sem toque nenhum (calado há 100d) | PARADO HÁ 100 dias | PARADO HÁ 100 dias |

Nenhum erro de página. Nada de CSS/layout mudou — só o número e o texto.

## Testes

`tests/v1265-parado-ha-conta-o-ultimo-toque-real.test.mjs` (novo) — reproduz o caso da Dani nos dois
pontos: a coluna com 17 (e não 100), o cliente sem toque preservando o número da conversa, o "—"
quando não há data nenhuma, o cabeçalho apontando pra mensagem de 28/07 sabendo que é dele, a
resposta posterior do cliente voltando a ser a última mensagem, e ligação/observação continuando
fora (não são mensagens).

`tests/v937-saudacao-nao-promete-lista-vazia.test.mjs` — ajustado: ele cravava o nome da função que
alimenta a linha "Última mensagem". O que o teste protege (a linha ser calculada e aparecer)
continua igual; só o nome da fonte mudou.

Suíte completa verde: 24 arquivos + 424 testes.
