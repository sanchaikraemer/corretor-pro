# v915 — reimportação com nome de contato editado não cria mais duplicata em silêncio

## O bug (relatado pelo dono, com prints do celular)

O corretor reimportou a conversa de um cliente já cadastrado. Tudo pareceu certo: a IA
transcreveu os áudios, analisou a conversa, ele copiou a mensagem sugerida e marcou o
atendimento — o lead na tela mostrava tudo atualizado, com "Atendido" verde. Ao voltar pra
Home, o card do mesmo cliente continuava em "Oportunidades esquecidas" como se nada tivesse
mudado. Ao clicar nele, a conversa nova e o atendimento marcado tinham "sumido".

**Causa raiz:** entre as duas importações, o nome do contato salvo no celular do corretor
mudou (ele editou o contato acrescentando uma palavra, ex.: o nome do empreendimento de
interesse atual). Isso muda dois sinais ao mesmo tempo:
- o nome do arquivo exportado pelo WhatsApp (que carrega o nome do contato);
- o `clientName` que a IA extrai da conversa.

`acharLeadExistente` (app.js) só reconhecia "é o mesmo cliente" com **nome tecnicamente
idêntico** ao já salvo. Como o nome mudou, nenhum lead existente era encontrado — e o app
**salvava direto como cliente novo**, sem perguntar nada (esse era o comportamento do "senão"
em `renderProcessedResult`). Resultado: um segundo cadastro foi criado com a conversa e o
atendimento atualizados; o cadastro antigo, nunca tocado, continuou parado e visível em
"Oportunidades esquecidas". Da perspectiva do corretor, a atualização "desapareceu" — na
verdade foi parar num cadastro que ele não sabia que existia.

Isso é uma lacuna já conhecida (ver `NOTAS-v815.md`: *"Exportações do WhatsApp sem número de
telefone dependem do nome/arquivo, que pode variar entre importações"*) — mas até aqui o app
nunca dava chance nenhuma de o corretor perceber a divergência antes de salvar.

## O que mudou

- **Nova função `nomesParecemMesmoCliente`** (`app.js`): considera dois nomes "parecidos" só
  quando as **duas primeiras palavras são idênticas** (nome + sobrenome) **e** todas as palavras
  do nome mais curto aparecem, na mesma ordem, dentro do mais longo (só tolera palavra(s) A MAIS
  no meio/fim — nunca fora de ordem, nunca sobrenome diferente).
- **`acharLeadExistente`** agora devolve, além do `nome-exato` de sempre, um `nome-parecido`
  quando só bate por essa checagem.
- **`renderProcessedResult`**: quando o nome só é parecido (não idêntico), o app **para e
  pergunta** — "Pode ser o mesmo cliente que já existe... É o mesmo cliente?" — com três opções:
  atualizar o cadastro existente, salvar como cliente novo, ou cancelar. Continua **nunca
  fundindo sozinho** (decisão fica sempre com o corretor, como já era o princípio desde a
  v827-16) — a mudança é só não deixar mais o caso "nome mudou um pouco" cair direto no fluxo de
  "cliente novo" sem avisar ninguém.
- Nome idêntico continua no fluxo de sempre (atualiza direto, sem essa pergunta extra); nome sem
  nenhuma semelhança continua salvando como novo automaticamente, como antes.

## O que este ajuste NÃO faz

Não mexe na deduplicação do servidor (`_nomesMesmoLead`/`_buscarProcessamentoExistenteV681` em
`api/_persistence.js`), que continua exigindo igualdade técnica — ela nunca decide fusão sozinha
por design (evita juntar duas pessoas diferentes de mesmo nome). A pergunta ao corretor no
cliente é a camada que faltava para o corretor não ser pego de surpresa quando o nome varia
entre importações.

## Cadastros duplicados já existentes

Este ajuste evita duplicatas **novas**. Um cadastro que já foi duplicado por esse bug antes da
v915 continua duplicado — precisa ser resolvido manualmente pelo corretor (localizar os dois
cadastros do mesmo cliente e apagar/consolidar o mais antigo).

## Verificação
- `tests/v915-nome-parecido-avisa.test.mjs` (novo): testa `nomesParecemMesmoCliente` isolada
  (palavra extra no meio/fim, sobrenome diferente, fora de ordem, nomes vazios/curtos) e confere
  que `acharLeadExistente`/`renderProcessedResult` tratam o caso "nome-parecido" com uma
  pergunta explícita ao corretor, oferecendo salvar como novo.
- Suíte inteira verde (`npm test`); `node --check app.js` OK.

## Arquivos
- `app.js` (`_palavrasNome`, `nomesParecemMesmoCliente`, `acharLeadExistente`,
  `renderProcessedResult`), `tests/v915-nome-parecido-avisa.test.mjs` (novo), `NOTAS-v915.md`,
  versão **914 → 915**.
