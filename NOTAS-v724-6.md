# v724-6 — Mostra o motivo real de a mensagem não ter sido gerada (sem DevTools)

## Contexto
A v724-5 corrigiu um bug real e comprovado por teste automatizado (campo
`diagnostico.mensagemQueEuEnviariaHoje` órfão enganando o front). Mas o
"Eder Premium" continuou preso em "Mensagem ainda não gerada" mesmo depois
do deploy, e não há como eu (assistente) acessar a OpenAI/Supabase de
produção nem os logs do Vercel desse projeto pra investigar de dentro —
e pedir pra abrir o DevTools não é viável pro usuário.

## O que esta versão faz
Em vez de mais uma hipótese, o app agora **mostra o motivo real** dentro do
próprio card "Mensagem recomendada" quando ela não é gerada — nenhum passo
técnico, só olhar a tela. Uma caixinha aparece com, quando existir:
- O `mode` da análise (`erro_api` / `reconciliacao_local`) e o erro do provedor.
- O aviso salvo pelo servidor (`avisoReanalise`).
- A última nota de validação (`validacaoSugestoes`).
- Se a IA devolveu ALGUMA mensagem: nenhuma das 3, ou só a A (faltando B/C).

## Por que isso resolve o impasse
Com essa caixinha, o próximo print da tela já traz o dado real (o que a API
respondeu de fato), sem precisar de Network tab nem F12 — só reanalisar e
olhar embaixo de "Mensagem ainda não gerada".

## Teste
1. Subir os arquivos.
2. Confirmar topo `Atualização #724-6`.
3. Reanalisar o "Eder Premium".
4. Se a mensagem não aparecer, a caixinha tracejada abaixo do aviso deve
   mostrar o motivo real — manda um print dela.
