# v980 — contas individuais por corretor (login real, isolamento de dados, teste grátis, admin)

## Contexto

Pedido direto do dono: o Corretor Pro vai virar produto de venda. Ele quer, por enquanto,
2 contas (a dele + 1 de teste) com: login próprio, dados/Cérebro isolados por conta, teste
grátis de 7 dias, bloqueio automático depois disso, e liberação manual por ele após pagamento
(controlado fora do sistema por enquanto). Ele também enviou um projeto anterior dele mesmo,
o **LeveCRM** (`testecrm-main`), que já validou em produção exatamente esse modelo — login via
Supabase Auth, isolamento por `access_user_id` + RLS, teste de 7 dias automático. Esta versão
porta esse padrão já comprovado para o Corretor Pro, adaptado à arquitetura atual (rotas
`api/*.js` protegidas, não PostgREST direto do navegador para tudo).

O próprio código do LeveCRM (`loadAccessAdmin` em app.js dele) admite que a tela de
administrador para gerir outras contas nunca foi construída ali — "ficou fora do HTML de
propósito, por segurança... o certo é uma rota administrativa". É exatamente essa peça que
faltava e que esta versão entrega (`api/admin-contas.js`), aproveitando que o Corretor Pro já
tem uma camada de rotas protegidas que o LeveCRM (estático, GitHub Pages) não tinha.

**Este pacote NÃO foi mesclado/publicado automaticamente.** Mexe em estrutura de banco e na
trava de "quem pode usar" ligada a pagamento — as duas exceções explícitas no CLAUDE.md ao
fluxo normal de "corrigir e publicar direto". Fica em Pull Request para o dono revisar, e só
funciona depois de passos manuais dele (seção final deste arquivo).

## O que foi construído

### 1. Banco (`supabase/migrations/0001_contas_e_isolamento_por_corretor.sql`)
- Tabela `profiles` (1 linha por conta): `account_status` (trial/active/blocked), `trial_end`,
  `license_end`.
- Função `is_corretor_pro_admin()` — reconhece o administrador pelo e-mail do login (mesmo
  padrão do LeveCRM), sem tabela de permissões separada.
- Trigger em `auth.users` — ao se cadastrar, cria o `profile` automaticamente com 7 dias de
  teste.
- Coluna `owner_id` adicionada (via `add column if not exists`, não destrutivo) em
  `whatsapp_processamentos`, `leads`, `direciona_leads`, `direciona_config` — com RLS
  (`owner_id = auth.uid() OR is_corretor_pro_admin()`).
- `direciona_config` é caso especial: a chave `chave` deixa de ser `PRIMARY KEY` sozinha e
  passa a ser única em `(chave, owner_id)` — cada conta tem seu próprio Cérebro para a mesma
  chave `direciona-cerebro`.
- Idempotente (mesmo padrão dos scripts `supabase-correcao-v44/v51.sql` do LeveCRM): pode rodar
  de novo sem quebrar.

### 2. Identidade e trava de acesso (`api/_auth.js`, novo)
- `autenticarConta(req)` / `requireAccount(req, res)` — valida o token Supabase enviado pelo
  navegador (`Authorization: Bearer`) via `anon.auth.getUser(token)`, busca o `profile` com a
  chave de serviço, e devolve `{ userId, email, isAdmin, acesso }`. Nunca confia em nada vindo
  do corpo da requisição para decidir identidade.
- `avaliarStatusDaConta(profile)` — mesma regra do `accessPlanMessage` do LeveCRM, decidida no
  servidor (a tela pode mostrar o mesmo texto, mas quem barra de verdade é o backend).
- `requireDonoDoRegistro(supabase, tabela, id, conta, res)` — portão único: confere se um
  registro específico pertence à conta antes de qualquer rota ler/alterar/apagar ele. Evita
  espalhar `.eq('owner_id', ...)` em cada função interna (mesma lição do `/api/analisar` sem
  senha — um ponto central é mais difícil de esquecer que muitos pontos espalhados).
