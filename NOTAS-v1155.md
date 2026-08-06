# v1155 — "antes baixava o app no botão instalar, agora não mais"

O dono apagou o app do celular, abriu o link de novo e o banner mostrou **"Como instalar"** em vez
de baixar de uma vez. Reação dele: *"errou no que funcionava bem e estragou"*.

## O que foi conferido antes de mexer em qualquer coisa

A v1154 **não** encostou no caminho que baixa o app (conferido no diff: ela só somou o botão pra
quem não recebeu o convite do navegador — o trecho que chama `prompt()` continua igual). Também
foram conferidos, um por um, os requisitos que o navegador exige pra oferecer instalação:

- `manifest.json` válido, com `id`, `start_url`, `scope`, `display: standalone` e ícones 192/512
  (`any` e `maskable`) — sem mudança desde a v1092;
- `service-worker.js` com `install`, `activate` e **`fetch`** (o `fetch` é obrigatório pro convite);
- captura antecipada do convite no `<head>` do `index.html` (`__deferredInstallPrompt`), intacta;
- CSP não bloqueia o manifest (`default-src 'self'`, mesmo domínio).

Ou seja: do lado do site está tudo de pé. O botão de **um toque só existe quando o navegador
dispara o convite** (`beforeinstallprompt`), e isso quem decide é o Chrome — nenhum site força.

## As três causas reais de "não baixa mais" — e o que a v1155 faz com cada uma

### 1. O app continua instalado no aparelho (a mais provável no caso do dono)

No Android, tirar o ícone da tela inicial **não desinstala** o app. O Chrome continua enxergando o
Corretor Pro como instalado e, por regra dele, nunca mais oferece baixar. Antes, a tela insistia em
ensinar a instalar o que já existia.

Agora o app **pergunta ao navegador** se já está instalado (`navigator.getInstalledRelatedApps()`,
habilitado pelo `related_applications` novo no manifest, apontando pro próprio manifest, com
`prefer_related_applications: false`) e, quando a resposta é sim:

- o botão do banner vira **"Onde está meu app"** (e o cartão do Menu junto), em vez de prometer
  download;
- o passo a passo abre numa tela nova explicando que o ícone está na **gaveta de apps** e que, pra
  instalar do zero, é preciso desinstalar de verdade em **Configurações → Apps → Corretor Pro**.

Navegador que não sabe responder (iPhone, por exemplo) simplesmente segue o fluxo antigo — a
checagem é silenciosa e não quebra nada.

### 2. O convite foi recusado uma vez e o rótulo continuava prometendo

O convite do navegador vale **um toque só**. Se a pessoa fechou a caixinha, o botão continuava
escrito "Baixar app" e não baixava mais nada naquela visita. Agora, convite recusado devolve o
rótulo honesto ("Como instalar") e o próximo toque abre o caminho pelo menu do navegador, que
sempre funciona.

### 3. O navegador simplesmente não convidou

Nesse caso o toque abre um **passo a passo ilustrado** (⋮ → "Instalar app" / "Adicionar à tela
inicial" → confirmar), com desenho de celular em cada etapa — Android com 3 passos, iPhone com 2
(Safari → Compartilhar → "Adicionar à Tela de Início"). Antes era uma linha de texto que passava
batida.

E quando o convite chega **depois** que a tela montou (é comum), o rótulo volta pra "Baixar app"
sozinho — a promessa só aparece quando é verdade.

## Arquivos

- `manifest.json` — `prefer_related_applications: false` + `related_applications` apontando pro
  próprio manifest (é o que libera a pergunta "já estou instalado?").
- `js/pwa-install.js` — checagem de app já instalado, rótulos honestos, abertura do passo a passo.
- `app.js` — `CP1155_PASSOS_ANDROID`, `CP1155_PASSOS_IOS`, `CP1155_PASSO_JA_INSTALADO` e
  `cpMostrarComoInstalar()`.
- `tests/v1154-oferta-de-instalar-sempre-aparece.test.mjs` — seções 3 e 4 novas.

## Conferência

- `npm test`: 24 arquivos + **324 testes**, todos verdes.
- Chromium headless (390×844, `public/` servido): banner visível, botão abre o passo a passo
  ilustrado (3 passos com desenho, sem erro de JS) e, simulando aparelho com o app já instalado, a
  primeira tela é a explicação certa ("O app já está neste celular"), cabendo inteira na tela.
