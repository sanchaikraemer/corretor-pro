# NOTAS v1103 — O Jamil, parte 2: a lista agora enxerga a conversa inteira

## O que o dono mandou

> *"Mas você está errado porque o Jamil tem atendimento e eu te mostrei no print."*

Ele está certo, e a cobrança revelou um segundo furo que a correção de ontem não cobria.

## O furo

Pra ser rápida, a lista de clientes carrega só as **últimas 8 mensagens** de cada conversa — não a
conversa inteira. A correção anterior olhava só essa prévia.

Se as últimas 8 mensagens fossem todas do cliente (cliente que mandou várias seguidas), as SUAS
respostas mais antigas ficavam fora da prévia — e o app dizia "você nunca respondeu" pra um
cliente respondido.

## A correção

Quem decide agora é o **servidor**, que enxerga a conversa completa: ele passou a informar à
lista a data da sua última mensagem de verdade na conversa (ignorando sugestão da IA e registro
automático). O app usa esse dado, não mais só a prévia.

Sem custo: esse cálculo entra na mesma varredura que o servidor já fazia, e fica guardado no
cache por lead que já existia.

## Validação

| Verificação | Resultado |
|---|---|
| Suíte completa | 277 testes verdes |
| `npm run build` | 27 arquivos, versão 1103 |
| Navegador de verdade | pior caso reproduzido |

O teste novo reproduz o pior caso: corretor respondeu há 53 dias e o cliente mandou 10 mensagens
depois (prévia sem NENHUMA resposta do corretor). O servidor acha a resposta, e a tela mostra
"SEM ATENDER DESDE 09/06 · há 53 dias" — nunca mais "nunca". E confirma o contrário: quem
realmente nunca recebeu resposta continua "NUNCA — você nunca respondeu".

## Arquivos alterados

**Código:** `api/_persistence.js`, `app.js`

**Versão:** `package.json`, `package-lock.json`

**Documentação:** `NOTAS-v1103.md` (novo)

**Testes (novo):** `tests/v1102-atender-pelo-whatsapp-conta.test.mjs`

**Testes (atualizado):** `tests/v1017-lentidao-cache-90dias-fazer-agora-cartao-duplicado.test.mjs`
