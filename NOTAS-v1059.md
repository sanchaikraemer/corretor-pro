# NOTAS v1059 — "aguardar, sem mandar mensagem" + dois ajustes finos no texto fixo

## O pedido

Continuação da revisão dos prompts do Cérebro (NOTAS-v1058.md). Depois do dono compartilhar o
conteúdo completo — Método, Tom de voz, Diferenciais, O que evitar, Regras comerciais e Sinais de
objeção reais da conta dele — e eu cruzar tudo com o texto fixo do sistema, ele pediu a decisão
direta: "quero q vc me diga o q vamos fazer, se vamos ajustar o prompt ou nao?"

## Achados e decisões

1. **A análise sempre entregava 3 mensagens prontas — mesmo quando a leitura certa era não mandar
   nenhuma.** Duas categorias de objeção do próprio dono deixam isso claro: "VAI PENSAR OU AINDA
   NÃO É O MOMENTO" ("não insista em visita, reunião ou fechamento") e "NEGATIVA CLARA" ("não
   insista, não pressione... encerre de forma cordial"). Isso bate com o caso da Karine (ela disse
   "vai ser mais pra frente") e com a comparação que o dono fez com uma análise no ChatGPT, que
   soube reconhecer "não manda nada hoje" — o Corretor Pro não tinha esse resultado possível. Novo
   campo `recomendacaoContato:{aguardar, motivo}`: quando os sinais indicarem espera/recusa sem
   nenhum gatilho novo pra contato, a IA marca `aguardar:true` com o motivo. As 3 mensagens
   continuam sendo geradas normalmente (ficam disponíveis se o corretor decidir contatar mesmo
   assim), mas a tela do lead agora mostra um aviso em destaque acima delas: "Recomendação agora:
   aguardar, sem mandar mensagem" + o motivo.

2. **A palavra "insista" no ponto do decorado.** O texto fixo dizia "Não viu o decorado → insista
   com leveza" — a mesma palavra ("insista") que aparece na regra de nunca insistir depois de uma
   negativa clara. As duas situações são diferentes (não ter visto o decorado não é recusa), mas
   não custava nada tirar a palavra em comum. Virou "retome com leveza", com a ressalva explícita
   de que só vale antes de qualquer recusa.

3. **O argumento "compra na planta, congela o preço e valoriza até a entrega".** Ficou mais claro
   que é um mecanismo geral do mercado (comprar na planta historicamente valoriza até a entrega),
   não uma promessa sobre um imóvel específico — sem cravar número ou percentual de valorização
   sem confirmação.

## O que fica só no texto do dono (não mexi, ele decide se quer atualizar)

A regra 13 das Regras comerciais dele tem "7 dias" escrito direto no texto, um número
independente do "Descanso após atender" (que já alimenta a análise desde a v1058) — se ele mudar
o "Descanso após atender" sem também editar essa regra, os dois números podem divergir. Passei a
sugestão de texto pra ele deixar essa regra dependente do prazo informado pelo sistema, em vez de
um número fixo — fica a critério dele aplicar.

## Testes

- `tests/v1059-aguardar-sem-mensagem-e-cerebro-ajustes.test.mjs` (novo): cobre a ausência de
  "insista" e a presença do aviso de valorização no texto fixo; o formato JSON e a instrução de
  `recomendacaoContato`; o comportamento fim a fim de `analyzeWithBrain` (aguardar=true chega com
  motivo, aguardar=false ou ausente cai no padrão seguro, motivo nunca aparece sem aguardar=true
  explícito); e o aviso novo em `renderLeadFoco` (app.js), só quando há mensagens prontas.
- `npm test`: suíte inteira verde.

## Arquivos

`api/_pipeline.js` (texto fixo sem "insista" e com aviso de valorização; novo campo
`recomendacaoContato` no formato pedido à IA, instrução e mapeamento no retorno de
`analyzeWithBrain`), `app.js` (`renderLeadFoco` calcula `aguardarContato`/`motivoAguardar` e mostra
o aviso acima das sugestões de mensagem), `tests/v1059-aguardar-sem-mensagem-e-cerebro-ajustes.test.mjs`
(novo), `package.json`/`package-lock.json` (versão + script `test`), `NOTAS-v1059.md`, versão
**1058 → 1059**.
