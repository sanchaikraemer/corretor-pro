# Corretor Pro — v1376

## Fechamento da correção de análise de fundamento e do build

Esta versão consolida a v1374 e corrige os testes de regressão que estavam presos a formas antigas do código.

### Análise de fundamento

- Mantém a conversa completa no prompt.
- Separa contexto antigo de episódio comercial atual quando existe hiato temporal forte, sem apagar o histórico.
- Consolida fatos já definidos, perguntas já respondidas, informações já dadas pelo corretor e materiais/links já enviados antes da condução.
- O caso real da Augusta continua sendo a regressão principal: localização respondida não volta como pergunta, R$ 430 mil do anúncio não vira orçamento e o histórico de 2025 não comanda a negociação reativada em 2026.

### Suíte / build

- Atualizados testes antigos que procuravam nomes/frases de implementações já substituídas, sem alterar o comportamento que eles protegem.
- Corrigidos dois testes cujo recorte de código ficou vazio depois de refatorações (`v1312` e `v954`).
- O v1327 continua útil como detector de mudança do miolo do prompt, mas não bloqueia mais publicação por uma medição de IA que o próprio build limpo não consegue executar. A última medição real permanece registrada sem adulteração; hash diferente gera aviso explícito.
- Nenhum teste é pulado e a válvula `DIRECIONA_PULAR_TESTES_NO_BUILD` não é usada.

Versão: **1376** (`7.1376.0`).
