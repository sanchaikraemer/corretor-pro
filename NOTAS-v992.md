# v992 — botão de mostrar senha + aviso certo de e-mail já cadastrado

## Contexto

O dono testou o cadastro de verdade e encontrou dois problemas:
1. Pediu um ícone de "olho" pra ver a senha digitada, comum em qualquer formulário.
2. Testou com um e-mail que já tinha conta (o próprio, criado de madrugada como
   administrador) e a tela mostrou "Conta criada! Confirme seu e-mail..." — mensagem
   enganosa, porque nenhuma conta nova foi criada.

## Causa do segundo problema

O Supabase, por segurança, não avisa diretamente que um e-mail já está cadastrado (pra não
deixar alguém descobrir e-mails de terceiros só tentando cadastrar). Quando isso acontece,
`auth.signUp()` devolve uma resposta "de sucesso" fingida: sem erro, sem sessão — exatamente
igual ao caso real de "cadastro pendente de confirmação por e-mail". A forma documentada de
diferenciar os dois casos é olhar `data.user.identities`: vem vazio quando o e-mail já existia,
e com pelo menos um item quando é um cadastro genuinamente novo.

## O que mudou

- `cadastro.html`, `entrar.html` e `admin-plataforma.html`: campo de senha agora tem um botão
  de olho (ícone SVG, mesmo estilo dos ícones do resto do app — nada de emoji) que alterna
  entre mostrar e ocultar o texto digitado. Primeira versão usava emoji (👁/🙈); o dono achou o
  macaquinho deslocado num sistema comercial sério, então foi trocado por um ícone de traço
  minimalista igual aos já usados no app principal.
- `cadastro.html`: ao detectar `identities` vazia, mostra "Esse e-mail já tem uma conta. Em vez
  de criar outra, clique em 'Entrar'." em vez da mensagem de sucesso incorreta.

## Testes

Novo `tests/v992-olho-senha-e-email-duplicado.test.mjs`: confirma o botão de olho e a função
`alternarSenha` nas 3 páginas, e a checagem de `identities` vazia + mensagem certa em
`cadastro.html`.

Testado visualmente com captura de tela em viewport de celular: preenchi a senha, cliquei no
olho, confirmei que o campo alterna entre oculto/visível e o ícone troca corretamente.

`npm test`: suíte inteira verde. `node build.js`: build limpo, 22 arquivos publicados.

## Arquivos

`cadastro.html`, `entrar.html`, `admin-plataforma.html` (botão de olho; cadastro.html também
ganha a checagem de e-mail duplicado), `contas-estilo.css` (estilo do botão de olho),
`tests/v992-olho-senha-e-email-duplicado.test.mjs` (novo), `package.json`/`package-lock.json`,
`NOTAS-v992.md`, versão **991 → 992**.
