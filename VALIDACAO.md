# Validação — Corretor Pro v076

## Alterações validadas

- áudios com status `error`, `empty` ou `missing` entram novamente na fila em uma reimportação;
- áudios já concluídos, fora do período ou acima do limite não são processados inutilmente;
- conversas com nomes iguais são diferenciadas pelo DNA das primeiras mensagens e pela sobreposição de fingerprints;
- registros antigos sem DNA são reconhecidos por mensagens coincidentes e preservam a chave original;
- `Sanchai` é tratado como o usuário/corretor do aplicativo; outros autores são interpretados como o contato;
- a sincronização periódica recebe apenas resumos dos cards;
- o histórico, a proposta e a análise completos são baixados somente quando o lead é aberto e há versão remota mais recente;
- versão unificada em `version.js`, cabeçalho, cache, API de saúde, build e documentação;
- textos de “Todo o período” não formam frases incorretas.

## Comandos obrigatórios

```bash
npm test
npm run check
npm run build
```


## Validação adicional da v076

- limite de áudio ampliado para 12 MB;
- fallback de modelo na análise comercial;
- home reposicionada como mesa do corretor, com motivo de prioridade e ação sugerida;
- versão atualizada de forma consistente para `v076` / `0.76.0`.
