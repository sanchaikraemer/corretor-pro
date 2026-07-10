# v762 — Cérebro como fonte única real

- Remove defaults antigos do Cérebro no front e no backend.
- Define o prompt mínimo novo como padrão oficial.
- O Cérebro salvo localmente é enviado em todas as rotas de análise/importação/reanálise.
- A API usa primeiro o Cérebro recebido do app; banco é fallback; vazio fica vazio.
- Sanitiza textos antigos como “Método Corretor Pro” para impedir que voltem do localStorage/banco.
- Inclui marcador interno `_cerebroFonte` e `_cerebroMetodoTeste` na análise para validação.
- Atualiza arquitetura para v762-cerebro-fonte-unica.
