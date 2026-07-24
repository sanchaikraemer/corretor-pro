# v955 — conclui revisão de api/_pipeline.js (linhas 950–3233): 1 fix + achados grandes

## Contexto

Conclui a revisão linha a linha de `api/_pipeline.js` (3233 linhas) — v951 tinha coberto
1–950, este ciclo cobriu 950–3233 (resto inteiro do arquivo). Arquivo marcado como
**concluído** no checklist (`REVISAO-COMPLETA.md`).

## O que mudou

`assinaturaTimelineIncremental` (usa pra decidir "essa mensagem é nova nessa reimportação?")
comparava áudio só pelo nome do arquivo via `normalizeName()`, que NÃO baixa a caixa — só tira
o caminho. A assinatura irmã em `api/_persistence.js` (`_assinaturaTimelineV681`, usada no
merge final que vai pro banco) já normaliza pra minúsculo. As duas fazem o mesmo trabalho
conceitual (identidade estável de item de timeline pra dedupe) em dois estágios diferentes do
mesmo pipeline de reimportação — alinhado pra usar a mesma normalização, evitando o mesmo
áudio (nome com caixa diferente entre uma exportação e outra) ser tratado como "mensagem nova"
num estágio e "já visto" no outro.

## Achado GRANDE, não corrigido — precisa decisão do dono (prioridade alta)

**Nomes de pessoas e de empresa parceira cravados no código**, contrariando a regra
não-negociável do CLAUDE.md ("Nenhuma informação comercial — preço, empreendimento, condição,
nome de pessoa — pode ser cravada no código"). Encontrados em pelo menos 4 arquivos, usados
como heurística pra decidir "esse autor da mensagem é o CORRETOR (lado do negócio) ou o
CLIENTE":

- `api/_pipeline.js` linhas 128, 232, 862, 1906: regex com `sanchai`, `miguel kirinus`,
  `senger`/`construtora senger` (nome de empresa parceira) hardcoded.
- `api/_pipeline.js` linha 1836: lista de **28 primeiros nomes** (`jamil, isabela, amiel,
  victor, paty, taiany, laura, jean, thuane, jessica, rafael, gilmar, alison, emerson,
  gabriele, joel, daniele, julia, henrique, karoliny, ricardo, alberto, marcia, monique,
  sanchai, cristian, fabio, douglas, zuleica`) usada como "stopwords" pra ignorar na hora de
  comparar similaridade de texto — muito provavelmente nomes reais de clientes/contatos que
  apareceram nos dados de treino e foram adicionados manualmente.
- `app.js` linhas 2053, 2076: mesmo padrão (`sanchai`, `miguel kirinus`, `senger`).
- `api/lead-update.js` linha 1300: mesmo padrão.

**Por que isso não é só "achei um nome no código" — é evidência de retrabalho incompleto:**
em `api/_pipeline.js` linha 2489, o próprio código documenta que esse EXATO problema já foi
corrigido uma vez, só que em outro lugar:
```
// v827 §7.4: o nome do corretor vem SEMPRE da configuração do Cérebro ("Seu nome
// como aparece no WhatsApp"). Sem nome fixo no código; na ausência, um rótulo genérico.
```
E a função `mcAutorEhContato` (linha ~225) já RECEBE `corretorNome` como parâmetro e usa ele
dinamicamente (`corretor.includes(autor)`) — só que continua rodando o regex hardcoded LOGO
DEPOIS, como checagem paralela redundante. Ou seja: o mecanismo certo (nome vindo do Cérebro
configurado) já existe e já funciona em paralelo — só não foi usado pra substituir de vez o
hardcode nessas funções.

**Por que não corrigi agora:** essa heurística decide quem é "o negócio" vs "o cliente" em
CADA análise — é núcleo da classificação de mensagem. Trocar errado quebra silenciosamente a
distinção autor-corretor/autor-cliente em produção, sem teste automatizado pegar (são heurísticas
de linguagem natural, não regra determinística). `autorPareceNegocioPipeline` (linha 127) nem
recebe `corretorNome` como parâmetro hoje — precisaria virar parâmetro e propagar pra todos os
call-sites, um refactor maior que um ciclo automatizado não deveria fazer sem confirmação.

**Recomendação pro dono decidir:**
1. Migrar as checagens de autor (`autorPareceNegocioPipeline`, `mcAutorEhContato` e
   equivalentes em app.js/lead-update.js) pra usar `corretorNome` do Cérebro já configurado em
   vez do nome hardcoded, removendo o fallback fixo.
2. Pra "Senger"/"Construtora Senger": decidir se isso devia vir do Cérebro (ex.: um campo
   "construtora(s) parceira(s)") em vez de fixo no código.
3. Pra a lista de 28 nomes em STOPWORDS (linha 1836): decidir se compensa manter (melhora
   comparação de similaridade) ou se deve sair (mesmo sendo só "palavra a ignorar", são nomes
   reais de pessoas parados no código-fonte).

## Achados menores, registrados

- `loadMemoriaComercialV2` (linha ~1326) e `aprenderRespostasDaCarteira` (linha ~1772): mais
  dois pontos com limite fixo de leitura no Supabase (10.000 e 3.000 linhas respectivamente) —
  mesma classe do achado de escala já registrado na v950 (`_buscarProcessamentoExistenteV681`,
  limite 5000). Não é bug agudo agora, mas é o TERCEIRO lugar com esse padrão — reforça que
  vale uma solução de busca indexada no banco em vez de paginação com teto fixo, quando o dono
  quiser priorizar isso.
- Duas implementações paralelas e ligeiramente diferentes de "assinatura de item de timeline
  pra dedupe" (`assinaturaTimelineIncremental` em `_pipeline.js` vs `_assinaturaTimelineV681`
  em `_persistence.js`) — agora alinhadas pro caso de áudio (este fix), mas continuam sendo
  duas implementações separadas do mesmo conceito em dois arquivos. Não unifiquei (mexeria em
  lógica central de merge de timeline dos dois lados do pipeline) — só registrado.

## Verificação

- `npm test` verde (suíte completa, incluindo o teste novo `v955-assinatura-audio-case-insensitive`).
- `node --check api/_pipeline.js` OK.
- Arquivo inteiro (3233 linhas) lido nesta revisão (950–3233 neste ciclo, 1–950 na v951).

## Arquivos
- `api/_pipeline.js` (assinatura de áudio normalizada), `tests/v955-assinatura-audio-case-insensitive.test.mjs`
  (novo), `package.json`/`package-lock.json`, `NOTAS-v955.md`, `REVISAO-COMPLETA.md`
  (checklist + achados), versão **954 → 955**.
