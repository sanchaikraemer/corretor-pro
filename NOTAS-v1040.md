# NOTAS v1040 — Trava real contra empresa duplicada, organization_id obrigatório, search_path fixo

## O pedido

Depois de resolver a publicação travada (v1039), o dono pediu pra seguir avançando pela lista de
pendências da auditoria, deixando de fora só cobrança automatizada e o app nativo do iPhone —
"o restante vamos fazer agora em diante e durante a madrugada". Este é o primeiro pacote: os três
achados de banco de dados que ainda faltavam (itens 5.2, 5.3 e 5.4 da auditoria).

## As três correções (migração `0009_travas_concorrencia_e_search_path.sql`)

### 1. Empresa duplicada por login (item 5.3)

`criar_empresa_e_dono` já tinha uma checagem ("este login já tem empresa? then recusa") desde a
v1006 — mas é uma checagem no **código** (lê, decide, grava), não uma trava no **banco**. Duas
chamadas simultâneas (dois cliques rápidos, ou um script) podiam passar pela checagem antes de
qualquer uma terminar de gravar, criando duas empresas — e dois testes grátis de 7 dias — pro
mesmo login.

Agora existe uma restrição única de verdade em `memberships(user_id)`: o próprio Postgres recusa
a segunda gravação simultânea. A função foi ajustada pra capturar esse erro e desfazer a empresa
que tinha acabado de criar (sem dono, órfã) antes de devolver a mensagem de erro — sem isso,
ficaria uma organização fantasma no banco toda vez que a trava disparasse.

### 2. `organization_id` opcional em `whatsapp_processamentos` (item 5.4)

Essa é a tabela principal de leads. A coluna existia desde a migração 0001, mas era opcional —
o código sempre preenche, mas nada no banco IMPEDIA um insert futuro sem organização (o que
criaria um lead que nenhuma empresa consegue enxergar). Agora é obrigatória. Antes de travar,
a migração preenche qualquer linha esquecida com a empresa original (mesma lógica já usada na
migração 0002), pra nunca falhar por causa de um dado antigo incompleto.

### 3. `search_path` fixo nas funções `SECURITY DEFINER` (item 5.2)

As 4 funções do banco que rodam com privilégio elevado (`minhas_organizacoes`,
`is_platform_admin`, `criar_empresa_e_dono`, `excluir_organizacao`) não fixavam `search_path`.
Prática recomendada do Postgres pra qualquer função `SECURITY DEFINER`: sem isso, em teoria, um
objeto com o mesmo nome de uma tabela/função real, criado num schema que entre antes de `public`
na busca de quem chama, poderia ser usado no lugar do objeto verdadeiro. Não era um problema já
observado no sistema, mas é a defesa correta a ter.

## Verificação

- Novo teste `tests/v1040-travas-concorrencia-e-search-path.test.mjs`: confirma estaticamente (não
  há banco real disponível nesta sessão) que a migração contém a restrição única, o tratamento do
  erro de concorrência com limpeza da organização órfã, o preenchimento defensivo antes do NOT
  NULL, e o `search_path` fixo nas 4 funções — sem afrouxar a revogação de `excluir_organizacao`.
- `npm test`: suíte inteira verde.
- `npm run build`: build limpo.

## Importante: a migração ainda precisa ser aplicada no banco real

Mesmo aviso de sempre (esta sessão não tem acesso ao Supabase de produção — ver CLAUDE.md):

1. Painel do Supabase → **SQL Editor** → **New query**.
2. Cole o conteúdo de `supabase/migrations/0009_travas_concorrencia_e_search_path.sql` inteiro e
   clique em **Run**.

Se o primeiro passo (a restrição única) falhar com erro de "duplicate key value", significa que
já existe, na base real, mais de uma empresa vinculada ao mesmo login — o que não deveria
acontecer, mas se acontecer, a mensagem mostra qual login está duplicado. Nesse caso, pare e me
avise antes de decidir qual das duas empresas manter; o resto da migração continua seguro de
aplicar em blocos separados.

## Arquivos

`supabase/migrations/0009_travas_concorrencia_e_search_path.sql` (novo),
`tests/v1040-travas-concorrencia-e-search-path.test.mjs` (novo), `package.json`/
`package-lock.json` (versão + script `test`), `NOTAS-v1040.md`, versão **1039 → 1040**.
