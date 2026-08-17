# v1292 — a lista de frases proibidas voltou pro pedido da IA

Dono, 17/08/2026, logo depois da v1291. Ao ser avisado de que a reescrita das instruções que ele
entregou tinha levado embora duas listas, a resposta foi direta: **"1 - entao recoloque"**.

## O que voltou

Voltaram, com o mesmo texto que tinham antes da v1291, as duas listas que travam a linguagem de
robô nas três sugestões:

1. **LINGUAGEM DE IA — PROIBIDO** — "espero que esteja bem/indo bem", "faz sentido", "se fizer
   sentido", "fico à disposição", "estou à disposição", "me coloco à disposição", "qualquer dúvida
   estou aqui", "espero ter ajudado", "não hesite em", "sinta-se à vontade para", "conforme
   conversamos" sem conversa real, "gostaria de saber se você teria interesse", e a construção no
   passado ("quis saber se..."). Mais a régua do fecho: termine curto, sem repetir com outras
   palavras o que a mensagem já disse.
2. **PALAVRA EM INGLÊS E JARGÃO DE ESCRITÓRIO — PROIBIDO** — overview, insight, feedback, budget,
   call, briefing, follow-up, case, timing, mindset, expertise, know-how, player, target, deal,
   lead, prospect, pipeline, background, update, board, meeting, com a tradução de cada uma escrita
   ao lado (overview = uma ideia geral; feedback = retorno; call = ligação; e assim por diante), e o
   jargão em português junto ("alinhar expectativas", "agregar valor", "de forma assertiva",
   "solução personalizada"). A exceção continua sendo o vocabulário real do mercado — studio, loft,
   duplex, garden, closet, playground, home office, coworking, hall, fitness — e nome próprio de
   empreendimento, construtora, bairro e rua.

As duas ficam junto das regras das três mensagens, no trecho que vale para **todo corretor** — não
só pra quem está em modo prévia. (A v1240 já tinha cometido o erro de deixar o piso valendo só na
prévia, e o dono ficou sem ele; não se repete.)

## Uma linha a mais na revisão final

A revisão que a IA faz por último, antes de devolver as sugestões, ganhou o item 11: conferir se
sobrou alguma frase das duas listas em alguma das três mensagens e, se sobrou, reescrever aquela
frase em português de corretor. É o mesmo lugar em que a versão anterior já conferia fato
sustentado, novidade inventada e fidelidade ao Cérebro.

## O que continua como o dono pediu na v1291

- **Quem define o tom continua sendo o Cérebro.** As listas estão escritas dizendo isso com todas as
  letras: elas não tratam de tom, tratam de marca de robô. Nenhuma outra regra da reescrita foi
  desfeita.
- **A regra da data não voltou** — o dono respondeu "ok" a esse ponto. O pedido continua sem nenhum
  trecho mandando a IA cravar dia ou horário, e o teste v1287 continua conferindo isso.
- **O código continua sem reescrever o texto da IA.** A rede é o prompt: o corte determinístico de
  frase (`limparFrasesProibidas`) segue removido desde a v1247 e não voltou. Se uma frase proibida
  escapar, ela escapa inteira — ninguém faz cirurgia no texto.

## Testes

- `v1280-nada-de-palavra-em-ingles` voltou a cobrar as duas listas palavra por palavra, mais a
  exceção do vocabulário de mercado, mais o item novo da revisão final.
- `v1212-voz-real-do-corretor-no-prompt` voltou a cobrar as seis frases de clichê que o dono
  rejeitou nos prints de 11/08.

Suíte inteira verde: 24 arquivos checados + 447 testes.
