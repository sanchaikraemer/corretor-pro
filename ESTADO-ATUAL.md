# Estado atual do Corretor Pro

> Este é o documento de referência sobre **como o sistema está organizado hoje** — arquitetura,
> variáveis de ambiente, banco de dados, processo de publicação e pendências conhecidas. A
> auditoria técnica/comercial de 27/07/2026 apontou falta de "um único documento de estado atual"
> em meio a mais de 190 notas de versão acumuladas (`NOTAS-v*.md`) — este arquivo é essa
> referência única. As notas de versão continuam existindo como **histórico** (o que mudou e por
> quê, versão a versão) — pra saber **como o sistema está agora**, comece por aqui.
>
> Regras de trabalho (como versionar, como rodar os testes, convenções já estabelecidas) continuam
> em `CLAUDE.md`, na raiz do projeto — este arquivo não repete aquilo, só descreve o estado técnico.

_Atualizado pela última vez na v1128 (04/08/2026), depois da auditoria completa do sistema pedida
pelo dono. O cabeçalho vinha dizendo "atualizado na v1068" havia 60 versões, mesmo com trechos já
reescritos até a v1120 — a auditoria pegou isso e a v1128 acertou. Mudanças desta rodada: a rota
nova `criar-conta.js` (seção 2), a trava de cadastro por conexão e a migração `0013` (seções 3 e
4), e a seção 8 (pendências) revisada de ponta a ponta — a confirmação de e-mail saiu de vez da
lista (decisão do dono: quem se cadastra entra na hora e a venda é fechada por telefone depois), e
a cobrança manual deixou de ser pendência pelo mesmo motivo. Ver `NOTAS-v1128.md`._

