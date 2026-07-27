# NOTAS v1013 — Fechamento da auditoria de isolamento entre contas (multi-tenant)

## Contexto

Uma auditoria externa revisou o Corretor Pro depois da transformação em SaaS multi-conta
(v990–v1012) e encontrou **13 problemas reais** de isolamento entre contas, fluxo de
cadastro/login, proteção de rotas administrativas e falta de controle de consumo. Esta versão
corrige os 13, um por um, com teste de regressão para cada correção que tinha comportamento
testável.

## 1–4. Isolamento de arquivos no Storage e do aprendizado por conta

**O problema:** o Storage (bucket `whatsapp-zips`) guardava ZIP, áudios extraídos, manifestos de
importação e cache de transcrição numa estrutura de pastas **global** (`whatsapp/imports/...`,
`imports/...`, `transcription-cache/...`) — sem `organizationId` no caminho. Isso permitia, em
teoria, uma conta acessar/sobrescrever arquivo de outra só adivinhando um `importId`, e a
limpeza automática (`limpar-antigos`) varria a pasta inteira do bucket, podendo apagar arquivo
temporário de OUTRA conta. Além disso, a exportação manual do aprendizado
(`obterExportacaoAprendizado`) e o reaproveitamento de transcrição por lead anterior
(`_buscarProcessamentoExistenteV681`, chamado de `processar-storage.js`) não recebiam
`organizationId`, caindo no padrão da conta principal.

**A correção:**
- `api/criar-upload-url.js`: caminho do ZIP passa a ser
  `whatsapp/organizations/{organizationId}/imports/{importId}/{arquivo}`.
- `api/processar-storage.js`: manifesto/áudio extraído passam a viver em
  `organizations/{organizationId}/imports/{importId}/...`; cache de transcrição em
  `organizations/{organizationId}/transcription-cache/...`; a limpeza (`limpar-antigos`) agora
  lista só `organizations/{organizationId}/imports` (nunca mais a pasta global); a chamada de
  reaproveitamento de transcrição (`_buscarProcessamentoExistenteV681`) passa a receber
  `organizationId`.
- `api/_pipeline.js`: `obterExportacaoAprendizado(inteligenciaAprendida, cerebroAtual,
  organizationId)` agora exige `organizationId` e usa `loadMemoriaComercialV2(true,
  organizationId)` — `api/cerebro-config.js` já passa a organização certa.

Testes: `tests/v827-9-storage-manifest-mime.test.mjs`, `tests/v954-reaproveitar-transcricao-por-lead.test.mjs`
e `tests/v825-storage-pipeline.test.mjs` foram atualizados pro novo formato de caminho; nenhum
comportamento de reaproveitamento/limpeza mudou, só o isolamento por conta.

## 5. `api/diagnostico.js` liberado para qualquer corretor autenticado

**O problema:** `?mode=bucket` reconfigurava o bucket de Storage inteiro (infraestrutura
compartilhada por todas as contas) e `?mode=status`/`?mode=openai` revelavam prefixo/final da
chave OpenAI e organização/projeto — tudo liberado pra qualquer conta autenticada e em dia, não
só o administrador da plataforma.

**A correção:** `?mode=bucket` agora exige administrador da plataforma (tabela
`platform_admins`, mesma checagem do painel administrativo — extraída para o helper
`getPlatformAdminUserId`/`requirePlatformAdmin` em `api/_persistence.js`, reaproveitado também em
`api/admin-contas.js`). `?mode=status`/`?mode=openai` continuam abertos a qualquer corretor
autenticado (telas reais do app dependem disso pra avisar "transcrição indisponível" e pro botão
"Testar IA"), mas os campos sensíveis (prefixo/final da chave, organização, projeto) só aparecem
pra administrador.

## 6. Cadastro quebrava com confirmação de e-mail ativada

**O problema:** `cadastro.html` só chamava `criar_empresa_e_dono` quando `signUpData.session`
já vinha pronta do `signUp`. Com a confirmação de e-mail ativada no projeto Supabase, essa sessão
nunca existe nesse momento — o corretor confirmava o e-mail, fazia login, e caía em "não
encontrei nenhuma conta vinculada a este login", pra sempre.

**A correção:** o nome digitado no cadastro vai também em `user_metadata.nome_empresa` (dado do
próprio `signUp`). `entrar.html`, no primeiro login que já tem sessão de verdade, detecta a
ausência de vínculo e cria a empresa que faltou automaticamente usando esse nome salvo — sem
pedir nada de novo ao corretor. Também foram criadas as páginas que faltavam:
**recuperar-senha.html** e **redefinir-senha.html** (o app não tinha nenhum jeito de recuperar
senha esquecida).

