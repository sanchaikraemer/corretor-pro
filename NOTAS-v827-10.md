# v827-10 — atualização sem segunda análise

- Corrige o HTTP 422 ao atualizar cliente existente depois de a conversa já ter sido analisada.
- O botão Atualizar salva exatamente a análise que passou pelo Cérebro em `/api/processar-storage`; não chama a OpenAI novamente.
- Remove a opção de criar novo cliente quando o nome já existe.
- A persistência também deduplica no servidor (`forceNew: false`).
- A evolução da reimportação é registrada de forma determinística, sem chamada extra à IA.
