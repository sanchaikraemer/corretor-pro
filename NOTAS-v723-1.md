# v723-1 — Reset total do cérebro de análise

## Objetivo
Apagar, na prática, a arquitetura antiga de análise e sugestões da IA e deixar o comportamento mais próximo da análise pura do ChatGPT.

## O que mudou
1. `api/_pipeline.js`
   - arquitetura atual: `gpt55-v723-1-reset-total-analise-pura`.
   - o prompt principal foi reduzido para o prompt simples definido pelo usuário.
   - removido o uso de Cérebro, catálogo, aprendizado, orientações e prompts auxiliares dentro da análise principal.
   - removida a geração antiga de três mensagens.
   - removida a regeneração por segunda IA.
   - removida a validação pesada que reprovava/reparava mensagens.
   - `normalizarModeloComercial` e `finalizarAnaliseComercial` agora ficam como compatibilidade e não reescrevem análise, mensagem, probabilidade ou estratégia.
   - a IA agora retorna uma única análise em formato: resumo, diagnóstico comercial, o que falta descobrir, próxima mensagem, estratégia e prioridade.

2. `app.js`
   - versão visual ajustada para #723-1.
   - arquitetura local atualizada para o novo motor.

3. `service-worker.js`
   - cache renovado para `v723-1`.

4. `package.json` / `package-lock.json`
   - versão atualizada para `7.23.1` / display `723-1`.

## O que NÃO foi feito
- Não mexi em layout.
- Não mexi em CSS.
- Não mexi em botões.
- Não mexi em importação, banco, ZIP ou transcrição.

## Teste obrigatório
1. Subir os arquivos alterados.
2. Confirmar #723-1 no topo.
3. Reanalisar Eder.
4. A análise deve se aproximar da estrutura pura:
   - resumo da conversa;
   - diagnóstico comercial;
   - o que falta descobrir;
   - próxima mensagem sugerida;
   - estratégia;
   - prioridade.
5. Se continuar aparecendo resposta artificial do tipo “parece que tua busca mudou” afirmando hipótese como fato, a versão falhou.
