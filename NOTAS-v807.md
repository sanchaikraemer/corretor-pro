# Atualização #807 — Home não trava após atualização

- Corrige um `ReferenceError` na montagem da Home: um renderer intermediário usava `filtroPrincipal` sem declarar a variável.
- Esse erro acontecia depois de os dados e contadores carregarem, por isso a tela mostrava os números, mas mantinha os cards no skeleton.
- Adiciona uma proteção por fallback: qualquer falha isolada ao montar os cards não bloqueia mais o acesso aos leads.
- Adiciona um watchdog curto que substitui skeleton preso por uma lista básica e clicável usando os dados já carregados.
- Não altera regras comerciais, dados, análises nem o validador de retomadas da versão 806.
