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

_Atualizado pela última vez na v1068 (28/07/2026) — a seção 8 (pendências) estava desatualizada
desde a v1043: apontava que política de privacidade e termos de uso "ainda não existiam", mas as
duas páginas já foram publicadas na v1045 (só faltam os dois campos de identificação do responsável
e a revisão jurídica, ver seção 8). A v1068 também trouxe uma nova auditoria completa (segurança,
comercial e código morto) — ver `NOTAS-v1068.md` e a seção 8 atualizada._

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
`limpar-tudo.js`, junto com o botão "Apagar tudo" — decisão do dono). **Hoje são 10, com 2 vagas
livres.**

| Rota | O que faz |
|---|---|
| `admin-contas.js` | Painel administrativo: excluir conta (`POST action:excluir-conta`) e relatório de uso de IA por empresa (`GET ?relatorio=uso-ia`) — as duas exclusivas do administrador da plataforma. |
| `atalho-zip-token.js` | Gera/mostra a chave pessoal do Atalho do iPhone (ver `NOTAS-v1035.md`). |
| `cerebro-config.js` | Configuração do Cérebro Comercial + aprendizado contínuo. |
| `diagnostico.js` | `?mode=status` (variáveis de ambiente configuradas), `?mode=openai` (teste real da chave OpenAI), `?mode=bucket` (configura o bucket do Storage — só admin). |
| `lead-update.js` | Ações sobre um lead: etapa (só Ativo/Geladeira), memória, aprendizado, lembrete, apagar, editar, salvar novo, criar manual, etc. Nota (v1092): `lembrete-set`/`lembrete-clear` foram REMOVIDAS — o histórico do repositório mostra que nenhuma tela as chamou em nenhum momento do projeto (o app usa `reagendar-lembrete`/`remover-lembrete` de reanalisar-lead.js). Já `analise-comercial-set` e `nova-oportunidade-parceiro` continuam de propósito: as chamadas saíram do front só na v1073 (29/07/2026) e, como o app é PWA instalável, um celular que não abriu o app desde então ainda roda a versão em cache que as chamaria. Remover agora daria erro pra quem está desatualizado — sair numa faxina futura. |
| `leads-recentes.js` | Listagem da Carteira + auditoria de qualidade dos dados (`?audit=1`) + backup completo (`?export=full`) — as três sempre filtradas pela própria empresa (ver `NOTAS-v1037.md`). |
| `processar-storage.js` | Pipeline de importação por Storage: criar URL de upload (absorveu `criar-upload-url.js`, ver `NOTAS-v1039.md`), preparar, transcrever, analisar, finalizar, limpar antigos. |
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
- `CORRETOR_PRO_LIMITE_ANALISES_DIA` — teto de segurança de análises por dia por empresa (padrão 200).
- `CORRETOR_PRO_LIMITE_ANALISES_DIA_TESTE` — mesmo teto, mas pra contas em teste grátis (padrão 5
  desde a v1109; era 10 na v1108 e 25 antes — ver `NOTAS-v1041.md`, `NOTAS-v1108.md`,
  `NOTAS-v1109.md`). **Atenção:** se essa variável estiver cadastrada na Vercel, ela MANDA sobre
  o padrão do código — confira lá antes de esperar o teto novo valer.
- `CORRETOR_PRO_WHATS_COMERCIAL` — WhatsApp comercial da plataforma (só dígitos, com código do
  país), usado no convite de contratação quando a conta em teste atinge o limite diário (v1108).
  Padrão embutido: o número do dono do produto.
- **Planos comerciais (v1110, recalibrados na v1111)** — Pro: 15/dia + 150/mês; Pro Master:
  30/dia + 300/mês (acima disso, plano personalizado negociado no WhatsApp). O plano
  de cada conta fica em `direciona_config` (chave `plano-contratado`), definido pelos botões
  "Pago · Pro" / "Pago · Pro Master" do painel administrativo (que também marcam a conta como
  ativa). Conta ativa sem registro = Pro. A conta original fica FORA dos planos (só o fusível
  técnico de `CORRETOR_PRO_LIMITE_ANALISES_DIA`, padrão 200/dia). Overrides:
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

**Importante**: esta sessão não tem acesso ao Supabase de produção (ver `CLAUDE.md`). Não há
confirmação automática de quais migrações já foram de fato aplicadas no banco real — isso precisa
ser conferido com o dono, ou visto diretamente no SQL Editor do Supabase (`\d nome_da_tabela` ou
a lista de funções). Se uma rota começar a falhar com erro citando uma tabela/coluna/função que
"não existe", o mais provável é uma migração ainda não aplicada.

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

- **Confirmação de e-mail no cadastro** — o código já suporta (`cadastro.html`), só falta ligar a
  opção "Confirm email" no painel do Supabase (Authentication → Providers → Email). Ação manual do
  dono.
- **Captcha no cadastro** — dá pra fazer (Supabase suporta hCaptcha/Turnstile), mas exige criar
  conta num provedor externo — combinar com o dono antes.
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
- **Cobrança/assinatura automatizada** — hoje o "virar pago" é manual, pelo botão "Marcar pago" no
  painel administrativo. Não há integração com nenhum meio de pagamento.
- **App nativo pro iPhone** (aparecer direto no botão Compartilhar do WhatsApp, como no Android) —
  projeto à parte, não iniciado; o Atalho do iPhone (Shortcuts) já cobre a mesma necessidade de um
  jeito mais manual (ver `NOTAS-v1035.md`).

## 9. Onde encontrar mais detalhes

Cada mudança relevante tem sua própria nota de versão em `NOTAS-vNNN.md` — comece pelas mais
recentes se quiser entender uma decisão específica. As notas antigas `NOTAS-v827-*.md` seguem um
padrão de nome diferente (histórico anterior à convenção atual) mas continuam válidas como
registro do que já foi decidido.
