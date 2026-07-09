# Corretor Pro — v740

## Correção principal
- Corrige a ordem dos acontecimentos nas sugestões.
- Se o cliente pediu fotos, vídeo ou material e o corretor já enviou depois, a IA não deve escrever como se ainda fosse enviar.
- A retomada passa a mencionar o material já encaminhado, o compromisso do cliente depois de receber e o próximo passo comercial coerente.

## Exemplo corrigido
No caso Silvana/Personalité, após o corretor já ter enviado o vídeo/fotos, as mensagens deixam de usar “seguem as fotos” ou “estou enviando as fotos” e passam a retomar a avaliação com o esposo e a visita.

## Validação
- Mantém a lógica aprovada da v739.
- Acrescenta trava determinística para mensagens incompatíveis com a ordem real da conversa.
