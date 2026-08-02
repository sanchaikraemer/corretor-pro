# NOTAS v1113 — Cadência do cliente que nunca respondeu (10 retomadas em 6 meses)

## De onde veio

Ideia do dono (02/08/2026), lendo o relatório da pesquisa mundial (v1107): em vez de o cliente
que NUNCA respondeu disputar a fila pelos critérios normais (dias parado, chance de fechar —
que não existem sem resposta), ele segue um **calendário fixo de retomadas**, até 10 mensagens
em 6 meses, e aí o app sugere arquivar. Bate exatamente com os números da pesquisa: 8–12
contatos convergem, 44% dos corretores desistem no 1º, 74% dos fechamentos vêm depois de 6
meses — e a "mensagem de despedida" do fim é a que mais gera resposta.

## O calendário (a partir do 1º contato registrado)

| Período | Retomadas | Dias |
|---|---|---|
| Mês 1 | 3 | 7, 14, 21 |
| Mês 2 | 2 | 35, 50 |
| Mês 3 | 2 | 65, 80 |
| Mês 4 | 1 | 105 |
| Mês 5 | 1 | 135 |
| Mês 6 | 1 (encerramento) | 165 |

Após as 10 sem nenhuma resposta: aviso no lead com a frase combinada — **"Arquive este lead:
esgotaram as 10 tentativas em 6 meses sem retorno."** — e botão de arquivar. **Nunca arquiva
sozinho** (regra da casa desde sempre).

## As 3 regras fechadas com o dono

1. **Toque só conta quando ele agiu** — atendimento registrado (marcar atendido, copiar
   mensagem, nota manual). Dias distintos: 3 cópias no mesmo dia = 1 toque. Sugestão ignorada
   **espera** — nunca "queima" uma das 10. Intervalo mínimo de 7 dias entre toques (corretor
   atrasado não recebe sugestões em rajada).
2. **Só entra quem nunca respondeu** desde o 1º contato (`clientMessageCount = 0`, histórico
   inteiro). Qualquer resposta do cliente numa reimportação tira do filtro na hora.
3. **Arquivar é sugestão com botão**, decisão do corretor.

## Onde aparece

- **Fila do dia (Hoje)**: o lead da cadência só aparece quando a retomada vence (entre uma e
  outra, some — sem cobrança fora de hora). Na linha, no lugar da barra de mensagens (que seria
  sempre vazia), aparece "↻ Retomada N de 10" / "Encerramento" / "Arquivar sugerido · 10/10".
- **Dentro do lead**: aviso com a situação ("a próxima é a retomada N de 10, programada pra
  DD/MM") ou a sugestão de arquivar com botão.
- As mensagens de retomada em si são as **3 sugestões da IA** que o lead já tem — copiar uma
  delas registra o toque sozinho (mecânica que já existia).

## Validação

| Verificação | Resultado |
|---|---|
| Suíte completa | 284 testes verdes (novo: `v1113-cadencia-cliente-sem-resposta`) |
| `npm run build` | ok, versão 1113 |
| Navegador de verdade | linha da fila com a etiqueta da retomada + os 2 avisos do lead |

O teste novo roda a função real com datas construídas: calendário exato, quem entra/não entra,
vencimento no dia certo, dias distintos, intervalo mínimo, encerramento na 10ª e sugestão de
arquivar depois — mais os regexes de integração (fila, linha, detalhe).

## Arquivos alterados

**Código:** `app.js`

**Documentação:** `NOTAS-v1113.md` (novo)

**Versão:** `package.json`, `package-lock.json`

**Testes (novo):** `tests/v1113-cadencia-cliente-sem-resposta.test.mjs`