## 7. Seleção de empresa não era determinística + sem trava contra múltiplas empresas

**O problema:** login e backend buscavam a empresa do usuário com `.limit(1)` sem `order()` —
se o mesmo login tivesse mais de um vínculo, pegava "o que o banco decidisse devolver" (não
determinístico). E `criar_empresa_e_dono` não tinha nenhuma trava contra o mesmo login criar
várias empresas (e ganhar vários testes grátis).

**A correção:** `entrar.html`, `api/_persistence.js` (`resolveOrganizationId`) e `app.js` (nome da
conta na lateral) agora ordenam por `criado_em desc` antes do `limit(1)` — sempre o vínculo mais
recente, nunca arbitrário. Nova migração
**`supabase/migrations/0006_uma_empresa_por_login.sql`** troca `criar_empresa_e_dono` para
recusar um segundo vínculo do mesmo login (`raise exception` se já existir uma
`membership`).

## 8. Nomes de pessoas/empresa parceira cravados no código

**O problema (já registrado como achado grande em `REVISAO-COMPLETA.md`/NOTAS-v955, agora
corrigido):** `api/_pipeline.js`, `app.js`, `api/lead-update.js` e `api/_persistence.js` tinham
regras de "quem é o corretor" com nomes reais cravados (`sanchai`, `miguel kirinus`, `senger`/
`construtora senger`, e uma lista de ~28 primeiros nomes de clientes reais usada como stopword de
similaridade de texto) — violação direta da regra do CLAUDE.md.

**A correção:** `corretorNome` (campo "Seu nome" do Cérebro, por organização) passou a ser
propagado como parâmetro por toda a cadeia de classificação de autor que ainda não recebia:
`autorPareceNegocioPipeline`/`autorPareceClientePipeline` → `papelMensagemAprendizado` →
`prepararTimelineParaAprendizado` → `aprenderComHistoricoReal` (agora chamado com `corretorNome`
carregado do Cérebro em `api/cerebro-config.js`); `guessLeadData`/`pickClientName` (chamados de
`prepararConversaDoZip` e `finalizarAnaliseDaConversa`, carregando o Cérebro antes);
`calcularMelhorHorario` (recebe de `analyzeWithBrain`, que já tinha o Cérebro carregado).
Todos os nomes de pessoa hardcoded foram removidos das regex e das listas de stopwords — sobram
só termos genéricos de papel (`corretor`, `corretora`, `construtora`, `imobiliária`,
`atendimento`, `direciona`/`sistema`), nunca nome próprio. Também corrigido um bug de produto
real: o template da **Proposta Comercial** (`index.html`/`js/proposta.js`) tinha
"Construtora Senger · Carazinho/RS" cravado como subtítulo fixo em **todo PDF de proposta gerado
por qualquer corretor** — agora o subtítulo vem do nome configurado no Cérebro de cada conta.
Placeholder do campo "Seu nome" trocado de "Ex.: Sanchai" para um nome genérico. Duas funções
mortas com o mesmo tipo de bug de isolamento (buscavam `direciona_config`/
`whatsapp_processamentos` sem filtrar por `organization_id`, mas nunca eram chamadas em lugar
nenhum) foram removidas: `loadInteligenciaAprendida` e `loadLeadMemoriaAprendizado`.

## 9–11. Exclusão de conta pelo painel administrativo

**Os problemas:** (a) não apagava os arquivos da conta no Storage; (b) apagava as 4 tabelas
(`whatsapp_processamentos`, `direciona_config`, `memberships`, `organizations`) uma de cada vez,
sem transação — uma falha no meio deixava a conta parcialmente excluída (leads apagados mas
Cérebro ainda existente, organização órfã, painel informando erro depois de parte do dado já ter
sido apagado); (c) erro ao apagar o login (`auth.admin.deleteUser`) era silenciosamente ignorado
— a resposta podia dizer `ok:true` com o login ainda existindo.

**A correção:**
- Nova migração **`supabase/migrations/0007_excluir_organizacao_transacional.sql`**: function
  `excluir_organizacao(p_organization_id)` que apaga as 4 tabelas dentro de **uma única
  transação** do Postgres — qualquer falha desfaz tudo automaticamente. `api/admin-contas.js`
  passa a chamar só essa function via `.rpc(...)`, no lugar dos 4 `.delete()` soltos.
