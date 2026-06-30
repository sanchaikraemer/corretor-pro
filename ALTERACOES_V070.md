# Corretor Pro v075 — foco funcional interno

Esta versão não implementa login e não implementa cadastro de imóveis. O objetivo é validar a função principal: importar conversas do WhatsApp, organizar histórico, transcrever áudios, analisar comercialmente e indicar quem merece ação agora.

## Alterações aplicadas

- Versão atualizada para `v075` / `0.75.0` em app, servidor, cache, HTML, pacote e documentação.
- Home reposicionada como **Mesa do corretor**, com:
  - quantidade de atendimentos para responder;
  - atendimentos para retomar;
  - oportunidades quentes;
  - conversas sem análise;
  - cards prioritários com motivo da ação.
- Priorização comercial melhorada:
  - resposta recente do cliente pesa mais;
  - atendimento parado há dias sobe para retomada;
  - proposta anexada aumenta relevância;
  - etapa financeira, visita, proposta, contrato, FGTS, entrada e parcelas pesam no score;
  - lead sem análise aparece como ação inicial.
- Cards da lista agora mostram ação sugerida: gerar análise, responder, retomar, conduzir ou abrir.
- Limite de áudio ampliado de 4 MB para 12 MB, com variável opcional `MAX_AUDIO_BYTES` no servidor.
- Análise comercial ganhou fallback automático de modelo: se o modelo configurado falhar por indisponibilidade/modelo inválido, tenta modelos alternativos.
- Documentação atualizada, removendo referência operacional antiga à v040.
- Estética comercial reforçada no painel de prioridade, mantendo a identidade escura/neon.

## Validação executada

```bash
npm run check
npm test
npm run build
```

Resultado: 55 testes passaram e o build gerou a pasta `public`.
