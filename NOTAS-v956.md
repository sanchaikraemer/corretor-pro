# v956 — reimportação de lead existente ganha a proteção da v900 (que faltava nela)

## Contexto

Revisão linha a linha de `api/lead-update.js` (1748 linhas), em andamento. Achado na função
`acaoAtualizarComEvolucao` — a ação `atualizar-com-evolucao`, chamada sempre que o app
reconhece um cliente já existente numa reimportação (esse é hoje o caminho MAIS COMUM de
reimportação, ainda mais depois da v953, que passou a acionar isso automaticamente sem
precisar de clique).

## O problema

A v900 (ver `NOTAS-v900...` no histórico) corrigiu um bug real: quando o corretor reimporta a
conversa, a "mensagem enviada" registrada antes (uma CÓPIA da sugestão da IA, só uma
aproximação do que foi realmente mandado) precisa ser SUBSTITUÍDA pela mensagem REAL do
WhatsApp quando a reimportação a traz — senão o app mostra as duas, duplicado, e a que fica
mais visível pode ser a cópia (texto diferente do que o corretor realmente escreveu). Esse fix
foi implementado em `_mesclarTimelinesV681` (`api/_persistence.js`) e tem teste dedicado
(`tests/v900-mensagem-real-vence.test.mjs`).

Só que `acaoAtualizarComEvolucao` (`api/lead-update.js`) tinha sua PRÓPRIA função de mescla
(`mesclarTimelines`/`assinaturaMsg`), mais simples, SEM essa proteção — e é esse o código que
roda toda vez que o app reconhece "esse cliente já existe" e atualiza direto (o caminho comum,
reforçado pela v953 desta mesma noite). Ou seja: o fix da v900 só protegia o caminho MENOS
comum (quando o app trata como cadastro novo e o servidor identifica a duplicata só depois, em
`persistProcessingResult`) — o caminho principal ficava sem a proteção.

## O que mudou

- `_assinaturaTimelineV681` e `_mesclarTimelinesV681` (`api/_persistence.js`) agora são
  exportadas (antes eram só internas do arquivo).
- `api/lead-update.js` importa as duas e troca a mescla local por elas em
  `acaoAtualizarComEvolucao`. As funções locais antigas (`assinaturaMsg`, `mesclarTimelines`)
  foram removidas — ficariam mortas e um risco de alguém voltar a usá-las por engano (mesmo
  padrão de problema encontrado e corrigido na v952 com `carregarGeladeira`).
- Efeito prático: reimportar a conversa de um cliente já existente agora também troca a cópia
  da sugestão pela mensagem real, no caminho que realmente é usado no dia a dia.

## Verificação

- `npm test` verde (suíte completa, incluindo o teste novo `v956-atualizar-usa-mescla-v900`,
  que confere a fiação certa — import correto, propriedade `timeline` desestruturada em vez de
  `mescladas`, funções locais antigas removidas — e roda a MESMA cena da v900 através da
  função agora exportada, pra provar que exportar não mudou o comportamento já validado).
- `node --check` OK nos dois arquivos; smoke test de import real (`import('./api/lead-update.js')`)
  confirma que não criei import circular.
- Não testado com Supabase real (sem credenciais nesta sessão) — o comportamento de
  ponta a ponta (reimportar de verdade e ver a cópia sumir) só dá pra confirmar em produção.

## Arquivos
- `api/_persistence.js` (`_assinaturaTimelineV681`/`_mesclarTimelinesV681` exportadas),
  `api/lead-update.js` (usa as funções importadas, remove as locais),
  `tests/v956-atualizar-usa-mescla-v900.test.mjs` (novo), `package.json`/`package-lock.json`,
  `NOTAS-v956.md`, versão **955 → 956**.