- Modo de teste: `NODE_ENV=test` devolve uma conta de mentira (admin, licença ativa) —
  mesmo padrão que `requireApiKey` já usa em `_persistence.js` para o mesmo problema (suíte não
  sobe um Supabase de verdade).

### 3. Rotas atualizadas para isolar por conta
- `api/lead-update.js` — autentica a conta; portão único de dono antes do `switch` de ações por
  `id`; as 3 ações que criam lead novo (`salvar-novo`, `criar-manual`,
  `nova-oportunidade-parceiro`) carimbam `ownerId`; `nova-oportunidade-parceiro` também confere
  o dono do contato de origem (não passava pelo portão único porque não exige `id` para criar,
  só para ler a origem); `apagar` em lote agora só enxerga IDs da própria conta.
- `api/processar-storage.js` — autentica a conta; `_buscarProcessamentoExistenteV681` (reaproveita
  transcrição por lead) e a leitura de `existingLeadId` (ação `analisar`) passam a considerar o
  dono.
- `api/leads-recentes.js` — autentica a conta; listagem normal filtra por `owner_id`; auditoria
  (`?audit=1`) e backup completo (`?export=full`) — que enxergam TODAS as contas de propósito —
  passam a exigir administrador; cache de resposta (antes global) agora é por conta
  (`${userId}:${limit}`), senão a resposta de uma conta podia vazar pra outra dentro da janela
  de 5s de cache.
- `api/cerebro-config.js` — autentica a conta; leitura/gravação do Cérebro (GET, save padrão,
  `intel-update`, `limpar-aprendizado-completo`, `exportar-aprendizado`) passam `ownerId`.
- `api/_persistence.js` — `persistProcessingResult`, `_buscarProcessamentoExistenteV681` e
  `buscarAvatarAnterior` aceitam `ownerId` (default `null`, retrocompatível); `listRecentProcessings`
  aceita `options.ownerId`.

### 4. Rota de administrador (`api/admin-contas.js`, novo)
- `listar` — todas as contas com situação calculada (`teste_ativo` / `licenca_ativa` /
  `bloqueado` / `expirado`).
- `liberar` — define `account_status='active'` e `license_end` = agora + N dias (padrão 30).
- `bloquear` / `reativar`.
- Exige `requireAccount` + `conta.isAdmin` — a peça que o próprio LeveCRM deixou pendente.

### 5. Front-end
- `api/auth-config.js` (novo) — entrega ao navegador a URL do Supabase e a chave `anon`
  (pública por design; quem protege é a RLS, não o sigilo desta chave). Ainda exige a chave de
  segurança compartilhada nesta fase (cadastro só entre convidados, não público).
- `js/auth.js` (novo módulo) — login/cadastro/sessão, adaptado do fluxo já validado do LeveCRM
  (`accessLogin`/`accessRegister`/`accessPlanMessage`) para os nomes e o estilo do Corretor Pro;
  painel de administrador (`carregarAdminContas`, liberar/bloquear).
- `index.html` — portão de acesso (`#cpAuthGate`, login/cadastro/bloqueado), tela
  `#adminContas` (menu Configurações → "Administrar contas", só visível para o admin), inclui
  `vendor/supabase.js`.
- `app.js` — importa `js/auth.js`; o fetch global (`protegerChamadasApiV682`) agora também
  anexa `Authorization: Bearer <token da sessão>` em toda chamada a `/api` (a chave
  compartilhada continua, como segunda trava); o boot (`iniciarDireciona`) só roda depois que
  `iniciarPortaoDeAcesso` confirmar acesso liberado.
- `build.js` — vendoriza `@supabase/supabase-js` localmente (`node_modules/.../dist/umd/supabase.js`
  → `public/vendor/supabase.js`), mesmo padrão já usado para o JSZip — sem CDN, sem abrir exceção
  na política de segurança do site (CSP já permitia `connect-src` para `*.supabase.co`, só
  faltava o script em si vir de algum lugar confiável).

## O que ficou de fora, de propósito, por agora

