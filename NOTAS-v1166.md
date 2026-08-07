# v1166 — o app pergunta "mudou alguma coisa?" antes de baixar a carteira inteira

O painel do Supabase acusou a cota de tráfego estourada: **7,11 GB de 5 GB** do plano grátis, com
período de tolerância até **04/09/2026** (depois disso as chamadas passam a ser recusadas — o app
para). Espaço não é problema nenhum: banco em 9% e arquivos em 6%.

O gasto é **egress** — dado saindo do Supabase. Duas correções já tinham atacado isso:

- **v1121** (03/08) — a atualização automática da Home passou de 30s para 2min;
- **v1136** (05/08) — a conversa de cada cliente saiu da busca da lista.

Deu resultado (de ~1,3 GB/dia para ~0,4 GB/dia), mas 0,4 GB/dia é o consumo de **uma** pessoa. Com
5 corretores no piloto seriam ~60 GB/mês, contra 5 GB do plano grátis.

## O desperdício que sobrou

A cada 2 minutos com a tela aberta, o app baixava até 2000 leads **com a análise comercial de cada
um** — e na esmagadora maioria dos tiques **nada tinha mudado desde o anterior**. Era pagar o preço
de um retrato completo pra descobrir que o retrato era idêntico.

## O que a v1166 faz

**1. Pergunta barata antes da busca cara.** Rota nova `leads-recentes?assinatura=1`, que devolve só
duas coisas: **quantos leads a empresa tem** e **qual foi a última alteração**. São ~80 bytes, contra
~1,2 MB da carteira completa numa base de 400 clientes. Se os dois forem iguais aos da carga
anterior, o app não baixa nada.

Qualquer mudança real mexe num dos dois: importar ou criar sobe o total **e** a última alteração;
editar, mudar etapa ou reanalisar sobe a última alteração; apagar baixa o total.

**A regra que vale acima de tudo: economizar nunca pode esconder novidade.** Toda dúvida resulta em
busca completa — resposta ruim do servidor, tempo esgotado, servidor sem assinatura confiável,
primeira carga da sessão, ou qualquer erro. E a economia vale **só pra atualização automática**: toda
ação do corretor (importar, salvar, mudar etapa) continua forçando a busca na hora, como sempre.

**2. Fim da busca em dobro.** Nas duas sincronizações, `carregarDashboard(true)` ia à rede de novo
logo depois de `loadRecentLeads(true)` ter baixado exatamente o mesmo conteúdo. O `force` sempre quis
dizer duas coisas ao mesmo tempo ("não use o retrato da memória" **e** "vá à rede"). Agora essas duas
passam `"reaproveitar"`: refazem as contas com o dado recém-chegado, sem uma segunda ida ao banco.
`true` continua significando as duas coisas em todo o resto do app.

## Medição (não é estimativa)

Navegador de verdade (Chromium), servidor de mentira contando cada byte, carteira de **400 clientes
com análise salva**, tela aberta e **nada mudando** — comparando a versão publicada anterior com esta:

| Cenário | v1165 | v1166 |
| --- | --- | --- |
| 400s (3 ciclos de atualização) | **4 buscas completas · 4,79 MB** | **2 buscas · 4 assinaturas · 2,40 MB** |
| Abrir o app + 6 voltas pra aba | **7 buscas · 8,38 MB** | **3 buscas · 7 assinaturas · 3,59 MB** |

Zero erro de JavaScript nos dois cenários, nas duas versões.

O número que importa não é a porcentagem desses minutos — é o **formato da curva**. Depois da
primeira carga, cada ciclo adicional sem mudança custa **~80 bytes** em vez de **~1,2 MB**. Num dia
de trabalho (8h com a tela aberta, ~240 ciclos, umas 10 mudanças reais), a conta sai de ~290 MB para
~12 MB — cerca de **95% menos**.

Rastreamento do portão, com marcação temporária no arquivo publicado, confirmando o comportamento:

```
[09:39] BUSCA COMPLETA            ← abrindo o app
[11:39] PORTAO: primeira vez -> busca
[11:39] BUSCA COMPLETA            ← 1º ciclo: ainda não havia com o que comparar
[13:39] PORTAO: igual -> PULA     ← 2º ciclo: nada baixado
```

## Arquivos

- `api/leads-recentes.js` — rota `?assinatura=1` e `calcularAssinaturaDaCarteira` (duas consultas
  minúsculas: a contagem é `head+count`, que não traz linha nenhuma; a marca traz uma coluna de uma
  linha só — ambas filtradas pela empresa, e nenhuma delas pede análise ou conversa).
- `app.js` — o portão (`cpCarteiraMudouDesdeAUltimaCarga`), usado no tique de fundo e na volta pra
  aba; `invalidarLeadsCache` passou a esquecer a assinatura (senão o app compararia com um retrato
  vencido); `carregarDashboard` aprendeu o modo `"reaproveitar"`.
- `tests/v1166-carteira-so-baixa-quando-muda.test.mjs` — novo. Roda a função de assinatura contra um
  banco de mentira e trava as quatro saídas de dúvida (todas resultando em busca completa), além de
  conferir que a pergunta barata vem antes da busca pesada no tique de fundo.
- `tests/v1121-…` e `tests/v1135-…` — duas guardas exigiam o formato exato de linhas que mudaram.
  Passaram a verificar a intenção (o tique usa `CP_SYNC_FUNDO_MS` e recarrega; o atalho de memória
  não carimba a carteira como fresca) em vez do texto literal. A `v1135` tinha um risco real: o
  `indexOf` do texto antigo devolvia -1 e o "trecho" analisado virava o arquivo inteiro.

## Conferência

- `npm test`: 24 arquivos + **333 testes**, verdes.
- Chromium headless, medição comparativa acima, zero erro de JavaScript.

## O que isso NÃO resolve

Não substitui a assinatura do plano pago do Supabase para o piloto. Esta versão derruba o consumo
de fundo, que era o maior gasto — mas **importar conversa gasta tráfego de verdade** (o ZIP e os
áudios entrando e saindo do Storage), e isso é uso legítimo que cresce com cada corretor novo. Com
5 parceiros importando todo dia, o plano grátis continua apertado.
