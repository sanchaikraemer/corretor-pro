# v1150 — o tutorial aparece pra CADA conta nova (não uma vez por celular)

Pergunta do dono depois da v1149: *"se eu entrar agora, criar um usuário novo, eu vou ter esse
tutorial então?"*

Boa pergunta — e a resposta, com a v1149 como estava, seria **não** no cenário que ele vai usar de
verdade. A marca de "já vi o passo a passo" era guardada **por aparelho**. No teste ele vai criar
contas novas **no mesmo celular**: a primeira conta veria o tutorial, e todas as seguintes (ou uma
conta nova criada depois de ele abrir a própria conta, que já tem clientes) **não veriam nada**.

## O que mudou

A marca passou a ser **por conta**: o app guarda quem está logado (`window.__cpContaId`, do login do
Supabase) e a chave do "já vi" leva esse identificador. Assim:

- **conta nova = tutorial na primeira abertura**, mesmo no celular onde outra conta já viu;
- quem já viu não é incomodado de novo;
- quem já tem cliente na carteira nunca é interrompido;
- sem login identificado (caminho antigo por chave compartilhada), cai numa chave geral — igual ao
  comportamento anterior.

## Validação

| Verificação | Resultado |
|---|---|
| Suíte completa | 322 testes verdes |
| Teste ajustado | `v1149-tutorial-como-enviar-conversa` ganhou a checagem da chave por conta e do id da sessão |
| `npm run build` | ok, versão 1150 |

## Arquivos alterados

**Código:** `app.js` · **Documentação:** `NOTAS-v1150.md` (novo) · **Versão:** `package.json`,
`package-lock.json` · **Testes:** `tests/v1149-tutorial-como-enviar-conversa.test.mjs`
