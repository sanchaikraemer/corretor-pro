# v995 — o produto é pra corretor individual, não pra imobiliária/empresa

## Contexto

O dono corrigiu o rumo do produto: o Corretor Pro é pra corretores de imóveis individuais, não
pra imobiliárias ou empresas com equipe. As páginas de cadastro, login e o painel administrativo
ainda falavam em "empresa"/"imobiliária" — herança de quando o sistema de contas foi desenhado
(a estrutura por trás sempre foi "uma conta = um dono só", isso não mudou; era só a linguagem nas
telas que dava a impressão errada de que seria pra várias pessoas numa mesma conta).

## O que mudou (só linguagem nas telas, nada de estrutura)

- `cadastro.html`: campo "Nome da sua imobiliária/empresa" → "Seu nome"; placeholder de exemplo
  trocado de "Imobiliária Nova Vista" pra um nome de pessoa; mensagem de campo vazio ajustada.
- `entrar.html`: "Cada corretor/imobiliária entra com sua própria conta" → "Cada corretor entra
  com sua própria conta"; mensagens de status (teste acabou, login confirmado, espera) trocam
  `"empresa"` por linguagem de conta pessoal, usando o nome do corretor de forma natural em vez
  de citar "empresa X".
- `admin-plataforma.html`: coluna "Empresa" → "Corretor"; "Todas as empresas cadastradas" →
  "Todos os corretores cadastrados".

Não mudou (de propósito, é só encanamento interno que ninguém vê): nomes de tabelas no banco
(`organizations`, `memberships`), a função `criar_empresa_e_dono` e variáveis internas do código
como `minhaEmpresa`. Continuam guardando "uma conta = um corretor" exatamente como antes — só o
texto que o corretor lê na tela é que deixou de soar como coisa de empresa.

## Testes

Novo `tests/v995-produto-e-pra-corretor-individual.test.mjs`: garante que "imobiliária" não
aparece em `cadastro.html`/`entrar.html` e que o painel administrativo lista "Corretor", não
"Empresa" — trava contra essa linguagem voltar por engano numa próxima edição.

`npm test`: suíte inteira verde. `node build.js`: build limpo.

## Arquivos

`cadastro.html`, `entrar.html`, `admin-plataforma.html` (linguagem ajustada),
`tests/v995-produto-e-pra-corretor-individual.test.mjs` (novo), `package.json`/
`package-lock.json`, `NOTAS-v995.md`, versão **994 → 995**.
