# v1310 — o erro em português (a conta da OpenAI estava sem crédito) e a quarta chave

Duas coisas pedidas pelo dono na conversa de 19/08/2026, à tarde.

---

## 1. O motivo apareceu — mas em inglês e em código

A v1309 fez a tela dizer **por que** a análise nova não saiu, em vez de devolver calada as
mensagens antigas. Funcionou: no print das 15h44 apareceu

> `[HTTP 429 · code=credit_balance_exhausted · type=insufficient_quota] You have no credits
> remaining. Add credits to continue using the API at https://platform.openai.com/...`

E a resposta do dono foi: *"isso não me resolve nada"*. Estava certo — **o motivo certo, escrito na
língua errada**. Quem lê é corretor de imóveis.

Agora esse mesmo erro chega assim:

> **A conta da OpenAI (a inteligência que escreve as análises) está SEM CRÉDITOS.** Enquanto ela
> não tiver saldo, nenhuma análise nova sai — nem aqui, nem no Reanalisar. Para resolver: entre em
> platform.openai.com, vá em Billing (cobrança) e adicione créditos. Feito isso, é só reanalisar:
> nada se perdeu.

…com um **botão que abre direto a página de créditos**. O texto técnico continua guardado no
Diagnóstico, que é onde ele serve.

Outros erros do provedor também viraram português: excesso de chamadas em pouco tempo, chave de
acesso recusada, tempo esgotado e modelo não liberado na conta.

**Importante:** isto **não conserta** a falta de crédito — nenhum código conserta. O que muda é que
a tela passa a dizer, em uma frase, o que está acontecendo e onde se resolve.

## 2. A quarta chave: "Usar o manual de vendas do app"

Pergunta do dono: *"se eu desligar tudo isso, vai analisar puramente o histórico como o ChatGPT?"*

Não ia. Com as três chaves da v1308 desligadas (Cérebro, aprendizado, regras de escrita), o app
**ainda mandava um manual de condução que vem de fábrica nele** — a Inteligência Comercial Base. Não
tem nada do corretor (nem preço, nem empreendimento, nem regra dele), mas é orientação comercial, e
por causa dela a comparação com o ChatGPT nunca era limpa.

Agora existe a quarta chave, em **Cérebro → Chaves da análise**. Com as quatro desligadas, o que vai
pra IA é **só a conversa** — igual ao que ele cola no ChatGPT. Padrão: ligada (quem nunca mexeu
continua exatamente como estava). Quando alguma está desligada, a faixa vermelha em cima da análise
diz qual — agora citando também esta.

**O que NÃO é desligável, nem com as quatro chaves fora:** as proteções de integridade — não
inventar fato, valor, data, condição ou promessa, e não transformar silêncio em aceite. Elas não são
método comercial: são o que impede o app de escrever pro cliente um preço que ninguém disse (regra
do projeto desde a v827).

## Arquivos

- `api/_pipeline.js` — `erroDaIAEmPortugues` (tradução dos erros do provedor), quarta chave
  aplicada no pedido, `motivoDaAnaliseNovaNaoTerValido` exportado para o teste executar de verdade.
- `api/cerebro-config.js` — a chave nova, com padrão ligado, na leitura e na gravação.
- `app.js` — erro traduzido também no caminho da importação, botão da página de créditos, quarta
  chave na tela e na faixa de "análise de teste".
- `index.html` — a quarta chave e o texto que explica o que ela faz.
- Teste: `v1310-quarta-chave-e-erro-da-ia-em-portugues`.
