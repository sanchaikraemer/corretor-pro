# Corretor Pro v750 — limpeza real de legado

Correção estrutural depois da v748/v749:

- Front não exibe mais mensagens de análises com arquitetura antiga.
- Reanálise não herda mensagens, produto, unidade ou nextAction antigos.
- Se a IA falhar, o sistema deixa a análise pendente; não restaura sugestão velha.
- Compactação incremental com resumo/análise anterior desativada na reanálise.
- Fallback comercial antigo não é usado para completar mensagens.
- Mantido apenas o mínimo técnico para API devolver JSON.

Depois de subir, reanalisar o lead. Mensagens antigas salvas não devem mais aparecer.
