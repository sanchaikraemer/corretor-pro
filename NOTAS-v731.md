# Corretor Pro — v731

Limpeza segura e sincronização pós-v730.

## Ajustes

- Sincronizada a arquitetura de mensagens da interface com o prompt final v730: `v730-prompt-retomada-contextual`.
- Removida referência antiga `gpt55-v726-trio-blindado` do front.
- Removido cache/publicação dos logos antigos `logo-direciona-light.svg` e `logo-direciona-dark.svg`.
- Classes antigas de logo no CSS agora apontam para `logo-cp.png`.
- Versão atualizada para `7.31.0` / Atualização #731.

## Importante

Não foram removidas rotas da pasta `/api`, porque elas ainda são chamadas pelo front ou fazem parte do suporte/admin do sistema.

Arquivos antigos que podem ser apagados do GitHub depois de subir esta versão:

- `logo-direciona-light.svg`
- `logo-direciona-dark.svg`
