# v761 — Cérebro sem defaults antigos e usado pela análise

Correção real do Cérebro:
- API `cerebro-config` não devolve mais o default antigo “Método Corretor Pro”.
- Tela prefere o Cérebro salvo no navegador quando o banco/tabela não existe.
- Defaults antigos vindos do banco/localStorage são sanitizados e substituídos pelo prompt mínimo.
- Backend de análise mantém suporte ao `cerebroConfig` enviado pelo front.
- Pacote inclui app.js, api/cerebro-config.js, api/_pipeline.js, api/processar-storage.js e api/reanalisar-lead.js para não deixar caminhos divergentes.

Teste esperado: ao salvar TESTE-CEREBRO no método e reanalisar, a terceira sugestão deve terminar com TESTE-CEREBRO.
