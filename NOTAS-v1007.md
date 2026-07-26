# v1007 — nome da conta na saudação/lateral + botão "Sair da conta"

## Contexto

Testando o fluxo novo no celular, o dono pediu: (1) a saudação da Home deve mostrar o nome de
quem se cadastrou, não "corretor" genérico; (2) precisa de um jeito de SAIR da conta dentro do
app pra conseguir trocar de login no mesmo aparelho (ex.: entrar com a conta de teste).

De quebra, saiu um problema real: a lateral do app tinha o nome do dono CRAVADO no código
("Sanchai" fixo no index.html) — proibido pelas regras do projeto, e todo corretor novo veria
o nome do dono ali.

## O que mudou

- `index.html`: o bloco de usuário da lateral virou dinâmico (nome + inicial do avatar), e
  ganhou o botão **Sair da conta** (com ícone), que só aparece quando existe sessão de login
  neste aparelho — nos aparelhos que usam a chave compartilhada (o app de hoje do dono), nada
  aparece nem muda.
- `app.js`:
  - Ao abrir o app com sessão de login, busca o nome da conta (organizations.nome — o que a
    pessoa preencheu no cadastro; a RLS garante que só o próprio vínculo é visível) e preenche
    saudação e lateral. Prioridade do nome: o que estiver escrito no campo "Nome do corretor"
    do Cérebro > nome da conta logada > "corretor" genérico.
  - "Sair da conta": encerra a sessão de verdade (signOut) e volta pra tela de entrar.
  - O cliente supabase do navegador foi centralizado num helper único (mesmo usado pra anexar
    a sessão nas chamadas, v1004).

## Testes

Novo `tests/v1007-nome-da-conta-e-sair.test.mjs`: sem nome de pessoa cravado no index; espaço
dinâmico e botão presentes; signOut de verdade + volta pra entrar; nome vindo do cadastro;
ordem de prioridade da saudação.

`npm test`: suíte inteira verde. `node build.js`: build limpo.

## Arquivos

`index.html`, `app.js`, `tests/v1007-nome-da-conta-e-sair.test.mjs` (novo),
`package.json`/`package-lock.json`, `NOTAS-v1007.md`, versão **1006 → 1007**.
