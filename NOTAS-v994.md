# v994 — login liga no sistema principal, mas só pra empresa original (por enquanto)

## Contexto

Depois do v993 (cache corrigido), o dono confirmou que o fluxo de cadastro/teste/login/painel
administrativo funciona de ponta a ponta, e pediu o próximo passo: depois de logar em
`entrar.html`, a pessoa deveria cair direto no sistema principal (o mesmo que o dono usa todo
dia), em vez de ficar parada na tela de login com "Login confirmado ✓" sem ir a lugar nenhum.

Antes de mexer, o dono pediu explicitamente pra eu revisar e prever problemas.

## O problema encontrado antes de mexer

O sistema principal (`index.html`/`app.js` + as rotas em `api/`) foi construído pra um dono só.
`api/_persistence.js` — usada por toda rota que lê ou grava cliente — não filtra nenhuma consulta
por empresa (`organization_id`): `whatsapp_processamentos`, `leads`/`direciona_leads` são lidos e
gravados globalmente, sem checar "de qual empresa é isso". A única proteção hoje é uma chave
única compartilhada (`X-Corretor-Pro-Key`), a mesma pra qualquer pessoa que a tenha.

Se o login novo fosse ligado direto nesse sistema pra QUALQUER empresa, uma empresa nova (como a
"Senger" criada em teste) entraria e veria os clientes reais do dono — e o dono, ao usar o
sistema, poderia ver os dados da Senger. Dado comercial de um cliente vazando pra outro.

## Decisão (com o dono)

Duas opções foram colocadas: (1) fazer a separação completa de dados agora, algo maior e mais
lento; (2) publicar uma versão seguindo o padrão de sempre, sem esperar a separação inteira: só a
empresa original entra direto no sistema completo; qualquer empresa nova fica numa tela de espera
até a separação estar pronta. O dono escolheu a opção 2.

## O que mudou

- `contas-config.js`: expõe `CORRETOR_PRO_EMPRESA_PRINCIPAL_ID`, o id fixo da "Empresa 1"
  (criado na migração `0002_migrar_dados_existentes.sql` — não é segredo, é só um identificador).
- `entrar.html`: depois de confirmar o login e que a empresa não está bloqueada/com teste
  vencido, compara o id da empresa logada com `CORRETOR_PRO_EMPRESA_PRINCIPAL_ID`:
  - **É a empresa principal** → mostra "Abrindo o sistema..." e redireciona pra `/` (o sistema
    principal) depois de meio segundo.
  - **É outra empresa** (qualquer cadastro novo) → mostra uma mensagem tranquilizando que o
    cadastro e o teste grátis estão confirmados, e que a parte completa do sistema está quase
    pronta, sem redirecionar — fica só na própria página, sem risco de ver dado de ninguém.

Isso NÃO troca a proteção por chave única do sistema principal — quem entrar como empresa
principal e nunca tiver salvo a chave no aparelho continua vendo a mesma pergunta de chave de
sempre (nada muda nesse ponto pra quem já usa o sistema hoje).

## O que ainda falta (próxima etapa, maior)

Revisar `api/_persistence.js`, `api/_pipeline.js` e as rotas de `api/` pra cada consulta passar a
filtrar por `organization_id` derivado do login de cada empresa — só depois disso for feito e
testado é seguro abrir o sistema completo pra empresas novas.

## Testes

Novo `tests/v994-login-empresa-principal-vai-pro-sistema.test.mjs`: confirma que o id usado em
`contas-config.js` bate com o da migração real, que o redirecionamento em `entrar.html` só
acontece DENTRO da checagem "é a empresa principal" (nunca incondicional), e que empresas fora
disso recebem a mensagem de espera.

`npm test`: suíte inteira verde.

## Arquivos

`contas-config.js` (novo id exposto), `entrar.html` (redirecionamento condicional),
`tests/v994-login-empresa-principal-vai-pro-sistema.test.mjs` (novo), `package.json`/
`package-lock.json`, `NOTAS-v994.md`, versão **993 → 994**.
