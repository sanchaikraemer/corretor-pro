# v944 — despedida do cliente não conta como "cliente esperando você"

## O pedido do dono

Ao revisar o lead **Fábio Luís Vargas** (Personalité/Renaissance), o dono apontou um erro
específico no cálculo de `cpProbabilidadeFechamento` (v943): o bônus de +30 pontos por
"cliente esperando resposta" (`clienteEsperaVoce`) estava disparando porque o cliente foi,
cronologicamente, quem falou por último na conversa — mas essa última fala era só uma
despedida ("Claro" / "Obrigado pela atenção"), não uma pergunta nem um pedido. Nas palavras
dele: *"ele falou por último só se despedindo, não era uma pergunta, ou seja, isso não pode
ser ponderado."*

## O bug

`clienteEsperaVoce` (`app.js`, `cpProbabilidadeFechamento`) media só posição temporal:

```js
const clienteEsperaVoce = Number.isFinite(resp) && (!Number.isFinite(toque) || resp <= toque);
```

`resp <= toque` (dias desde a resposta do cliente ≤ dias desde o último toque do corretor)
diz apenas "o cliente falou depois do meu último contato" — sem checar SE aquela fala pedia
alguma coisa. Uma despedida como "Obrigado pela atenção" satisfaz essa condição do mesmo jeito
que uma pergunta real ("Consegue me mandar a planta?"), e as duas somavam o mesmo +30.

## A correção

Antes de aplicar o bônus, `cpProbabilidadeFechamento` agora busca a última mensagem real do
cliente (`ui670UltimaMensagemReal`, já usada em `ui670ModeloComercial` pra decidir a ação da
carteira) e só mantém o bônus se essa mensagem de fato pede resposta — mesma checagem que já
existe em `ultimaPedeResposta`: contém "?" ou começa com um verbo de pedido ("pode", "consegue",
"me manda", "qual", "quando", etc.). Uma despedida pura ("Claro", "Obrigado pela atenção",
"Perfeito") não bate nesse padrão e o bônus não é somado.

Quando não há como checar (lead sem `recentMessages`, ou última fala foi do corretor), o
comportamento antigo é mantido — o bônus continua valendo por padrão, sem regressão pros
casos que já funcionavam.

## Verificação

- `tests/v944-despedida-nao-conta-como-cliente-esperando.test.mjs` (novo): confere que a função
  usa `ui670UltimaMensagemReal`, que uma despedida ("Obrigado pela atenção", "Claro") não soma o
  bônus, que uma pergunta ou pedido real soma os +30, e que a ausência de dado pra checar não
  quebra o comportamento anterior.
- Suíte inteira verde (`npm test`); `node build.js` OK, versão 944.

## Arquivos
- `app.js` (`cpProbabilidadeFechamento`), `tests/v944-…` (novo), `package.json`/
  `package-lock.json`, `NOTAS-v944.md`, versão **943 → 944**.
