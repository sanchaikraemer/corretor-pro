# Telas reais — cadastro, login e painel administrativo

Diferente do `prototipo-contas-empresas/` (que usa dados de mentira), esta pasta fala
DIRETO com o Supabase real do Corretor Pro, usando a `anon key` pública (ver `paginas/config.js`
— essa chave é segura de estar aqui, é feita pra ser pública; a proteção de verdade é a RLS
configurada no banco).

**Ainda não faz parte do site publicado** — não está na lista do `build.js`, então não vai pro
ar sozinha.

## Como rodar localmente

```
cd contas-reais
node server.js
```

Abre em `http://localhost:4301` (a tela de login).

## Arquivos

- `paginas/cadastro.html` — cadastro público, cria empresa nova + teste de 7 dias.
- `paginas/login.html` — login, mostra status do teste/pagamento.
- `paginas/admin.html` — painel do administrador da plataforma (só quem está na tabela
  `platform_admins` consegue entrar).

## Testado

A lógica de segurança (RLS, função `criar_empresa_e_dono`, painel administrativo) foi testada
rodando de verdade contra um banco Postgres local simulando o Supabase — ver
`supabase/migrations/README.md`. As telas HTML em si (o clique de verdade contra o Supabase de
produção) ainda precisam de um teste manual — ver `PROXIMOS-PASSOS-CONTAS.md` na raiz do
projeto.
