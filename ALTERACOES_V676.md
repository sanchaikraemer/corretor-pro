# Corretor Pro — versão 676

## Correção principal

O front-end estava atualizado, mas os arquivos serverless dentro de `/api` continuaram antigos. Por isso o fallback `analise-comercial-set` retornava “Action inválida”.

## Mudanças

- Atualiza corretamente `api/_pipeline.js`, `api/lead-update.js` e `api/reanalisar-lead.js`.
- Atualiza front, cache e versão para 676.
- Adiciona verificação no build que bloqueia arquivos de API duplicados na raiz.
- Mostra erro claro caso o backend publicado esteja desatualizado.

## Arquivos perigosos que devem ser excluídos da raiz

- `_persistence.js`
- `_pipeline.js`
- `lead-update.js`
- `processar-storage.js`
- `reanalisar-lead.js`

As versões válidas desses arquivos ficam somente dentro de `/api`.
