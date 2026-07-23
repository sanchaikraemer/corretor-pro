# v954 — reaproveitamento de transcrição de áudio: por nome do arquivo, não por hash

## O pedido do dono

"Sempre tem zero reaproveitados, não to entendendo por quê?" — print mostrando
"Transcrevendo — 9/55 novos · 0 reaproveitados" numa importação. Toda reimportação de uma
conversa transcrevia TODOS os áudios de novo, mesmo os que ele sabia já ter transcrito antes
no mesmo cliente — gastando tempo e chamada de API (OpenAI Whisper) à toa.

## Causa

`api/processar-storage.js` reconhecia "já transcrevi esse áudio antes" comparando o **hash
sha256 do conteúdo do arquivo** contra um cache global (`transcription-cache/{hash}.json` no
Storage). Isso só bate se o WhatsApp gerar o arquivo *byte a byte idêntico* em duas exportações
separadas da mesma conversa — na prática, não gera (mesmo áudio, arquivo levemente diferente
por dentro entre exportações). Resultado: o cache por hash quase nunca batia entre
importações separadas, e `audiosReaproveitados` ficava sempre 0.

## O que mudou

Adicionado um segundo caminho de reaproveitamento, tentado **antes** do cache por hash:
reconhecer o áudio pelo **nome do arquivo** (esse sim estável entre exportações do WhatsApp —
ex. `AUD-20240115-WA0007.opus`), comparando **só dentro do histórico do MESMO cliente** já
identificado — nunca entre clientes diferentes (isso seria arriscado: podia colar a
transcrição errada no cliente errado).

Como funciona: na ação `preparar` (antes de baixar/extrair o zip), o servidor já tenta achar um
cliente existente **só pelo nome do arquivo do zip** (reaproveitando a mesma lógica de
`_buscarProcessamentoExistenteV681` que a persistência já usa pra decidir fusão de cadastro —
aqui só pra reaproveitar transcrição, não decide fusão). Se achar, monta um mapa
`nome-do-áudio → texto já transcrito` a partir do `timeline_json` salvo desse cliente (só
itens `type:"audio"` com `audioStatus:"transcrito"` — nunca reaproveita erro/status
incompleto). Na hora de processar cada áudio extraído, esse mapa é consultado primeiro; só cai
pro cache por hash (mantido como reforço, não custa nada) se não achar nada ali.

O reconhecimento do cliente existente continua acontecendo (de novo, com dados completos) na
análise/persistência, exatamente como já era — essa busca antecipada só serve pra decidir
reaproveitamento de transcrição, não decide fusão de cadastro sozinha.

## Verificação

- `npm test` verde (suíte completa, incluindo o teste novo
  `v954-reaproveitar-transcricao-por-lead`, que testa `transcricoesDoLeadAnterior` de verdade —
  reaproveita só áudio com status "transcrito", ignora erro/incompleto, ignora áudio solto sem
  posição exata, ignora texto/nota manual, usa `normalizeName` pra bater com o resto do
  pipeline de áudio).
- `node --check api/processar-storage.js` OK, e importei o módulo de verdade num smoke test
  (`import('./api/processar-storage.js')`) pra garantir que não criei import circular com
  `_persistence.js`/`_pipeline.js`.
- Não testei em produção de verdade (sem credenciais de Supabase/OpenAI nesta sessão) — o
  impacto real (áudios efetivamente reaproveitados numa reimportação de verdade) só dá pra
  confirmar com uma reimportação real depois do deploy.

## Achado registrado (não é bug novo, é o mesmo já anotado hoje)

A busca de cliente existente por nome de arquivo (`_buscarProcessamentoExistenteV681`) varre
até 5000 registros por chamada — já registrado como achado de escala em `REVISAO-COMPLETA.md`
(v950). Esta mudança adiciona uma SEGUNDA chamada dessa mesma busca por importação (antes só
era chamada na hora de salvar; agora também na hora de preparar). Mesmo padrão de custo, não
piora a natureza do problema, só reforça que vale a pena resolver isso na revisão completa.

## Arquivos
- `api/processar-storage.js` (reaproveitamento por nome do arquivo, escopado ao lead
  identificado), `tests/v954-reaproveitar-transcricao-por-lead.test.mjs` (novo),
  `package.json`/`package-lock.json`, `NOTAS-v954.md`, versão **953 → 954**.
