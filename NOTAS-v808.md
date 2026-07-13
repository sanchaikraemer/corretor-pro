# Atualização #808 — Aprendizado contínuo real

- Cria uma memória comercial estruturada e persistente, separada do formulário manual do Cérebro.
- Cada caso aprendido guarda: situação, sinal do cliente, impedimento, condução realmente usada pelo corretor, resposta posterior, resultado e regra reutilizável.
- O sistema nunca aprende com sugestões produzidas pela própria IA; somente mensagens realmente enviadas, observações e respostas reais do cliente.
- Diferencia condução observada de condução validada, parcial, inconclusiva ou que não funcionou.
- A primeira abertura após a publicação inicia, em segundo plano, a leitura de todos os históricos já importados, uma conversa por vez, sem travar as telas.
- O progresso é retomado automaticamente se a aba fechar, a internet cair ou uma conversa falhar.
- Uma conversa com erro volta para a fila e o bootstrap só é marcado como concluído depois da recuperação.
- Toda nova importação, reimportação e reanálise atualiza automaticamente o aprendizado quando a timeline mudou; históricos sem alteração são ignorados por hash.
- Antes de gerar novas sugestões, o motor recupera os casos anteriores mais parecidos e usa obrigatoriamente a lógica comercial relevante, sem copiar nomes, produtos, preços ou fatos para outro cliente.
- Conversas longas preservam todas as conduções do corretor e principalmente as mensagens mais recentes, em vez de aprender apenas com o começo do histórico.
- A tela de Inteligência Comercial mostra quantos históricos e casos reais já foram aprendidos, sem percentuais ou score.
- “Apagar tudo que aprendeu” remove tanto as categorias antigas quanto os novos casos estruturados, preservando as regras digitadas manualmente.
- Inclui teste do caso Lorena: a mensagem real sobre verificar se o terreno foi vendido é aprendida; a sugestão antiga da IA sobre retorno da direção é excluída.
