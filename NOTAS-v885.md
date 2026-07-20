# v885 — Reforma Home/Condução: prioridade por FATOS + limpezas

Mudança grande, autorizada pelo dono, juntando 7 pontos que ele levantou revisando a home.

## 1. RAIZ — classificar pela situação real (fim do balde-lixo "Aguardando cliente")

`cp786Categoria` foi reescrita. Antes dependia do campo de status da IA (`acao.status`/
`responsavel`), que vinha vazio na maioria dos leads importados → jogava quase tudo em
"aguardando", inclusive **retomadas vencidas** ("retorno vencido há 31 dias, retome").

Agora classifica pela **situação real**, sem esse campo:

- `programados` (Agenda): tem compromisso/lembrete marcado (`cp786TemCompromisso`).
- `aguardando`: atendido hoje / protegido pós-atendimento (<5 dias), **lead cru** (0-2
  mensagens = prospecção) ou a bola está legitimamente com o cliente (`entraEmRetomada`=false).
- `agora` (Fazer agora): precisa de você — responder ou **retomar** (`entraEmRetomada`:
  parado 5+ dias, retorno/lembrete vencido, cliente falou por último, quente-fechar...).

Como Home e Condução usam `cp786Categoria`/`cp788Grupos`, as duas telas passam a mostrar
os **mesmos números** (fim do "207 na Home × 0 na Condução").

## 2. "Fazer agora" = DOSE do dia (top 10 ranqueado), não o backlog inteiro

O dono não quer ranquear por valor R$ nem etapa/funil nem proposta — **nada disso existe/vale**
na base. Sobram **fatos comportamentais**:

`cpNotaPrioridade` = **Engajamento** (nº de mensagens, `messageCount`) + **Abandono**
(`diasParado`, com teto) + desempate **"cliente falou por último"** (`cp786UltimoFoiCliente`).
Pesos em constantes `CP_*`, fáceis de calibrar. `CP_DOSE_DIA = 10`.

- Card/saudação "Fazer agora" mostram a **dose** = `min(fila, 10)`.
- Clicar abre a dose (top 10) **+ a fila de retomada** (backlog) num expansor — nada some.
- A lista principal da Home (`renderBotoesHome`) e a Condução usam a mesma fila ranqueada,
  mostrando a dose + expansor de backlog.
- Exemplo do dono ("antigo, sem atendimento, muitas mensagens") sobe ao topo.

## 3. Home × Condução unificadas
Mesma `cp786Categoria` + mesma `cpFilaFazerAgora`. O KPI "Fazer agora" da Condução mostra a
dose (não o backlog), e a lista traz a dose + "Fila de retomada — mais N".

## 4. "Total de leads" → tela vira "Carteira ativa"
Ao chegar na Condução via "Total de leads" (filtro `todos`), o H1 da tela vira **"Carteira
ativa / Todos os seus leads ativos"** em vez de "Condução / o que fazer agora" (que confundia).

## 5. Condução — abas duplicadas removidas
Os 3 botões de aba (Fazer agora / Agenda / Aguardando cliente) repetiam os cards logo acima.
Removidos; os próprios cards (clicáveis) filtram.

## 6. "Top conversão de hoje" removido
Rótulo sem sentido na home — saiu (os botões de ação da linha continuam).

## 7. Ícones do topo (desktop) — duplicados/mentirosos
Removidos os dois ícones que só repetiam o menu da esquerda (💬 Atendimentos e 📅 Agenda).
O 🔔 sino foi mantido (abre a "Central de atenção", um painel real) e teve o rótulo corrigido
(era "Notificações"/"Agenda" — agora "Central de atenção").

## Arquivos
- `app.js` — `cpNotaPrioridade`, `cpFilaFazerAgora`, `CP_*`, nova `cp786Categoria`;
  `renderResumoDia`, `renderSaudacao`, `abrirFazerAgora`, `abrirGrupoHome` (backlog),
  `renderBotoesHome` (dose+backlog), render vivo da Condução (dose, título dinâmico, sem abas),
  `updateBell` (rótulo).
- `index.html` — ícones do topo (removidos 2, sino relabelado).
- `tests/v885-prioridade-por-fatos.test.mjs` (novo, executa o ranking); `v818`, `v824`, `v881`,
  `v884` atualizados pro novo mecanismo.
- `package.json` — versão 884 → 885.

## Calibragem (fácil de mexer depois de ver com leads reais)
`CP_PESO_ENGAJAMENTO=2`, `CP_TETO_ENGAJAMENTO=120`, `CP_PESO_ABANDONO=1`, `CP_TETO_ABANDONO=90`,
`CP_BONUS_BOLA=25`, `CP_DOSE_DIA=10`.
