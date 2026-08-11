# v1211 — "existia, mas existia aonde?": dá pra ver o cadastro antes de juntar

Pergunta do dono, 11/08/2026, depois de três importações seguidas caírem na pergunta "pode ser o
mesmo cliente que já existe": *"existia, mas existia aonde? Dois nomes."*

Ele estava certo em desconfiar. A pergunta pedia uma decisão **irreversível** — responder "Sim"
funde as duas conversas num cadastro só, e não existe desfazer — mostrando **um nome e mais nada**.
Pra conferir se aquele cadastro existia mesmo, ele teria que sair da importação e procurar na mão. E
procurar não resolvia: o cadastro antigo costuma ter o nome curto (sem o empreendimento no fim), então
buscar pelo nome longo da importação não acha nada e parece que o app inventou um cliente.

## O que mudou

Na própria pergunta agora tem o botão **"Ver esse cadastro"**. Ele abre, **ali mesmo**, o cadastro que
o app apontou:

- nome completo e se está **ativo ou arquivado**;
- empreendimento e telefone;
- **quando foi a última mensagem guardada**;
- as **últimas mensagens** daquele cadastro.

Batendo o olho nas mensagens dá pra saber em dois segundos se é o seu cliente. Tocar de novo esconde.

Duas decisões de projeto que valem registrar:

1. **Não leva pro lead.** O painel abre dentro da tela da importação porque sair dela no meio é
   exatamente o caminho que já travou a tela na v1192 — e a análise que acabou de rodar (que custou
   processamento e transcrição) continua intacta na memória enquanto o painel está aberto.
2. **É leitura pura.** Nada é gravado nem alterado ao conferir. Se o histórico não vier (rede ruim),
   o painel mostra o que já se sabe do cadastro em vez de ficar vazio.

O texto do painel termina lembrando o que fazer com o que ele viu: se as mensagens são do mesmo
cliente, **Sim**; se for outra pessoa, **"Não, é outro — salvar novo"** — aí nada se mistura.

## O que NÃO mudou

A regra de juntar continua igual: nome só parecido **nunca** funde sozinho, sempre pergunta (v1176).
O botão não decide nada — só mostra.

## Arquivos alterados

- `js/importacao.js` — botão "Ver esse cadastro", painel e a função `verCadastroParecido`.
- `app.js` — `getLeadDetail` exportada (é ela que traz o histórico do cadastro apontado).
- `tests/v1211-ver-cadastro-parecido.test.mjs` — guarda de regressão: o botão vem antes dos botões de
  decidir, o painel abre e fecha, não navega pra fora da importação, não grava nada, e sobrevive a
  falha ao carregar o histórico.
- `package.json` / `package-lock.json` — versão 1211.
