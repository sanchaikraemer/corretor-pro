# Corretor Pro — Atualização 826

Segundo módulo do plano de estabilização. Tema geral: **Atendimento, etapas
comerciais e fila de prioridade**. Esta primeira entrega do módulo trata a
**guarda do "Negociando"** (§6.3 e §6.4) — as demais frentes (fila por fatos §6.6 e
tela Atendimentos §6.5) vêm em seguida.

## Guarda determinística do "Negociando"

A etapa comercial só pode virar **"Negociação"** quando existe **evidência concreta**
de negociação na conversa. Pedir informação, receber uma apresentação, fazer uma
visita ou ficar sem responder **não bastam** para classificar o lead como negociação.

Evidências aceitas (plano §6.3):

- proposta ou contraproposta;
- pedido ou discussão de desconto;
- discussão de entrada, parcelas, financiamento ou forma de pagamento (inclui simulação);
- reserva;
- condição comercial específica / ajuste de valor;
- escolha de unidade acompanhada de negociação de valores ou condições.

Quando a IA sugere "Negociação" sem nenhuma dessas evidências, a etapa é rebaixada
para o que os fatos justificam: **"Visita/Proposta"** se houve visita/apresentação,
senão **"Atendimento"**.

A guarda fica em um único lugar (`ajustarEtapaNegociacao` em `api/_pipeline.js`,
aplicada na saída de `analyzeWithBrain`), então tanto a **importação** quanto a
**reanálise** herdam a etapa já protegida.

### Caso Maria Clarisse (§6.4)

Cliente pediu informações, recebeu os detalhes e ainda não respondeu; o corretor
marcou atendimento. Resultado correto, agora garantido:

- **Etapa comercial:** continua onde estava (não pula para "Negociação").
- **Situação operacional:** "atendida hoje / aguardando resposta" — registrada pelo
  botão de atendimento, que já **não altera** a etapa comercial
  (`api/reanalisar-lead.js`), e por "Copiar", que já é só ação de interface e **não**
  registra atendimento (`app.js`).

## Validação

- Versão interna: `7.126.0`. Versão exibida: `826`.
- Novo teste `tests/v826-negociando-guard.test.mjs`: cobre o caso Maria Clarisse, "só
  pergunta", "só visita" e seis variações com evidência real de negociação, além de
  confirmar que a guarda não rebaixa outras etapas.
- Suíte completa (24 conjuntos) e build (`versão=826`) concluídos sem erro.

## Fila por fatos (§6.6) — versão 826-1

A ordem da fila deixou de vir de pesos subjetivos ocultos (+120, +92, −34, −300, …) e
passou a seguir uma **precedência determinística de 7 níveis**, com o **motivo factual
visível** em cada card:

1. Cliente respondeu e ainda não recebeu resposta.
2. Compromisso do corretor está vencido.
3. Retorno está marcado para hoje.
4. Negociação real aguarda ação do corretor.
5. Atendimento está programado.
6. Retomada é necessária pelo tempo sem contato.
7. Lead está aguardando resposta do cliente.

- A decisão foi isolada numa função pura `filaPorFatos(fatos)` em `app.js`, que recebe
  apenas fatos (booleanos) e devolve nível/grupo/título — testável diretamente.
- As supressões factuais foram preservadas: lead **atendido recentemente** sai da fila
  de ação imediata (§6.7) e **volta** assim que o cliente fala de novo; **lembrete
  futuro**, **cliente pediu tempo** e **trava externa** continuam segurando o lead.
- O score interno virou apenas função do nível (degrau de 1000), com desempate factual
  por recência — a ordenação existente (`scoreRankingHoje`) continua funcionando.

## Ainda dentro do Módulo 826 (próxima entrega)

- **Tela Atendimentos (§6.5):** reconhecer todas as fontes reais de atendimento e
  ordenar do mais recente para o mais antigo, com atualização imediata.

## Validação da fila por fatos

- Novo teste `tests/v826-fila-fatos.test.mjs`: executa a função pura e confere os 7
  níveis, a precedência entre eles, o mapa de grupos e as supressões (atendido, lembrete
  futuro, pediu tempo, trava externa), além de confirmar que os pesos antigos saíram.
- Suíte completa (25 conjuntos) e build (`versão=826-1`) sem erro.

## Como testar depois de publicar

1. Abrir um lead que só pediu informação / recebeu apresentação e clicar em
   **Reanalisar**: a etapa não deve aparecer como "Negociando".
2. Abrir um lead com proposta, desconto, entrada/parcelas ou reserva e reanalisar: a
   etapa "Negociação" deve ser mantida.
