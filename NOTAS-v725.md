# NOTAS v725 — Correção consolidada

Versão consolidada para encerrar a sequência v724 e voltar ao controle principal de versão.

## O que foi corrigido

- Atualização de versão para `7.25.0` / display `725`.
- `package-lock.json` alinhado com o `package.json`.
- `service-worker.js` deixou de usar `724-2` fixo e passou a usar o token `__VERSION__` no cache e nos assets.
- Implementado fallback determinístico para completar as 3 mensagens comerciais quando a IA retornar apenas 1 ou 2 sugestões.
- A análise não deve mais apagar todas as mensagens quando faltar uma variação.
- Cérebro Comercial voltou a ser injetado no prompt principal da análise, usando método, tom, regras, conhecimento e catálogo quando disponíveis.
- Janela de áudio corrigida: mensagens escritas entram completas; apenas os áudios obedecem ao período escolhido.
- Antes da importação, o usuário escolhe período de transcrição dos áudios: 30, 60, 90 dias ou todo o período. O padrão é 90 dias.
- Áudios fora do período escolhido ficam identificados na linha do tempo como não transcritos por estarem fora da janela.
- Rotas de processamento por Storage passaram a receber e preservar `audioWindowDays`, `audiosParaTranscrever` e `audioFilesForaDaJanela`.
- Segurança da API reforçada em produção: sem `CORRETOR_PRO_API_KEY`, a API bloqueia chamadas em ambiente production, salvo se `ALLOW_UNPROTECTED_API=true` for definido conscientemente.
- Ajustes de marca visível para Corretor Pro. Nomes internos antigos foram preservados quando necessários para não quebrar armazenamento, tabelas ou compatibilidade.

## Validação feita

- `npm ci`
- `npm test`
- `npm run build`

O build gerou `public` com versão `725` e service worker com cache `corretor-pro-static-v725`.

## Observação

Não foram testadas chamadas reais de OpenAI/Supabase neste ambiente, porque dependem das variáveis e credenciais de produção.

## Verificação pré-deploy
- Validação reforçada em 08/07/2026: `npm ci`, `npm test` e `npm run build` passaram.
- Teste manual de ZIP confirmou: mensagens escritas ficam completas; áudio fora da janela não é enviado à transcrição; opção `todo` inclui todos os áudios.
- Rótulo do Cérebro ajustado para deixar claro que a configuração padrão limita somente áudios, não o texto da conversa.
