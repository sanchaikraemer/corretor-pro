# v1151 — erro de cadastro em português, com o que fazer

Print do dono criando a segunda conta de teste: a tela mostrou

> **Erro ao criar conta: User already registered**

Em inglês, cru do provedor de login, sem dizer o que fazer. Ele está começando a vender pra
corretores — um corretor que topa nisso no cadastro desiste ali.

## O que mudou

As falhas que o corretor pode ver de verdade agora aparecem em português **com a ação ao lado**:

| Situação | O que ele vê |
|---|---|
| E-mail já tem conta (o caso do print) | "**Esse e-mail já tem conta.** Use outro e-mail, ou entre com este." + atalhos **Entrar** e **Esqueci minha senha** |
| E-mail escrito errado | "**E-mail inválido.** Confira se está escrito certinho (exemplo: nome@gmail.com)." |
| Senha curta | "**Senha curta.** Use pelo menos 6 caracteres." |
| Muitas tentativas seguidas | "**Muitas tentativas em pouco tempo.** Espere um minuto e tente de novo." |
| Sem internet | "**Sem conexão.** Confira a internet do aparelho e toque em criar conta de novo." |

Duas regras que ficaram travadas por teste:

- **nada é engolido**: uma falha fora dessa lista continua aparecendo com o motivo original
  ("Não consegui criar a conta agora: …") — texto estranho é melhor que nenhuma informação;
- a mensagem da **trava contra cadastro falso em massa** (que o servidor já devolve em português)
  não é reescrita.

## Validação

| Verificação | Resultado |
|---|---|
| Suíte completa | 323 testes verdes |
| Teste novo | `v1151-erro-de-cadastro-em-portugues` (o erro cru não vai mais pra tela; cada falha comum tem texto em português; e-mail repetido oferece Entrar e Esqueci a senha; falha desconhecida continua visível) |
| `npm run build` | ok, versão 1151 |

## Arquivos alterados

**Código:** `cadastro.html` · **Documentação:** `NOTAS-v1151.md` (novo) · **Versão:**
`package.json`, `package-lock.json` · **Testes:** `tests/v1151-erro-de-cadastro-em-portugues.test.mjs` (novo)
