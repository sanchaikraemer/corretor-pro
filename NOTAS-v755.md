# v755 — IA limpa e importação estável

- Substitui o motor de análise por uma chamada limpa: conversa bruta + metadados mínimos.
- Remove o uso de fallback/template comercial antigo na geração de mensagens.
- A análise não recebe produto, unidade, nextAction ou análise antiga salva.
- Se a IA não devolver 3 mensagens novas, a tela pede reanálise em vez de mostrar lixo antigo.
- A chamada JSON agora usa `response_format: json_object` para reduzir falhas de parse.
- Aumentado o tempo técnico da etapa de análise sem mexer em regras comerciais.
