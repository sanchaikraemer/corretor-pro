# v1145 — a IA só escreve o que aparece na tela (7 dos 12 campos cortados)

Regra dada pelo dono, e ela vale como lei do projeto de agora em diante:

> "Cara, se não aparece na tela, não precisa existir, você não acha? Estamos perdendo tempo e
> gastando energia à toa... se não é usado (aparecer na tela) por que vai existir isso então?"

Ele está certo — e no caso da análise isso não era só faxina, era **tempo de espera**: o que faz a
importação demorar é a IA **escrever**. Ela escrevia 12 campos de diagnóstico; a tela mostra cinco.

## O que a tela realmente mostra (e continua sendo pedido à IA)

No cliente, bloco **"Detalhes comerciais"** (fica logo abaixo das sugestões de mensagem):

| Campo pedido à IA | Onde aparece |
|---|---|
| `pendenciaFinanceira` | linha **"Permuta / entrada com imóvel"** |
| `objecaoPrincipal` | linha **"Impedimento principal"** |
| `pedidoSemResposta` | linha **"Pedido do cliente ainda sem resposta direta"** |
| `ultimoCompromissoCliente` | linha **"Último compromisso"** |
| `ultimaPessoaFalar` | não aparece como texto: é o que decide o **"cliente esperando você"** na fila do dia |

## O que foi cortado (nunca apareceu em lugar nenhum)

- **`mensagemQueEuEnviariaHoje`** — o pior caso: a IA escrevia uma **quarta mensagem inteira** e o
  código já a jogava fora, guardando no lugar a mensagem A. Era escrita e descartada em 100% das
  análises.
- `ultimaInformacaoPrometida`
- `compromissoCorretorNaoCumprido`
- `produtosParalelos`
- `produtoPrincipal` (repetia o `produtoInteresse`, que é o que a tela usa em "Produto")
- `quemDeveAgirAgora` (só alimentava um "próximo passo" que nenhuma tela lê; o que a tela mostra é
  o `nextAction`, pedido à parte)
- `etapaFunil` (só alimentava a etapa; a tela usa `etapaSugerida`, pedida à parte)

## O que NÃO mudou

- **Nenhuma tela perdeu informação**: nada do que foi cortado era exibido.
- **O que fica salvo tem a mesma forma de antes**: cada campo cortado continua no registro,
  preenchido pelas reservas que já existiam no código (produto vem de `produtoInteresse`, etapa vem
  de `etapaSugerida`, próximo passo vem de `nextAction`, e a "mensagem de hoje" já era a mensagem
  A). Cliente antigo não perde nada.
- **As instruções de raciocínio continuam inteiras.** Só o que a IA precisa DIGITAR encurtou. Ela
  continua sendo mandada a considerar promessa não cumprida, pedido sem resposta e permuta ao
  escrever as três mensagens — isso é qualidade de mensagem, e não custa tempo de escrita.

## Efeito esperado

Menos texto pra escrever = menos espera na importação e na reanálise, sem trocar de modelo e sem
perder nada de tela. O tamanho exato do ganho só o uso real mostra (o dono vai medir na próxima
importação), mas a conta é direta: sai da resposta a maior parte do texto que era gravado e nunca
lido — inclusive uma mensagem completa.

## Validação

| Verificação | Resultado |
|---|---|
| Suíte completa | 318 testes verdes |
| Teste novo | `v1145-ia-so-escreve-o-que-aparece` — os cinco campos de tela continuam pedidos; os sete cortados não podem voltar ao pedido **e** seguem sem uso em tela; o objeto gravado mantém a forma antiga pelas reservas; a única citação de `mensagemQueEuEnviariaHoje` no app é conferência técnica, nunca exibição |
| `npm run build` | ok, versão 1145 |

## Arquivos alterados

**Código:** `api/_pipeline.js`

**Documentação:** `NOTAS-v1145.md` (novo)

**Versão:** `package.json`, `package-lock.json`

**Testes:** `tests/v1145-ia-so-escreve-o-que-aparece.test.mjs` (novo)
