# v1208 — dá pra marcar dia E hora sem o painel fechar (e ele parece um app de novo)

## O pedido

Print do painel de agendar, com raiva: *"eu não estou conseguindo agendar a hora, porra. Está uma
bosta aí, se eu não consigo agendar, boto ali o dia, e daí quando eu vou tentar selecionar a hora
fecha. Sem falar que está feio, está horrível, nem parece um app desse nível"*.

Ele tinha razão nos dois pontos, e os dois eram defeito nosso.

## Defeito 1 — o painel fechava no meio do caminho

Escolher o dia **salvava na hora**. E salvar redesenha a tela — o painel morria junto, antes dele
chegar no campo da hora. Ou seja: marcar dia **e** hora na mesma ida era literalmente impossível.

Isso era herança de uma decisão antiga ("salva sozinho, sem precisar confirmar") que funcionava
enquanto só existia o campo de dia. Quando a hora entrou (v1199/v1207), virou uma armadilha.

**Agora:** nada é salvo até você tocar em **Confirmar agendamento**. Os atalhos (Hoje / Amanhã /
+7d / +15d / +30d) apenas **preenchem** o dia — não salvam mais sozinhos. Você escolhe o dia,
escolhe a hora, confere e confirma.

## Defeito 2 — os campos apareciam vazios e feios

No print, dia e hora eram duas caixas pretas vazias com uma setinha. O motivo: o campo de data e o
de hora do Android vêm com esquema de cor **claro** por padrão — o texto guia ("dd/mm/aaaa",
"--:--") e os ícones saíam **escuros sobre o fundo escuro** do app. Não estava vazio: estava
invisível.

**Agora:** campo em modo escuro de verdade (texto e ícone claros, e o calendário/relógio que abre
também), altura de dedo (48px), letra de 16px (abaixo disso o celular dá zoom sozinho quando você
toca) e um rótulo em cima de cada bloco — **DIA** e **HORA (opcional)**.

## O que mais entrou junto

- **Atalhos de hora**: 08:00, 09:00, 10:00, 14:00, 16:00, 18:00 e **Sem hora**. No caso comum você
  nem precisa abrir o relógio do celular — é um toque. O atalho escolhido fica marcado em verde.
- **Frase de conferência** embaixo do botão: *"Vai agendar: quinta-feira, 13/08, às 09:00."* Você
  vê o que vai salvar **antes** de salvar.
- **Já vem preenchido** com o compromisso que existe: abrir o painel de um cliente que já tem
  "13/08 às 09:00" marcado mostra 13/08 e 09:00 nos campos, em vez de dois campos vazios.
- **Confirmar sem dia** avisa ("Escolha o dia primeiro — depois, se quiser, a hora") em vez de não
  fazer nada.
- **Um painel só**: o "Agendar" de dentro do cliente e o "Reagendar" do cartão da Agenda agora são
  exatamente a mesma coisa. Antes eram dois painéis diferentes com o mesmo defeito — corrigir um
  deixava o outro quebrado.

## Detalhe técnico (pra quem for mexer depois)

- `app.js` — `cpAgendarPainelHTML` + os ajudantes `cpAgendarEscolherDia/EscolherHora/Resumo/
  Confirmar` (todos em `window`, porque são chamados de atributo inline — lição da v1202).
  `ui670ScheduleHtml` (lead) e `reagendarControlHTML` (Agenda) passaram a montar esse painel.
  `reagendarDias` continua existindo pra quem quiser um atalho de um toque só, mas o painel não o
  usa mais. Nada mudou no servidor: `reagendarLembrete` já mandava a hora desde a v1199.
- `styles.css` — bloco `.cp1208-*`. O `color-scheme:dark` no campo é o que conserta o "vazio" do
  print; a especificidade em dois níveis (`.cp1208-agendar .cp1208-campo`) é necessária porque
  `.ui670-inline-panel input` já pintava esses campos.
- Conferido no navegador (Chromium headless, 412x915 e 1280x900), nas duas telas: tocar no dia e
  na hora **não** dispara salvamento (zero chamadas de rede); o Confirmar manda dia e hora juntos;
  Confirmar sem dia não manda nada e mostra o aviso; os campos ficam legíveis, com 48px de altura
  e 16px de fonte; nenhuma tela estoura pro lado.
- Testes: `tests/v1208-agendar-dia-e-hora-sem-fechar.test.mjs` (novo — inclusive travando que
  nenhum campo/atalho do painel pode chamar `reagendarLembrete` sozinho). `v1199` e `v1202` foram
  reancorados no painel novo, mantendo a intenção original de cada um; o teste `v1207` saiu porque
  o painel que ele descrevia deixou de existir.

Não há criação de tabela, coluna ou função nova no Supabase nesta atualização.
