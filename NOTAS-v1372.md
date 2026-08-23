# v1372 — revisão final da mensagem canônica

A v1371 acertava a prioridade comercial e já impedia B/C de pularem para entrada ou parcelas, mas a revisão antes do deploy encontrou uma brecha: a conferência ainda aceitava uma mensagem que fazia a pergunta certa e terminava ali. Isso não reproduzia por inteiro a qualidade da mensagem aprovada no caso Julsimar.

## O que ficou mais rígido

1. **Mesma lacuna + mesma jogada completa**
   - As três opções continuam pedindo o mesmo dado prioritário.
   - Agora o fichário e o prompt dizem a mesma coisa, sem a expressão antiga de “abrir estratégias diferentes”.

2. **Pergunta precisa ter consequência prática**
   - Quando existe lacuna prioritária, não basta perguntar o dado correto.
   - A mensagem precisa dizer o que o corretor fará com a resposta: filtrar opções, selecionar unidades, montar a condição, comparar ou executar o próximo passo sustentado pela conversa.

3. **Conferência determinística e reparo automático**
   - A regra acima não ficou apenas no prompt.
   - Se a IA terminar numa pergunta solta, a conferência acusa e a mesma tentativa de reparo das mensagens é acionada antes de mostrar ao corretor.

4. **Regressão real do Julsimar**
   - A mensagem aprovada passa sem aviso.
   - A antiga opção A da v1370, apesar de perguntar a faixa correta, é reprovada por não explicar o que acontece depois da resposta.
   - Entrada e parcelas/reforços continuam bloqueados enquanto a prioridade for faixa total de investimento.

## Segunda revisão antes do deploy

A revisão final encontrou e fechou uma brecha adicional: a conferência olhava a última pergunta da mensagem. Assim, uma sugestão poderia perguntar uma lacuna secundária primeiro (ex.: entrada) e terminar perguntando a lacuna prioritária (ex.: faixa), escapando da trava. Agora todas as perguntas comerciais reconhecíveis da mesma mensagem são conferidas: saudação social como “Tudo bem?” é ignorada, mas qualquer qualificação secundária é bloqueante e aciona o reparo.

Também foram atualizados dois testes históricos (v1219 e v1277) que ainda pressupunham que nunca existiria a tentativa única de reparo criada na v1370. A regra de produto permanece: não há reescrita textual local/silenciosa; há no máximo uma nova chamada de IA para reescrever somente A/B/C quando a conferência determinística reprova as sugestões.
