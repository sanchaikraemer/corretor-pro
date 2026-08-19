# v1315 — a análise voltou ao estado de 17/08, por ordem do dono

*"Volte essa análise a 48h antes... porque de lá pra cá ficou uma merda"* (19/08/2026, 18h).

Feito. O miolo da análise — o pedido que vai pra IA e a lógica que monta esse pedido — voltou a ser
o da **v1292 (17/08, 14h40)**, que é o texto que o **próprio dono escreveu** na v1291 e mandou
publicar sem alteração, mais a lista de frases proibidas que voltou na v1292.

## O que saiu (tudo que foi empilhado no miolo entre 18/08 16h44 e 19/08 17h35)

- a rede que **reescrevia** a sugestão por fora do pedido (v1295/1299/1302/1303);
- "um caminho só" e a regra do "sem compromisso" (v1298);
- a lista de **perguntas já feitas** (v1297) e a de **mensagens já enviadas** (v1309);
- **"joia não é resposta"** (v1300);
- **valores citados há muito tempo** e a conferência de endereço inventado por fora do pedido
  (v1305);
- **prazo marcado pelo cliente** e o filtro de cortesia nas tentativas sem resposta (v1308);
- as regras de "entregue o que está escrito" e "cliente que volta não se qualifica de novo"
  (v1313), que eu tinha acabado de escrever.

## O que NÃO voltou atrás (não é análise — é encanamento, e sem isso o app não funciona)

- **o parâmetro que o modelo novo exige** (v1311). Sem ele, nenhuma análise sai. Ficou.
- **nunca cair pra um modelo mais fraco em silêncio** (v1308) — ordem do dono, ficou.
- **casos de outro cliente e fatos da carteira fora do pedido** (v1301) — ordem do dono, com print
  do endereço inventado. Continuam fora, com o motivo escrito no código.
- **as quatro chaves da análise** (Cérebro, aprendizado, regras de escrita, manual do app).
- **erro da IA em português na tela** (v1310/v1314) e o aviso de análise reaproveitada.
- **leitura de imagem, PDF e link** e o reaproveitamento do que já foi lido (v1306/07/12).
- **a prova na tela** (quanto do Cérebro e do aprendizado entrou nesta análise).
- carteira que travava, arquivo conferido no aparelho, segunda tentativa do histórico do cliente.

## Testes

Os testes que guardavam as regras removidas foram apagados junto com elas (v1295 a v1305 e v1313):
guardar uma regra que não existe mais é pior que não ter teste. Os que protegem ordens do dono
(v1301, v1212) e o que sobrou da v1308 foram reescritos e continuam de pé.

`npm test`: 30 arquivos checados + 459 testes, verdes.

## A lição, registrada

É a **segunda vez** que este projeto precisa fazer esta operação — a primeira foi a v1247,
restaurando ao dia 11/08. O padrão é o mesmo: várias camadas de regra empilhadas no miolo da
análise, no mesmo dia, sem medir cada uma contra conversa real. Cada uma parece uma melhoria
isolada; juntas, engessam a IA e o resultado piora.

**Daqui pra frente, mudança no miolo da análise só entra medida contra conversa real do dono,
uma de cada vez.**