- `api/limpar-tudo.js`: `emptyBucket` ganhou um parâmetro `prefix` (compatível com o uso
  existente, que continua limpando o bucket inteiro). `api/admin-contas.js` reaproveita essa
  função pra apagar `whatsapp/organizations/{id}` e `organizations/{id}` no Storage — só é seguro
  fazer isso sem risco de atingir outra conta porque os caminhos já são isolados por
  `organizationId` (itens 1–4 acima).
- Erros ao apagar login não são mais engolidos: aparecem em `loginsComErro` na resposta, com um
  aviso explícito (`aviso: "N login(s) não puderam ser removidos..."`). A resposta também traz
  `storage: { ok, arquivosApagados, erro }`.

**Passo manual pendente:** rodar `supabase/migrations/0006_uma_empresa_por_login.sql` e
`supabase/migrations/0007_excluir_organizacao_transacional.sql` no SQL Editor do Supabase (igual
às migrações anteriores). Sem isso, `criar_empresa_e_dono` continua sem a trava de conta única e
a exclusão de conta responde com um erro claro pedindo pra rodar a 0007.

## 12. Botão "Sair" do painel administrativo não encerrava sessão

**O problema:** só fazia `location.reload()` — recarrega a tela, mas a sessão do Supabase
continuava salva no navegador. Num aparelho compartilhado, a próxima pessoa a abrir o painel
entrava direto, sem pedir login.

**A correção:** `admin-plataforma.html` ganhou `sairAdmin()`, que chama
`supabaseClient.auth.signOut()` antes de recarregar — mesmo padrão já usado no "Sair" do app
principal (v1009).

## 13. Nenhum controle de consumo por conta

**O problema:** sem limite algum de análises de IA por dia, um bug, script ou uso mal-intencionado
podia gerar custo real ilimitado numa única conta — inclusive numa conta de teste grátis, sem
nunca pagar por isso.

**A correção:** nova rede de segurança (`verificarLimiteDiario`/`limiteAnalisesIADoDia` em
`api/_pipeline.js`) conta análises de IA por organização e por dia civil (contador em
`direciona_config`, reinicia sozinho). Aplicada em dois pontos: `analyzeWithBrain` (cobre
importação E reanálise, já que os dois passam por ali) — padrão de 200 análises/dia por conta,
configurável via `CORRETOR_PRO_LIMITE_ANALISES_DIA` sem precisar mudar código; e
`api/diagnostico.js` `?mode=openai` (o botão "Testar IA") — 40 testes/dia por conta. Os dois
números são só uma rede de segurança técnica contra abuso/loop descontrolado — bem acima de
qualquer uso manual real — não são uma trava de plano comercial (essa decisão continua sendo do
dono do produto, ajustável pela variável de ambiente). Falha ao consultar o banco nunca bloqueia
uma análise real (fail-open) — é proteção de custo, não trava de cobrança que precise ser exata.

## Testes novos

- `tests/v1013-diagnostico-e-admin-plataforma.test.mjs` — helper de administrador da plataforma
  (`getPlatformAdminUserId`/`requirePlatformAdmin`) e as duas rotas que passaram a usá-lo.
- `tests/v1013-cadastro-login-uma-empresa.test.mjs` — fluxo de cadastro sem sessão imediata,
  criação de empresa lazy no login, seleção determinística de vínculo, migração 0006, páginas de
  recuperação de senha.
- `tests/v1013-sair-painel-admin-encerra-sessao.test.mjs` — botão Sair do painel administrativo.
- `tests/v1013-limite-diario-uso-ia.test.mjs` — contagem diária por organização, reset por dia
  civil, fail-open, variável de ambiente.

Testes existentes atualizados pro novo comportamento correto (documentado em cada um):
`v827-9-storage-manifest-mime`, `v954-reaproveitar-transcricao-por-lead`, `v997-resolve-organizacao`,
`v1003-conta-bloqueada-trava-no-servidor`, `v970-nome-corretor-dinamico-cerebro`,
`v1005-excluir-conta-pelo-painel`.

## Arquivos principais alterados

`api/_pipeline.js`, `api/_persistence.js`, `api/cerebro-config.js`, `api/criar-upload-url.js`,
`api/processar-storage.js`, `api/diagnostico.js`, `api/admin-contas.js`, `api/limpar-tudo.js`,
`api/lead-update.js`, `app.js`, `js/proposta.js`, `index.html`, `entrar.html`, `cadastro.html`,
`admin-plataforma.html`, `build.js`, novo `recuperar-senha.html`, novo `redefinir-senha.html`,
novas migrações `0006_uma_empresa_por_login.sql` e `0007_excluir_organizacao_transacional.sql`.

## `npm test`

Suíte inteira verde (todos os `node --check` + todos os testes de `tests/*.test.mjs`, incluindo
os 4 novos desta versão).
