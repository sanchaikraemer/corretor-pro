# v1377 — corte de contexto sem apagar o que o cliente já informou

## Correção
A v1374 separou corretamente episódios comerciais depois de hiatos longos, mas a revisão pré-publicação encontrou um risco: o corte podia fazer fatos explícitos antigos (ex.: finalidade, dormitórios ou faixa de valor) desaparecerem do estado usado para evitar repetição.

A v1377 mantém duas camadas:
- **episódio atual**: decide pendências, perguntas abertas, promessas e condução;
- **histórico completo**: preserva fatos explicitamente informados pelo cliente, para não perguntar de novo só porque houve um hiato.

Assim, contexto promocional antigo não volta a comandar a negociação, mas o sistema também não sofre amnésia comercial.

## Regressões
- Augusta continua 7/7.
- Novo teste `v1377-corte-nao-apaga-fatos`: hiato de 224 dias preserva moradia, 3 dormitórios e faixa já informada, sem reativar pergunta antiga como pendência.
