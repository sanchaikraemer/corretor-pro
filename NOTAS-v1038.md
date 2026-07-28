# NOTAS v1038 — Quanto cada corretor está custando de IA (telemetria de uso por empresa)

## O pedido

Depois da correção de segurança da v1037 (vazamento entre empresas), o dono pediu pra seguir com
o próximo item crítico da auditoria técnica/comercial: medir o custo real de IA por corretor —
item 6.2 do relatório ("Controle de custo vulnerável à concorrência") e 12.2 ("Antes de vender em
escala: criar medição de custo por empresa").

## O que existia antes

Só um CONTADOR de segurança contra abuso (`verificarLimiteDiario`, v1013): sobrescreve um único
número por dia, por empresa, na tabela `direciona_config`. Ele nunca guardou tokens, nunca guardou
histórico, e é sobrescrito por concorrência (documentado no próprio código como aceitável, porque
é só uma rede de segurança contra loop/abuso — não uma medição de custo). Não existia NENHUMA
telemetria real: nenhuma tabela, nenhum registro de tokens de entrada/saída, nenhum registro de
minutos de áudio transcrito, nenhuma estimativa de custo em reais.

## A mudança

### Nova tabela: `ai_usage_events` (migração `0008_telemetria_uso_ia.sql`)

Uma linha por CHAMADA real à OpenAI — não um contador que se sobrescreve. Guarda: empresa, tipo
(`chat` ou `whisper`), modelo usado, de qual funcionalidade veio (`rota`), tokens de entrada/saída
(chat) ou segundos de áudio (whisper). Índices por empresa+data e por data. RLS: cada empresa só
lê os próprios eventos; o administrador da plataforma lê de todas (mesmo padrão de
`organizations`/`memberships`).

### `api/_iaCusto.js` (novo)

- `registrarUsoIA(...)`: grava UM evento (INSERT simples — nunca agrega, então nunca tem disputa
  de concorrência pra perder contagem, diferente do contador de limite diário). Nunca lança erro:
  telemetria não pode derrubar a análise/transcrição de verdade.
- `estimarCustoUsd`/`estimarCustoBRL`: calcula o custo a partir de uma tabela de preço por modelo
  (dólar por 1 milhão de tokens de entrada/saída, e por minuto de áudio pro Whisper). Cotação do
  dólar configurável por `CORRETOR_PRO_COTACAO_USD_BRL` (padrão 5,50). É uma ESTIMATIVA pra decisão
  comercial, não uma nota fiscal — preço fica no código (não no banco) porque a OpenAI muda preço
  com mais frequência do que faria sentido rodar migração nova.

### Cada chamada real à OpenAI passa a registrar o próprio uso

Foram instrumentados todos os 12 pontos que chamam a OpenAI de verdade no sistema (conferido com
`grep` no código, não só pela leitura): a análise comercial principal (`chamarGPT4Json`/
`analyzeWithBrain`, a mais cara), a atualização do conhecimento do corretor, a extração de
inteligência observada (aprendizado), o resumo de atendimento ditado, a transcrição de áudio
(tanto na importação quanto em "ensinar o Cérebro por voz"), o teste manual "Testar IA" do painel,
e as 3 leituras de visão em `lead-update.js` (extrair print, detectar rosto, ler prints de
conversa). Duas funções (`compararEvolucao` e `buildTimeline`/`transcribeAudio`) são código morto
— não são chamadas por nenhuma rota real hoje — e ficaram de fora de propósito.

Como a maioria dessas funções de baixo nível não recebia `organizationId` (mesmo ele estando
disponível 1-3 níveis acima, na rota que as chama), foi preciso encadear o parâmetro por elas —
sem isso não dava pra saber de qual empresa cobrar cada chamada.

A transcrição por áudio (Whisper) passou a pedir `response_format: "verbose_json"` — o único jeito
de receber a DURAÇÃO real do áudio, que é como o Whisper cobra (por minuto, não por token). Antes
disso o código nem pedia esse dado.

### `api/admin-uso-ia.js` (novo) + painel administrativo

Rota exclusiva do administrador da plataforma (`requirePlatformAdmin` — nunca a chave
compartilhada nem um dono comum de empresa). Lê os eventos dos últimos 30 dias (configurável por
`?dias=`), agrega por empresa (hoje vs. período) e devolve chamadas, tokens, minutos de áudio e
custo estimado em reais. `admin-plataforma.html` ganhou uma seção nova ("Uso de IA por empresa")
que mostra isso numa tabela, carregada automaticamente ao entrar no painel.

## Verificação

- Novo teste `tests/v1038-telemetria-uso-ia.test.mjs`, 5 partes: cálculo de custo (chat cobra por
  token, whisper por minuto, modelo desconhecido nunca custa zero), `registrarUsoIA` grava o
  evento real (e nunca grava sem `organizationId`), `analyzeWithBrain` registra o uso de verdade
  após uma análise bem-sucedida (com os tokens que a OpenAI devolveu, não um número inventado),
  `transcreverBuffer` pede `verbose_json` e registra a duração certa, e `api/admin-uso-ia.js`
  recusa quem não é administrador e agrega corretamente por empresa sem misturar uma com a outra.
- `npm test`: suíte inteira verde (todos os testes anteriores + o novo). Dois testes existentes
  (`v961`, `v1013-diagnostico-e-admin-plataforma`) tiveram uma checagem estática ajustada porque a
  assinatura de `modoOpenAI` ganhou o parâmetro `organizationId` — comportamento continua o mesmo,
  só a forma de checar mudou.
- `npm run build`: build limpo, sem duplicidade.

## O que fica pra depois

Ainda restam da auditoria: proteção contra abuso do período de teste grátis (múltiplos
cadastros só pra consumir IA de graça), `organization_id` obrigatório por restrição do próprio
banco, e dividir o `app.js` em módulos menores. A telemetria desta versão é o que faltava pra medir
o próximo passo natural (limite de uso por PLANO, não só por segurança) — mas decidir o valor
desses planos é decisão comercial do dono, não algo pra deduzir sozinho.

## Arquivos

`supabase/migrations/0008_telemetria_uso_ia.sql` (novo), `api/_iaCusto.js` (novo),
`api/admin-uso-ia.js` (novo), `api/_pipeline.js`, `api/diagnostico.js`, `api/lead-update.js`,
`api/cerebro-config.js`, `api/reanalisar-lead.js`, `api/processar-storage.js`,
`admin-plataforma.html`, `tests/v1038-telemetria-uso-ia.test.mjs` (novo),
`tests/v961-diagnostico-analise-funciona.test.mjs` (ajustado),
`tests/v1013-diagnostico-e-admin-plataforma.test.mjs` (ajustado),
`tests/v963-todas-rotas-exigem-api-key.test.mjs` (guarda ampliada pra reconhecer
`requirePlatformAdmin`), `package.json`/`package-lock.json` (versão + script `test`),
`NOTAS-v1038.md`, versão **1037 → 1038**.

## Importante: a migração ainda precisa ser aplicada no banco real

Esta sessão não tem acesso ao Supabase de produção (ver CLAUDE.md). O código já está pronto e
publicado, mas a tabela `ai_usage_events` só existe depois que você rodar a migração:

1. Painel do Supabase → **SQL Editor** → **New query**.
2. Cole o conteúdo de `supabase/migrations/0008_telemetria_uso_ia.sql` inteiro e clique em **Run**.

Até isso ser feito, a gravação de cada evento falha silenciosamente (por design — telemetria nunca
pode travar uma análise ou transcrição de verdade) e o painel de "Uso de IA" fica vazio, sem
quebrar nada do resto do sistema.
