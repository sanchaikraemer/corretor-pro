# v1247 — o Cérebro, o prompt e a análise voltam ao ponto em que funcionavam

> "de ontem pra hoje está cada vez pior, realmente uma merda... parece q quanto mais mechemos pior
> fica. Queria ver se vc tem como recuperar a parte do cerebro de ontem, tipo usarmos como estava a
> 48h atrás, mas sem retornar o sistema todo para 48h... manter o q foi feito com excessão das
> regras de prompt, cerebro e analises." (dono, 13/08/2026)

Ele está certo, e dá pra apontar o dia e a hora em que estragou.

## O que aconteceu

Entre 12/08 e 13/08 saíram nove atualizações mexendo no pedido que o sistema faz pra IA (v1230,
v1235, v1236, v1239, v1240, v1241, v1243, v1244, v1245). Cada uma parecia uma melhoria isolada.
Somadas, elas **tiraram do pedido quase tudo que ensinava a IA a vender** e puseram no lugar
instruções abstratas sobre quem manda em quem.

O erro central é da **v1240**. Até ali, o método comercial (como identificar quem é o interlocutor,
pra onde olhar em cada situação, e a estratégia das três mensagens — a recomendada, a mais suave e
a mais direta, cada uma com um papel) ia no pedido **sempre**. A v1240 moveu esse bloco inteiro
para um cantinho que só é usado por **conta nova, com o Cérebro ainda vazio**. Ou seja: quem tem
Cérebro preenchido — o dono — passou a receber uma análise **sem método comercial nenhum**.

Junto disso vieram outras três coisas que puxaram a qualidade pra baixo:

- as regras concretas ("cliente já disse sim, não peça a mesma permissão de novo", "pergunta do
  corretor sem resposta", "as três precisam ter ângulos diferentes") viraram frases genéricas do
  tipo "o Cérebro decide o papel de cada mensagem";
- o sistema passou a **cortar frases das sugestões por conta própria** depois que a IA escrevia —
  cirurgia em texto pronto, que devolve mensagem truncada;
- e a análise trocou de forma no meio do caminho, com campos novos disputando espaço com o que
  realmente importa.

## O que foi feito

O miolo do Cérebro/prompt/análise voltou a ser **exatamente o do fim do dia 11/08 (v1225)** — o
último ponto antes da sequência ruim. Nada mais do sistema foi tocado: Agenda, notas, arquivados,
importação, envio de ZIP, telas, cores, cadastro, cobrança — tudo continua como está hoje.

**O que foi mantido do período ruim** (porque não é regra de prompt, é correção de fato):

1. **A conversa inteira chega na IA.** O limite técnico que cortava conversa longa em silêncio
   subiu: uma carteira de 300 mensagens não perde mais de cem delas sem ninguém avisar. E quando o
   limite realmente encostar, a tela passa a dizer quantas de quantas foram lidas, em vez de
   afirmar que leu tudo.
2. **A saudação certa pelo horário** (chega de "Boa noite" às 17h40).
3. **Reconhecer quem é a voz do corretor na conversa.** Quando o nome salvo no Cérebro é diferente
   do nome que o WhatsApp exporta, os exemplos reais de escrita dele ficavam vazios — e a IA caía
   no tom genérico de vendedor. Corrigido.
4. **A proibição de inventar ação e novidade do corretor** ("aproveitei para conferir se surgiram
   opções novas") — foi o próprio dono que flagrou isso, e devolver esse defeito seria burrice.

## O que sai da tela

O bloco **"Como conduzir este atendimento"** (que apareceu na v1239, acima das sugestões) deixa de
ser preenchido, porque ele fazia parte justamente do pacote revertido. O diagnóstico comercial, as
três sugestões e todo o resto do cadastro continuam iguais. Se ele fizer falta, dá pra trazer de
volta sozinho, sem arrastar as regras junto.

## Testes

- Os testes que existiam antes e tinham sido reescritos para casar com as regras novas voltaram à
  versão da v1225 e passam.
- Os testes que só existiam para guardar as regras revertidas foram removidos (v1230, v1235, v1236,
  v1239, v1243, v1244, v1245).
- O teste da v1241 foi reduzido às duas partes que não são regra de prompt e continuam valendo: o
  aviso na tela antes de cortar texto do Cérebro, e a guarda que impede documentação e código de
  mandarem coisas opostas.
- O teste da v1222 agora **tranca o contrário do que trancava**: a conversa não pode encolher entre
  a primeira análise e a reimportação — nenhuma mensagem fica escondida.
- `npm test` verde.

## Recado pra próxima sessão

Não refaça o caminho da v1240. O piso comercial não pode ser movido para dentro do modo prévia, e
regra concreta de prompt não deve ser trocada por meta-instrução do tipo "o Cérebro decide". Isso
está registrado no `CLAUDE.md`.
