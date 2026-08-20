# v1327 — a bateria de conversas triplicou e virou porteiro do prompt

Quinto bloco da auditoria de 20/08/2026. Ela foi direta sobre a maior fragilidade do produto:

> "A avaliação que realmente pergunta 'a IA entendeu a situação e conduziu direito?' fica em
> `evals/executar.mjs`, usa IA real e é manual. […] Toda mudança no coração da análise deveria
> exigir um score mínimo da bateria comercial antes de produção. E eu aumentaria de 10 para algo
> como 30–50 casos comerciais canônicos anonimizados."

É o ponto que explica agosto inteiro: mexer no prompt, publicar, piorar, desfazer. Não faltava
cuidado — faltava régua.

## 1. De 10 para 32 conversas

Foram escritas 22 conversas novas, todas a partir de situações que **já aconteceram de verdade**
neste projeto (estão nas notas de versão), com nomes e valores inventados. Cada uma traz, escrito
em português comum, o que um bom corretor **precisa perceber**, o que as mensagens **não podem**
fazer e o que elas **precisam** fazer:

- a entrada em permuta que muda a faixa de compra inteira;
- preço de meses atrás convivendo com o preço de hoje na mesma conversa;
- o preço atual que veio dentro da arte lida (imagem), não no texto;
- a seleção de imóveis que estava atrás de um link;
- o cliente que sumiu sete meses e voltou sozinho;
- a pergunta direta do cliente que ficou sem resposta;
- o pedido de desconto que ninguém autorizou;
- quem decide junto (o pai, o sócio, a esposa);
- o cliente que avisa que comprou com outro;
- a pausa com prazo marcado pelo próprio cliente;
- o critério que veio em áudio, não em texto;
- o investidor que não vai morar no imóvel;
- o "ok" que não é avanço nenhum;
- o corretor que prometeu retorno e não voltou;
- o pedido objetivo respondido com outra coisa;
- a comparação com o concorrente pelo valor da parcela;
- "achei caro" sem nenhum número do lado do cliente;
- o primeiro contato de anúncio, sem informação nenhuma;
- o cliente que quer financiar e nunca simulou crédito;
- o indeciso entre duas unidades;
- o prazo curto de mudança contra a entrega na planta;
- a proposta formal enviada e o silêncio depois dela.

A camada 1 (sem IA, custo zero) confere as 32 em todo `npm test`: quem é o cliente, quem falou por
último, quantas tentativas do corretor ficaram sem resposta e o que entra como exemplo da voz dele.
A camada 2 (com IA de verdade) é a que lê a análise e as três mensagens contra a régua escrita —
essa continua custando dinheiro e rodando quando o dono mandar.

## 2. O porteiro

O miolo do prompt — o piso comercial e as instruções da análise — passou a ficar cercado por
marcadores dentro do código, e a assinatura dele está registrada em
`evals/assinatura-do-prompt.json`, junto com a data e o resultado da última medição.

Se alguém mexer no miolo e não registrar a medição, **a suíte fica vermelha** — e, desde a v1325,
suíte vermelha **não publica**. O erro não diz "teste falhou": diz o que fazer, passo a passo
(rodar a bateria antes, mexer, rodar depois, registrar o que melhorou e o que piorou).

Isso não impede mudar o prompt. Impede mudar **sem medir** — que é a regra que o `CLAUDE.md` já
mandava em palavras desde a v1247, e que palavra nenhuma segurou nas madrugadas de agosto.

**Honestidade sobre o registro atual:** a camada 2 não foi rodada nesta sessão — ela precisa da
chave da OpenAI do dono, que esta sessão não tem. O registro diz isso com todas as letras: a
assinatura marca o miolo como ele está hoje, e a primeira medição completa com IA é a próxima vez
que o dono rodar `node evals/executar.mjs`.

## Verificação

- `tests/v1283` (camada 1) roda as 32 conversas: 4 conferências em cada, sem gastar IA.
- Guarda nova: `tests/v1327-porteiro-do-prompt.test.mjs`.
- `npm test`: 31 arquivos checados + 474 testes, verdes.
- Nada muda na tela.
