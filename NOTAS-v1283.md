# v1283 — bateria de conversas: agora dá pra saber se a IA melhorou ou piorou

## Por que isto existe

Achado A6 da auditoria de 16/08/2026: dos **437 arquivos de teste** do projeto, **356 apenas leem o
código-fonte** procurando se um trecho está lá. Nenhum respondia a pergunta que decide o produto —
*"a análise entendeu a situação e conduziu direito?"*.

Foi por isso que:

- o erro do contato salvo como **"Anderson Corretor"** (v1282) passou pelos 437 testes sem acender
  nenhuma luz;
- agosto virou um vaivém de publicar e desfazer no prompt, porque cada mudança era avaliada por
  sensação. A regra do `CLAUDE.md` já dizia "alteração de prompt entra com antes e depois na mesma
  conversa real" — só que não existia ferramenta para isso, então era boa intenção.

## O que entrou

Uma pasta `evals/` com **8 conversas** escritas a partir de situações reais já registradas nas
notas de versão (o print de 14/08 da oferta repetida, o corretor parceiro, a pausa marcada pelo
próprio cliente, a objeção que o produto não resolve, e por aí). **Nenhuma tem dado de cliente de
verdade** — nomes e valores são inventados; o que é real é a situação comercial.

Cada conversa traz o que se espera de um bom atendimento, escrito em português comum:

```
"aIaPrecisaPerceber":  ["a apresentação já foi oferecida duas vezes sem resposta"]
"asMensagensNaoPodem": ["oferecer a mesma apresentação pela terceira vez"]
"asMensagensPrecisam": ["propor um encontro com dia e horário concretos"]
```

### Camada 1 — roda de graça, em toda alteração

`tests/v1283-bateria-conversas-comerciais.test.mjs`, dentro do `npm test`.

Confere, em cada conversa, tudo que o sistema decide **antes de falar com a IA** — que é exatamente
onde o erro da v1282 morava:

1. **quem é o cliente** (o nome do cartão, que decide em qual cadastro a conversa entra);
2. **quem falou por último** (decide "aguardando o cliente" × "responder agora" na fila);
3. **quantas tentativas do corretor ficaram sem resposta e quais são os textos** — e falha se uma
   fala do CLIENTE entrar nessa lista (era assim que a IA ficava proibida de tratar justo o que o
   cliente pediu);
4. **quais mensagens entram como exemplo de voz do corretor** — e falha se a fala do cliente entrar
   ali (era assim que a IA copiava o jeito de escrever da pessoa errada).

Custo: zero. Não depende de internet. Conversa nova em `evals/conversas/` entra sozinha.

### Camada 2 — fala com a IA de verdade, só quando o dono mandar

`evals/executar.mjs`. **Não roda na suíte nem na publicação** — exige chave e comando explícito,
porque uma rodada completa gasta em torno de R$ 3 a R$ 5.

```
OPENAI_API_KEY=xxx node evals/executar.mjs
node evals/executar.mjs --caso=oferta-ja-ignorada
node evals/executar.mjs --salvar=antes
node evals/executar.mjs --comparar=antes
```

Ela manda cada conversa para a análise real e depois pede a uma segunda leitura da IA que confira,
item por item, se a régua escrita em português foi cumprida. O juiz recebe a situação, o resultado
e a régua — **nunca a resposta certa pronta** — e precisa justificar cada veredito citando trecho.

O uso que importa é o **antes e depois**:

```
node evals/executar.mjs --salvar=antes      ← antes de mexer no prompt
   ... a mudança é feita ...
node evals/executar.mjs --comparar=antes    ← depois
```

A saída diz, conversa por conversa, o que **melhorou**, o que **piorou** e o que ficou igual, e
avisa em letras maiúsculas quando algo quebrou.

## O que mudou no código do sistema

Uma linha, e nenhuma mudança de comportamento: `exemplosDoCorretor` (em `api/_pipeline.js`) ganhou
a palavra `export`, para a camada 1 conseguir conferi-la sem gastar IA. O corpo da função está
intacto.

`tests/run-all.mjs` passou a rodar a checagem de sintaxe também nos arquivos de `evals/` — como
eles não rodam na suíte, um erro de digitação lá só apareceria no dia da comparação de prompt, que
é justamente a hora errada.

`.gitignore` ganhou `evals/resultados/`: as rodadas guardadas são material de trabalho local, não
entram no repositório.

## Suíte

**24 arquivos checados + 439 testes, todos verdes.**

## O que isto destrava

Além de proteger a análise, esta bateria é pré-requisito de uma economia grande já identificada na
auditoria: o bloco de instrução é idêntico em toda análise, e a OpenAI cobra metade do preço por
trecho repetido reconhecido no **começo** do pedido — mas hoje o primeiro trecho variável entra
logo na linha 29 do prompt de sistema, e todo o miolo fixo vem depois. Reorganizar essa ordem pode
cortar perto da metade do item que responde por **79% da conta de IA**, sem reescrever nenhuma
regra. Só que mudar ordem de prompt muda comportamento — e agora existe como medir isso antes de
publicar.

## O que esta bateria não é

Não é medida de venda. Ela responde "a análise entendeu e conduziu direito?", nunca "isso vendeu?".
O resultado comercial é o achado A4 da auditoria e vem da conversa reimportada — não daqui, e não
de formulário.
