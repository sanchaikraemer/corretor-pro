# v1219 — "esperando você" deixou de parecer "travado"; e a IA para de inventar novidade

Dois relatos do dono no mesmo minuto (11/08/2026, 17h57 e 17h58).

---

## 1. "de novo dando pau"

**O que ele viu:** depois da importação, a tela mostrava **"Salvando — preparando pra salvar"**
com a rodinha girando e a barra quase cheia, e nada acontecia.

**O que estava acontecendo de verdade:** nada de errado. O app estava **parado, esperando ele
responder** a pergunta logo abaixo — *"Pode ser o mesmo cliente que já existe: Evandro Zibetti
Meira. É o mesmo cliente?"*. É a única pergunta da importação que trava o fluxo de propósito
(juntar duas conversas não tem desfazer, então quem decide é ele).

O problema é que a tela dizia o contrário: rodinha girando é a promessa de que **o app** está
trabalhando. Trabalho em andamento que não termina nunca só pode ser lido como travamento — e os
botões "Nova análise" e "Diagnóstico" ainda estavam travados, reforçando a impressão.

**O que mudou:** quando a vez é dele, a linha de andamento:

- **para de girar** (sem rodinha);
- passa a dizer **"Esperando sua resposta — responda a pergunta acima pra continuar"**, em vez de
  "Salvando";
- fica em **cinza** (cor de pausa), com um **?** no lugar do passo em curso;
- e **destrava** "Nova análise" e "Diagnóstico" — não há nada rodando pra proteger.

Assim que ele responde, a rodinha volta e a linha diz "Salvando no banco de dados..." de novo —
aí é trabalho de verdade.

---

## 2. "eu não sugeri novas opções em momento algum — a IA está inventando"

**O que ele viu**, nas três sugestões: *"Aproveitei para conferir se surgiram opções novas desde
nossa última conversa"*, *"alguma alternativa diferente que tenha surgido por aqui nos últimos
dias"*, *"as melhores opções disponíveis hoje"*.

Nada disso aconteceu: ele não conferiu nada, não surgiu opção nenhuma, e a conversa não fala em
novidade. A mensagem é **assinada por ele** — colocar isso na boca dele é mentira que o próprio
cliente desmente na resposta.

**Por que passou:** as regras já proibiam inventar **fato** (preço, condição, endereço, cidade,
prazo, metragem). O que faltava era proibir inventar **ação do corretor** e **novidade** — e é
justamente aí que a IA escorrega quando a conversa está parada há tempo e ela "precisa" de um
motivo pra voltar a falar.

**O que mudou** — regra nova, explícita, no pedido enviado à IA:

- é proibido escrever que o corretor **conferiu, pesquisou, separou, levantou, verificou com
  alguém, recebeu retorno** ou "aproveitou pra ver" se isso não está nas fontes (conversa,
  observações registradas por ele, Cérebro);
- é proibido **afirmar ou sugerir** que existe novidade do lado dele — "surgiram opções novas",
  "chegaram unidades", "as melhores opções disponíveis hoje", "tenho novidades";
- conversa parada **não** autoriza inventar motivo de retomada: o motivo tem que ser real (o que
  ficou pendente na conversa);
- no lugar disso, o permitido é **oferecer fazer agora** ("quer que eu veja o que está disponível
  e te mando?"). Verbo no futuro ou no condicional, nunca no passado.

O **código continua sem reescrever mensagem nenhuma** — decisão antiga do projeto e mantida aqui:
o conteúdo comercial é da IA com o Cérebro, não do programa. A correção é na regra.

---

## Arquivos alterados

- `app.js` — `renderEtapas` aprendeu o estado "esperando você" (sem rodinha, cinza, "?", botões
  liberados).
- `js/importacao.js` — a pergunta "é o mesmo cliente?" passa a marcar esse estado.
- `api/_pipeline.js` — regra "AÇÃO E NOVIDADE QUE NÃO EXISTEM — PROIBIDO" no prompt de sistema
  (vale sempre, inclusive em conta nova sem Cérebro).
- `tests/v1219-...` — executa `renderEtapas` de verdade contra um DOM falso e compara os dois
  estados (salvando × esperando); e confere que a regra nova cita as frases exatas do print.
- `tests/v1175-...`, `tests/v862-...` — as guardas antigas continuam valendo, atualizadas pro novo
  formato (rodinha só quando o app trabalha sozinho).
- `package.json` / `package-lock.json` — versão 1219.

Verificação em tela (Chromium headless sobre `public/`, temas claro e escuro): os dois estados
desenhados lado a lado pela função de verdade — "Salvando" com rodinha coral × "Esperando sua
resposta" em cinza, sem rodinha.
