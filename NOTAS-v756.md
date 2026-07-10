# v756 — correção efetiva da etapa de análise

- Corrige desalinhamento de arquitetura entre backend e front.
- Usa chamada de análise mais rápida/estável para importação, com retry curto.
- Reduz contexto técnico enviado para evitar estouro/timeout na etapa "Analisando atendimento".
- Mostra o erro real da IA no front, em vez de toast genérico.
- Mantém a análise sem prompts comerciais longos, sem regras antigas e sem fallback que inventa mensagens.
