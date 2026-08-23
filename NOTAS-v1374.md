# Corretor Pro — v1374

## Correção: análise de fundamento antes das sugestões

Caso que originou a correção: Augusta Feldmann, com o mesmo histórico que já estava no Corretor Pro.
A conversa tinha informação suficiente para uma leitura correta, mas o sistema estava chegando à redação
sem consolidar primeiro o que era contexto antigo, o que pertencia ao atendimento atual, o que já havia
sido respondido e o que já tinha sido enviado pelo corretor.

### O que mudou

- A análise agora monta um **fundamento factual do próprio histórico antes de pedir a condução**.
- Um hiato temporal forte separa o **contexto anterior** do **episódio comercial atual**, sem apagar o
  histórico antigo: a conversa completa continua sendo enviada à IA.
- O estado comercial e o fichário que orientam a condução passam a usar o episódio atual quando existe
  esse corte forte. Assim, uma pergunta promocional de meses atrás não reaparece como pauta atual.
- O fundamento consolida:
  - fatos já definidos pelo cliente;
  - perguntas do cliente que o corretor já respondeu;
  - informações que o corretor já entregou;
  - materiais, links, mapas e vídeos já enviados;
  - pendências factuais que continuam realmente abertas.
- O JSON da IA ganhou o bloco `fundamentos`, preenchido **antes** da decisão de próximo passo e das três
  sugestões. As sugestões são revisadas contra esse fundamento.
- Corrigida a leitura de perguntas informativas: `Onde fica este imóvel?` passa a ser reconhecida como
  respondida quando a resposta traz prédio/rua/bairro/centro/mapa, mesmo sem repetir as mesmas palavras
  da pergunta.
- Corrigida a classificação financeira: `Quero saber mais sobre o apartamento de R$ 430 mil` é interesse
  no anúncio, não declaração de orçamento de R$ 430 mil.
- Mantido o padrão de **uma única chamada de IA**. A análise de fundamento é estruturada no código e no
  mesmo pedido, sem reintroduzir a lentidão das duas chamadas sequenciais.

### Teste de regressão — Augusta

Foi adicionado `tests/v1374-analise-de-fundamento-augusta.test.mjs` com o histórico real do caso.
Ele comprova 7 pontos:

1. o sorteio/oferta de 2025 fica como contexto anterior e o atendimento atual começa no anúncio de 22/08/2026;
2. R$ 430 mil do anúncio não vira orçamento declarado da cliente;
3. localização já respondida não continua como pergunta aberta;
4. moradia, endereço, Maps, vídeo da área de lazer e vídeo do 802A entram no fundamento;
5. o endereço existente na conversa não gera falso aviso de endereço inventado;
6. a IA recebe a conversa completa + o fundamento, mantendo uma chamada por padrão;
7. o fundamento final fica disponível no resultado da análise para auditoria e depuração.

### Validação executada

- `node --check api/_pipeline.js` — aprovado.
- Teste novo v1374 — **7/7 aprovado**.
- Regressões diretamente relacionadas v1337, v1346, v1367, v1368, v1369, v1372 e v1373 — aprovadas.
- `npm install --package-lock-only --ignore-scripts --offline` — aprovado e lockfile atualizado.
- A suíte completa foi iniciada, mas o ambiente local não tinha todas as dependências npm disponíveis
  em cache; a execução parou em um teste de Supabase por falta da implementação real do pacote no
  ambiente de teste. Isso não foi causado pela alteração desta versão.

Versão: **1374** (`7.1374.0`).