_Retoque na v1141: a importação **não pergunta mais o período dos áudios** (usa o "Período padrão
dos áudios" do Cérebro) e a reimportação passou a reaproveitar o que já está salvo — a seção 2
descreve como isso funciona em `processar-storage.js`. Ver `NOTAS-v1141.md`._

## 1. Arquitetura

- **Front-end**: JavaScript puro (sem framework), servido como PWA (Service Worker,
  `manifest.json`, instalável no celular). Tela principal em `index.html` + `app.js` (arquivo
  grande — ver seção 8, "Pendências conhecidas"). Painel administrativo separado
  (`admin-plataforma.html`), telas de conta (`cadastro.html`, `entrar.html`,
  `recuperar-senha.html`, `redefinir-senha.html`).
- **Backend**: funções serverless na Vercel, uma por arquivo em `api/*.js` com
  `export default async function handler`. Arquivos com `_` no início (`_persistence.js`,
  `_pipeline.js`, `_zipUpload.js`, `_iaCusto.js`) são módulos internos importados pelas rotas —
  não viram função por conta própria (convenção da própria Vercel).
- **Banco de dados, autenticação e armazenamento**: Supabase (Postgres + Supabase Auth +
  Supabase Storage).
- **Inteligência artificial**: OpenAI (Chat Completions pra análise/mensagens, Whisper pra
  transcrição de áudio).
- **Multiempresa**: cada corretor pertence a uma `organization` (tabela `organizations`), vínculo
  em `memberships`. Toda tabela de dado de cliente carrega `organization_id`. Chave da empresa
  original (dono da plataforma), fixa: `00000000-0000-0000-0000-000000000001`
  (`EMPRESA_PRINCIPAL_ID` em `api/_persistence.js`).

## 2. Rotas da API (`api/*.js`)

O plano gratuito (Hobby) da Vercel permite no máximo **12** Serverless Functions por publicação
(ver `NOTAS-v1039.md` — isso já travou publicações por dias sem ninguém perceber). O projeto
esteve nas 12 até a v1082; a v1083 removeu duas rotas (`analisar.js`, sem nenhum chamador, e
`limpar-tudo.js`, junto com o botão "Apagar tudo" — decisão do dono); a v1128 acrescentou
`criar-conta.js`. **Hoje são 11, com 1 vaga livre.**

| Rota | O que faz |
|---|---|
| `admin-contas.js` | Painel administrativo: excluir conta (`POST action:excluir-conta`), definir plano/marcar pago (`POST action:definir-plano`), zerar a contagem de análises do dia de uma conta (`POST action:zerar-limite-analises`, v1174) e relatórios de uso de IA, de planos e de consumo do teto diário (`GET ?relatorio=uso-ia` / `?relatorio=planos` / `?relatorio=limites`, v1174) — todas exclusivas do administrador da plataforma. |
| `atalho-zip-token.js` | Gera/mostra a chave pessoal do Atalho do iPhone (ver `NOTAS-v1035.md`). |
| `cerebro-config.js` | Configuração do Cérebro Comercial + aprendizado contínuo. **v1170**: também serve o bloco de notas administrativas (`action: nota-adicionar/nota-concluir/nota-remover`, chave própria `notas-rapidas` em `direciona_config` — separada de propósito da chave do Cérebro, pra uma nota administrativa nunca virar contexto de uma sugestão de mensagem pro cliente). |
| `criar-conta.js` | Cria a empresa de quem acabou de se cadastrar, com a trava contra cadastro falso em massa (quantas contas novas saíram da mesma conexão de internet nas últimas 24h). Única rota que usa `requireLoginSemEmpresa` em vez de `resolveOrganizationId` — quem chega aqui ainda não tem empresa, que é justamente o que ela vai criar (ver `NOTAS-v1128.md`). |
| `diagnostico.js` | `?mode=status` (variáveis de ambiente configuradas), `?mode=openai` (teste real da chave OpenAI), `?mode=bucket` (configura o bucket do Storage — só admin), `?mode=banco` (quais migrações estão MESMO aplicadas no banco — só admin, v1185). |
| `lead-update.js` | Ações sobre um lead: etapa (só Ativo/Geladeira), memória, aprendizado, lembrete, apagar, editar, salvar novo, criar manual, etc. Nota (v1092): `lembrete-set`/`lembrete-clear` foram REMOVIDAS — o histórico do repositório mostra que nenhuma tela as chamou em nenhum momento do projeto (o app usa `reagendar-lembrete`/`remover-lembrete` de reanalisar-lead.js). Já `analise-comercial-set` e `nova-oportunidade-parceiro` continuam de propósito: as chamadas saíram do front só na v1073 (29/07/2026) e, como o app é PWA instalável, um celular que não abriu o app desde então ainda roda a versão em cache que as chamaria. Remover agora daria erro pra quem está desatualizado — sair numa faxina futura. **v1148**: entrou `juntar-clientes` (junta dois cadastros da MESMA pessoa — conversa dos dois numa só, o duplicado é apagado só DEPOIS de a fusão estar gravada). |
| `leads-recentes.js` | Listagem da Carteira + auditoria de qualidade dos dados (`?audit=1`) + backup completo (`?export=full`) + **assinatura da carteira (`?assinatura=1`, v1166)** — todas sempre filtradas pela própria empresa (ver `NOTAS-v1037.md`). A assinatura devolve só **quantos leads existem** e **qual foi a última alteração** (~80 bytes, contra ~1,2 MB da carteira completa numa base de 400 clientes): a atualização automática do app pergunta isso primeiro e, se nada mudou desde a carga anterior, não baixa nada. É a correção da cota de tráfego (egress) do Supabase estourada em 07/08/2026 — ver `NOTAS-v1166.md`. **Toda dúvida (erro, tempo esgotado, `indefinida: true`, primeira carga) resulta em busca completa**: economizar nunca pode esconder novidade. |
| `processar-storage.js` | Pipeline de importação por Storage: criar URL de upload (absorveu `criar-upload-url.js`, ver `NOTAS-v1039.md`), preparar, transcrever, analisar, finalizar, limpar antigos. **Reimportação (v1141)**: "preparar" identifica o cliente já salvo (telefone/arquivo/nome) e devolve o id; "analisar" recebe esse id, lê do banco a conversa e a análise já gravadas e — se a reimportação não trouxer NENHUMA mensagem nova e a análise salva estiver completa — reaproveita essa análise **sem nenhuma chamada de IA**. Áudio que já tem transcrição salva do mesmo cliente nem é extraído do ZIP. Ver `NOTAS-v1141.md`. |
| `reanalisar-lead.js` | Reanálise de um lead já importado. |
| `receber-zip-atalho.js` | Recebe o ZIP mandado pelo Atalho do iPhone (autenticação própria, por token — não é sessão do app). |
| `restaurar-leads.js` | Restauração de leads das tabelas legadas pré-multiempresa — exclusiva da empresa original (ver `NOTAS-v1042.md`). |

Antes de criar uma rota nova em `api/`, considere se ela cabe como uma ação nova dentro de uma
rota já existente (o padrão já usado em `lead-update.js`, `diagnostico.js`, `admin-contas.js`,
`processar-storage.js`) — criar um arquivo novo aproxima o projeto do limite de 12 de novo.

## 3. Variáveis de ambiente

### Obrigatórias pra funcionar
- `SUPABASE_URL` (ou `NEXT_PUBLIC_SUPABASE_URL`) — endereço do projeto Supabase.
- `SUPABASE_SERVICE_ROLE_KEY` — chave de administrador do Supabase (backend só, nunca no navegador).
- `SUPABASE_ANON_KEY` (ou `NEXT_PUBLIC_SUPABASE_ANON_KEY`) — chave pública, usada pelo navegador
  (login, `admin-plataforma.html`).
- `OPENAI_API_KEY` — chave da OpenAI.

### Segurança
- `CORRETOR_PRO_API_KEY` (ou `API_SECRET`/`CP_API_SECRET`) — chave compartilhada do caminho
  antigo (pré-login por conta); hoje só resolve pra empresa principal, nunca abre rota nenhuma
  sozinha (ver `NOTAS-v1042.md`). Sem essa variável configurada, em produção a API fica bloqueada
  por padrão — a menos que `ALLOW_UNPROTECTED_API=true` seja definida conscientemente.
- `DIRECIONA_DANGER_LIMPAR_TUDO` — **não é mais usada.** A rota `limpar-tudo.js` foi removida na
  v1083; se essa variável ainda estiver cadastrada na Vercel, pode apagar.
- `ATALHO_ZIP_TOKEN_SECRET` — segredo usado pra assinar a chave pessoal do Atalho do iPhone.
- `ALLOW_UNPROTECTED_API` — **não vale mais em produção (v1092).** Ela liberava a API sem chave e
  sem login; como toda chamada sem login é tratada como sendo da conta original, isso deixava os
  dados dela abertos pra qualquer um. Fora de produção (desenvolvimento/teste) continua valendo.
- `CORRETOR_PRO_LEGADO_DESLIGADO` — defina como `sim` pra **desligar definitivamente** o acesso
  antigo por chave compartilhada. A partir daí só entra quem tem login de verdade. Vem desligado
  por padrão porque o Atalho do iPhone e aparelhos antigos da conta original podem depender do
  caminho antigo; quem usa o app com login não perde nada ao ligar isto.

### Custo e limites de IA
- `CORRETOR_PRO_LIMITE_ANALISES_DIA` — teto de segurança de análises por dia (padrão 50 desde a v1112; era 200) — hoje só alcança a conta original, as demais usam os planos.
- `CORRETOR_PRO_LIMITE_ANALISES_DIA_TESTE` — mesmo teto, mas pra contas em teste grátis (padrão 5
  desde a v1109; era 10 na v1108 e 25 antes — ver `NOTAS-v1041.md`, `NOTAS-v1108.md`,
  `NOTAS-v1109.md`). **Atenção:** se essa variável estiver cadastrada na Vercel, ela MANDA sobre
  o padrão do código — confira lá antes de esperar o teto novo valer.
- `CORRETOR_PRO_WHATS_COMERCIAL` — WhatsApp comercial da plataforma (só dígitos, com código do
  país), usado no convite de contratação quando a conta em teste atinge o limite diário (v1108).
  Padrão embutido: o número do dono do produto.
- `CORRETOR_PRO_LIMITE_CADASTROS_CONEXAO_DIA` — quantas contas novas a mesma conexão de internet
  pode abrir em 24h (padrão 5, v1128). É a trava que entrou no lugar da confirmação de e-mail,
  descartada por decisão do dono. Folgada de propósito: um corretor cria uma conta, uma imobiliária
  inteira no mesmo Wi-Fi cabe, e um script numa máquina só trava na sexta tentativa. Vale de
  verdade só com a migração `0013` aplicada (ela é que tira do navegador o direito de criar empresa
  por fora). Ver `NOTAS-v1128.md`.
- **Planos comerciais (v1110, recalibrados na v1111)** — Pro: 15/dia + 150/mês; Pro Master:
  30/dia + 300/mês (acima disso, plano personalizado negociado no WhatsApp). O plano
  de cada conta fica em `direciona_config` (chave `plano-contratado`), definido pelos botões
  "Pago · Pro" / "Pago · Pro Master" do painel administrativo (que também marcam a conta como
  ativa). Conta ativa sem registro = Pro. A conta original fica FORA dos planos (só o fusível
  técnico de `CORRETOR_PRO_LIMITE_ANALISES_DIA`, padrão 50/dia desde a v1112). Overrides:
  `CORRETOR_PRO_LIMITE_DIA_PRO`, `CORRETOR_PRO_LIMITE_MES_PRO`,
  `CORRETOR_PRO_LIMITE_DIA_PROMASTER`, `CORRETOR_PRO_LIMITE_MES_PROMASTER`.
- `CORRETOR_PRO_LIMITE_TRANSCRICAO_VOZ_DIA` / `CORRETOR_PRO_LIMITE_TRANSCRICAO_VOZ_DIA_TESTE` —
  mesmo tipo de teto, pra transcrição de voz avulsa (observação por voz do lead, `cp7Obs`) —
  padrão 100/dia (20/dia em teste, ver `NOTAS-v1068.md`). As 3 ações de visão (extrair print,
  detectar rosto, ler prints de conversa) e o teto que tinham (`CORRETOR_PRO_LIMITE_VISAO_DIA`)
  foram removidos do código na v1069 — o dono nunca usou essas 3 funções.
- `CORRETOR_PRO_COTACAO_USD_BRL` — cotação usada pra estimar custo de IA em reais no painel administrativo (padrão 5,50).
- `SUPABASE_ZIP_BUCKET` — nome do bucket de Storage (padrão `whatsapp-zips`).
- `SUPABASE_ZIP_MAX_BYTES` — tamanho máximo de ZIP aceito.
- `MAX_AUDIO_TRANSCRIPTIONS` — limite de áudios transcritos por importação.

### Modelos de IA (todas opcionais — têm padrão embutido em `api/_pipeline.js`)
`DIRECIONA_MAIN_MODEL`, `DIRECIONA_FAST_MODEL`, `DIRECIONA_IMPORT_MODEL`,
`OPENAI_TRANSCRIPTION_MODEL`, `OPENAI_VISION_MODEL`, `OPENAI_SIMPLE_MODEL`, `OPENAI_MODEL`,
`OPENAI_ORQUESTRADOR_MODEL`, `OPENAI_REASONING_EFFORT`.

### Outras
`OPENAI_BASE_URL`/`OPENAI_API_BASE`, `OPENAI_ORG_ID`/`OPENAI_ORGANIZATION`,
`OPENAI_PROJECT_ID`/`OPENAI_PROJECT` (conta/projeto da OpenAI, não confundir com organização do
Corretor Pro), `DIRECIONA_ANALYSIS_MAX_TOKENS`, `DIRECIONA_ANALYSIS_TIMEOUT_MS`,
`DIRECIONA_MAX_CONTEXT_CHARS`, `DIRECIONA_LIMITAR_HISTORICO`, `DIRECIONA_USAR_APRENDIZADO_AUTO`,
`DIRECIONA_USAR_CONHECIMENTO_AUTO`, `DIRECIONA_USAR_ESTILO_AUTO`.

## 4. Banco de dados — migrações

Migrações vivem em `supabase/migrations/`, numeradas e aplicadas manualmente (SQL Editor do
Supabase — nenhuma ferramenta de migração automática está configurada). Lista atual:

| Arquivo | O que faz |
|---|---|
| `0001_contas_e_empresas.sql` | `organizations`, `memberships`, coluna `organization_id`, RLS inicial. |
| `0002_migrar_dados_existentes.sql` | Cria a "Empresa 1" e atribui a ela todo dado sem organização. |
| `0003_teste_e_administracao.sql` | Teste de 7 dias, status da conta, `platform_admins`, `criar_empresa_e_dono`, painel administrativo. |
| `0004_cerebro_por_corretor.sql` | Primeiro passo pra Cérebro por corretor. |
| `0005_abrir_cerebro_multiconta.sql` | `organization_id` obrigatório em `direciona_config`. |
| `0006_uma_empresa_por_login.sql` | Trava (no código) contra criar mais de uma empresa pelo mesmo login. |
| `0007_excluir_organizacao_transacional.sql` | Exclusão de empresa numa transação só. |
| `0008_telemetria_uso_ia.sql` | Tabela `ai_usage_events` (uso de IA por empresa). |
| `0009_travas_concorrencia_e_search_path.sql` | Restrição única real contra empresa duplicada, `organization_id` obrigatório em `whatsapp_processamentos`, `search_path` fixo nas funções `SECURITY DEFINER`. |
| `0010_dedupe_indexado.sql` | **Aditiva e opcional (v1092).** Cria três colunas de deduplicação (`dedupe_fone8`, `dedupe_arquivo`, `dedupe_nome`) com índice por empresa, pra a importação parar de varrer a carteira inteira só pra saber se o cliente já existe. Enquanto não for aplicada, o sistema funciona igual, só mais devagar — o app detecta a ausência sozinho. |
| `0011_cadastro_contato_corretor.sql` | **Aditiva (v1117).** Adiciona `telefone`, `cidade`, `estado`, `email_contato` em `organizations`; faz `criar_empresa_e_dono` gravar esses campos; e os expõe em `admin_visao_empresas` (pra o painel mostrar como falar com cada corretor). As telas de cadastro/login funcionam antes e depois dela — enquanto não for aplicada, o cadastro segue no ar, só não grava os campos novos. |
| `0012_contadores_atomicos.sql` | **Aditiva (v1120).** Cria as funções `reservar_analise_ia` e `reservar_contador_dia`, que fazem "checar + somar" o uso numa transação só, com trava (advisory lock) por empresa — cliques simultâneos não furam mais o teto. O app usa `reservar_analise_ia` quando ela existe e, se não existir (ou der erro), volta pro jeito antigo (lê/decide/grava) — nunca bloqueia análise real. `reservar_contador_dia` fica disponível pra uma faxina futura ligar os contadores de voz/diagnóstico/transcrição. |
| `0013_limite_cadastro_por_conexao.sql` | **Aditiva, mas com um fechamento (v1128).** Cria a tabela `cadastros_por_conexao` (o contador da trava contra cadastro falso; guarda só uma impressão embaralhada da conexão, nunca o endereço de internet) e a função `criar_empresa_e_dono_para`, que é a criação de empresa feita pelo backend. **Também tira do navegador o direito de chamar `criar_empresa_e_dono`** — é esse fechamento que faz a trava valer, já que a chave "anon" do Supabase é pública. **O `revoke` precisa incluir `public`, não só `anon`/`authenticated`**: o Postgres libera toda função nova pro grupo `public` por conta própria, e os dois papéis continuam podendo chamar por serem membros dele. A primeira versão desta migração (v1128) errava exatamente nisso e a porta seguia aberta — pego na v1129 rodando a migração num Postgres 16 de verdade, e agora protegido por `tests/v1129-migracao-0013-fecha-porta-do-navegador.test.mjs`. Enquanto não for aplicada, o cadastro continua funcionando pelo caminho antigo (`api/criar-conta.js` responde `migracaoPendente` e as telas caem nele sozinhas), só sem a trava. De quebra, restaura a checagem amigável de "uma empresa por login" que a migração `0011` tinha derrubado sem querer da `criar_empresa_e_dono` da `0009`. |
| `0014_permissoes_rpc_contadores.sql` | **URGENTE — correção de segurança (v1163).** A `0012` liberou as duas funções de contador (`reservar_analise_ia`, `reservar_contador_dia`) pro papel `authenticated`, e elas recebem a EMPRESA como parâmetro sem conferir se quem chama pertence a ela. Como a chave "anon" e o id da conta principal são públicos (`contas-config.js`), qualquer pessoa podia chamar o banco por fora do app e (a) queimar o limite de IA de qualquer conta e (b) — via a chave livre de `reservar_contador_dia` — gravar `{dia, contagem}` por cima de QUALQUER linha de `direciona_config`, inclusive o Cérebro Comercial (`direciona-cerebro`) e o plano contratado. Reproduzido num Postgres 16 de verdade (0001→0013 aplicadas): `set role authenticated; select reservar_contador_dia('00000000-…-0001','direciona-cerebro',…)` destruiu o Cérebro da conta principal — e `anon`, sem conta nenhuma, também conseguia chamar, porque `grant … to authenticated` não tira a liberação automática do grupo `public`. A `0014` revoga as duas de `public, anon, authenticated`, concede só ao `service_role` (o backend, `api/_pipeline.js`), e recria `reservar_contador_dia` aceitando **só** chave de contador (`limite-diario:*` / `limite-mensal:*`) — assim o Cérebro e o plano ficam fora do alcance dessa função mesmo se a permissão for reaberta um dia. **Também concede `excluir_organizacao(uuid)` ao `service_role`**: as migrações `0007` e `0009` revogaram de todo mundo e nunca concederam ao backend, então o botão "excluir conta" do painel administrativo responde `permission denied` (conferido no mesmo Postgres). Protegida por `tests/v1163-migracao-0014-contadores-so-do-backend.test.mjs`, que simula as permissões finais do banco (incluindo a liberação automática pro `public`) e falha se qualquer função que receba empresa por parâmetro sobrar ao alcance do navegador. |
| `0015_travas_da_0009_fora_de_ordem.sql` | **Conserto de ordem (v1165).** A conferência do banco real (07/08/2026) mostrou que a `0009` **nunca foi aplicada**, embora da `0010` à `0014` estejam. Rodar a `0009` hoje reabriria um buraco: no passo 1 dela existe `grant execute on function criar_empresa_e_dono(text) to authenticated`, que é justamente o que a `0013` revogou — aplicá-la fora de ordem desfaria a `0013` em silêncio (o arquivo `0009` ganhou um aviso no topo por isso). A `0015` faz os três pedaços que faltavam, sem tocar em permissão: trava de **uma empresa por login** no banco (`memberships_um_por_usuario`), `organization_id` **obrigatório** em `whatsapp_processamentos` (com backfill antes) e `search_path` fixo em toda função `security definer` — via `alter function`, que não reescreve o corpo e por isso não ressuscita versão antiga de função. No fim, **reafirma os revokes da `0013`/`0014`**, então rodá-la de novo conserta qualquer aplicação fora de ordem. Se algum login estiver vinculado a duas empresas, ela **para com mensagem em português** dizendo quais, em vez de erro cru de banco. Protegida por `tests/v1165-migracao-0015-nao-reabre-porta.test.mjs`. |
| `0016_devolver_reserva_analise.sql` | **Aditiva (v1174).** Cria `devolver_analise_ia(uuid, text, text)` — o outro lado da reserva feita pela `0012`. A `0012` soma 1 no contador de análises ANTES de chamar a IA (é o que impede um laço descontrolado de gastar dinheiro real), mas nada devolvia essa unidade quando a análise falhava — tempo esgotado, erro da OpenAI, resposta sem as três mensagens. Como o app repete a etapa sozinho, uma importação que falhava queimava 4 a 6 unidades do teto do dia sem entregar nada: foi assim que a conta original travou em "limite atingido" num dia em que a OpenAI acusava 114 chamadas no mês inteiro. A função subtrai 1 dos mesmos contadores (dia e mês), com a MESMA trava por empresa, nunca abaixo de zero e só no período corrente. Enquanto não for aplicada, `devolverReservaAnalise` (em `api/_pipeline.js`) faz a devolução pelo caminho antigo (ler, subtrair, gravar) — nada quebra, só perde a atomicidade. Rode DEPOIS da `0012`. |

| `0017_registro_de_migracoes.sql` | **Aditiva (v1185).** Cria `cp_migracoes_aplicadas` e a função `conferir_migracoes()`, que **olha o catálogo do Postgres** (tabela, função, índice, trava e permissão) e diz o que cada migração deixou de fato — não confia em anotação. É a resposta das quatro auditorias de 08/2026 ao maior risco restante: código e banco em versões diferentes sem ninguém saber (a `0009` faltando enquanto da `0010` à `0014` estavam). Detalhes importantes: a `0009` e a `0015` são conferidas **pelo mesmo efeito** (a `0015` refaz o que faltou da `0009`); a `0013` só conta como aplicada se o navegador **não** conseguir chamar `criar_empresa_e_dono*` (função existir não basta — a trava é o revoke); a `0014` só conta se os dois contadores estiverem fora do alcance de `anon`/`authenticated`. Por isso a conferência também serve de **alarme**: reabrir uma dessas portas faz a migração virar "faltando" na hora. Tabela e funções fechadas pro navegador (RLS ligada, `revoke` incluindo `public`, `grant` só ao `service_role`). Validada num Postgres 16 de verdade em três cenários (banco de 07/08 sem a `0009`; banco completo; portas reabertas). Lida por `conferirMigracoesDoBanco` (`api/_persistence.js`) e exposta em `api/diagnostico.js?mode=banco`. Protegida por `tests/v1185-banco-se-reporta-e-nada-cai-no-caminho-antigo.test.mjs`, que exige que **toda** migração do disco esteja na conferência. |

**Como saber o que está aplicado em produção (v1185)**: pergunte ao banco, não a um documento —
`/api/diagnostico?mode=banco` (logado como administrador da plataforma) devolve a lista do que está
aplicado, do que falta e qual arquivo rodar. **Nenhum documento deste repositório sabe o estado
real**; a única exceção é a própria `0017`, que precisa ser aplicada às cegas uma vez para o resto
passar a se reportar. Esta sessão continua sem acesso ao Supabase de produção (ver `CLAUDE.md`).
Se uma rota falhar citando tabela/coluna/função que "não existe", o mais provável é migração não
aplicada — e agora dá para confirmar em vez de supor.

**Regra que passou a valer na v1185**: peça de segurança faltando no banco gera **diagnóstico**,
nunca downgrade silencioso. Antes, três lugares faziam o contrário — salvar o Cérebro caía na
regra global de antes das contas separadas; o cadastro criava a empresa pelo navegador quando a
`0013` não era encontrada; e a rota do Cérebro sugeria recriar `direciona_config` no esquema
pré-multiempresa. Os três foram retirados e trocados por aviso claro. Quem for mexer nisso: **não
reintroduza reserva que contorne migração faltando** — o teste da v1185 falha de propósito.

## 5. Processo de publicação

1. Trabalho feito numa branch, PR aberto pro `main`.
2. `.github/workflows/ci.yml` roda `npm test` automaticamente no PR e no push pro `main` (desde a
   v1043) — não bloqueia o merge sozinho (não é branch protection), é só um aviso visível.
3. Mesclar no `main` → a Vercel publica sozinha (webhook do GitHub já configurado).
   - Desde a v1073, `build.js` publica os `.js`/`.css` **sem comentários e espaços** (esbuild,
     só `minifyWhitespace` — nunca renomeia identificador, senão os `onclick="funcao()"` do HTML
     quebrariam; se o esbuild faltar/falhar, publica o arquivo como está). O `app.js` publicado
     caiu de ~800KB pra ~510KB com isso + a faxina de código morto da mesma versão.
4. Migrações do Supabase **não** são aplicadas automaticamente — são sempre um passo manual à
   parte (colar o SQL no SQL Editor).

### Rollback
Não há script de rollback automatizado. Duas formas manuais:
- **Código**: painel da Vercel → Deployments → escolher uma publicação anterior "Ready" → menu
  "..." → "Promote to Production". Mais rápido, não mexe no Git.
- **Git**: `git revert` do(s) commit(s) problemático(s) no `main` e deixar a Vercel publicar de
  novo — mais correto a longo prazo (mantém o histórico limpo), mas mais lento.
- Migrações de banco **não têm rollback automático** — cada migração nova deveria, idealmente, ser
  escrita de um jeito que só adiciona (nunca remove/altera destrutivamente) — é o padrão que todas
  as migrações até aqui já seguem.

## 5-A. Jornada do cliente novo (o caminho que decide a venda)

Reescrita entre a v1128 e a v1135, depois de o dono testar o produto como cliente e travar em cada
passo. Está aqui porque é o caminho mais importante do sistema e o mais fácil de quebrar sem querer.

1. **Recebe o link** → `entrar.html` mostra o **convite** (o que o produto faz + "Criar minha conta
   grátis"), nunca um formulário de senha. Quem já entrou naquele aparelho cai direto no login. O
   que decide é `localStorage['cp-ja-entrou']`, marcado só por login/cadastro concluído (v1134).
   **v1165** — no login e no cadastro, `js/dados-locais.js` carimba de quem é o dado guardado neste
   aparelho (`cp-dono-dos-dados-locais`) e, se o dono MUDOU, apaga o que era da conta anterior
   **antes** de o app abrir: Cérebro em cópia local, importação pendente, ZIP compartilhado
   (IndexedDB `direciona-share`), retrato do lembrete diário com nomes de clientes (IndexedDB
   `corretor-pro-notif`) e os caches `direciona-sharetarget-*`. Sair da conta apaga o dado
   comercial e o carimbo. Preferência neutra do aparelho (tema) nunca é apagada, e os contadores de
   uso do próprio corretor (`cpAtividade_*`, `cpTempoAppPorDia`) só somem quando o dono muda —
   sair e voltar na mesma conta não pode tomar dele o histórico da tela Desempenho.
2. **Cria a conta** → entra na hora, sem confirmar e-mail (decisão do dono, v1128). A proteção
   contra cadastro falso em massa é por conexão de internet, no servidor (`api/criar-conta.js` +
   migração `0013`).
3. **Importa a primeira conversa** → a Home vazia abre com o caminho dentro do WhatsApp, passo a
   passo, e o botão de escolher arquivo é secundário (v1130). O app **não** busca conversa nenhuma:
   quem exporta e envia é o corretor, e o WhatsApp não guarda exportação.
4. **Recebe a análise** → mesmo **sem Cérebro configurado**. É o `modoPrevia` (v1132): a análise
   sai apoiada só na conversa enviada, com as três mensagens, e o prompt proíbe afirmar preço,
   condição, empreendimento ou localização que não esteja escrita ali. Depois da análise aparece o
   convite "Ensinar a IA a falar como eu", que leva ao Cérebro.
   **Não reintroduza a recusa por falta de Cérebro** — ver `NOTAS-v1132.md` e o teste
   `v1132-conta-nova-ve-o-produto-funcionando`.
5. **Configura o Cérebro** quando quiser, já tendo visto o valor.

## 5-B. Cache de tela e memória (a armadilha que já gerou 3 bugs)

As telas desenham a partir de listas em memória (`state.todosLeads`, `state.itemsAtivos`) para não
mostrarem "Carregando..." a cada navegação. Isso é bom para a percepção de velocidade e é a origem
de uma classe inteira de bug: **gravar no servidor sem atualizar a memória deixa a tela mostrando o
dado velho**, sem erro nenhum. Já aconteceu três vezes (v1125 arquivar, v1133 excluir lembrete, e
remarcar lembrete, que ninguém chegou a relatar).

Como está hoje:

- `state.dataRevision` sobe a cada `invalidarLeadsCache()` (isto é, depois de toda gravação) e a
  cada busca nova de leads.
- `state.carteiraRevisao` (v1135) guarda **em que revisão a carteira em memória foi preenchida a
  partir do servidor**. Só é carimbada onde os dados vieram mesmo de `getLeadsData` — nunca onde a
  lista recebe uma cópia da própria memória.
- `carregarAgenda()` pinta da memória (rápido) e, se `carteiraRevisao !== dataRevision`, revalida no
  servidor e repinta. Esquecer de sincronizar a memória numa ação nova deixa a tela um pouco mais
  lenta em vez de mostrar dado errado.

Ao criar uma ação que grava no servidor, prefira sempre atualizar a memória (`cpMarcarEtapaLocal`,
`cpAtualizarLembreteLocal`, `removerLeadDosCaches` são os exemplos existentes). A revalidação é rede
de segurança, não substituta.

## 6. Ambiente de homologação (staging)

**Ainda não existe.** Hoje só há um projeto Supabase (produção) e uma publicação Vercel de
produção — toda alteração de banco é testada só com dados fake em memória (os testes automatizados
usam um servidor HTTP de mentira, nunca o Supabase real) ou direto em produção. Esta sessão não
tem credenciais pra criar um projeto Supabase novo nem pra configurar variáveis de ambiente por
ambiente na Vercel — são passos que só o dono consegue fazer. Passo a passo pra quando quiser
montar isso:

1. Criar um **segundo projeto no Supabase** (grátis), só pra teste.
2. Rodar todas as migrações de `supabase/migrations/` nesse projeto novo, na ordem.
3. Na Vercel → Settings → Environment Variables: cadastrar `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` (e demais) com os valores do projeto de
   **teste**, mas marcadas pra valer só no ambiente **Preview** (não em Production) — a Vercel já
   separa isso nativamente, é só escolher a caixinha certa ao cadastrar cada variável.
4. A partir daí, toda Pull Request já publica automaticamente numa URL de "Preview" (a Vercel já
   faz isso hoje) — e, seguindo o passo 3, essa URL passa a usar o banco de teste, nunca o de
   produção.

## 7. Segurança — resumo do que já foi corrigido

- Nenhuma rota usa mais a chave compartilhada (`CORRETOR_PRO_API_KEY`) como única prova de
  identidade — todas identificam a empresa de verdade (`NOTAS-v1037.md`, `NOTAS-v1042.md`).
- Restrição única real (não só no código) contra duas empresas pelo mesmo login
  (`NOTAS-v1040.md`).
- `organization_id` obrigatório (não mais opcional) na tabela principal de leads
  (`NOTAS-v1040.md`).
- Funções do banco com privilégio elevado (`SECURITY DEFINER`) com `search_path` fixo
  (`NOTAS-v1040.md`).
- Teto de uso de IA bem menor durante o teste grátis (`NOTAS-v1041.md`).
- Telemetria de custo de IA por empresa, visível no painel administrativo (`NOTAS-v1038.md`).

## 8. Pendências conhecidas

- ~~[MAIOR PENDÊNCIA TÉCNICA] A listagem lê a conversa inteira de todos os leads a cada carga~~ —
  **resolvida na v1136** (era o achado nº 1 da auditoria de 05/08/2026 e a causa quase certa da
  cota de egress estourada desde a v1122). A listagem normal **não pede mais `timeline_json`**: o
  `_statsCache` virou v3 (marca d'água = `atualizado_em` da linha, prévia de 8 mensagens e último
  toque gravados juntos) e responde tudo; só linhas com cache frio/vencido têm a conversa buscada,
  numa segunda consulta, em lotes de 50. No regime normal a carga é **uma** consulta sem conversa
  nenhuma; na virada do dia (os números de 90 dias envelhecem) todo mundo recalcula **uma** vez e
  volta ao regime barato. O detalhe do lead (`includeFullTimeline`) segue trazendo o histórico
  completo. Guardas: `tests/v1136-listagem-nao-traz-conversa-inteira.test.mjs` (usa um banco de
  mentira que **respeita** o select — os fakes antigos devolviam a linha inteira fosse qual fosse a
  coluna pedida, e por isso nunca enxergariam esta regressão). Ver `NOTAS-v1136.md`.

- ~~Confirmação de e-mail no cadastro~~ — **descartada por decisão do dono na v1128**, e não é mais
  pendência: quem se cadastra precisa entrar no app na hora e usar os 7 dias de teste; a venda é
  fechada depois, por telefone, no WhatsApp que o próprio cadastro pede. O código continua
  aguentando as duas situações (`cadastro.html` trata tanto a sessão que já vem pronta quanto a
  ausência dela), então ligar a opção no Supabase no futuro não quebraria nada — mas a intenção
  registrada é deixar desligada. **Não reabra isto como "pendência" numa auditoria futura.**
- ~~Captcha no cadastro~~ — **resolvido de outro jeito na v1128**, sem provedor externo. Como a
  confirmação de e-mail (que na prática segurava robô criando conta com e-mail inventado) saiu, a
  proteção passou a ser server-side: `api/criar-conta.js` conta quantas contas novas saíram da
  mesma conexão de internet em 24h e recusa acima do limite (`CORRETOR_PRO_LIMITE_CADASTROS_
  CONEXAO_DIA`, padrão 5). Não pede nada de quem se cadastra. **Só vale de verdade com a migração
  `0013` aplicada** — sem ela, o navegador ainda consegue criar empresa por fora.
- **`app.js` é um arquivo só, com ~11,3 mil linhas** — funciona, mas dificulta manutenção. Ainda
  não foi dividido em módulos. Detalhe importante pra quem for mexer: `app.js` é um **módulo ES**
  (`<script type="module">` no `index.html`), então uma `function` declarada no topo do arquivo
  **não** fica acessível pros `onclick="funcao()"` do HTML — só as linhas `window.funcao = funcao`
  fazem essa ponte. É por isso que uma "função duplicada" quase sempre é, na verdade, uma ponte
  `window.x = ...` reatribuída.
  - As duplicatas que esta seção apontava desde a v1068 (`abrirVenda`/`marcarPerdido` 3 vezes,
    `abrirEditarLead`/`salvarEditarLead` 2 vezes) **não existem mais**: saíram na faxina da v1069.
  - A v1082 varreu o arquivo inteiro com um analisador de sintaxe (acorn) e confirmou **zero**
    declarações duplicadas no topo. As últimas sobras de verdade foram removidas na mesma versão:
    a geração antiga de `arquivarLead` (com `confirm()` do navegador, substituída na v1073) e uma
    linha repetida de `window.reanalisarTudo`.
  - **Não** mexa nas reatribuições de `window.show`, `window.cpPerformanceResumo` e
    `window.__cpShareImportActive`: as duas primeiras são correntes propositais (cada camada
    guarda a anterior e chama ela), a terceira é estado de execução, não definição. Remover
    qualquer elo dessas correntes derruba silenciosamente o comportamento da camada de fora.
- ~~`limpar-tudo.js` sem checagem de "dono" da empresa~~ — **resolvido na v1083 pela remoção da
  rota inteira** (decisão do dono: o botão "Apagar tudo" nunca seria usado). A única forma de
  apagar os dados de uma conta hoje é o painel administrativo (`admin-contas.js`, ação
  `excluir-conta`), que já exige ser administrador da plataforma.
- **Política de privacidade e termos de uso** — publicadas desde a v1045 (`privacidade.html`,
  `termos.html`). Os dados de identificação do responsável e o e-mail de contato **já foram
  preenchidos na v1084**; os links passaram a existir também dentro do app, no rodapé da tela Menu
  (antes só havia link na tela de criar conta, então quem já era cliente não achava as páginas).
  **Pendência restante: uma revisão jurídica de verdade** antes de tratar o texto como definitivo —
  o aviso disso continua visível no topo das duas páginas.
- **Cobrança/assinatura automatizada** — não há integração com meio de pagamento, e **isso é
  intencional desde a v1128**: o dono acompanha os dias restantes pela coluna "Dias de teste" do
  painel, liga pro WhatsApp cadastrado antes de o teste vencer, fecha o pacote por telefone e
  marca o plano no painel (que já ativa a conta). Continua listado aqui como característica
  conhecida, não como tarefa em aberto.
- **App nativo pro iPhone** (aparecer direto no botão Compartilhar do WhatsApp, como no Android) —
  projeto à parte, não iniciado; o Atalho do iPhone (Shortcuts) já cobre a mesma necessidade de um
  jeito mais manual (ver `NOTAS-v1035.md`).

## 9. Onde encontrar mais detalhes

Cada mudança relevante tem sua própria nota de versão em `NOTAS-vNNN.md` — comece pelas mais
recentes se quiser entender uma decisão específica. As notas antigas `NOTAS-v827-*.md` seguem um
padrão de nome diferente (histórico anterior à convenção atual) mas continuam válidas como
registro do que já foi decidido.
