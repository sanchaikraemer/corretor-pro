# v827-12 — a análise não é mais descartada por causa das 3 mensagens

## O problema

Na etapa "Analisando — validando as três mensagens pelo Cérebro", quando a IA gerava as
três sugestões de mensagem e alguma delas não cumpria as regras do Cérebro (saudação por
horário, expressão proibida, mais de uma pergunta, dado numérico ausente da conversa,
abertura genérica de retomada etc.), o sistema tentava corrigir automaticamente **duas
vezes**. Se mesmo assim a IA insistisse em descumprir alguma regra, a **análise inteira
era descartada** — mesmo já tendo baixado o ZIP, transcrito os áudios e montado o
diagnóstico completo. Do lado do app isso aparecia como "Não foi possível analisar.",
de forma intermitente: o mesmo ZIP podia falhar numa tentativa e funcionar na seguinte,
dependendo só de a IA acertar as regras de primeira.

## A correção

Depois das duas tentativas normais de correção pela IA, se as mensagens ainda não
passarem na validação, o sistema agora monta as três mensagens de forma **determinística**
(`construirMensagensDeterministicasCerebro` em `api/_pipeline.js`): usa só fatos reais já
extraídos da conversa (produto identificado, âncora mais citada, próximo passo do
diagnóstico), aplica a saudação certa pelo horário/Cérebro, remove expressões proibidas,
garante exatamente uma pergunta ao final e respeita limites de caracteres/palavras — as
mesmas regras que `validarMensagensCerebro` cobra da IA. Esse fallback nunca inventa preço,
prazo ou qualquer dado numérico.

Resultado: a análise **sempre chega ao corretor** com diagnóstico e as três mensagens,
mesmo no caso raro em que a IA não consiga cumprir as regras do Cérebro.

## Validação

- Versão interna: `7.127.12`. Versão exibida: `827-12`.
- Novo teste `tests/v827-12-fallback-mensagens.test.mjs`: confirma que o fallback gera
  três mensagens distintas, que passam na validação do Cérebro (saudação, uma pergunta,
  sem termos proibidos) tanto em modo continuidade quanto em retomada (citando um fato
  real da conversa).
- Suíte completa (33 conjuntos) e build (`versão=827-12`) sem erro.
