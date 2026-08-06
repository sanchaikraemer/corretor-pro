# v1157 — fechar fecha pra sempre; desinstalar traz a oferta de volta

Pedido do dono, palavra dele: *"quero que fechar feche pra sempre, a não ser que o app seja
desinstalado e quando entrar no link apareça novamente. Você não consegue organizar essa diferença
entre já instalado ou não?"*

Consegue. A v1156 tinha tirado o beco sem saída com prazo (7 dias). O prazo saiu — quem manda agora
é o **estado real do aparelho**.

## Como o app sabe se está instalado ou não

Três sinais, todos do próprio navegador:

| Sinal | Conclusão |
| --- | --- |
| Abriu em tela cheia, pelo ícone (sem barra de endereço) | **está instalado** |
| `navigator.getInstalledRelatedApps()` responde que sim (Android) | **está instalado** |
| O navegador ofereceu instalar (`beforeinstallprompt`) | **não está instalado** — ele só oferece quando o app não está no aparelho |

O app **anota** quando vê que está instalado (`direciona_app_estava_instalado`). Quando depois tem
certeza de que não está mais, a conclusão é uma só: **foi desinstalado**. Aí o "fechado" é apagado e
a oferta volta na abertura seguinte.

## O que acontece em cada caso (conferido na tela, um por um)

| Situação | Aviso na Hoje | Botão / Menu |
| --- | --- | --- |
| Corretor novo, nunca fechou | **aparece** | "Baixar app" (com convite) ou "Como instalar" |
| Fechou o aviso **e o app está no celular** | não aparece | "Onde está meu app" |
| Fechou o aviso **e desinstalou o app** | **aparece de novo** | "Baixar app" / "Como instalar" |
| Fechou o aviso e nunca instalou | não aparece | "Instalar app" no Menu |

Duas coisas de propósito:

- **Instalado não é hora de oferecer instalação.** Com o app no celular, o aviso sai da Hoje e o
  cartão do Menu passa a servir pra outra coisa: achar o ícone que sumiu da tela inicial.
- **"Não está instalado" sozinho não reabre nada.** Só reabre quando o app *estava* instalado antes
  — senão o "fechar" não serviria pra nada.

Navegador que não sabe responder (iPhone, por exemplo) segue com o que dá: fechar fecha, e o caminho
pelo Menu → "Instalar app" nunca sai da tela.

## Arquivos

- `js/pwa-install.js` — `anotarQueEstaInstalado()` / `anotarQueNaoEstaInstalado()`,
  `conviteDeInstalacaoChegou()` (os três caminhos de convite passam pela mesma porta),
  `conferirSeJaEstaInstalado()` tratando também a resposta "não está instalado", e o `appinstalled`
  e o modo tela cheia anotando o estado.
- `tests/v1157-fechar-e-pra-sempre-ate-desinstalar.test.mjs` — teste novo (substitui o da v1156, que
  travava a regra de 7 dias).

## Conferência

- `npm test`: 24 arquivos + **325 testes**, verdes. O teste **executa** a regra (com um
  `localStorage` de mentira) nos cinco casos, inclusive "um ano depois, com o app instalado,
  continua fechado" — que é exatamente o que a v1156 fazia errado.
- Chromium headless (390×844, `public/` servido), simulando a resposta do navegador sobre o app
  estar ou não instalado, nos quatro cenários da tabela acima: todos bateram, sem erro de JS.
