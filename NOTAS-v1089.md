# NOTAS v1089 — A tela cheia parou de piscar no meio, e o andamento passou a caminhar

## O que o dono relatou

> *"no meio da análise apareceu essa tela e depois voltou pro carregamento."*
> *"quero somente o carregamento e com andamento mais 'linear', e não ficar pulando o carregamento
> de bastante em bastante."*

Dois ajustes na tela cheia que estreou na v1088.

## 1. A tela que aparecia no meio

A v1088 escondia a tela cheia numa etapa chamada *"aguardando confirmação para salvar"*, com uma
suposição errada: a de que o app sempre para ali pra perguntar se é pra salvar.

Ele **não** para. No caminho normal — a esmagadora maioria das importações — o app **salva
sozinho** logo em seguida. O que acontecia, então, era: a tela cheia saía de cena, os cartões da
importação apareciam por um instante, e a tela cheia voltava. Exatamente o "apareceu essa tela e
depois voltou pro carregamento".

**Corrigido:** essa etapa não esconde mais nada. A tela cheia agora sai de cena **só** no único
caso em que a importação realmente para pra ouvir uma decisão: quando o nome do cliente é apenas
*parecido* com um que já existe, e o app precisa perguntar se é a mesma pessoa ou outra. Fora
disso, ela fica de pé do começo ao fim.

As outras saídas de segurança continuam todas valendo (erro no meio, erro ao salvar, erro ao
atualizar, e a rede final no fim de qualquer importação).

## 2. O andamento agora caminha, em vez de pular

Antes o número pulava: 8% → 32% → 48% → 70% → 86%. E **ficava parado entre um pulo e outro** —
às vezes por bastante tempo, porque as etapas têm durações muito diferentes: ouvir os áudios e
analisar levam dezenas de segundos, enquanto as outras passam num instante.

Agora o número **anda sozinho**. Ao entrar numa etapa ele mira o percentual dela e, enquanto
aquela etapa não termina, vai se arrastando devagar em direção à próxima — chegando cada vez mais
devagar, sem nunca alcançar. Quando a etapa seguinte acontece de verdade, ele alcança o novo valor
suavemente.

Duas garantias que valem a pena registrar:

- **Nunca volta atrás.** Se a tela já mostra 78%, nada faz o número diminuir.
- **Nunca anuncia uma etapa que não começou.** O limite do arrasto é sempre o percentual da etapa
  seguinte menos uma folga — então ele nunca "promete" um passo que ainda não aconteceu.

Medido no navegador, com a etapa dos áudios durando 12 segundos:

```
70% → 74% → 76% → 78% → 79% → 80% → 81% → 81%
```

Sempre subindo, sempre se movendo, sem invadir os 86% da etapa seguinte.

## Testes

`npm test` verde, com o código de saída conferido. O teste da tela cheia ganhou as regras novas:
que a etapa de preparar o salvamento **não pode mais** esconder a tela, que o caso de nome parecido
é quem libera, e as três garantias do andamento (anda sozinho, não volta atrás, não invade a etapa
seguinte).

Verificado num navegador de verdade, rodando a sequência completa etapa por etapa: a tela cheia
fica visível do início ao fim (nenhum piscar no meio) e some sozinha depois de concluir.
