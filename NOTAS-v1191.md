# v1191 — a conferência do banco ganhou tela (e o dono, finalmente, um jeito de olhar)

## O que aconteceu

A v1190 passou a exigir a migração `0018` pra criar conta nova em produção, e a nota daquela versão
avisava: *"confira em `/api/diagnostico?mode=banco`"*. O dono foi conferir — e não conseguiu.
Primeiro colou o endereço na busca do Google (que só devolveu resultado de pesquisa). Depois, no
lugar certo, ainda não funcionaria: **aquela rota exige o login de administrador no cabeçalho da
chamada**, coisa que só o app sabe mandar. Digitar o endereço na barra do navegador devolve 403.

Ou seja: a conferência existe desde a v1185, responde a pergunta mais importante da operação — *"o
banco que está no ar tem TODAS as travas que este código supõe que existem?"* — e **nunca teve
porta de entrada**. Ficou seis versões sendo citada em nota de versão como se fosse algo que o dono
pudesse abrir.

É o mesmo achado da v1186 (recurso feito, testado, publicado e sem botão), agora numa camada pior:
o texto da documentação *mandava* usar uma coisa que não dava pra usar.

## O que mudou

Um cartão novo no **painel administrativo** (`admin-plataforma.html`), embaixo do "Uso de IA por
empresa": **"Saúde do banco de dados"**. Ele roda sozinho assim que o administrador entra no
painel, e tem um botão "Conferir agora" pra repetir a qualquer momento.

Os três estados possíveis, escritos pra quem não é programador:

- **Verde — "Banco em dia"**: todas as travas que o sistema espera já estão aplicadas. Nada a fazer.
- **Vermelho — "Falta N atualização(ões)"**: diz **quantas**, **quais arquivos** e um passo a passo
  (entrar no Supabase → SQL Editor → New query → colar → Run). Quando a `0018` é uma das que
  faltam, avisa em destaque que **o cadastro de cliente novo fica recusando** enquanto isso, e que
  o resto do app funciona normalmente.
- **"O banco ainda não sabe se conferir sozinho"**: o caso em que falta a própria `0017` (a que
  cria a conferência). Mostra o que rodar pra destravar.

Nada mudou no servidor: a rota continua exatamente como estava, e continua **exclusiva do
administrador da plataforma**. O que faltava era a tela chamando ela com o login junto.

## Dois retoques que só a conferência visual pegou

Rodando o painel num Chromium de verdade (desktop 1440×900 e celular 390×844), com as três
respostas simuladas:

1. **"Faltam 1 atualização"** — plural errado quando falta só uma. Corrigido pra "Falta 1
   atualização".
2. **Sessão vencida deixava o cartão preso em "Conferindo…" pra sempre**, sem explicar nada. Agora
   diz: "Sua sessão de administrador venceu. Entre de novo pra conferir o banco."

## Verificação

- `npm test` — **361 testes verdes**, 24 arquivos checados.
- `npm run build` — 28 arquivos publicados, versão 1191.
- **Conferido no navegador** (Chromium, painel já publicado em `public/`), nos dois tamanhos de
  tela e nos três estados: o texto certo aparece em cada caso, o verde é verde e o vermelho é
  vermelho (cor conferida no resultado computado, não no arquivo de estilo), o cartão não estoura a
  largura da tela no celular e não há erro de página.
- Teste novo: `tests/v1191-saude-do-banco-tem-tela.test.mjs` — trava a **ligação** entre tela e
  rota (inclusive o cabeçalho de login, que era o motivo de não dar pra abrir na mão), os três
  estados, o aviso específico da `0018`, o escape do texto vindo do servidor e a existência dos
  estilos. Se alguém remover o cartão de novo, a suíte cai.
