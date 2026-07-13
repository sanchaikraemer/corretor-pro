# Atualização #806 — Cérebro obedecido e retomadas validadas

- Corrige a geração de mensagens que ignorava regras salvas no Cérebro Comercial.
- O limite de retomada configurado no texto do Cérebro passa a ser lido pelo motor; o padrão é 7 dias.
- O sistema calcula os dias desde a última mensagem no fuso `America/Sao_Paulo` antes de gerar as respostas.
- Após o limite, as três mensagens precisam retomar um fato concreto da conversa e não podem usar aberturas genéricas ou passivas.
- As três sugestões precisam terminar com uma pergunta específica.
- Frases como “passando para saber”, “fico à disposição”, “só me chamar”, “me avise quando”, “se quiser” e “pensar com carinho” são bloqueadas nas retomadas.
- Se a primeira geração desobedecer, o sistema faz uma correção automática dedicada e valida novamente.
- Caso a correção ainda falhe, as mensagens incorretas não são exibidas; o lead fica pedindo nova análise.
- A arquitetura das mensagens foi atualizada para invalidar sugestões antigas e exigir reanálise.
- Adicionado teste funcional específico para cálculo de 65 dias, retomada, frases genéricas e pergunta final.
