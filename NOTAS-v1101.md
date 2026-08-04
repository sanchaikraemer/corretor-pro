# v1101 — fim da contagem de dias nas listas: agora é data

> **Nota escrita depois (v1128).** A auditoria completa do sistema encontrou este arquivo faltando:
> a v1101 foi publicada normalmente (commit `2a0987a`, PR #248), mas ficou sem nota de versão — a
> única do intervalo 846→1127 nessa situação. O conteúdo abaixo foi reconstituído a partir do que
> foi publicado na época. Registrado agora pra o histórico não ter buraco.

## O problema

As listas mostravam há quantos dias cada coisa tinha acontecido — "43 dia(s)", "há 7 dias". Duas
chateações com isso:

1. **Não dizia nada de útil.** "Há 43 dias" obriga a fazer conta de cabeça pra saber se foi antes
   ou depois de alguma coisa que você lembra. Data resolve na hora.
2. **Envelhecia errado.** O número era calculado quando a lista era montada e ficava congelado ali;
   quem deixava o app aberto via "há 2 dias" no dia seguinte.

A v1100 já tinha corrigido os textos mal escritos que vinham dessa contagem ("atendido há hoje",
"43 dia(s)"). A v1101 foi o passo seguinte: parar de contar dias.

## O que mudou na tela

- Onde aparecia a contagem de dias, agora aparece **a data** (dia/mês).
- "Hoje" e "Ontem" continuam por extenso, porque nesses dois casos a palavra é mais rápida de ler
  que a data.
- Nada foi tirado das listas — é a mesma informação, escrita de um jeito que não precisa de conta.

## Por que não dá pra "voltar atrás"

A contagem de dias sumiu de propósito. Se em algum momento a impressão for de que "faltou o tempo
decorrido", o caminho é acrescentar isso **junto** com a data, nunca no lugar dela — foi
exatamente a troca que gerou os textos quebrados da v1100.
