# v739 — IA pensante e contexto real nas sugestões

Correção em cima da v738.

## Problema corrigido
A v738 corrigiu o status dos produtos, mas exagerou nas regras e templates. Em contextos diferentes, as sugestões podiam sair quase iguais, mudando só nome e produto. Isso fazia a IA parecer um modelo fixo, não uma análise comercial real.

## Ajustes feitos
- Reforcei no prompt que as regras são travas, não modelos prontos.
- Adicionei a camada “IA pensante e contexto real”: antes de escrever, a IA deve considerar última fala real do cliente, última fala do corretor, compromisso pendente, pedido feito, pessoa envolvida na decisão, produto, status do produto e melhor próximo passo.
- Cada sugestão deve usar pelo menos um fato concreto da conversa, além do nome do produto.
- O fallback deixou de substituir automaticamente todas as mensagens quando há direcionamento comercial do corretor.
- O fallback agora só entra quando a mensagem vem inválida, proibida, incompatível com o status real do produto ou com erro claro de contexto.
- O fallback também ficou mais contextual, usando fatos como esposo/esposa, fotos, plantas, valor, condição, metragem, visita ou localização.
- Mantida a lógica aprovada da v736/v737/v738: retomada contextual, mudança de jornada quando real, direcionamento comercial quando foi o corretor que conduziu, e status real do produto.

## Testes
- npm test passou.
- npm run build passou.
- Build gerou Atualização #739.
- Teste interno confirmou que uma mensagem boa da IA não é mais sobrescrita por template.
- Teste interno confirmou que mensagem errada tratando Renaissance como pronto continua sendo corrigida.
