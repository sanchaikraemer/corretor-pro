# NOTAS v1102 — "Nunca atendido Jamil?????" — atender no WhatsApp agora conta

## O que o dono mandou

O Jamil recebeu apresentação, visita ao Personalité, material detalhado, ofertas de
personalização — e a lista "Sem atender 30d+" dizia **"NUNCA — nunca atendido"**.

> *"nunca atendido jamil?????"*

## Por que acontecia

A lista só contava atendimento **registrado no app**: o botão "Marcar" ou a cópia de uma mensagem
sugerida. As mensagens que você mandou pro Jamil **dentro da própria conversa do WhatsApp** não
contavam como atendimento.

Pra corretor, atender é falar com o cliente. O app dizia na sua cara que você nunca atendeu um
cliente que você claramente atendeu.

## O que mudou

O "sem atender" passou a contar o seu **último contato real**, o que for mais recente entre:

- atendimento marcado no app (o que já contava), **e**
- a última mensagem **que você mandou** na conversa do WhatsApp.

Na tela:

| Cliente | Antes | Agora |
|---|---|---|
| Jamil (atendido pela conversa, nunca marcado) | NUNCA — nunca atendido | **SEM ATENDER DESDE 09/06** · há 53 dias |
| Cliente que só mandou mensagem e você nunca respondeu | NUNCA — nunca atendido | **NUNCA — você nunca respondeu** |

E quem você respondeu pelo WhatsApp esta semana **sai** da lista de 30d+ — como deve ser. O número
do quadro acompanha.

## O que NÃO mudou — de propósito

A fila **"Fazer agora"** e o **descanso** continuam contando só do atendimento **marcado**. Essa
regra é sua, dita com todas as letras: *"esquece 2 regras, vamos usar uma só, que é de marcar
atendimento, esquece a data da última msg"*. Ela vale pra fila — não mexi. A mudança de hoje é só
na leitura do "sem atender", onde o critério antigo te chamava de mentiroso.

## Validação feita antes de publicar

| Verificação | Resultado |
|---|---|
| Suíte completa | 276 testes verdes |
| `npm run build` | 27 arquivos, versão 1102 |
| Navegador de verdade | caso Jamil reproduzido |

No navegador, com uma conversa igual à do Jamil (mensagens suas na conversa, nada marcado no app):
sai **"SEM ATENDER DESDE 09/06 · há 53 dias"**. E um cliente que só mandou mensagem sem nunca
receber resposta: **"NUNCA — você nunca respondeu"**.

## Arquivos alterados

**Código:** `app.js`

**Versão:** `package.json`, `package-lock.json`

**Documentação:** `NOTAS-v1102.md` (novo)

**Testes (atualizados):** `tests/v826-atendimentos.test.mjs`,
`tests/v1071-contador-sem-atender-30-dias.test.mjs`,
`tests/v1072-sem-atender-30d-abre-lista-ordenada.test.mjs`,
`tests/v1098-listas-mostram-o-numero-que-as-define.test.mjs`
