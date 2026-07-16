# v827-17 — mostra o motivo quando a mensagem vem do fallback genérico

## O problema

Desde a v827-12, quando a IA não consegue cumprir as regras do Cérebro mesmo após as
tentativas normais de correção, o sistema usa um fallback determinístico (mensagens
genéricas construídas com fatos reais) em vez de descartar a análise inteira. Isso evita
o "Não foi possível analisar.", mas criou um novo problema: o corretor não tinha como
saber SE e POR QUE aquilo tinha acontecido — o motivo original (por que a IA falhou)
era descartado assim que o fallback "resolvia" a análise. Resultado: quando o texto
genérico aparecia repetidamente, não dava pra diagnosticar a causa real sem acesso ao
banco de produção.

## A correção

- `analyzeWithBrain` (`api/_pipeline.js`) agora guarda o motivo original da reprovação
  em `motivoFallbackMensagens` antes de qualquer sobrescrita, e devolve isso junto da
  análise.
- A tela do lead (`app.js`, seção "Fazer agora") mostra um aviso curto quando
  `mensagensGeradasPorFallback` é verdadeiro, com o motivo exato listado — visível
  direto na tela, sem precisar de acesso ao banco pra diagnosticar.

## Validação

- Versão interna: `7.127.17`. Versão exibida: `827-17`.
- Novo teste `tests/v827-17-motivo-fallback-visivel.test.mjs`: confirma que o motivo é
  guardado antes da sobrescrita, que entra no objeto de análise retornado, e que a tela
  do lead checa e exibe esses dois campos.
- Suíte completa (36 conjuntos) e build (`versão=827-17`) sem erro.

## Próximo passo

Com isso visível, da próxima vez que o texto genérico aparecer dá pra ver o motivo
exato na própria tela (em vez de reportar só o sintoma) e corrigir a causa raiz
específica — em vez de ficar tentando adivinhar.