- **Aprendizado automático** (`aprender-carteira`, `processar-aprendizado-pendente`,
  `finalizar-bootstrap-aprendizado` em `api/cerebro-config.js`, e as funções de aprendizado em
  `api/_pipeline.js`) ainda lê/grava sem filtrar por conta. Funciona hoje porque só existe uma
  conta de verdade em uso. **Precisa da mesma revisão antes de liberar a segunda conta de teste
  para valer** — registrado como próximo passo, não escondido.
- Cadastro público (qualquer pessoa se cadastrar sozinha) não foi construído — hoje o cadastro
  existe (`accessRegister`/`signUp`), mas a expectativa combinada com o dono é de convidar
  manualmente as 2 primeiras contas antes de abrir de vez.
- Chave de ativação por código (`redeem_license_key`, do jeito que o LeveCRM fez) não foi
  portada — o dono descreveu controle manual ("eu libero direto"), o botão "Liberar" do painel
  de administrador cobre exatamente isso, mais simples que pedir código de ativação.

## Verificação

- `npm test`: suíte inteira verde (154 checks), incluindo `v980-contas-isolamento` (novo) —
  cobre `avaliarStatusDaConta` (teste ativo/vencido, licença ativa/vencida, bloqueado) e varre o
  texto das rotas confirmando que nenhuma ficou sem a checagem de dono (mesmo espírito do
  `v963-todas-rotas-exigem-api-key`).
- Corrigido de quebra um teste existente que ficou "verde por engano"
  (`boot-route-restore.test.mjs` usava `indexOf('requestAnimationFrame(iniciarDireciona)')` como
  fim de um recorte de texto; a chamada mudou de forma, o `indexOf` passou a devolver -1, e
  `slice(x, -1)` silenciosamente cresceu até quase o fim do arquivo inteiro em vez de encolher —
  o teste continuava "passando" sem checar o que dizia checar).
- `npm run build`: build limpo, 18 arquivos publicados (+1: `vendor/supabase.js`).
- **Não testado**: fluxo real de login/cadastro contra um Supabase de verdade (esta sessão não
  tem essas credenciais, ver CLAUDE.md) — a lógica replica de perto o que já roda em produção no
  LeveCRM, mas o dono precisa validar na prática antes de confiar 100%.

## Passos manuais do dono antes disso funcionar (nenhum deles foi feito por esta sessão)

1. Colar `supabase/migrations/0001_contas_e_isolamento_por_corretor.sql` inteiro no SQL Editor
   do Supabase do Corretor Pro e rodar.
2. Configurar na Vercel: `SUPABASE_ANON_KEY` (a chave "anon"/"public" do projeto Supabase —
   Project Settings → API). `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já devem existir.
3. Publicar esta versão (fazer o merge do Pull Request) só depois dos passos 1 e 2 — sem eles a
   tela de login mostra erro de configuração, mas o resto do site continua funcionando (a
   trava de acesso "abre" sozinha nesse caso, então não vale publicar sem antes rodar o SQL).
4. Criar a própria conta pela tela nova, pegar o "User UID" em Authentication → Users no
   Supabase, e rodar o bloco de `update` no fim do arquivo de migração (troca `owner_id` de
   `null` para o UID em todas as linhas antigas) — sem isso os leads/Cérebro de hoje ficam
   "órfãos" (visíveis só para o administrador, não aparecem na carteira da conta nova).

## Arquivos

- `supabase/migrations/0001_contas_e_isolamento_por_corretor.sql` (novo), `api/_auth.js` (novo),
  `api/admin-contas.js` (novo), `api/auth-config.js` (novo), `js/auth.js` (novo),
  `api/lead-update.js`, `api/processar-storage.js`, `api/leads-recentes.js`,
  `api/cerebro-config.js`, `api/_persistence.js`, `app.js`, `index.html`, `styles.css`,
  `build.js`, `tests/v980-contas-isolamento.test.mjs` (novo),
  `tests/boot-route-restore.test.mjs` (corrigido), `package.json`/`package-lock.json`,
  `NOTAS-v980.md`, versão **979 → 980**.
