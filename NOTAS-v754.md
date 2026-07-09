# v754 — Histórico e limpeza do detalhe do lead

- Remove o percentual circular do detalhe do lead e o código visual ligado a esse score no card principal.
- Adiciona botão “Copiar histórico” no topo da aba “Últimas mensagens”.
- Melhora a velocidade ao abrir/atualizar lead: o detalhe não força mais reconstrução da lista inteira de leads a cada renderização.
- Mantém a IA sem prompt/regras comerciais adicionadas novamente.


Correção complementar:
- Importação não finaliza como sucesso se a IA não gerar análise + 3 mensagens.
- Reimportação não reutiliza análise antiga nem envia previousAnalysis para a IA.
- API processar-storage retorna erro quando a análise não conclui, permitindo retry sem salvar lixo.
