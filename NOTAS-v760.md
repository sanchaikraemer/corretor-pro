# Corretor Pro — v760

Correção efetiva do Cérebro na análise.

## Correções

- Backend agora usa o Cérebro enviado pelo app/localStorage antes do banco.
- Se não houver banco nem localStorage, backend usa o prompt mínimo oficial como fallback, sem regras antigas.
- Caminho legado `processZipBuffer` também passa `cerebroConfigOverride`; antes podia analisar sem Cérebro.
- Modo completo do `processar-storage` também repassa o Cérebro.
- Prompt da análise reforça que o Cérebro salvo é obrigatório.
- Campo de debug na análise: `cerebroFonteUsada` e `cerebroRecebidoNaAnalise`.
- Teste TESTE-CEREBRO: se o Cérebro pedir essa palavra, a terceira sugestão deve terminar com ela.

## Importante

O Cérebro ainda pode aparecer como salvo localmente se a tabela `direciona_config` não existir. Mesmo assim, nesta versão, o conteúdo salvo localmente é enviado junto para a análise.
