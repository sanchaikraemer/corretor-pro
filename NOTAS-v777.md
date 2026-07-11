# v777 — Fim da confusão "arquivar / geladeira / perdido"

## O pedido (observação do usuário)

"Perdido, geladeira, arquivar… não é nomenclatura e lugar demais pra mesma finalidade?"

Estava certo. Existiam **só 2 destinos reais**, mas **3 palavras** e botões repetidos pra chegar neles.

## O que existia de verdade

Só dois estados de saída (etapas no banco):

- **Geladeira** — sai das listas ativas, guardado pra revisitar. Volta com "Reativar".
- **Perdido** — arquivo morto, não converteu. Volta com "Reabrir".

O problema era a palavra **"Arquivar"**, que não tinha significado próprio:

- Na tela do lead havia **dois botões colados** — "Colocar na geladeira" e "Arquivar" — chamando a **mesma** função (`arquivarLead`), os dois indo pra Geladeira.
- Em outra UI, o botão "Arquivar" também ia pra Geladeira.
- Mas o fluxo de "Perdido" também se chamava de "arquivar" ("vai pro arquivo morto").

Ou seja: "arquivar" ora era Geladeira, ora era Perdido.

## O que foi feito (`app.js`) — dois verbos, só

1. Removido o botão **"Arquivar"** duplicado da tela do lead (ficou só "Colocar na geladeira").
2. O outro botão "Arquivar" virou **"Colocar na geladeira"** (é pra onde ele já mandava).
3. O rótulo interno "Arquivado/Geladeira" virou só **"Geladeira"**.
4. As confirmações agora **explicam cada destino** em vez do genérico "Marcar como X?":
   - Geladeira: "…sai das listas ativas, mas fica guardado pra você reativar depois."
   - Perdido: "…sai das listas ativas e da busca (dá pra reabrir depois)."

"Arquivar" deixou de existir como **ação**. A seção do menu continua se chamando "Arquivo" — mas só como um lugar que **guarda** Perdidos + Geladeira, não como um botão. Nenhuma função foi perdida: quem quer pausar usa Geladeira, quem perdeu usa Perdido.

## Testes

- `npm test` e `npm run build` passaram.
- Falta validar em produção: abrir um lead e conferir que agora há um único caminho claro pra cada destino (Geladeira / Perdido) e que os textos de confirmação batem.
