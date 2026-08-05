# v1137 — a segunda parede caiu: o Cérebro guia o corretor novo (e para de mentir na prévia)

Item 2 do plano aprovado pelo dono. A primeira parede (análise recusada sem Cérebro) caiu na
v1132; esta é a que vinha logo depois: o convite "Ensinar a IA a falar como eu" levava pra uma
tela que dizia **"estas instruções entram no prompt da OpenAI a cada análise"** (jargão puro) e
mostrava 15 campos vazios, sem nenhuma ordem de importância. Um corretor trava ali.

## O que a auditoria achou junto (e era pior que o jargão)

1. **A tela mandava tocar num botão que não existe.** O texto do Aprendizado instruía: *"abra a
   aba Cérebro e toque em 'Aprender de toda a carteira agora'"* — esse botão foi substituído há
   várias versões pelo **aprendizado contínuo automático**, que lê as conversas importadas em
   segundo plano sem ninguém pedir. O texto sobreviveu apontando pro nada.
2. **O aprendizado automático era jogado fora exatamente pra quem mais precisa dele.** Sem
   instruções manuais, `loadCerebroConfig` devolvia `null` — descartando o
   `inteligenciaAprendida` que o aprendizado já tinha guardado. Resultado: a conta nova, em modo
   prévia, analisava SEM a voz aprendida das próprias conversas (que existia, salva no banco), e
   o convite da prévia dizia *"a IA ainda não conhece o seu jeito"* — mentira, ela conhecia.

## O que mudou

**Na tela do Cérebro:**

- O jargão virou: *"Tudo que você ensinar aqui vale pra todas as análises e mensagens."*
- Um **guia de primeiro uso** aparece enquanto o Cérebro está vazio (mesma régua do servidor —
  campos de instrução; o nome sozinho não conta):
  - a IA **já aprende sozinha** com cada conversa importada — não precisa preencher nada pra ela
    trabalhar;
  - o que **só ele** pode ensinar, em ordem do que mais muda as mensagens: **1)** o nome,
    **2)** as regras comerciais (condições, valores), **3)** o que evitar;
  - botão "Começar pelo meu nome" que rola até o campo e foca.
- O guia some sozinho assim que qualquer campo de instrução é preenchido.
- O texto morto do Aprendizado foi corrigido: *"isto se preenche sozinho"*.

**No servidor:**

- `loadCerebroConfig` agora devolve o Cérebro salvo **mesmo sem instruções manuais**, marcado como
  `banco-sem-instrucoes` — a análise continua caindo em prévia (a decisão de
  `hasCerebroInstructions` não mudou, e a preferência banco-com-instruções > navegador continua
  igual), mas a **voz aprendida entra no prompt**, como sempre deveria.
- A análise em prévia ganhou a marca `previaComAprendizado`: verdadeira quando o aprendizado já
  tem conteúdo relevante pra aquela conversa.

**No convite da prévia (depois da análise):**

- Sem aprendizado ainda: o texto de sempre ("esta análise saiu só da conversa que você enviou").
- **Com** aprendizado: *"A IA já aprendeu seu jeito de falar com as suas conversas. O que ela
  ainda não tem são as suas condições comerciais…"* — e o botão vira **"Confirmar minhas
  condições"**. Sem mentira, e com o pedido certo.

## Arquivos

- Alterados: `index.html` (guia + textos), `app.js` (liga/desliga do guia + convite adaptativo),
  `api/_pipeline.js` (`loadCerebroConfig` sem descartar o aprendizado + marca
  `previaComAprendizado`).
- Novo: `tests/v1137-cerebro-sem-parede.test.mjs` — inclui rodar a análise de verdade (IA
  simulada) provando que a voz aprendida chega no prompt da prévia e que a marca liga/desliga
  certo; e guardas de tela: sem "prompt da OpenAI", sem instrução de botão morto, guia com a
  ordem certa.

## Conferido

- Suíte completa: **310 testes verdes**.
- Verificação visual no Chromium (celular): Cérebro vazio mostra o guia (sem scroll lateral, sem
  erro); Cérebro preenchido esconde o guia; jargão ausente nos dois estados.
