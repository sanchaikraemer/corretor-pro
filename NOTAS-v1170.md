# v1170 — bloco de notas administrativas, no topo da Home

Pedido do dono: um lugar fácil de achar pra anotar tarefa que **não é atendimento de cliente** —
"verificar pagamento de entrada de tal cliente", "matrículas atualizadas no registro de imóveis".
Como a pergunta de design (onde fica, se tem data, se sincroniza) ficou sem resposta no meio da
conversa, segui com a opção mais segura em cada uma — explicado abaixo, fácil de ajustar se algo
não bater com o que ele tinha em mente.

## As três decisões tomadas

1. **Onde fica**: fixo no topo da Home, antes até da busca e das faixas de agenda — é o primeiro
   bloco que a tela mostra. Fechado por padrão (só a contagem do que falta), pra não competir com
   a fila de clientes; abre com um toque.
2. **Tem data?**: não — é uma lista simples, escreve, marca como feita quando resolver, apaga
   quando quiser. Sem hora marcada, sem entrar na faixa "Hoje na agenda" (essa é só pra
   compromisso de cliente).
3. **Sincroniza?**: sim, pelo servidor — mesmo padrão do Cérebro e da carteira. Abre no celular,
   edita no computador, continua igual dos dois lados.

## Por que a nota NÃO mora dentro do Cérebro Comercial

Essa foi a decisão de arquitetura que mais importa aqui. O Cérebro (`direciona-cerebro`) é o que
vira **contexto pra IA** montar as sugestões de mensagem pro cliente. Se a nota administrativa
fosse guardada ali dentro, "verificar pagamento da Maria" corria o risco de um dia vazar pra
dentro de uma sugestão de mensagem **pra própria Maria**. Por isso a nota mora numa chave própria
do banco (`notas-rapidas`, na mesma tabela `direciona_config`, mas separada), que a IA nunca lê.

## O que dá pra fazer

- Escrever uma nota e adicionar.
- Marcar como feita (risca o texto, esmaece) — e desmarcar se precisar.
- Apagar.
- Contagem do que está pendente aparece no título, mesmo com o bloco fechado.

Limite de 200 notas por conta (folgado pro uso — se bater, é hora de apagar as concluídas).

## Arquivos

- `api/cerebro-config.js` — chave nova `NOTAS_KEY = "notas-rapidas"`; três ações
  (`nota-adicionar`, `nota-concluir`, `nota-remover`); a leitura padrão (GET) já devolve `notas`
  junto do resto, sem viagem extra ao servidor. Reaproveitou a rota existente — nenhuma rota nova
  (o projeto está no teto de 12 do plano grátis da Vercel).
- `app.js` — `cp1170Carregar`, `cp1170Rerender`, `cp1170ItemHTML`, `cp1170BlocoHTML`,
  `cp1170Toggle`, `cp1170Adicionar`, `cp1170Concluir`, `cp1170Remover` (novas); o bloco entra na
  Home antes da busca; `renderBotoesHome` dispara o carregamento sozinho, sem esperar o corretor
  abrir o bloco, pra a contagem já vir pronta.
- `ESTADO-ATUAL.md` — a rota `cerebro-config.js` ganhou a menção às ações novas.
- `tests/v1170-bloco-de-notas.test.mjs` — novo. Duas partes:
  - **Servidor**: roda o `handler` de verdade contra um Supabase de mentira (mesmo padrão do
    teste dos planos comerciais) — adicionar, concluir/desmarcar, remover, teto de 200, a leitura
    padrão trazendo as notas, e a prova de isolamento: a nota nunca grava na chave do Cérebro.
  - **Front-end**: funções extraídas de verdade — confirma que o bloco vem ANTES da busca na
    Home, testa fechado/aberto, e prova que o texto da nota passa por `escapeHtml` (uma nota com
    `<script>` dentro não vira código, só texto na tela).

## Conferência

- `npm test`: 24 arquivos + **336 testes**, verdes.
- Chromium headless, app publicado, três cenários com dado de verdade (via rota interceptada):
  - fechado, sem nada carregado — só o título;
  - aberto, com 3 notas (2 pendentes + 1 concluída) — contagem "2" certa, checkbox/risco/× no
    lugar, e o texto `<script>alert(1)</script>` de uma das notas aparece **como texto puro na
    tela**, sem executar nada;
  - tela larga (1280px), vazio — "Nada anotado ainda.", layout sem quebrar.
  - Zero erro de JavaScript nos três.

## O que ficou de fora (de propósito, por ora)

Editar o texto de uma nota já salva (hoje só dá pra apagar e criar de novo). Se o dono sentir
falta, é fácil acrescentar depois.
