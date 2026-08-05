# v1144 — uma busca por importação (o dono viu a incoerência e ela era real)

Pergunta do dono, depois de ler as notas da v1143: **"por que 2x em cada importação? não tem nem
coerência isso, por quê?"**

Ele está certo, e a resposta honesta é: por descuido histórico. A busca "esse cliente já existe?"
rodava duas vezes porque foi escrita em dois momentos diferentes, pra duas perguntas que ninguém
percebeu serem a mesma:

| Quando | Pergunta | Pra quê |
|---|---|---|
| Ao abrir o ZIP | "esse cliente já existe?" | reaproveitar as transcrições já pagas dele — e, desde a v1141, a análise já salva |
| Ao salvar | "atualizo o cadastro que existe ou crio um novo?" | trava contra cadastro duplicado |

A resposta é idêntica nas duas. E desde a v1141 a **primeira já devolve o id** do cliente
encontrado — a segunda estava varrendo a carteira inteira pra redescobrir algo que o próprio
sistema já sabia dez segundos antes.

## O que mudou

A segunda busca agora **recebe o id que a primeira encontrou e confere aquela linha** — uma leitura
pontual de um registro — em vez de varrer a carteira de novo.

**Por que conferir e não confiar direto:** esse id vai e volta pelo navegador (viaja dentro do
resultado da análise). Nada que vem de fora pode mandar numa decisão de fundir cadastros. A
conferência usa as MESMAS regras da busca (telefone, nome do arquivo ou nome do cliente); se não
bater — ou se a linha não existir — a busca completa roda inteira, como sempre. A trava contra
duplicata continua exatamente a mesma.

Somando com a v1143 (que tirou a análise inteira de toda a carteira dessa consulta), o que era
"duas varreduras da carteira por importação" virou **uma varredura + uma conferência de uma linha**
— e, quando as colunas de deduplicação estão aplicadas no banco (migração `0010`), nem varredura
existe: são consultas indexadas.

## Validação

| Verificação | Resultado |
|---|---|
| Suíte completa | 317 testes verdes |
| Teste novo | `v1144-uma-busca-por-importacao`, com banco de mentira: com o id, UMA consulta pontual (e presa à empresa); id de OUTRO cliente é rejeitado e a busca completa decide; id inexistente cai na busca normal e ainda acha; sem id, comportamento idêntico ao de antes |
| `npm run build` | ok, versão 1144 |

## Arquivos alterados

**Código:** `api/_persistence.js`

**Documentação:** `NOTAS-v1144.md` (novo)

**Versão:** `package.json`, `package-lock.json`

**Testes:** `tests/v1144-uma-busca-por-importacao.test.mjs` (novo)
