# v1160 — "Ficaram de te dar uma resposta"

Caso real trazido pelo dono:

> "Ontem a cliente pediu infos, mandei e ela ficou de falar com o marido à noite. Hoje teria que dar
> um toque nela, o que acha?"

O app não ajudava **nada** nisso. Como ele tinha acabado de atender, ela estava no descanso (2 dias) e
não aparecia em lugar nenhum — ele lembrou de cabeça. A informação estava lá, na conversa importada, e
era ignorada. Proposta aceita ("pode ser, boa ideia"): quando o cliente fica de dar uma resposta, o
app propõe o retorno e ele confirma com um toque.

**Zero custo de IA:** tudo sai das mensagens que já foram importadas. Nenhuma reanálise, nenhum token
— vale pra carteira inteira na primeira vez que ele abrir o app.

## O que aparece na tela

**Na Hoje**, acima da fila do dia, uma faixa (só existe quando há alguém nessa situação):

```
FICARAM DE TE DAR UMA RESPOSTA · 2
Cliente A   "Vou falar com meu marido hoje à noite e te falo."   disse ontem     [Agendar hoje]
Cliente B   "Vou conversar com minha esposa e te aviso"          disse há 9 dias [Agendar hoje]
O prazo que eles mesmos deram já passou. Agendar coloca na sua Agenda de hoje.
```

Tocar no nome abre o cliente; o botão agenda num toque (pelo mesmo caminho do botão "Agendar" do
cliente, que também marca o atendimento — regra da v1148).

**Dentro do cliente**, no topo do "Fazer agora", a mesma coisa com a data proposta ("Retomar hoje?",
"Retomar amanhã?") — aqui aparece mesmo quando o dia ainda não chegou.

## As regras (todas conferíveis na conversa, nada de palpite)

- **O que conta como promessa:** "te falo/aviso/retorno/confirmo", "fico de te retornar", "qualquer
  coisa te chamo", "vou falar/conversar/ver/consultar com **alguém**" (marido, esposa, sócio, pai,
  banco, contador, gerente…), "vou pensar/analisar/avaliar/decidir".
- **O que NÃO conta:** "vou ver o apartamento no sábado" (é visita, não resposta), perguntas,
  saudações. Por isso o "vou falar/ver" exige o interlocutor.
- **Data proposta:** o dia seguinte ao prazo que o próprio cliente deu. Ele entende "hoje à noite",
  "amanhã", "depois de amanhã", "segunda", "semana que vem", "fim de semana", "de manhã". Sem prazo
  citado, é o dia seguinte à fala dele — não inventa data.
- **Respeita o prazo dele:** se ele disse que responde amanhã, a faixa não cobra hoje.
- **Prazo vencido:** continua na faixa (mostrando "disse há 9 dias") e agendar é sempre pra **hoje**,
  nunca uma data no passado.
- **Desistência clara** ("desisti", "já comprei", "sem interesse") cancela a proposta — não se insiste
  com quem disse não.
- **Só as 3 últimas falas do cliente** contam: promessa velha, com conversa nova por cima, não vale.
- **Promessa com mais de 45 dias** não entra aqui (esse é caso das vagas de resgate do dia).
- Fica fora quem já foi atendido hoje, quem já tem compromisso/lembrete marcado e quem está
  arquivado.

## Arquivos

- `app.js` — bloco `cp1160*` (detecção + faixa da Home + banner do cliente + o agendar de um toque),
  ligado no template da Home e no card "Fazer agora" do cliente, com o CSS das duas telas.
- `tests/v1160-cliente-ficou-de-dar-resposta.test.mjs` — **novo**.
- `tests/v1021-barra-mobile-nao-sobrepoe-produto.test.mjs` — passou a achar o bloco de CSS do celular
  a partir da regra de desktop do `cp-hoje-row`, e não pelo primeiro `@media(max-width:560px)` do
  arquivo (a faixa nova mudou a ordem e o teste media o CSS errado).

## Conferência

- `npm test`: 24 arquivos + **326 testes**, verdes. O teste novo roda a detecção de verdade em 10
  cenários — inclusive o caso da cliente que falou ontem à noite, o prazo vencido há 9 dias, o
  "amanhã" que não pode ser cobrado hoje, a desistência e os falsos positivos.
- **Chromium headless (obrigatório, mudou o que aparece na tela):** faixa da Home conferida em
  390×844 e 1280×900, nos temas escuro e claro — visível, acima da fila, dentro da tela, botão e
  textos legíveis, sem erro de JS. Banner do cliente conferido nos dois temas.
- Um problema foi pego **nessa** conferência: a cor do texto do banner estava cravada em rgba clara
  (padrão do bloco de CSS do cliente, feito pro tema escuro) e ficava quase branca no tema claro.
  Trocada por `var(--text)` e reconferida nos dois temas.
