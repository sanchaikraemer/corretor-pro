# v971 — "Análises feitas" não contava o "Reanalisar todos"

## Contexto

Reportado ao vivo: "mensagens copiadas e análises... muito mais" — o dono espera números bem
maiores que os mostrados no card "Sua semana no Corretor Pro" (Desempenho).

## Investigação

**Mensagens copiadas:** rastreei os 3 pontos que registram o evento `mensagem_copiada`
(`copiarMensagemLead`, o handler de `#copyMessage`, `ui683RegistrarEvento`) — todos gravam
corretamente via `/api/lead-update` (`action:"aprendizado"`), e a contagem em
`cpDesempenhoMetricas` já lê dessa mesma fonte (`lead.analysis.aprendizado.eventos`, dado
sincronizado no servidor, não local). Não achei um bug mecânico aqui — pode ser que o corretor
genuinamente não tenha usado o botão "Copiar" nos últimos 7 dias (a métrica é só da última
semana), ou o problema está em algo que não consegui reproduzir sem acesso à base de produção.
Fica registrado como não resolvido — se continuar discrepante, preciso de mais detalhes (em qual
lead, aproximadamente quando).

**Análises feitas — bug real e confirmado:** o contador (`cpRegistrarAtividade("analise")`) só
era chamado num único lugar: o botão "Reanalisar" de UM lead por vez (`ui670Reanalisar`). O
fluxo **"Reanalisar todos"** (`executarReanaliseTudo`, que roda a reanálise de TODOS os leads
ativos, 5 em paralelo) **nunca contava nada** — mesmo cada lead reanalisado com sucesso ali
sendo uma análise de verdade, processada pela IA, exatamente como a individual. Quem usa
"Reanalisar todos" com alguma frequência (a própria tela sugere isso: "quando muda algo grande")
tem a métrica sistematicamente subestimada, potencialmente por dezenas de análises reais.

## O que mudou

`tentar()` (dentro de `executarReanaliseTudo`) passa a chamar `cpRegistrarAtividade("analise")`
no caminho de sucesso (`data?.ok`), a mesma chamada que já existia pro botão individual — cada
lead reanalisado com sucesso no "Reanalisar todos" agora conta.

## O que fica pendente (achado, não corrigido — precisa decisão)

A análise AUTOMÁTICA que roda quando um ZIP é importado pela primeira vez (antes de qualquer
"reanalisar") também NÃO é contada em "Análises feitas" — só o `importações` conta ali (1 por
ZIP). O rótulo do card diz "Conversas processadas pela IA", que sugere que deveria contar
TAMBÉM essa primeira análise automática, não só reanálises explícitas. Não mudei isso agora
porque a análise inicial acontece no SERVIDOR (`api/processar-storage.js`/`api/analisar.js`), e
`cpRegistrarAtividade` é um contador só-local (`localStorage`, por design da v929, pra não
sincronizar via Supabase); ligar os dois pontos direito (e decidir se "análises feitas" deve
mesmo incluir a automática) é mudança maior — melhor com decisão consciente do dono do que um
ciclo automatizado inventando o critério.

Fica valendo também o já registrado desde a v929: `análises`/`importações`/`tempo no app` são
contadores **só deste aparelho** (não sincronizam celular↔PC) — quem usa o app em mais de um
dispositivo vê números parciais em cada um. Isso não é bug técnico, mas explica parte da
sensação de "tá contando errado" se o uso for espalhado entre aparelhos.

## Verificação

- `npm test` verde, incluindo o teste novo.
- Novo teste `tests/v971-reanalisar-tudo-conta-analise.test.mjs`: confirma que `tentar()` chama
  `cpRegistrarAtividade("analise")` no caminho de sucesso, e que NÃO chama no caminho de erro
  (evita inflar o número com falhas).
- `node --check app.js` OK.

## Arquivos
- `app.js` (`executarReanaliseTudo` → `tentar`),
  `tests/v971-reanalisar-tudo-conta-analise.test.mjs` (novo),
  `package.json`/`package-lock.json`, `NOTAS-v971.md`, versão **970 → 971**.
