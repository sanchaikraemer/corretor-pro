# NOTAS v1022 — compromisso vencido furando o prazo de descanso + importação que nunca reaproveita

## Os relatos

Duas coisas na mesma mensagem do dono:

1. Print de duas tentativas de importar a mesma conversa ("Cesinha corretor.zip", 62.1 MB): a
   primeira travou ("Demorou demais — servidor não respondeu") depois de já ter transcrito os
   áudios; a segunda, tentando de novo, transcreveu tudo do zero de novo — "0 reaproveitados".
   Pergunta do dono: "por que nunca reaproveita nada?"
2. Um lead ("Henrique") continuando a aparecer no topo da lista de prioridades sem respeitar o
   prazo de descanso, mesmo depois de várias rodadas de correção nesse mesmo assunto.

## Causa

### 1. Compromisso confirmado vencido nunca "soltava" o lead

Quando a conversa menciona um compromisso (ex.: "combinamos a visita sábado") e a IA confirma
essa data, isso fica guardado no lead. O problema: essa marcação nunca era apagada, mesmo
DEPOIS que a data já tinha passado há semanas ou meses. E, na fila de prioridades, "tem
compromisso confirmado" tirava o lead da regra do prazo de descanso pra sempre — não importava
há quantos dias ele tinha sido atendido, o compromisso antigo continuava empurrando ele pro topo
como se fosse urgente hoje. Isso já existia corrigido em outro lugar do sistema (o card de
detalhe do lead já sabe dizer "esse compromisso já venceu"), só faltava aplicar essa mesma
checagem na fila de prioridades.

Também alinhei duas contagens de "faz quanto tempo que atendi esse lead" que tinham ficado
levemente diferentes uma da outra (uma olhava só uma forma de marcar atendimento, a outra olhava
todas as formas) — agora as duas usam exatamente a mesma régua, pra não voltar a divergir sobre
o mesmo lead.

### 2. Importação perdia a "memória" do que já tinha sido transcrito

Quando uma importação trava no meio (como no print — deu timeout depois de já transcrever os
áudios) e o dono tenta de novo, o sistema já sabe reaproveitar a transcrição — MAS só se
reconhecer que é uma continuação da MESMA tentativa. Essa "memória" ficava só na tela aberta: se
a página recarregasse no meio do caminho (bem comum quando o arquivo é grande e demora), essa
memória se perdia, e a próxima tentativa começava do zero sem saber que aquele áudio já tinha
sido transcrito antes — daí o "0 reaproveitados" mesmo repetindo o mesmo arquivo.

## Correção

- A fila de prioridades agora só considera "tem compromisso marcado" quando ele ainda não
  passou (hoje ou depois) — um compromisso de meses atrás não segura mais o lead no topo pra
  sempre.
- As duas formas de contar "há quanto tempo foi o último atendimento" (usadas em partes
  diferentes da tela) agora usam a mesma fonte, então não vão mais discordar sobre o mesmo lead.
- A importação agora guarda no aparelho qual conversa está sendo processada. Se a página
  recarregar no meio de uma importação grande, uma nova tentativa com o MESMO arquivo reencontra
  o que já tinha sido feito antes, em vez de começar do zero.

## Teste novo

`tests/v1022-prazo-compromisso-antigo-atendimento-e-reaproveitar-importacao.test.mjs` — cobre o
compromisso vencido não segurando mais o lead, as duas formas de contar atendimento batendo
entre si, e a importação reencontrando o arquivo já processado (e não reaproveitando de um
arquivo diferente, nem depois de mais de 24h).

## Sobre o "Henrique" especificamente

Não consigo ver os dados reais da conta do dono (essa sessão não tem acesso ao banco), então não
dá pra confirmar 100% qual dessas causas era a dele — pode ter sido o compromisso vencido, ou
(se ele é um lead bem recente, de poucos dias) o prazo de descanso mais curto que já existe pra
leads novos (3 dias em vez de 5). Se ele voltar a aparecer errado depois desta atualização, um
print de dentro do card dele (mostrando a data do último atendimento) ajuda a confirmar.

## `npm test`

Suíte inteira verde.
