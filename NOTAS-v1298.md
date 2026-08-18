# v1298 — um caminho só, e o fim do "sem compromisso"

Pedido direto do dono, 18/08/2026, olhando as sugestões que a v1297 gerou: **"faz as duas, manda
direto e tira o sem compromisso"**.

As duas coisas apontadas estavam nas sugestões daquele print:

1. *"Prefere que eu explique por aqui ou envio um material resumido?"*
2. *"…posso esclarecer melhor as condições de pagamento, **sem compromisso**."*

## 1. Um caminho só — quem escolhe é o corretor

Entrou nas regras das três mensagens:

> **UM CAMINHO SÓ, escolhido por você.** Não devolva ao cliente a escolha do formato ("prefere que eu
> explique por aqui ou envio um material?", "quer por áudio ou por escrito?", "prefere ver agora ou
> depois?"): escolher é trabalho do corretor, e duas opções de caminho dão ao cliente uma chance a
> mais de adiar. Proponha o caminho mais forte, um só, e ele responde sim ou pede outra coisa.

**A exceção é marcar dia e hora.** Oferecer dois horários ("quinta às 18h ou sábado de manhã?") é o
que faz agenda fechar, e continua liberado — sem essa ressalva a regra atrapalharia justamente o
momento em que duas opções ajudam.

Na prática, a sugestão que dizia "prefere que eu explique por aqui ou envio um material?" passa a
sair como "te envio agora o quadro completo de condições" — uma proposta, não um menu.

## 2. "Sem compromisso" virou frase proibida

Entrou na lista LINGUAGEM DE IA — PROIBIDO, junto de "fico à disposição" e companhia, com o motivo
escrito ao lado: **o corretor não pede licença pra fazer o trabalho dele.** Oferecer a informação já
é normal — e dizer "sem compromisso" ainda avisa o cliente, de graça, que ele pode ignorar a
mensagem.

Vale para "sem compromisso", "sem nenhum compromisso" e "sem qualquer compromisso". Como qualquer
frase dessa lista, ela também entra na rede criada na v1295: se escapar mesmo assim, a mensagem volta
pra própria IA reescrever, mantendo o mesmo conteúdo. O código continua sem cortar ou costurar texto.

## Testes

- Novo `v1298-um-caminho-so-e-sem-compromisso`: as três formas de "sem compromisso" reconhecidas,
  mensagem que entrega direto continua limpa, a lista e o motivo dentro do pedido, a regra do caminho
  único com o exemplo real do print e com a exceção de dia/hora, e a análise de verdade devolvendo a
  mensagem furada pra IA reescrever (sem tocar nas outras duas).

Suíte inteira verde: 29 arquivos checados + 452 testes.
