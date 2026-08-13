# v1249 — a conversa é ENVIADA pelo compartilhar do WhatsApp, nunca "importada"

Ordem direta do dono, repetida várias vezes e desobedecida de novo na v1248:

> "QUANTAS VEZES JÁ TE DISSE Q NADA É IMPORTADO, E SIM ENVIADO PELO COMPARTILHAR DO WHATS?"

Ele está certo, e o erro é de vocabulário do produto, não de código. O que ele faz é: abrir a
conversa no WhatsApp, **exportar**, e **compartilhar/enviar** o arquivo pro Corretor Pro. "Importar"
é palavra de programador, descreve o que o sistema faz por dentro — e não o que ele faz na mão.

## O que mudou na tela

| Onde | Antes | Agora |
|---|---|---|
| Menu da esquerda (computador) | Importar conversa | **Enviar conversa** |
| Botão da tela Hoje (celular) | Importar conversa do WhatsApp | **Enviar conversa do WhatsApp** |
| Título da tela | Importar conversa | **Enviar conversa do WhatsApp** |
| Cartão do Menu | Importar conversa | **Enviar conversa** |
| Atalho do painel de ações | ⇪ Importar conversa | **⇪ Enviar conversa do WhatsApp** |
| Desempenho | Importações / "ZIPs de conversa processados" | **Conversas enviadas** / "Conversas do WhatsApp processadas" |
| Cadastro manual | "Cadastre sem importar uma conversa" | "Cadastre sem **enviar** uma conversa" |
| Tela Hoje vazia | "Bom momento pra importar conversas novas." | "Bom momento pra **enviar** conversas novas." |
| Cérebro | "cada conversa importada é lida" / "com cada conversa que você importa" | "cada conversa **enviada** é lida" / "com cada conversa que você **envia**" |
| Aviso do histórico | Aguardando importação | **Aguardando a conversa** |
| Barra de progresso | "Preparando a importação…" | "Preparando…" |
| Aviso ao descartar | "Importação descartada." | "**Envio descartado.**" |

**O ícone também estava errado**: era uma seta pra BAIXO (que lê como "baixar/importar"). Virou
seta pra **cima** — enviar — nos dois atalhos.

## O que NÃO mudou

Nomes internos de código (`processFile`, `js/importacao.js`, `#btnImportarHome`, `data-nav-key`,
classes CSS, nomes de arquivo e de teste). Trocar isso não muda nada pro dono e só criaria risco de
quebrar o app. **A regra é sobre o que aparece na tela.**

Também ficou de fora, de propósito: **"Importar telefones (CSV)"**. Ali é outra coisa — um arquivo
de planilha que o corretor de fato importa, não a conversa do WhatsApp. Trocar essa palavra
confundiria duas ações diferentes.

## Trava pra não acontecer de novo

`tests/v1249-a-conversa-e-enviada-nunca-importada.test.mjs` falha de propósito se qualquer texto de
tela (fora de comentário de código) voltar a dizer "Importar conversa", "Importação descartada" ou
"Aguardando importação", e confere que os dois atalhos continuam com o ícone de enviar.

`tests/v866-ui-limpeza.test.mjs` foi atualizado: ele exigia o card **"Importar conversa"** no Menu e
agora exige **"Enviar conversa"**.

## Testes

`npm test` verde: 24 arquivos checados + **408 testes**. Conferência visual no Chromium sobre
`public/` em 390 px e 1280 px, com a tela de envio aberta — o texto novo aparece nos quatro lugares.

**Nota de processo:** na conferência da v1248 o servidor local que serve `public/` tinha caído e as
imagens lidas eram as da rodada anterior. Desta vez o servidor foi conferido antes (o número da
versão na página bate com o `displayVersion`) — vale como aviso pra quem for repetir a checagem
visual: confira a versão escrita na tela antes de acreditar no print.
