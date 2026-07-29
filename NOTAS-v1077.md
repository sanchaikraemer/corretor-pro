# NOTAS v1077 — pacote publicado junto, a pedido do dono (4 itens)

> O dono pediu que estes itens fossem preparados um a um e publicados JUNTOS numa única
> atualização — este arquivo cobre o pacote completo.

## 1. "Carregando os leads…" com rodinha coral (modelo 2, escolhido pelo dono)

O print do dono mostrou a tela Hoje parecendo TRAVADA durante o carregamento: só quadros
vazios, sem nenhum sinal de atividade. Entre 4 modelos apresentados, ele escolheu o **2
(rodinha + mensagem), pedindo a rodinha na cor coral da paleta**.

- O esqueleto de quadros vazios saiu de todos os pontos (`cp-home-skeleton`, `cp-db-loading`,
  `cp-side-skeleton` — HTML inicial, recarregamento vazio da Home e CSS).
- Em todos eles entra o mesmo loader: **rodinha coral girando + "Carregando os leads…" +
  "Buscando sua carteira atualizada."** (classes `.cp-loading-leads`/`.cp-loading-spinner`,
  coral = `var(--lime)`, o token da paleta).
- Pontos cobertos: abertura do app (HTML inicial do `#leadFocoArea`), tela de abertura
  (`#bootPaint`, só o texto), recarregamento vazio da Home (`carregarDashboard`), o embrulho
  com vigia de 9s (cp694 — texto e regex do vigia atualizados) e a tela Atendimentos
  (`#carteiraBody`).
- O esqueleto rápido de abrir um lead (`skel-loading`, some em fração de segundo) ficou.
- Teste: `tests/v1077-carregando-rodinha-coral.test.mjs`.

## 2. Voltar reconstrói a lista aberta pelo card da Home (bug com print do dono)

No celular: abriu "Fazer agora" (lista dos 10), entrou/saiu, e ao VOLTAR a tela mostrava o
nome interno cru ("__FAZERAGORA") com 0 leads. Causa: as listas "montadas na hora" pelos
cards (Fazer agora, Aguardando cliente, Carteira ativa, Sem atender 30d+, Propostas) não
vivem em `state.gruposHome` — o voltar reabria o grupo sem os leads. Agora existe
`cpReabrirGrupoEspecial`: os dois caminhos de voltar (popstate do navegador e o voltar de
dentro do lead) reconstroem a lista pela função dona; e um grupo sem meta nunca mais mostra
o prefixo interno `__` no título. Teste: `tests/v1077-voltar-lista-e-import-limpo.test.mjs`.

## 3. Importação: enquanto baixa/analisa, o card de instruções sai da tela

Pedido com print: durante o processamento da conversa, o card "Importar conversa" (passo a
passo, nota do iPhone, "Arquivo selecionado", botões Nova análise/Diagnóstico) fica escondido —
só o andamento aparece. Classe `cp-import-rodando` ligada no início do processamento e
desligada no fim (finally), no arquivo inválido e na "Nova análise". Mesmo teste acima.

## 4. Contadores da Home numa linha só no computador (modelo 1 escolhido)

Na versão web os 5 cards de contadores quebravam pra segunda linha. Entre 4 modelos, o dono
escolheu o **1 (mesmos cards, menores)**: no computador (≥1000px) os 5 ficam numa linha só,
mais compactos e **sem os iconezinhos** (só nome e número). Celular e tablet não mudam.
Só CSS (`#resumoDia`), sem mexer no render. Teste: `tests/v1077-contadores-uma-linha.test.mjs`.

## Verificação

- Suíte inteira (`npm test`) verde — incluindo os 3 testes novos do pacote.
- `npm run build` limpo.

## Arquivos

`app.js`, `index.html`, `styles.css`, `tests/v1077-*.test.mjs` (3 novos),
`package.json`/`package-lock.json` (versão **1076 → 1077**), `NOTAS-v1077.md` (este arquivo).
