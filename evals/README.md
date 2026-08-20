# Bateria de conversas — como saber se a IA melhorou ou piorou

Esta pasta existe por um motivo só: **hoje não há como saber se uma mudança no jeito de pedir
análise para a IA melhorou ou piorou o resultado.** Foi isso que fez agosto de 2026 virar um
vaivém de publicar e desfazer — a auditoria de 16/08 mediu que, dos 437 arquivos de teste,
**356 apenas leem o código** procurando se um trecho está lá. Nenhum deles responde se a análise
está boa.

A bateria tem **duas camadas**. Elas servem para coisas diferentes.

---

## Camada 1 — roda sozinha, de graça, em toda alteração

**Arquivo:** `tests/v1283-bateria-conversas-comerciais.test.mjs` (roda dentro do `npm test`)

Confere tudo que o sistema decide **sem a IA**: quem é o cliente, quem falou cada mensagem, o que
vai dentro do pedido enviado para a IA. Não gasta um centavo e não depende da internet.

É a camada que pega a família de erro que quebrou o sistema em 16/08 (contato salvo como
"Anderson Corretor" virando o lado da empresa, e a fala do cliente indo para a IA rotulada como
mensagem do corretor).

Se algo aqui ficar vermelho, **não publique**.

---

## Camada 2 — fala com a IA de verdade, custa dinheiro, roda quando você mandar

**Arquivo:** `evals/executar.mjs`

Manda cada conversa para a IA de verdade e confere a análise que volta: se o cliente foi
identificado, se o pedido que estava pendente foi tratado, e se as três mensagens não fizeram
nada do que aquela situação proíbe.

**Ela nunca roda sozinha** — nem na suíte, nem na publicação. Precisa de chave e de um comando
explícito, porque cada rodada completa gasta em torno de **R$ 3 a R$ 5** de IA.

```
OPENAI_API_KEY=xxx node evals/executar.mjs
```

Opções úteis:

```
node evals/executar.mjs --caso=oferta-ja-ignorada     # roda uma conversa só
node evals/executar.mjs --salvar=antes                # guarda o resultado com um nome
node evals/executar.mjs --comparar=antes              # roda de novo e mostra o que mudou
```

## O porteiro (v1327) — mexeu no prompt, a suíte cobra a medição

O miolo do prompt (o piso comercial e as instruções da análise) fica cercado por marcadores
`INÍCIO/FIM DO MIOLO DO PROMPT` dentro de `api/_pipeline.js`. A assinatura desse trecho está
registrada em **`evals/assinatura-do-prompt.json`**, junto com a data e o resultado da última
medição.

`tests/v1327-porteiro-do-prompt.test.mjs` compara os dois. **Mexeu no miolo e não atualizou o
registro → suíte vermelha → publicação parada** (desde a v1325 a Vercel publica com
`npm test && node build.js`).

Não é para impedir mudança de prompt. É para impedir mudança de prompt **sem medir** — que é
exatamente o que fez agosto de 2026 virar publicar-piorar-desfazer.

O ritual, quando for mexer:

```
node evals/executar.mjs --salvar=antes      ← antes de mexer
   ... a mudança é feita ...
node evals/executar.mjs --comparar=antes    ← depois de mexer
   ... atualize evals/assinatura-do-prompt.json (assinatura, data, versão, casos, resultado)
```

Atualizar a assinatura sem rodar a bateria é mentir para o próprio projeto.

---

### O uso que importa: antes e depois

Esta é a razão de existir da camada 2. Ao mexer no prompt:

```
node evals/executar.mjs --salvar=antes      ← antes de mexer
   ... a mudança é feita ...
node evals/executar.mjs --comparar=antes    ← depois de mexer
```

A saída mostra, conversa por conversa, **o que melhorou, o que piorou e o que ficou igual**. É a
regra do `CLAUDE.md` ("alteração de prompt entra com antes e depois na mesma conversa real") virada
em ferramenta, em vez de boa intenção.

---

## As conversas

São **32** hoje (v1327 — a auditoria de 20/08/2026 pediu de 30 a 50). Ficam em
`evals/conversas/*.json`, uma por arquivo. Todas foram escritas a partir de **situações
reais já registradas nas notas de versão** (o print de 14/08 da oferta repetida, o parceiro, a
pausa marcada pelo cliente, e por aí). **Nenhuma contém dado de cliente de verdade** — os nomes e
os valores são inventados; o que é real é a *situação comercial*.

### Como uma conversa é escrita

```json
{
  "id": "oferta-ja-ignorada",
  "titulo": "O corretor ofereceu a mesma apresentação duas vezes e o cliente não respondeu",
  "veioDe": "NOTAS-v1277.md — print do dono de 14/08/2026",
  "corretorNome": "Sanchai",
  "nomeArquivo": "Conversa do WhatsApp com Marcos Pereira.txt",
  "conversa": [
    { "date": "01/08/2026", "time": "09:00", "author": "Sanchai", "text": "..." }
  ],
  "esperado": {
    "clienteChamaSe": "Marcos Pereira",
    "quemFalouPorUltimo": "corretor",
    "tentativasSemResposta": 2,
    "vozDoCorretorNaoPodeConter": ["quero 3 dormitórios"],
    "aIaPrecisaPerceber": ["a apresentação já foi oferecida duas vezes sem resposta"],
    "asMensagensNaoPodem": ["oferecer a apresentação pela terceira vez"],
    "asMensagensPrecisam": ["propor um encontro com dia e horário concretos"]
  }
}
```

Os quatro primeiros campos de `esperado` são conferidos **sem IA** (camada 1). Os três últimos
(`aIaPrecisaPerceber`, `asMensagensNaoPodem`, `asMensagensPrecisam`) são escritos em português
comum e conferidos na camada 2, por uma segunda leitura da IA — que recebe só a situação, o
resultado e a régua, nunca a resposta esperada pronta.

### Para acrescentar uma conversa sua

Copie um arquivo, troque o texto e escreva o que você esperaria de um bom corretor naquela
situação. Se for conversa de cliente real, **troque os nomes antes** — esta pasta vai para o
repositório.

---

## O que esta bateria **não** é

Não é medida de venda. Ela responde "a análise entendeu a situação e conduziu direito?", nunca
"isso vendeu?". O resultado comercial é outro assunto (achado A4 da auditoria) e vem da conversa
reimportada, não daqui.
