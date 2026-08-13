# v1250 — print da resposta do cliente vira texto na observação

Pedido do dono:

> "quando vem poucas respostas do cliente, em vez de ter que reimportar tudo de novo e demorar, só
> dar um print na resposta, colocar em observação e ele transcrever e salvar... será que não
> facilitaria?"

Facilita, e muito. Hoje, pra registrar **duas linhas** que o cliente respondeu, o caminho é:
exportar a conversa inteira no WhatsApp → enviar o arquivo → esperar a análise rodar de novo.
Trabalho grande demais pro tamanho da novidade — e é justamente o tipo de coisa que faz o corretor
desistir de registrar, deixando a carteira desatualizada.

## Como ficou

Dentro do cliente, no quadro **"Registrar observação"**, ao lado de "Gravar áudio", entrou
**"Ler print da resposta"**:

1. Toca no botão e escolhe o print (no celular abre direto a galeria/câmera).
   No computador dá pra **colar a imagem com Ctrl+V** dentro do próprio campo de texto.
2. O texto das mensagens aparece no campo, uma por linha, marcando quem escreveu
   (`Cliente:` / `Eu:`) e a hora, quando ela aparece no print.
3. **Você confere e corrige** — é texto comum, dá pra editar à vontade.
4. Toca em **Salvar observação**, como sempre fez.

A partir daí é uma observação igual a qualquer outra: entra na linha do tempo do cliente e é lida
como **fato confirmado** na próxima análise. Nada de novo pra aprender.

## Isto NÃO é a volta do que a v1069 removeu

Precisa ficar registrado, porque a semelhança é enganosa. A v1069 removeu três funções — **"extrair
lead de um print"**, **"detectar rosto pra avatar"** e **"ler conversa por vários prints"** — com
esta justificativa: *"essas três nunca funcionaram bem e o dono confirmou que nunca vai usar"*.

A diferença é o tamanho do que se pede à IA:

| | v1069 (removido) | v1250 (agora) |
|---|---|---|
| O que a IA fazia | **Reconstruía** a conversa/o cadastro a partir de imagens | Só **passa pra texto** o que está escrito |
| Quem decidia | A IA, sozinha | O corretor, conferindo antes de salvar |
| Gravava direto? | Sim | **Não. Nada.** |
| Tamanho da tarefa | Conversa inteira, vários prints | Duas ou três mensagens, um print |

A fronteira está trancada no código e no teste: a ação `ler-print` **não faz nenhum
`update`/`insert`/`upsert`/`delete`**, não cria lead e não mexe em etapa. Ela devolve texto. Ponto.

## Por dentro

- **Rota**: ação nova `ler-print` dentro de `api/cerebro-config.js` (rota que já existia — o plano
  da Vercel permite no máximo 12 funções e o projeto está em 11).
- **Modelo**: o de visão já configurado no projeto (`modeloVisao()`, hoje `gpt-4o`).
- **Instrução**: transcrever **somente** o texto visível, na ordem, marcando quem escreveu pelo lado
  do balão (esquerda = cliente, direita = você) e a hora quando aparece — **sem corrigir, resumir,
  completar, traduzir ou comentar**, e sem descrever a imagem. Print sem texto legível devolve
  "SEM TEXTO" e a tela avisa em português, em vez de inventar alguma coisa.
- **Teto diário por conta**, igual ao que a transcrição de voz já tem (`cerebro-leitura-print`;
  100/dia, 20/dia em conta de teste, ajustáveis por variável de ambiente). Sem isso, seria a única
  função de IA do sistema sem rede de segurança de custo.
- **Custo registrado** no relatório de uso de IA (rota `ler-print-conversa`).
- **A imagem é reduzida no próprio aparelho** antes de subir (lado maior em 1600 px, JPEG 85%).
  Print de celular moderno passa de 3 MB; subir isso cru numa rede de rua é o caminho certo pro
  pedido morrer no meio do envio. Reduzido fica em algumas centenas de KB, com o texto legível.
- **Recusas com aviso claro, antes de gastar IA**: formato que não é imagem, imagem grande demais
  (teto de 5 MB no servidor) e imagem vazia.

**Detalhe que quase virou bug:** o botão usa `document.getElementById(...)` no `onclick`, e não o
atalho `qs(...)` usado no resto do arquivo. `app.js` é um módulo — `qs` **não existe** no escopo em
que um `onclick` do HTML roda (o mesmo motivo das linhas `window.funcao = funcao` espalhadas pelo
projeto). Escrito com `qs`, o botão seria um botão morto. O teste tranca isso.

## Testes

`npm test` verde: 24 arquivos checados + **409 testes**. Novo:
`tests/v1250-ler-print-da-resposta.test.mjs` — e ele **executa a função de verdade**, com um OpenAI
de mentira, conferindo que o texto volta inteiro, que a imagem viaja no formato certo, que a
instrução proíbe inventar, que os tetos existem, e que a ação não grava nada no banco.

Conferência no navegador (Chromium, 390 px): abri um cliente, escolhi um print, o texto entrou no
campo de observação e o aviso "Confira o texto acima e toque em Salvar observação" apareceu — sem
nenhum erro de página.

## Uma limitação honesta

A leitura é boa, mas não é infalível: print borrado, letra muito pequena ou balão cortado no meio
podem sair com erro. É exatamente por isso que o texto **cai no campo pra você conferir** em vez de
ser salvo direto. Print mais próximo, só das mensagens que interessam, sai melhor do que print da
tela inteira.
