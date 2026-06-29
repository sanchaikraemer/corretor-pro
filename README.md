# Corretor Pro — v040

Aplicativo web/PWA para importar conversas exportadas do WhatsApp, organizar mensagens e transcrições, analisar o atendimento com inteligência comercial e gerar sugestões de resposta.

## Principais funções

- importação incremental, sem duplicar mensagens;
- transcrição de áudios `.opus` com novas tentativas automáticas;
- nova tentativa, em reimportações, para áudios que permaneceram com falha;
- período de 30, 60, 90 dias ou todo o histórico;
- análise comercial com imagem da última proposta;
- diferenciação entre cliente direto e corretor parceiro;
- identificação do usuário do app como **Sanchai**;
- reconhecimento de conversas pelo nome e pelo DNA das mensagens, reduzindo risco de misturar homônimos;
- sincronização leve: a lista consulta apenas resumos e o histórico completo é carregado ao abrir o lead;
- PWA com cache versionado pela fonte central `version.js`.

## Versão

- versão visual e operacional: `v040`;
- versão do pacote: `0.40.0`;
- fonte central: `version.js`.

## Publicação

```bash
npm test
npm run check
npm run build
```

A Vercel usa `build.js` para gerar a pasta `public` e `server.js` para as rotas da API.
