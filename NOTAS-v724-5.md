# v724-5 — Campo órfão travava a mensagem mesmo com a A pronta

## Problema encontrado (rastreado, não suposto)
Mesmo com a v724-4 (mais tokens), o "Eder Premium" continuava preso em
"Mensagem ainda não gerada". Encontrei a causa seguindo o valor exato do campo
que trava o front:

1. `api/_pipeline.js`: `diagnostico.mensagemQueEuEnviariaHoje` recebia a
   mensagem A (`msgA`) **mesmo quando B ou C vinham vazias** da IA.
2. `api/reanalisar-lead.js` (`garantirMensagensMotorComercialV714`): quando o
   trio não está completo, zera `messages.a/b/c` pra `""` — mas não zera
   `diagnostico.mensagemQueEuEnviariaHoje`, que fica com a mensagem A órfã.
3. `app.js` (`cp704Msgs`): usa esse campo como sinal de "a IA já mandou uma
   mensagem real" (`temMsgIa`). Com o campo ainda preenchido, `temMsgIa` virava
   `true` e desligava o fallback de B/C — que ficam vazias porque foram
   zeradas no passo 2.
4. `cp705MessagesReady` via B/C vazias e esconde a seção inteira, mesmo com a
   mensagem A intacta (sem uso) no campo do diagnóstico.

## Correção
- `api/_pipeline.js`: `mensagemQueEuEnviariaHoje` só recebe conteúdo quando
  `msgA && msgB && msgC` existem juntas; senão fica `""`, igual a
  `messages.a/b/c`. Sem esse campo órfão, o front reconhece corretamente que
  não há mensagem completa da IA e aplica o fallback (`ui682FallbackMessages`)
  em vez de travar a tela vazia.
- Versão/cache atualizados para `724-5`.

## Limite desta correção
Não tenho como rodar a chamada real de IA em produção pra confirmar 100% que
esse era o único fator no caso do "Eder Premium" — segui a cadeia de código
até a causa comprovada, mas só o teste real no app confirma. Pedido:
reanalisar o "Eder Premium" e, se possível, checar na aba Network do
DevTools a resposta de `/api/reanalisar-lead` (campos `messages` e
`diagnostico.mensagemQueEuEnviariaHoje`) pra confirmarmos com dado real.

## Teste
1. Subir os arquivos.
2. Confirmar topo `Atualização #724-5`.
3. Reanalisar o lead "Eder Premium".
4. A seção "Mensagem recomendada" deve mostrar 3 opções (da IA ou, na pior
   hipótese, do fallback "Validar mudança/Abrir contexto/Pergunta direta").
