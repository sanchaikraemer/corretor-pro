# v1142 — copiar a sugestão marca atendimento SEMPRE (as duas causas do "às vezes")

Print do dono (05/08/2026, 17:33 — cliente "Maria Juçara"): copiou a sugestão de mensagem e o
botão do cliente continuava **"Marcar"**, como se nada tivesse sido registrado. Palavras dele:
"de novo o mesmo problema recorrente que você nunca arruma".

Ele está certo em cobrar: a v1019, a v1031 e a v1097 já mexeram nisso. Cada uma consertou um
pedaço real (avisar quando falha, marcar todas as cópias em memória, mandar o atendimento primeiro
com `keepalive`) — e nenhuma pegou as duas causas abaixo, que são as que sobraram.

## Causa 1 — a tela só mostrava o atendimento se a REDE respondesse

Ao copiar, o app marcava o atendimento **na memória** (certo) e mandava a gravação pro servidor
(certo). Mas quem **redesenhava o cliente na tela** era o recarregamento pela rede, no fim do
processo. Se ele demorasse, falhasse, ou fosse cortado pelo celular (copiar é exatamente quando o
corretor sai pro WhatsApp), **ninguém redesenhava**: o botão ficava em "Marcar" mesmo com o
atendimento já gravado no banco. Ficava certo depois de um F5 ou ao reabrir o cliente — daí o
"às vezes marca, às vezes não".

O botão "Marcar atendimento" nunca teve esse problema porque ele redesenha na hora. Agora copiar
faz igual: **a tela mostra "Atendido" imediatamente, sem depender de rede.**

E o contrário também virou verdade: se a gravação falhar de vez (agora são **3 tentativas de 30s**,
a mesma teimosia do botão, em vez de 2 de 15s), a marca é **desfeita** na tela e o aviso diz o que
fazer. A tela não mente em nenhum dos dois sentidos.

## Causa 2 — existia um segundo botão "Copiar" que nunca marcava atendimento

O card **"Resposta pronta pra enviar"**, que aparece na tela de importação assim que a análise sai
— um dos momentos em que o corretor mais copia —, tinha um "Copiar" que registrava **só o contador
de mensagens copiadas**. Nunca marcava atendimento e nunca entrava na conversa do cliente como
"Mensagem enviada". Copiar a MESMA sugestão de dentro do cliente marcava.

Mesma ação, dois comportamentos: era literalmente "às vezes marca, às vezes não" — dependia de
**onde** ele copiou. Agora os três caminhos de copiar sugestão marcam atendimento do mesmo jeito:

| Onde ele copia | Antes | Agora |
|---|---|---|
| Dentro do cliente ("Fazer agora", opções 1/2/3) | marcava | marca (e a tela mostra na hora) |
| Card da tela inicial | marcava | marca |
| "Resposta pronta pra enviar" (tela de importação) | **não marcava** | marca |

## Detalhe que também estava errado (silencioso)

A marca local entrava com o rótulo interno do **botão** ("botao_atendido"), enquanto o servidor
grava a da cópia como "copiar_msg", e com horário próprio. Ao recarregar, o mesmo atendimento
voltava como um **segundo** evento na conversa do cliente. Agora a marca local usa o mesmo rótulo
e adota o horário confirmado pelo servidor — um atendimento, um registro.

## Validação

| Verificação | Resultado |
|---|---|
| Suíte completa | 315 testes verdes |
| Teste novo | `v1142-copiar-sugestao-sempre-marca-atendimento` (repinta antes da rede; 3 tentativas de 30s; falha desfaz a marca; reaplicação só com confirmação; os TRÊS botões de copiar marcam atendimento) |
| Testes ajustados | `v1020`, `v1031`, `v1097` (guardavam a forma antiga das duas tentativas escritas na mão e da marca local sem rótulo — a intenção de cada um continua travada) |
| `npm run build` | ok, versão 1142 |
| Navegador de verdade | app publicado em Chromium headless: boot sem erro, o botão "Copiar" do card de importação existe e agora passa pelo registro de atendimento |

## Arquivos alterados

**Código:** `app.js`

**Documentação:** `NOTAS-v1142.md` (novo)

**Versão:** `package.json`, `package-lock.json`

**Testes:** `tests/v1142-copiar-sugestao-sempre-marca-atendimento.test.mjs` (novo),
`tests/v1020-registrar-atendimento-da-copia-tenta-de-novo.test.mjs`,
`tests/v1031-copiar-mensagem-marca-atendido-em-toda-copia.test.mjs`,
`tests/v1097-copiar-marca-atendimento.test.mjs`
